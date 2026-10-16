import {Ad, Article} from './data';
export type FeedItem = {kind: 'article'; id: string; data: Article} | {kind: 'ad'; id: string; data: Ad};
/** Sequence against the complete loaded story list so page boundaries never reset the rhythm. */
export function sequenceFeed(stories: Article[], adInventory: Ad[], pageSize = 6, storyOffset = 0): FeedItem[] {
  const result: FeedItem[] = [];
  let ad = Math.floor(storyOffset / 2);
  stories.forEach((story, index) => {
    result.push({kind: 'article', id: story.id, data: story});
    if ((storyOffset + index + 1) % 2 === 0 && adInventory.length) {
      const item = adInventory[ad % adInventory.length];
      if (!result.some(entry => entry.kind === 'ad' && entry.id === item.id)) result.push({kind: 'ad', id: item.id, data: item});
      ad++;
    }
  });
  return result.slice(0, pageSize);
}

/** Home owns the lead card, so the stream starts at article index one. */
export function homeFeed(articles: Article[], adInventory: Ad[], pageSize = Number.POSITIVE_INFINITY): FeedItem[] {
  return sequenceFeed(articles.slice(1), adInventory, pageSize, 1);
}
