import OpenAI from 'openai';
import { ScoutAnalysis } from './types.js';

/**
 * Scout Phase: Analyzes documentation structure and generates extraction schema
 */
export class Scout {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Analyze documentation page content to determine structure
   */
  async analyzePage(markdown: string, url: string): Promise<ScoutAnalysis> {
    const prompt = `
You are a Documentation Structure Analyzer. Your task is to analyze the following documentation page
and identify its structure, entities, and the best schema for extracting structured data.

URL: ${url}

Documentation Content (first 8000 chars):
${markdown.slice(0, 8000)}

Analyze this documentation and provide:
1. Page type (api-docs, guide, reference, tutorial, or unknown)
2. Key entities detected (e.g., "endpoints", "authentication", "rate limits", "pricing")
3. A suggested JSON schema structure for extracting the most important information

Respond in this exact JSON format:
{
  "pageType": "api-docs",
  "detectedEntities": ["endpoints", "authentication", "rate limits"],
  "suggestedSchema": {
    "platformName": "string",
    "endpoints": [{"path": "string", "method": "string"}],
    "authentication": {"type": "string"}
  },
  "confidence": 0.85
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a precise documentation analyzer. Always respond with valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const analysis = JSON.parse(content) as ScoutAnalysis;
      return analysis;
    } catch (error) {
      console.error('Scout analysis failed:', error);
      return {
        pageType: 'unknown',
        detectedEntities: [],
        suggestedSchema: {},
        confidence: 0
      };
    }
  }

  /**
   * Generate a Zod-compatible schema definition from analysis
   */
  generateSchemaDefinition(analysis: ScoutAnalysis): Record<string, unknown> {
    // Base schema for API documentation
    const baseSchema = {
      platformName: { type: 'string', description: 'Name of the platform/service' },
      version: { type: 'string', optional: true, description: 'API version' },
      endpoints: {
        type: 'array',
        items: {
          path: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
          description: { type: 'string', optional: true },
          parameters: {
            type: 'array',
            optional: true,
            items: {
              name: { type: 'string' },
              type: { type: 'string' },
              required: { type: 'boolean' },
              description: { type: 'string', optional: true }
            }
          },
          headers: { type: 'array', items: { type: 'string' }, optional: true },
          rateLimit: { type: 'string', optional: true },
          codeExample: { type: 'string', optional: true }
        }
      },
      authentication: {
        type: 'object',
        optional: true,
        properties: {
          type: { type: 'string' },
          description: { type: 'string', optional: true }
        }
      },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Required SDKs or packages'
      },
      hardConstraints: {
        type: 'array',
        items: {
          rule: { type: 'string' },
          type: { type: 'string', enum: ['hard', 'soft', 'recommended'] },
          context: { type: 'string', optional: true }
        },
        optional: true,
        description: 'Explicit rules and limitations'
      },
      pricing: {
        type: 'object',
        optional: true,
        properties: {
          model: { type: 'string', optional: true },
          freeTier: { type: 'string', optional: true },
          paidTiers: { type: 'array', items: { type: 'string' }, optional: true }
        }
      }
    };

    // Merge with detected entities
    const mergedSchema = { ...baseSchema };
    
    for (const entity of analysis.detectedEntities) {
      if (!mergedSchema[entity as keyof typeof mergedSchema]) {
        mergedSchema[entity as keyof typeof mergedSchema] = {
          type: 'string',
          optional: true,
          description: `Detected entity: ${entity}`
        };
      }
    }

    return mergedSchema;
  }

  /**
   * Convert schema definition to Firecrawl-compatible extraction prompt
   */
  toExtractionPrompt(schema: Record<string, unknown>): string {
    return `
Extract structured information from this documentation page.

Focus on these key areas:
${Object.entries(schema)
  .filter(([key]) => !key.startsWith('_'))
  .map(([key, value]) => `- ${key}: ${(value as { description?: string }).description || key}`)
  .join('\n')}

Instructions:
- Extract ONLY factual information present in the documentation
- Do not make assumptions or infer missing data
- Use exact values from the docs (e.g., rate limits, endpoint paths)
- Include code examples if available
- Mark fields as null if information is not found
- Be precise with technical details

Return valid JSON matching the expected schema.
`;
  }
}
