import {describe, expect, it, vi} from 'vitest';
import {track} from '../src/analytics';

describe('analytics seam', () => {
  it('emits the advertiser conversion event to the durable endpoint when configured', async () => {
    const listener = vi.fn();
    window.addEventListener('laudium:analytics', listener);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    track('advertise_cta_clicked', {path: 'directory'});
    expect(listener).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
    window.removeEventListener('laudium:analytics', listener);
  });
});
