/**
 * API Context Router
 * 
 * Smart router for documentation extraction with three paths:
 * 1. llms.txt (fastest)
 * 2. Official MCP (native integration)
 * 3. Universal Harvester (fallback)
 * 
 * @example
 * ```typescript
 * import { SmartRouter } from 'api-context-router';
 * 
 * const router = new SmartRouter({
 *   firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
 *   openaiApiKey: process.env.OPENAI_API_KEY
 * });
 * 
 * const result = await router.query({
 *   url: 'https://docs.stripe.com/api',
 *   intent: 'authentication'
 * });
 * 
 * console.log(result.data);
 * ```
 */

export { SmartRouter } from './router.js';
export { UniversalHarvester } from './harvester.js';
export { Scout } from './scout.js';
export { DocumentationCache } from './cache.js';

// Types
export type {
  DocumentationQuery,
  ExtractionResult,
  RouterConfig,
  HarvesterConfig,
  HarvesterOptions,
  ScoutAnalysis,
  CacheEntry,
  ExtractionMethod,
  MCPServerConfig,
  ValidationResult,
  APIEndpoint,
  APIConstraint,
  PlatformDocumentation
} from './types.js';

// Zod schemas
export {
  APIEndpointSchema,
  APIConstraintSchema,
  PlatformDocumentationSchema
} from './types.js';
