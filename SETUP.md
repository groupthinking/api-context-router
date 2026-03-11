# Setup Guide

## 1. Create GitHub Repository

### Option A: Using GitHub CLI (Recommended)

```bash
# Install GitHub CLI if you haven't
# https://cli.github.com/

# Login to GitHub
gh auth login

# Create the repository
gh repo create api-context-router --public --description "Smart router for documentation extraction"

# Push the code
git init
git add .
git commit -m "Initial commit: API Context Router MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/api-context-router.git
git push -u origin main
```

### Option B: Manual Setup

1. Go to https://github.com/new
2. Name: `api-context-router`
3. Description: `Smart router for documentation extraction`
4. Make it Public
5. Don't initialize with README (we already have one)
6. Create repository

Then run:

```bash
git init
git add .
git commit -m "Initial commit: API Context Router MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/api-context-router.git
git push -u origin main
```

## 2. Environment Setup

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your API keys
# Get Firecrawl key: https://firecrawl.dev
# Get OpenAI key: https://platform.openai.com
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Build

```bash
npm run build
```

## 5. Test

```bash
# Run tests
npm test

# Run CLI in dev mode
npm run dev query "https://docs.stripe.com/api"
```

## 6. Publish to npm (Optional)

```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

## Project Structure

```
api-context-router/
├── src/
│   ├── index.ts          # Main exports
│   ├── cli.ts            # CLI interface
│   ├── router.ts         # Smart router logic
│   ├── harvester.ts      # Universal Harvester
│   ├── scout.ts          # Scout phase
│   ├── cache.ts          # SQLite caching
│   └── types.ts          # TypeScript types
├── tests/
│   └── router.test.ts    # Tests
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── LICENSE
├── .env.example
└── .gitignore
```

## Next Steps

1. ✅ Create GitHub repo
2. ✅ Set up environment variables
3. ✅ Install dependencies
4. ✅ Build and test
5. 🔄 Implement MCP client (Phase 2)
6. 🔄 Add multimodal support (Phase 3)
7. 🔄 Publish to npm

## API Keys Needed

| Service | URL | Used For |
|---------|-----|----------|
| Firecrawl | https://firecrawl.dev | Web scraping |
| OpenAI | https://platform.openai.com | Schema generation |

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Cache Issues

```bash
# Clear cache
npm run dev cache -- --clear
```

### Type Errors

```bash
# Run type check
npm run typecheck
```
