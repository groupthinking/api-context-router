# API Context Router

Smart router for documentation extraction with three paths:
1. **llms.txt** (fastest, if available)
2. **Official MCP** (native integration, if available)
3. **Universal Harvester** (fallback, always works)

## The Problem

When building apps, you face a research nightmare:
- AWS, GCP, Vercel each have hundreds of documentation pages
- AI agents take shortcuts: *"I think it works like this..."* (hallucination)
- Manual "Ctrl+A, Ctrl+C" from every page is soul-crushing
- No way to verify if an agent actually checked the docs

## The Solution

```
Developer Query: "How do I implement auth with Stripe?"
  ↓
Smart Router
  ↓
┌─────────────────────────────────────────┐
│ 1. Check llms.txt (instant)             │
│    ✓ Return compressed markdown         │
│    ✗ Continue...                        │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ 2. Check official MCP (native)          │
│    ✓ Use Google/AWS MCP server          │
│    ✗ Continue...                        │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ 3. Universal Harvester (fallback)       │
│    • Scout analyzes page structure      │
│    • LLM generates extraction schema    │
│    • Firecrawl extracts to JSON         │
│    • Return validated JSON              │
└─────────────────────────────────────────┘
  ↓
Output: Deterministic, validated JSON
```

## Installation

```bash
npm install -g api-context-router
```

Or use with npx:

```bash
npx api-context-router query "https://docs.stripe.com/api"
```

## Setup

Create a `.env` file:

```env
FIRECRAWL_API_KEY=your_firecrawl_key
OPENAI_API_KEY=your_openai_key
```

Get your API keys:
- [Firecrawl](https://firecrawl.dev)
- [OpenAI](https://platform.openai.com)

## Usage

### CLI

```bash
# Basic query
api-context-router query "https://docs.stripe.com/api"

# With specific intent
api-context-router query "https://docs.stripe.com/api" --intent "authentication"

# JSON output
api-context-router query "https://docs.stripe.com/api" --output json

# Check available methods for a URL
api-context-router check "https://docs.stripe.com/api"

# Cache management
api-context-router cache --stats
api-context-router cache --cleanup
api-context-router cache --clear
```

### Library

```typescript
import { SmartRouter } from 'api-context-router';

const router = new SmartRouter({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY
});

const result = await router.query({
  url: 'https://docs.stripe.com/api',
  intent: 'authentication'
});

console.log(result.data);
// {
//   platformName: 'Stripe',
//   authentication: {
//     type: 'Bearer token',
//     description: '...'
//   },
//   endpoints: [...],
//   ...
// }
```

## Output Format

```json
{
  "success": true,
  "data": {
    "platformName": "Stripe",
    "version": "2024-01-01",
    "authentication": {
      "type": "Bearer token",
      "description": "Authenticate via Authorization header"
    },
    "endpoints": [
      {
        "path": "/v1/customers",
        "method": "GET",
        "description": "List all customers",
        "parameters": [...],
        "rateLimit": "100/min"
      }
    ],
    "hardConstraints": [
      {
        "rule": "Maximum 100 items per page",
        "type": "hard"
      }
    ]
  },
  "source": "https://docs.stripe.com/api",
  "verifiedDate": "2026-03-11T12:00:00Z",
  "confidence": 0.92,
  "method": "harvester"
}
```

## How It Works

### The Three Paths

| Path | When Used | Speed |
|------|-----------|-------|
| **llms.txt** | If the site provides it | Instant |
| **Official MCP** | If there's a native MCP server | Native |
| **Universal Harvester** | Fallback for any URL | ~30s |

### Universal Harvester Architecture

```
Phase 1: Scout
  ↓ Analyze page structure
  ↓ Detect entities (endpoints, auth, rate limits)
  ↓ Generate extraction schema

Phase 2: Extract
  ↓ Firecrawl crawls documentation
  ↓ LLM extracts structured data
  ↓ Schema enforcement

Phase 3: Validate
  ↓ Zod validation
  ↓ Data fixing (attempt auto-repair)
  ↓ Return validated JSON
```

## Differentiation

| Solution | Requires | Your Project |
|----------|----------|--------------|
| Context7 | Pre-indexed libraries | Works with ANY URL |
| Official MCPs | Platform adoption | Works without adoption |
| GraphQL MCP | Existing GraphQL API | Creates from scratch |
| WebMCP | Website implementation | No implementation needed |
| **YOURS** | **Just a URL** | **✅ Zero prerequisites** |

## Cache

Results are cached in SQLite by default:
- Cache location: `./.api-context-router/cache.db`
- Default TTL: 24 hours
- Cache key: URL + intent

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in dev mode
npm run dev query "https://docs.example.com"

# Run tests
npm test
```

## Roadmap

- [ ] MCP client implementation for official servers
- [ ] Multimodal support (images, PDFs) via Gemini Embedding 2
- [ ] VS Code extension
- [ ] Web interface
- [ ] Custom schema definitions
- [ ] Batch processing

## License

MIT
