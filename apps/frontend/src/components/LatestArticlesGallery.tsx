import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export const LatestArticlesGallery = ({ onSelect, stories: inputStories, sections }: { onSelect?: (story: Story) => void, stories?: Story[], sections?: Array<{ title: string; stories: Story[] }> }) => {
  const navigate = useNavigate();
  const { data: fetchedStories, isLoading, error } = useStories();
  const stories = inputStories ?? fetchedStories;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" size={24} />
        <span className="ml-2">Loading articles...</span>
      </div>
    );
  }

  if (!sections && (error || !stories || stories.length === 0)) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No articles available</p>
      </div>
    );
  }

  // Use provided order when stories are passed in; otherwise sort fetched stories by published date desc
  const orderedStories = inputStories
    ? stories
    : (stories ? [...stories].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) : []);

  const formatDate = (dateString: string) => {
    // French format, e.g., 12 septembre 2025
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      });
    } catch {
      return new Date(dateString).toLocaleDateString('fr-FR');
    }
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} size={12} className="fill-yellow-400 text-yellow-400" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <Star size={12} className="text-gray-300" />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star size={12} className="fill-yellow-400 text-yellow-400" />
            </div>
          </div>
        );
      } else {
        stars.push(
          <Star key={i} size={12} className="text-gray-300" />
        );
      }
    }

    return stars;
  };

  const Grid = ({ title, list }: { title?: string; list: Story[] }) => (
    <div className="mb-10">
      {typeof title !== 'undefined' && title !== '' && (
        <div className="w-full flex justify-center">
          <h3 className="w-full xl:max-w-[1460px] mx-auto text-2xl font-bold mb-4 text-foreground">{title}</h3>
        </div>
      )}
      <div className="w-full flex justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-2 w-full xl:max-w-[1460px] mx-auto">
          {list.map((story) => (
            <StoryCard key={story.id} story={story} onSelect={onSelect} formatDate={formatDate} renderStars={renderStars} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {sections && sections.length > 0 ? (
        sections.map((sec, idx) => (
          <Grid key={idx} title={sec.title} list={sec.stories} />
        ))
      ) : (
        <>
          <Grid title={typeof title === 'undefined' ? 'Stories récentes' : title} list={orderedStories} />
        </>
      )}
    </div>
  );
};

function StoryCard({ story, onSelect, formatDate, renderStars }: { story: Story; onSelect?: (s: Story) => void; formatDate: (d: string) => string; renderStars: (n: number) => JSX.Element[]; }) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setLandscape(r.width > r.height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const typeText = useMemo(() => {
    return Array.isArray(story.types) && story.types.length > 0
      ? story.types.join(', ')
      : (story.category || (story as any).type);
  }, [story]);

  const rating = story.rating;
  // Shift 3px from right and add +2px top margin on portrait/square
  const posClass = landscape ? 'bottom-2 right-[11px]' : 'top-[15px] right-[11px]';

  return (
    <div
      className={`relative z-0 hover:z-20 group cursor-pointer transition-transform hover:scale-105 duration-200 ${story.isClosed ? 'opacity-80' : ''}`}
      onClick={() => onSelect && onSelect(story)}
    >
      <div ref={wrapRef} className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg">
        {/* Thumbnail Image */}
        <img src={story.thumbnail} alt={story.title} className={`w-full h-full object-cover ${story.isClosed ? 'grayscale' : ''}`} />

        {/* Gradient Overlay (thumbnail container for positioning) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Prize logos: logo-only, white, bigger; positioned based on aspect */}
        {Array.isArray(story.prizes) && story.prizes.length > 0 && (
          <div className={`absolute ${posClass} flex flex-col items-end gap-2 pointer-events-none`}>
            {story.prizes.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="ai-style-change-3"
                style={{ position: 'relative' }}
              >
                {p.iconUrl && (
                  <img
                    src={p.iconUrl}
                    alt=""
                    className="w-[52px] h-[52px] object-contain ai-style-change-1"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg line-clamp-2 flex-1">{story.title}</h3>
            {story.isClosed && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white whitespace-nowrap">Fermé</span>
            )}
          </div>
          {typeText ? (
            <p className="text-sm text-gray-200 mb-1 line-clamp-1 italic">{typeText}</p>
          ) : null}

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-200">{formatDate(story.postedDate || story.lastVisit || story.publishedAt)}</span>
            {typeof rating === 'number' && !Number.isNaN(rating) && (
              <div className="flex items-center gap-1">
                {renderStars(rating)}
                <span className="text-sm ml-1 text-gray-200">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simplified list-sidebar gallery: custom heading and title-only cards
export function ListSidebarGallery({ heading, stories, onSelect }: { heading: string; stories: Story[]; onSelect: (s: Story) => void; }) {
  return (
    <div className="p-6">
      <div className="w-full flex justify-center">
        <h3 className="w-full xl:max-w-[1460px] mx-auto text-2xl font-bold mb-4 text-foreground">{heading}</h3>
      </div>
      <div className="w-full flex justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-2 w-full xl:max-w-[1460px] mx-auto">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => onSelect(story)}
              className={`relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg group ${story.isClosed ? 'opacity-80' : ''}`}
            >
              {story.thumbnail && (
                <img src={story.thumbnail} alt={story.title} className={`w-full h-full object-cover ${story.isClosed ? 'grayscale' : ''}`} />
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
    </div>
  );
}
