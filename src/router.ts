import { z } from 'zod';
import fetch from 'node-fetch';
import { UniversalHarvester } from './harvester.js';
import { DocumentationCache } from './cache.js';
import {
  DocumentationQuery,
  ExtractionResult,
  RouterConfig,
  ExtractionMethod
} from './types.js';

/**
 * Smart Router: Picks the optimal extraction method
 * 
 * Priority:
 * 1. llms.txt (fastest, if available)
 * 2. Official MCP (native integration, if available)
 * 3. Universal Harvester (fallback, always works)
 */
export class SmartRouter {
  private config: RouterConfig;
  private harvester: UniversalHarvester | null = null;
  private cache: DocumentationCache | null = null;

  constructor(config: RouterConfig = {}) {
    this.config = config;
    
    // Initialize cache if enabled
    if (config.cacheEnabled !== false) {
      this.cache = new DocumentationCache(config);
    }

    // Initialize harvester if API keys provided
    if (config.firecrawlApiKey && config.openaiApiKey) {
      this.harvester = new UniversalHarvester({
        firecrawlApiKey: config.firecrawlApiKey,
        openaiApiKey: config.openaiApiKey,
        model: config.defaultModel || 'gpt-4o-mini'
      });
    }
  }

  /**
   * Main query method - routes to optimal extraction method
   */
  async query(query: DocumentationQuery): Promise<ExtractionResult> {
    const { url, intent, schema } = query;

    console.log(`\n🌐 [Router] Processing query for: ${url}`);
    if (intent) {
      console.log(`🎯 Intent: ${intent}`);
    }

    // Step 0: Check cache
    if (this.cache) {
      const cached = this.cache.get(url, intent);
      if (cached) {
        console.log(`💾 [Cache] Hit! Returning cached data`);
        return {
          success: true,
          data: JSON.parse(cached.data),
          source: url,
          verifiedDate: new Date(cached.timestamp).toISOString(),
          confidence: 1,
          method: 'harvester' // Could store method in cache too
        };
      }
    }

    // Step 1: Try llms.txt (fastest)
    console.log(`\n📋 Step 1: Checking for llms.txt...`);
    const llmsResult = await this.tryLlmsTxt(url);
    if (llmsResult.success) {
      this.cacheResult(url, llmsResult, intent);
      return llmsResult;
    }

    // Step 2: Try official MCP (native integration)
    console.log(`\n🔌 Step 2: Checking for official MCP...`);
    const mcpResult = await this.tryMCP(url, intent);
    if (mcpResult.success) {
      this.cacheResult(url, mcpResult, intent);
      return mcpResult;
    }

    // Step 3: Universal Harvester (fallback, always works)
    console.log(`\n🚜 Step 3: Using Universal Harvester...`);
    if (!this.harvester) {
      return {
        success: false,
        data: null,
        source: url,
        verifiedDate: new Date().toISOString(),
        confidence: 0,
        method: 'error',
        error: 'Harvester not initialized. Provide firecrawlApiKey and openaiApiKey.'
      };
    }

    const harvesterResult = await this.harvester.extract({
      url,
      intent,
      schema
    });

    if (harvesterResult.success) {
      this.cacheResult(url, harvesterResult, intent);
    }

    return harvesterResult;
  }

