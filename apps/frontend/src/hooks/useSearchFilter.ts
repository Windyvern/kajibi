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
  title?: boolean;     // Nom (title)
  username?: boolean;  // @Instagram (username/author)
  address?: boolean;   // Adresse
  description?: boolean; // Mots-clés (tags/types)
  images?: boolean;    // Contenu (article description + panel alt/caption)
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
  let titleUserMatchCount = 0;

  const keep: Story[] = [];
  for (const s of stories) {
    const title = normalize(s.title);
    const username = normalize(s.username || s.author);
    const aliasTitle = normalize(s.appendedFromTitle);
    const aliasUser = normalize(s.appendedFromUsername);
    const address = normalize(s.address);
    const desc = normalize(s.description);

    const titleHit = fields.title && (title.includes(query) || (!!aliasTitle && aliasTitle.includes(query)));
    const userHit = fields.username && (username.includes(query) || (!!aliasUser && aliasUser.includes(query)));
    const titleUserHit = titleHit || userHit;
    const addrHit = fields.address && address.includes(query);
    // If searching an @username, ignore matches from description/image descriptions
    const isAtQuery = query.startsWith('@');
    // Mots-clés: search tags/types (and legacy type/category)
    const keywordsHit = fields.description && !isAtQuery && (
      (Array.isArray(s.tags) && s.tags.some(t => normalize(t).includes(query))) ||
      (Array.isArray(s.types) && s.types.some(t => normalize(t).includes(query))) ||
      (!!s.type && normalize(s.type).includes(query)) ||
      (!!s.category && normalize(s.category).includes(query))
    );

    // Contenu: prioritize panel image alt/caption; also search article description
    let panelHitId: string | undefined;
    let contentDescHit = false;
    if (fields.images && !isAtQuery) {
      for (const p of s.panels) {
        const alt = normalize(p.altText);
        const cap = normalize(p.caption);
        if ((alt && alt.includes(query)) || (cap && cap.includes(query))) {
          panelHitId = p.id;
          break;
        }
      }
      if (!panelHitId && desc.includes(query)) contentDescHit = true;
    }

    const matched = titleUserHit || addrHit || keywordsHit || panelHitId || contentDescHit;
    if (matched) {
      keep.push(s);
      if (panelHitId) matchedPanelByStory[s.id] = panelHitId; // panel prioritized when present
      if (titleUserHit) titleUserMatchCount += 1;
      // Strong match candidate only when title/username matches and geo exists
      if (titleUserHit && !strongMatchStoryId && s.geo) strongMatchStoryId = s.id;
      // Scoring: title > username > keywords/address > content (desc) > panel
      let score = 0;
      if (titleHit) score += 4000;
      if (userHit) score += 3000;
      if (addrHit) score += 2000;
      if (keywordsHit) score += 2000;
      if (contentDescHit) score += 1500;
      if (panelHitId) score += 2500; // prioritize images within Contenu
      scores[s.id] = score;
    }
  }
  // Only keep strong match when there is a unique title/username match and query has enough length
  if (titleUserMatchCount !== 1 || (q || '').length < 3) strongMatchStoryId = undefined;
  // Sort by score desc for convenience
  keep.sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  return { filtered: keep, matchedPanelByStory, strongMatchStoryId, scores };
}
