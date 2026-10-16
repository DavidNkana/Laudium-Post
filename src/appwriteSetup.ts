export type AppwriteIndex = {key: string; type: 'key' | 'fulltext'; attributes: string[]};

/** Keep this manifest in lockstep with docs/appwrite-schema.json. Query.search requires fulltext indexes. */
export const requiredPublicIndexes: AppwriteIndex[] = [
  {key: 'articles_title_search', type: 'fulltext', attributes: ['title']},
  {key: 'articles_excerpt_search', type: 'fulltext', attributes: ['excerpt']},
  {key: 'ads_business_search', type: 'fulltext', attributes: ['business']},
  {key: 'ads_title_search', type: 'fulltext', attributes: ['title']},
  {key: 'ads_category_search', type: 'fulltext', attributes: ['category']},
];

export function verifySearchIndexes(indexes: AppwriteIndex[]) {
  const available = new Set(indexes.map(index => `${index.type}:${index.attributes.join(',')}`));
  return requiredPublicIndexes.every(index => available.has(`${index.type}:${index.attributes.join(',')}`));
}
