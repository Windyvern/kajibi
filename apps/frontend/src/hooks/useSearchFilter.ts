import { Story } from '@/types/story';

export interface SearchResults {
  filtered: Story[];
  matchedPanelByStory: Record<string, string | undefined>;
  strongMatchStoryId?: string;
  scores: Record<string, number>;
}

export function normalize(str?: string) {
  return (str || '').toLowerCase();
}

export type SearchFields = {
  title?: boolean;
  username?: boolean;
  address?: boolean;
  description?: boolean;
  images?: boolean; // alt/caption
};

export function useSearchFilter(
  stories: Story[] | undefined,
  q: string | null,
  fields: SearchFields = { title: true, username: true, address: true, description: true, images: true }
): SearchResults {
  if (!stories || !q) return { filtered: stories || [], matchedPanelByStory: {}, scores: {} };
  const query = normalize(q);
  const matchedPanelByStory: Record<string, string | undefined> = {};
  let strongMatchStoryId: string | undefined;
  const scores: Record<string, number> = {};

  const keep: Story[] = [];
  for (const s of stories) {
    const title = normalize(s.title);
    const username = normalize(s.username || s.author);
    const address = normalize(s.address);
    const desc = normalize(s.description);

    const titleHit = fields.title && title.includes(query);
    const userHit = fields.username && username.includes(query);
    const titleUserHit = titleHit || userHit;
    const addrHit = fields.address && address.includes(query);
    // If searching an @username, ignore matches from description/image descriptions
    const isAtQuery = query.startsWith('@');
    const descHit = fields.description && !isAtQuery && desc.includes(query);

    let panelHitId: string | undefined;
    if (!titleUserHit && !addrHit && !descHit && fields.images && !isAtQuery) {
      for (const p of s.panels) {
        const alt = normalize(p.altText);
        const cap = normalize(p.caption);
        if ((alt && alt.includes(query)) || (cap && cap.includes(query))) {
          panelHitId = p.id;
          break;
        }
      }
    }

    const matched = titleUserHit || addrHit || descHit || panelHitId;
    if (matched) {
      keep.push(s);
      if (panelHitId) matchedPanelByStory[s.id] = panelHitId;
      if (titleUserHit && !strongMatchStoryId && s.geo) strongMatchStoryId = s.id;
      // Scoring (Gallery asks: title > username > description > image description). Address grouped with description.
      let score = 0;
      if (titleHit) score += 4000;
      if (userHit) score += 3000;
      if (addrHit) score += 2000;
      if (descHit) score += 2000;
      if (panelHitId) score += 1000;
      scores[s.id] = score;
    }
  }
  // Sort by score desc for convenience
  keep.sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  return { filtered: keep, matchedPanelByStory, strongMatchStoryId, scores };
}
