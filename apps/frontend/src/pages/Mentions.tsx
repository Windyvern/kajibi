import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { List as ListIcon } from 'lucide-react';
import { SearchHeader } from '@/components/SearchHeader';
import { useState, useMemo, useEffect } from 'react';
import { useStories } from '@/hooks/useStories';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { ViewToggle } from '@/components/ViewToggle';
import { Map as StoriesMap } from '@/components/Map';
import { Story } from '@/types/story';
import OptionsPopover from '@/components/OptionsPopover';
import { useOptions } from '@/context/OptionsContext';

const MentionsPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const style = params.get('style') === 'map' ? 'map' : 'gallery';
  const { data: stories } = useStories();
  const { showClosed } = useOptions();

  const prizeStories: Story[] = useMemo(() => {
    const all = stories || [];
    const filtered = all.filter(s => (s.prizes || []).some(p => (p.slug || p.id)?.toString() === slug));
    return showClosed ? filtered : filtered.filter(s => !s.isClosed);
  }, [stories, slug, showClosed]);

  // Restore gallery scroll when returning from a story
  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    try {
      const v = sessionStorage.getItem(`scroll:${key}`);
      if (v && style !== 'map') {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(v, 10) || 0);
          sessionStorage.removeItem(`scroll:${key}`);
        });
      }
    } catch {}
  }, [location.pathname, location.search, style]);

  // Bounds-prioritized ordering for gallery
  const orderedStories: Story[] = useMemo(() => {
    try {
      const bRaw = sessionStorage.getItem('view:map:bounds');
      if (!bRaw) return prizeStories;
      const b = JSON.parse(bRaw) as { north: number; south: number; east: number; west: number };
      const inB: Story[] = [];
      const outB: Story[] = [];
      for (const s of prizeStories) {
        const g = s.geo;
        if (g && g.lat <= b.north && g.lat >= b.south && g.lng <= b.east && g.lng >= b.west) inB.push(s); else outB.push(s);
      }
      return [...inB, ...outB];
    } catch {
      return prizeStories;
    }
  }, [prizeStories]);

  // Compute bounds for all prize stories (map view)
  const prizeBounds = useMemo(() => {
    const pts = prizeStories.filter(s => s.geo).map(s => [s.geo!.lat, s.geo!.lng]) as [number, number][];
    if (pts.length < 1) return null;
    let north = -90, south = 90, east = -180, west = 180;
    for (const [lat, lng] of pts) { north = Math.max(north, lat); south = Math.min(south, lat); east = Math.max(east, lng); west = Math.min(west, lng); }
    return [[south, west], [north, east]] as [[number, number],[number, number]];
  }, [prizeStories]);

  // Extract current prize meta (name + icon)
  const prizeMeta = useMemo(() => {
    for (const s of prizeStories) {
      const p = (s.prizes || []).find(p => (p.slug || p.id)?.toString() === slug);
      if (p) return p;
    }
    return null as any;
  }, [prizeStories, slug]);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-3 left-3 right-3 z-[10000]">
        <SearchHeader viewToggleMode="query" />
      </div>

      <div className="px-6 mt-[85px] md:mt-12">
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col gap-2">
            <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/mentions')}>
              ← Mentions
            </button>
            <div className="flex items-center gap-3">
              {prizeMeta?.iconUrl && (
                <img src={prizeMeta.iconUrl} alt="" className="h-8 w-8 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              )}
              <h2 className="text-2xl font-bold">{prizeMeta?.name || 'Mention'}</h2>
            </div>
          </div>
        </div>
      </div>

      {style === 'map' ? (
        <div className="h-[100svh] w-full">
          <StoriesMap
            stories={prizeStories}
            onStorySelect={(story) => {
              const current = `${location.pathname}${location.search}`;
              const base = `/story/${encodeURIComponent(story.handle || story.id)}`;
              navigate(`${base}?from=${encodeURIComponent(current)}`);
            }}
            selectedStoryId={undefined}
            onViewChange={() => {}}
            fitBounds={prizeBounds || undefined}
            fitPadding={80}
          />
        </div>
      ) : (
        <LatestArticlesGallery
          title=""
          stories={orderedStories}
          onSelect={(story) => {
            const current = `${location.pathname}${location.search}`;
            try { sessionStorage.setItem(`scroll:${current}`, String(window.scrollY)); } catch {}
            navigate(`/story/${encodeURIComponent(story.handle || story.id)}?from=${encodeURIComponent(current)}`);
          }}
        />
      )}
    </div>
  );
};

export default MentionsPage;
