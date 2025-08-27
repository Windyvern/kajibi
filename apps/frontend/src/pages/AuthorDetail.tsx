import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SearchHeader } from '@/components/SearchHeader';
import { useState, useMemo, useEffect } from 'react';
import { useAuthors } from '@/hooks/useAuthors';
import { useStories } from '@/hooks/useStories';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import { useOptions } from '@/context/OptionsContext';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { useAuthorPosts, useAuthorReels } from '@/hooks/useAuthorMedia';
import { ViewToggle } from '@/components/ViewToggle';
import { Map as StoriesMap } from '@/components/Map';

const AuthorDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const style = params.get('style') === 'map' ? 'map' : 'gallery';
  const { data: authors, isLoading: aLoading, error: aError } = useAuthors();
  const { data: stories, isLoading: sLoading, error: sError } = useStories();
  const { clusterAnim } = useOptions();

  const author = useMemo(() => (authors || []).find(a => (a.slug || a.id) === slug), [authors, slug]);
  const authorStories = useMemo(() => {
    if (!author || !stories) return [];
    return stories.filter(s => (s.author || '').trim() === (author.name || '').trim());
  }, [author, stories]);
  const q = params.get('q') || '';
  const sf = params.get('sf') || 't,u,a,d,i';
  const fields = { title: sf.includes('t'), username: sf.includes('u'), address: sf.includes('a'), description: sf.includes('d'), images: sf.includes('i') } as const;
  const { filtered } = useSearchFilter(authorStories, q, fields);
  const visibleStories = q ? filtered : authorStories;
  const { data: posts } = useAuthorPosts(author?.slug || author?.name);
  const { data: reels } = useAuthorReels(author?.slug || author?.name);
  const [tab, setTab] = useState<'stories'|'posts'|'reels'>('stories');
  // Restore gallery scroll when returning from a story
  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    try {
      const v = sessionStorage.getItem(`scroll:${key}`);
      if (v && style !== 'map' && tab === 'stories') {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(v, 10) || 0);
          sessionStorage.removeItem(`scroll:${key}`);
        });
      }
    } catch {}
  }, [location.pathname, location.search, style, tab]);

  if (aLoading || sLoading) {
    return <div className="min-h-screen flex items-center justify-center"><span>Chargement…</span></div>;
  }
  if (aError || sError || !author) {
    return <div className="min-h-screen flex items-center justify-center"><span>Auteur introuvable</span></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-6 pt-4 mb-2">
        <SearchHeader />
      </div>

      <div className="px-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate('/authors')} className="text-sm text-gray-600 hover:text-gray-800">← Auteurs</button>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-1 ring-black/10">
            {author.avatarUrl ? (
              <img src={author.avatarUrl} alt={author.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-200" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-foreground">{author.name}</h2>
        </div>
        <div className="flex items-center gap-3 border-b border-border" data-lov-id="src/pages/AuthorDetail.tsx:102:8">
          {[
            { key: 'stories', label: 'Stories' },
            { key: 'posts', label: 'Posts' },
            { key: 'reels', label: 'Reels' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-3 py-2 text-sm border-b-2 ${tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
          {/* View toggle moved here; icon-only on mobile */}
          <div className="ml-auto hidden mb-2 md:block">
            <ViewToggle mode="query" />
          </div>
          <div className="ml-auto mb-2 md:hidden">
            <ViewToggle mode="query" showLabels={false} />
          </div>
        </div>
      </div>
      {tab === 'stories' && (
        style === 'map' ? (
          <div className="h-[70vh] w-full flex flex-col justify-end bg-gray-100">
            <StoriesMap
              stories={visibleStories}
              onStorySelect={(story) => {
                const current = `${location.pathname}${location.search}`;
                const base = `/story/${encodeURIComponent(story.handle || story.id)}`;
                navigate(`${base}?from=${encodeURIComponent(current)}`);
              }}
              selectedStoryId={undefined}
              onViewChange={() => {}}
              fitBounds={(function(){
                const withGeo = visibleStories.filter(s=>s.geo);
                if (withGeo.length < 1) return undefined as any;
                let minLat=withGeo[0]!.geo!.lat, maxLat=minLat, minLng=withGeo[0]!.geo!.lng, maxLng=minLng;
                withGeo.forEach(s=>{ const g=s.geo!; minLat=Math.min(minLat,g.lat); maxLat=Math.max(maxLat,g.lat); minLng=Math.min(minLng,g.lng); maxLng=Math.max(maxLng,g.lng); });
                return [[minLat,minLng],[maxLat,maxLng]] as [[number,number],[number,number]];
              })()}
              fitPadding={80}
              centerOffsetPixels={{ x: 0, y: -95 }}
              clusterAnimate={clusterAnim}
            />
          </div>
        ) : (
          <LatestArticlesGallery
            stories={visibleStories}
            onSelect={(story) => {
              const current = `${location.pathname}${location.search}`;
              try { sessionStorage.setItem(`scroll:${current}`, String(window.scrollY)); } catch {}
              navigate(`/story/${encodeURIComponent(story.handle || story.id)}?from=${encodeURIComponent(current)}`);
            }}
          />
        )
      )}
      {tab !== 'stories' && (
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(tab === 'posts' ? (posts || []) : (reels || [])).map((m) => (
              <div key={m.id} className="relative group w-full aspect-square rounded-xl overflow-hidden bg-muted">
                {m.thumbUrl ? (
                  <img src={m.thumbUrl} alt={m.caption || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorDetailPage;
