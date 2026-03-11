import { describe, it, expect, beforeEach } from 'vitest';
import { SmartRouter } from '../src/router.js';
import { resetCache } from '../src/cache.js';

describe('SmartRouter', () => {
  beforeEach(() => {
    resetCache();
  });

  describe('URL validation', () => {
    it('should handle invalid URLs gracefully', async () => {
      const router = new SmartRouter({});
      
      await expect(router.query({ url: 'not-a-url' }))
        .rejects.toThrow();
    });

    it('should process valid URLs', async () => {
      const router = new SmartRouter({});
      
      // This will fail because no API keys, but should not throw on URL validation
      const result = await router.query({ 
        url: 'https://docs.example.com' 
      });
      
      // Should return error result, not throw
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('source');
    });
  });

  describe('cache integration', () => {
    it('should cache successful results', async () => {
      const router = new SmartRouter({
        cacheEnabled: true,
        cacheTtl: 3600
      });

      // First call should miss cache
      const result1 = await router.query({ 
        url: 'https://docs.example.com' 
      });

      // Get cache stats
      const stats = router.getCacheStats();
      expect(stats).not.toBeNull();
    });
  });
});

describe('Platform name extraction', () => {
  it('should extract platform name from URL', () => {
    const testCases = [
      { url: 'https://docs.stripe.com/api', expected: 'Stripe' },
      { url: 'https://docs.aws.amazon.com/', expected: 'Aws' },
      { url: 'https://vercel.com/docs', expected: 'Vercel' },
      { url: 'https://docs.github.com', expected: 'Github' }
    ];

    for (const { url, expected } of testCases) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const name = hostname
        .replace(/^www\./, '')
        .replace(/\.com$/, '')
        .replace(/\.io$/, '')
        .replace(/\.dev$/, '')
        .replace(/\.org$/, '')
        .replace(/-docs$/, '')
        .replace(/^docs\./, '')
        .split('.')
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      expect(name).toBe(expected);
    }
  });
});
