import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export const LatestArticlesGallery = ({ onSelect, stories: inputStories }: { onSelect?: (story: Story) => void, stories?: Story[] }) => {
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

  if (error || !stories || stories.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No articles available</p>
      </div>
    );
  }

  // Sort stories by published date (most recent first)
  const sortedStories = [...stories].sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

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

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-foreground">Latest Articles</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedStories.map((story) => {
          const rating = story.rating;
          return (
            <div
              key={story.id}
              className="relative group cursor-pointer transition-transform hover:scale-105 duration-200"
              onClick={() => onSelect && onSelect(story)}
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg">
                {/* Thumbnail Image */}
                <img
                  src={story.thumbnail}
                  alt={story.title}
                  className="w-full h-full object-cover"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                    {story.title}
                  </h3>
                  {/* Type(s) below title (support multiple, fallback to category) */}
                  {(() => {
                    const typeText = Array.isArray(story.types) && story.types.length > 0
                      ? story.types.join(', ')
                      : (story.category || (story as any).type);
                    return typeText ? (
                      <p className="text-sm text-gray-200 mb-1 line-clamp-1">
                        <span className="font-semibold">Type</span> : {typeText}
                      </p>
                    ) : null;
                  })()}

                  {/* Prize names (textual) below types when available */}
                  {Array.isArray(story.prizes) && story.prizes.length > 0 && (
                    <p className="text-sm text-gray-200 mb-1 line-clamp-1">
                      <span className="font-semibold">Prix</span> : {story.prizes.map(p => p.name).join(', ')}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-200">
                      {formatDate(story.lastVisit || story.publishedAt)}
                    </span>
                    {typeof rating === 'number' && !Number.isNaN(rating) && (
                      <div className="flex items-center gap-1">
                        {renderStars(rating)}
                        <span className="text-sm ml-1 text-gray-200">
                          {rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Prizes pictograms: bottom-right on desktop, top-right on mobile */}
                  {Array.isArray(story.prizes) && story.prizes.length > 0 && (
                    <>
                      {/* Mobile badges: top-right */}
                      <div className="absolute top-3 right-3 md:hidden flex flex-col items-end gap-1">
                        {story.prizes.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/gallery?prize=${encodeURIComponent(p.slug || p.id)}`); }}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shadow"
                            style={{ color: p.textColor || '#111', backgroundColor: p.bgColor || '#fff' }}
                            aria-label={`Voir ${p.name}`}
                          >
                            {p.iconUrl && (<img src={p.iconUrl} alt="" className="w-4 h-4 rounded-sm object-cover" />)}
                            <span>{p.name}</span>
                          </button>
                        ))}
                      </div>
                      {/* Desktop badges: bottom-right */}
                      <div className="hidden md:flex absolute bottom-3 right-3 flex-col items-end gap-1">
                        {story.prizes.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/gallery?prize=${encodeURIComponent(p.slug || p.id)}`); }}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shadow"
                            style={{ color: p.textColor || '#111', backgroundColor: p.bgColor || '#fff' }}
                            aria-label={`Voir ${p.name}`}
                          >
                            {p.iconUrl && (<img src={p.iconUrl} alt="" className="w-4 h-4 rounded-sm object-cover" />)}
                            <span>{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {/* Author hidden for now; use formatAuthor(story.username) when needed */}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