  /**
   * Try to fetch llms.txt for the URL
   */
  private async tryLlmsTxt(url: string): Promise<ExtractionResult> {
    try {
      const urlObj = new URL(url);
      const llmsUrl = `${urlObj.protocol}//${urlObj.host}/llms.txt`;
      const llmsFullUrl = `${urlObj.protocol}//${urlObj.host}/llms-full.txt`;

      // Try llms.txt first
      let response = await fetch(llmsUrl, {
        headers: { 'Accept': 'text/plain, */*' },
        timeout: 5000
      } as any);

      // Try llms-full.txt if llms.txt fails
      if (!response.ok) {
        response = await fetch(llmsFullUrl, {
          headers: { 'Accept': 'text/plain, */*' },
          timeout: 5000
        } as any);
      }

      if (!response.ok) {
        console.log(`   ❌ No llms.txt found`);
        return {
          success: false,
          data: null,
          source: url,
          verifiedDate: new Date().toISOString(),
          confidence: 0,
          method: 'llms.txt',
          error: 'llms.txt not found'
        };
      }

      const content = await response.text();
      
      if (!content || content.length < 100) {
        console.log(`   ⚠️ llms.txt found but content too short`);
        return {
          success: false,
          data: null,
          source: url,
          verifiedDate: new Date().toISOString(),
          confidence: 0,
          method: 'llms.txt',
          error: 'llms.txt content insufficient'
        };
      }

      console.log(`   ✅ llms.txt found! (${content.length} chars)`);

      // Parse llms.txt content into structured format
      const parsed = this.parseLlmsTxt(content, url);

      return {
        success: true,
        data: parsed,
        source: llmsUrl,
        verifiedDate: new Date().toISOString(),
        confidence: 0.95,
        method: 'llms.txt'
      };
    } catch (error) {
      console.log(`   ❌ Error checking llms.txt: ${error}`);
      return {
        success: false,
        data: null,
        source: url,
        verifiedDate: new Date().toISOString(),
        confidence: 0,
        method: 'llms.txt',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse llms.txt content into structured format
   */
  private parseLlmsTxt(content: string, sourceUrl: string): Record<string, unknown> {
    const lines = content.split('\n');
    const result: Record<string, unknown> = {
      platformName: this.extractPlatformName(sourceUrl),
      source: 'llms.txt',
      sections: []
    };

    let currentSection: { title: string; content: string[] } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;

      // Section header (## or #)
      if (trimmed.startsWith('# ')) {
        if (currentSection) {
          (result.sections as Array<{ title: string; content: string[] }>).push(currentSection);
        }
        currentSection = {
          title: trimmed.replace('# ', ''),
          content: []
        };
      } else if (trimmed.startsWith('## ')) {
        if (currentSection) {
          (result.sections as Array<{ title: string; content: string[] }>).push(currentSection);
        }
        currentSection = {
          title: trimmed.replace('## ', ''),
          content: []
        };
      } else if (currentSection) {
        currentSection.content.push(trimmed);
      }
    }

    // Add final section
    if (currentSection) {
      (result.sections as Array<{ title: string; content: string[] }>).push(currentSection);
    }

    // Extract key information
    result.rawContent = content;
    result.extractedAt = new Date().toISOString();

    return result;
  }

  /**
   * Try to use official MCP server for the URL
   */
  private async tryMCP(url: string, intent?: string): Promise<ExtractionResult> {
    // Check if we have configured MCP servers
    if (!this.config.mcpServers || this.config.mcpServers.length === 0) {
      console.log(`   ❌ No MCP servers configured`);
      return {
        success: false,
        data: null,
        source: url,
        verifiedDate: new Date().toISOString(),
        confidence: 0,
        method: 'mcp',
        error: 'No MCP servers configured'
      };
    }

    // Find matching MCP server for URL
    const matchingServer = this.config.mcpServers.find(server => {
      if (!server.supportedUrls) return false;
      return server.supportedUrls.some(pattern => {
        // Simple pattern matching (could be improved with regex)
        return url.includes(pattern.replace('*', ''));
      });
    });

    if (!matchingServer) {
      console.log(`   ❌ No matching MCP server for this URL`);
      return {
        success: false,
        data: null,
        source: url,
        verifiedDate: new Date().toISOString(),
        confidence: 0,
        method: 'mcp',
        error: 'No matching MCP server'
      };
    }

    console.log(`   🔌 Found matching MCP server: ${matchingServer.name}`);

    // TODO: Implement actual MCP client connection
    // This would require @modelcontextprotocol/sdk client implementation
    // For now, return not implemented
    console.log(`   ⚠️ MCP client not yet implemented`);
    return {
      success: false,
      data: null,
      source: url,
      verifiedDate: new Date().toISOString(),
      confidence: 0,
      method: 'mcp',
      error: 'MCP client not yet implemented'
    };
  }

  /**
   * Extract platform name from URL
   */
  private extractPlatformName(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Remove common suffixes
      const name = hostname
        .replace(/^www\./, '')
        .replace(/\.com$/, '')
        .replace(/\.io$/, '')
        .replace(/\.dev$/, '')
        .replace(/\.org$/, '')
        .replace(/-docs$/, '')
        .replace(/^docs\./, '');
      
      // Capitalize first letter of each segment
      return name
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    } catch {
      return 'Unknown Platform';
    }
  }

  /**
   * Cache the extraction result
   */
  private cacheResult(
    url: string,
    result: ExtractionResult,
    intent?: string
  ): void {
    if (this.cache && result.success) {
      this.cache.set(url, result.data, result.method, intent);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { total: number; expired: number } | null {
    if (!this.cache) return null;
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): number {
    if (!this.cache) return 0;
    return this.cache.cleanup();
  }
}
