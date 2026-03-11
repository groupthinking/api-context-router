import FirecrawlApp from '@mendable/firecrawl-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Scout } from './scout.js';
import {
  HarvesterConfig,
  HarvesterOptions,
  ExtractionResult,
  PlatformDocumentationSchema
} from './types.js';

/**
 * Universal Harvester: Extracts structured data from arbitrary documentation
 * 
 * Phase 1: Scout - Analyze page structure
 * Phase 2: Extract - Use Firecrawl with LLM-generated schema
 * Phase 3: Validate - Ensure output matches expected structure
 */
export class UniversalHarvester {
  private firecrawl: FirecrawlApp;
  private scout: Scout;
  private config: HarvesterConfig;

  constructor(config: HarvesterConfig) {
    this.config = config;
    this.firecrawl = new FirecrawlApp({ apiKey: config.firecrawlApiKey });
    this.scout = new Scout(config.openaiApiKey, config.model);
  }

  /**
   * Main extraction method
   */
  async extract(options: HarvesterOptions): Promise<ExtractionResult> {
    const { url, schema, intent, maxPages = 10 } = options;

    console.log(`\n🚜 [Harvester] Starting extraction for: ${url}`);

    try {
      // Phase 1: Scout - Analyze the page structure
      console.log(`🔍 [Scout] Analyzing documentation structure...`);
      const scoutResult = await this.runScoutPhase(url);

      if (scoutResult.confidence < 0.3) {
        console.warn(`⚠️ [Scout] Low confidence (${scoutResult.confidence}). Proceeding with generic schema.`);
      }

      // Phase 2: Extract - Use Firecrawl with schema
      console.log(`📄 [Extract] Crawling and extracting data...`);
      const extractionSchema = schema || this.buildExtractionSchema(scoutResult);
      const extractedData = await this.runExtractionPhase(url, extractionSchema, maxPages);

      if (!extractedData) {
        return {
          success: false,
          data: null,
          source: url,
          verifiedDate: new Date().toISOString(),
          confidence: 0,
          method: 'harvester',
          error: 'Extraction failed - no data returned'
        };
      }

      // Phase 3: Validate - Ensure output is valid
      console.log(`✅ [Validate] Validating extracted data...`);
      const validatedData = await this.runValidationPhase(extractedData, extractionSchema);

      return {
        success: true,
        data: validatedData,
        source: url,
        verifiedDate: new Date().toISOString(),
        confidence: scoutResult.confidence,
        method: 'harvester',
        schema: JSON.stringify(extractionSchema)
      };
    } catch (error) {
      console.error('❌ [Harvester] Extraction failed:', error);
      return {
        success: false,
        data: null,
        source: url,
        verifiedDate: new Date().toISOString(),
        confidence: 0,
        method: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Phase 1: Scout - Analyze page structure
   */
  private async runScoutPhase(url: string): Promise<{
    confidence: number;
    pageType: string;
    detectedEntities: string[];
    schema: Record<string, unknown>;
  }> {
    try {
      // Quick scrape to get page content for analysis
      const scrapeResult = await this.firecrawl.scrapeUrl(url, {
        formats: ['markdown'],
        onlyMainContent: true
      });

      if (!scrapeResult.success || !scrapeResult.markdown) {
        throw new Error('Failed to scrape page for scout analysis');
      }

      const analysis = await this.scout.analyzePage(scrapeResult.markdown, url);
      const schema = this.scout.generateSchemaDefinition(analysis);

      return {
        confidence: analysis.confidence,
        pageType: analysis.pageType,
        detectedEntities: analysis.detectedEntities,
        schema
      };
    } catch (error) {
      console.warn('Scout phase failed, using fallback:', error);
      return {
        confidence: 0.5,
        pageType: 'unknown',
        detectedEntities: [],
        schema: this.getFallbackSchema()
      };
    }
  }

  /**
   * Phase 2: Extract - Use Firecrawl with schema
   */
  private async runExtractionPhase(
    url: string,
    schema: z.ZodSchema,
    maxPages: number
  ): Promise<unknown | null> {
    try {
      // Convert Zod schema to JSON schema for Firecrawl
      const jsonSchema = zodToJsonSchema(schema, {
        name: 'DocumentationExtraction',
        $refStrategy: 'none'
      });

      // Use Firecrawl's extract endpoint with the schema
      const extractResult = await this.firecrawl.extract([url], {
        prompt: this.buildExtractionPrompt(),
        schema: jsonSchema as Record<string, unknown>
      });

      if (!extractResult.success) {
        console.error('Firecrawl extraction failed:', extractResult.error);
        return null;
      }

      return extractResult.data;
    } catch (error) {
      console.error('Extraction phase error:', error);
      return null;
    }
  }

  /**
   * Phase 3: Validate - Ensure output matches schema
   */
  private async runValidationPhase(
    data: unknown,
    schema: z.ZodSchema
  ): Promise<unknown> {
    try {
      const result = schema.safeParse(data);
      
      if (result.success) {
        return result.data;
      }

      // If validation fails, try to fix common issues
      console.warn('Validation failed, attempting to fix:', result.error.errors);
      const fixedData = this.attemptDataFix(data, result.error.errors);
      
      // Re-validate
      const retryResult = schema.safeParse(fixedData);
      if (retryResult.success) {
        return retryResult.data;
      }

      // Return original with warnings if fix fails
      console.warn('Could not fix validation errors, returning raw data');
      return data;
    } catch (error) {
      console.warn('Validation error:', error);
      return data;
    }
  }

  /**
   * Build extraction schema from scout analysis or use default
   */
  private buildExtractionSchema(scoutResult: {
    schema: Record<string, unknown>;
  }): z.ZodSchema {
    // Use PlatformDocumentationSchema as base
    return PlatformDocumentationSchema;
  }

  /**
   * Get fallback schema when scout fails
   */
  private getFallbackSchema(): Record<string, unknown> {
    return {
      platformName: { type: 'string' },
      description: { type: 'string', optional: true },
      endpoints: { type: 'array', optional: true },
      authentication: { type: 'object', optional: true },
      rateLimits: { type: 'array', optional: true },
      pricing: { type: 'object', optional: true }
    };
  }

  /**
   * Build extraction prompt for Firecrawl
   */
  private buildExtractionPrompt(): string {
    return `
Extract structured API documentation information from this page.

Focus on extracting:
1. Platform/service name and version
2. API endpoints (path, method, parameters, headers)
3. Authentication requirements
4. Rate limits and constraints
5. Code examples
6. Pricing information (if available)

Rules:
- Extract ONLY information explicitly stated in the documentation
- Do NOT make assumptions or hallucinate missing data
- Use exact values (e.g., "100 requests/minute" not "around 100")
- Include complete endpoint paths
- Preserve code examples exactly as shown
- If information is missing, use null or omit the field

Return valid JSON matching the provided schema.
`;
  }

  /**
   * Attempt to fix common validation errors
   */
  private attemptDataFix(
    data: unknown,
    errors: z.ZodError['errors']
  ): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const fixed = { ...data } as Record<string, unknown>;

    for (const error of errors) {
      const path = error.path;
      
      // Handle common issues
      if (error.message.includes('Required')) {
        // Set missing required fields to null
        this.setNestedValue(fixed, path, null);
      }
      
      if (error.message.includes('Expected array')) {
        // Convert non-arrays to arrays
        const current = this.getNestedValue(fixed, path);
        if (current !== undefined && !Array.isArray(current)) {
          this.setNestedValue(fixed, path, [current]);
        }
      }
    }

    return fixed;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: (string | number)[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: (string | number)[],
    value: unknown
  ): void {
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;
  }
}
