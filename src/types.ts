import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export interface DocumentationQuery {
  url: string;
  intent?: string; // e.g., "authentication", "rate limits", "pricing"
  schema?: z.ZodSchema; // Optional predefined schema
}

export interface ExtractionResult {
  success: boolean;
  data: unknown;
  source: string;
  verifiedDate: string;
  confidence: number;
  method: 'llms.txt' | 'mcp' | 'harvester' | 'error';
  schema?: string; // The schema used for extraction
  error?: string;
}

export interface CacheEntry {
  url: string;
  data: string;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// Scout Types
// ============================================================================

export interface ScoutAnalysis {
  pageType: 'api-docs' | 'guide' | 'reference' | 'tutorial' | 'unknown';
  detectedEntities: string[];
  suggestedSchema: Record<string, unknown>;
  confidence: number;
}

// ============================================================================
// Harvester Types
// ============================================================================

export interface HarvesterConfig {
  firecrawlApiKey: string;
  openaiApiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface HarvesterOptions {
  url: string;
  schema?: z.ZodSchema;
  intent?: string;
  maxPages?: number;
}

// ============================================================================
// Router Types
// ============================================================================

export type ExtractionMethod = 'llms.txt' | 'mcp' | 'harvester' | 'none';

export interface RouterConfig {
  // API Keys
  firecrawlApiKey?: string;
  openaiApiKey?: string;
  
  // Cache settings
  cacheEnabled?: boolean;
  cacheTtl?: number; // seconds
  cachePath?: string;
  
  // MCP settings
  mcpServers?: MCPServerConfig[];
  
  // Harvester settings
  defaultModel?: string;
  maxPagesPerCrawl?: number;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  supportedUrls?: string[]; // URL patterns this server can handle
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// Zod Schemas for Common Documentation Patterns
// ============================================================================

export const APIEndpointSchema = z.object({
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
  description: z.string().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string().optional()
  })).optional(),
  headers: z.array(z.string()).optional(),
  rateLimit: z.string().optional(),
  codeExample: z.string().optional()
});

export const APIConstraintSchema = z.object({
  rule: z.string(),
  type: z.enum(['hard', 'soft', 'recommended']),
  context: z.string().optional()
});

export const PlatformDocumentationSchema = z.object({
  platformName: z.string(),
  version: z.string().optional(),
  endpoints: z.array(APIEndpointSchema).optional(),
  dependencies: z.array(z.string()).optional(),
  hardConstraints: z.array(APIConstraintSchema).optional(),
  authentication: z.object({
    type: z.string(),
    description: z.string().optional()
  }).optional(),
  pricing: z.object({
    model: z.string().optional(),
    freeTier: z.string().optional(),
    paidTiers: z.array(z.string()).optional()
  }).optional()
});

export type APIEndpoint = z.infer<typeof APIEndpointSchema>;
export type APIConstraint = z.infer<typeof APIConstraintSchema>;
export type PlatformDocumentation = z.infer<typeof PlatformDocumentationSchema>;
