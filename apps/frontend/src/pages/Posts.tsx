import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { List as ListIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { ViewToggle } from '@/components/ViewToggle';
import OptionsPopover from '@/components/OptionsPopover';
import { useOptions } from '@/context/OptionsContext';
import { usePosts } from '@/hooks/usePosts';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import { Map } from '@/components/Map';
import { Story } from '@/types/story';

// For now, posts are a subset of stories with a postedDate present and optionally a type marker
export default function PostsPage() {
  const { data: stories } = usePosts();
  const { showClosed, clusterAnim } = useOptions();
  const [params] = useSearchParams();
  const q = params.get('q');
  const navigate = useNavigate();
  const location = useLocation();
  const [mapCenter] = useState<{ lat: number; lng: number }>({ lat: 41.5, lng: 70 });
  const [mapZoom] = useState<number>(3);
  const isMap = (params.get('style') === 'map');

  const posts: Story[] = useMemo(() => {
    return (stories || []).filter(s => Boolean(s.postedDate) && !(s as any).isReel);
  }, [stories]);

  const sf = params.get('sf') || 't,u,a,d,i';
  const fields = {
    title: sf.includes('t'),
    username: sf.includes('u'),
    address: sf.includes('a'),
    description: sf.includes('d'),
    images: sf.includes('i'),
  } as const;
  const { filtered, matchedPanelByStory } = useSearchFilter(posts, q, fields);
  let visible = q ? filtered : posts;
  if (!showClosed) visible = visible.filter(s => !s.isClosed);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-6 pt-4">
        <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
          <div />
          <div className="justify-self-start w-full lg:w-[620px] xl:w-[720px]">
            <SearchBar />
          </div>
          <div className="flex items-center justify-end gap-2 relative">
            <Link to="/lists">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <ListIcon size={16} className="mr-2" />
                Listes
              </Button>
            </Link>
            <OptionsPopover />
            <ViewToggle mode="query" />
          </div>
        </div>
        <div className="md:hidden flex flex-col gap-2">
          <div className="w-full md:w-[720px] mx-auto">
            <SearchBar />
          </div>
          <div className="flex items-center justify-end gap-2 relative">
            <Link to="/lists">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <ListIcon size={16} className="mr-2" />
                Listes
              </Button>
            </Link>
            <ViewToggle mode="query" />
            <OptionsPopover />
          </div>
        </div>
      </div>

      {/* Map view for posts with pins where geo exists (toggle) */}
      {isMap && (
        <div className="h-[100svh]">
          <Map
            stories={visible.filter(s => s.geo)}
            onStorySelect={(story) => {
              const pid = q ? matchedPanelByStory[story.id] : undefined;
              const base = `/post/${encodeURIComponent(story.handle || story.id)}`;
              const current = `${location.pathname}${location.search}`;
              const from = `from=${encodeURIComponent(current)}`;
              navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
            }}
            center={mapCenter}
            zoom={mapZoom}
            clusterAnimate={clusterAnim}
            fitPadding={80}
          />
        </div>
      )}

      {/* Gallery list (toggle) */}
      {!isMap && (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Posts récents</h2>
        <div className="grid grid-cols-1 [@media(min-width:800px)]:grid-cols-3 xl:grid-cols-4 gap-6 w-full xl:max-w-[1460px] mx-auto">
          {visible.map((story) => (
            <button
              key={story.id}
              onClick={() => {
                const pid = q ? matchedPanelByStory[story.id] : undefined;
                const base = `/post/${encodeURIComponent(story.handle || story.id)}`;
                const current = `${location.pathname}${location.search}`;
                const from = `from=${encodeURIComponent(current)}`;
                navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
              }}
              className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg group"
            >
              {story.thumbnail && (
                <img src={story.thumbnail} className={`w-full h-full object-cover ${story.isClosed ? 'grayscale' : ''}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg line-clamp-2 flex-1 text-left">{story.title}</h3>
                  {story.isClosed && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white whitespace-nowrap">Fermé</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
