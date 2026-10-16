import {describe, expect, it} from 'vitest';
import {AppwriteContentAdapter, DemoContentAdapter} from '../src/adapter';

describe('content adapter configuration', () => {
  it('fails loudly instead of returning demo fixtures when Appwrite is unconfigured', () => {
    expect(() => new AppwriteContentAdapter()).toThrow(/configuration is missing/);
  });
  it('keeps demo pagination explicit and local', async () => {
    const result = await new DemoContentAdapter().listArticles('', '', {limit: 1});
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.items[0].status).toBe('Published');
  });
});
