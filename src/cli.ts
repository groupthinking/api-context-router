#!/usr/bin/env node

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { SmartRouter } from './router.js';
import { DocumentationCache } from './cache.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('api-context-router')
  .description('Smart router for documentation extraction')
  .version('0.1.0');

program
  .command('query')
  .description('Query documentation and extract structured data')
  .argument('<url>', 'Documentation URL to query')
  .option('-i, --intent <intent>', 'Specific intent (e.g., "authentication", "rate-limits")')
  .option('-o, --output <format>', 'Output format (json, pretty)', 'pretty')
  .option('--no-cache', 'Skip cache lookup')
  .action(async (url: string, options) => {
    try {
      // Validate URL
      try {
        new URL(url);
      } catch {
        console.error(`❌ Invalid URL: ${url}`);
        process.exit(1);
      }

      // Check for required API keys
      const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY;

      if (!firecrawlApiKey || !openaiApiKey) {
        console.error('❌ Missing required environment variables:');
        if (!firecrawlApiKey) console.error('   - FIRECRAWL_API_KEY');
        if (!openaiApiKey) console.error('   - OPENAI_API_KEY');
        console.error('\nSet them in your .env file or environment.');
        process.exit(1);
      }

      // Initialize router
      const router = new SmartRouter({
        firecrawlApiKey,
        openaiApiKey,
        cacheEnabled: options.cache !== false
      });

      console.log(`\n🔍 Querying: ${url}`);
      if (options.intent) {
        console.log(`🎯 Intent: ${options.intent}`);
      }
      console.log('');

      // Execute query
      const result = await router.query({
        url,
        intent: options.intent
      });

      // Output result
      if (result.success) {
        console.log('\n✅ Extraction successful!\n');
        
        if (options.output === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('📊 Result:');
          console.log('─'.repeat(60));
          console.log(`Method: ${result.method}`);
          console.log(`Source: ${result.source}`);
          console.log(`Verified: ${result.verifiedDate}`);
          console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          console.log('─'.repeat(60));
          console.log('\n📄 Data:');
          console.log(JSON.stringify(result.data, null, 2));
        }
      } else {
        console.error('\n❌ Extraction failed!\n');
        console.error(`Error: ${result.error || 'Unknown error'}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Unexpected error:', error);
      process.exit(1);
    }
  });

program
  .command('cache')
  .description('Cache management commands')
  .option('-s, --stats', 'Show cache statistics')
  .option('-c, --clear', 'Clear all cache entries')
  .option('--cleanup', 'Remove expired entries only')
  .action(async (options) => {
    const cache = new DocumentationCache();

    if (options.stats) {
      const stats = cache.getStats();
      console.log('\n📊 Cache Statistics:');
      console.log(`   Total entries: ${stats.total}`);
      console.log(`   Expired entries: ${stats.expired}`);
      console.log(`   Valid entries: ${stats.total - stats.expired}`);
    }

    if (options.cleanup) {
      const removed = cache.cleanup();
      console.log(`\n🧹 Cleaned up ${removed} expired entries`);
    }

    if (options.clear) {
      cache.clear();
      console.log('\n🗑️  Cache cleared');
    }

    if (!options.stats && !options.clear && !options.cleanup) {
      console.log('Use --stats, --clear, or --cleanup');
    }

    cache.close();
  });

program
  .command('check')
  .description('Check what extraction methods are available for a URL')
  .argument('<url>', 'URL to check')
  .action(async (url: string) => {
    try {
      new URL(url);
    } catch {
      console.error(`❌ Invalid URL: ${url}`);
      process.exit(1);
    }

    console.log(`\n🔍 Checking extraction methods for: ${url}\n`);

      // Check llms.txt
    console.log('📋 Checking llms.txt...');
    const urlObj = new URL(url);
    const llmsUrl = `${urlObj.protocol}//${urlObj.host}/llms.txt`;
    
    try {
      const response = await fetch(llmsUrl, { 
        method: 'HEAD',
        headers: { 'Accept': 'text/plain' }
      });
      if (response.ok) {
        console.log('   ✅ llms.txt is available');
      } else {
        console.log('   ❌ llms.txt not found');
      }
    } catch {
      console.log('   ❌ llms.txt not accessible');
    }

    // Check MCP servers
    console.log('\n🔌 Checking MCP servers...');
    console.log('   ⚠️  MCP client not yet implemented');

    // Check Harvester availability
    console.log('\n🚜 Checking Universal Harvester...');
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (firecrawlKey && openaiKey) {
      console.log('   ✅ Harvester available (FIRECRAWL_API_KEY + OPENAI_API_KEY set)');
    } else {
      console.log('   ❌ Harvester not available');
      if (!firecrawlKey) console.log('      - Missing FIRECRAWL_API_KEY');
      if (!openaiKey) console.log('      - Missing OPENAI_API_KEY');
    }

    console.log('\n📊 Summary:');
    console.log('   The router will try methods in this order:');
    console.log('   1. llms.txt (fastest)');
    console.log('   2. Official MCP (native)');
    console.log('   3. Universal Harvester (fallback)');
  });

program.parse();
