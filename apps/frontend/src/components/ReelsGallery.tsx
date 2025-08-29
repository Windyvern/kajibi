import { Story } from '@/types/story';
import { Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface ReelsGalleryProps {
  reels?: Story[];
  onSelect?: (story: Story) => void;
}

export const ReelsGallery = ({ reels, onSelect }: ReelsGalleryProps) => {
  // Safety check for undefined reels
  if (!reels || !Array.isArray(reels)) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Reels récents</h2>
        <div className="text-center text-muted-foreground">Aucun reel disponible</div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
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

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-foreground">Reels récents</h2>
      <div className="w-full flex justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-2 w-full xl:max-w-[1460px] mx-auto">
          {reels.map((reel) => (
            <ReelCard key={reel.id} reel={reel} onSelect={onSelect} formatDate={formatDate} renderStars={renderStars} />
          ))}
        </div>
      </div>
    </div>
  );
};

function ReelCard({ reel, onSelect, formatDate, renderStars }: { 
  reel: Story; 
  onSelect?: (s: Story) => void; 
  formatDate: (d: string) => string; 
  renderStars: (n: number) => JSX.Element[]; 
}) {
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
    return Array.isArray(reel.types) && reel.types.length > 0
      ? reel.types.join(', ')
      : (reel.category || (reel as any).type);
  }, [reel]);

  const rating = reel.rating;
  const posClass = landscape ? 'bottom-2 right-[11px]' : 'top-[15px] right-[11px]';

  return (
    <div
      className={`relative z-0 hover:z-20 group cursor-pointer transition-transform hover:scale-105 duration-200 ${reel.isClosed ? 'opacity-80' : ''}`}
      onClick={() => onSelect && onSelect(reel)}
    >
      <div ref={wrapRef} className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg">
        {/* Thumbnail Image */}
        <img src={reel.thumbnail} alt={reel.title} className={`w-full h-full object-cover ${reel.isClosed ? 'grayscale' : ''}`} />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
            <div className="w-0 h-0 border-l-8 border-l-white border-t-6 border-t-transparent border-b-6 border-b-transparent ml-1"></div>
          </div>
        </div>

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg line-clamp-2 flex-1">{reel.title}</h3>
            {reel.isClosed && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white whitespace-nowrap">Fermé</span>
            )}
          </div>
          {typeText && (
            <p className="text-sm text-gray-200 mb-1 line-clamp-1 italic">{typeText}</p>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-200">{formatDate(reel.postedDate || reel.publishedAt)}</span>
            {/*typeof rating === 'number' && !Number.isNaN(rating) && (
              <div className="flex items-center gap-1">
                {renderStars(rating)}
                <span className="text-sm ml-1 text-gray-200">{rating.toFixed(1)}</span>
              </div>
            )*/}
          </div>
        </div>
      </div>
    </div>
  );
}
