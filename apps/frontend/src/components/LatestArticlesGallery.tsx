import { useStories } from '@/hooks/useStories';
import { Star } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export const LatestArticlesGallery = () => {
  const { data: stories, isLoading, error } = useStories();

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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Generate a random rating between 3.5 and 5 for demo purposes
  const generateRating = (id: string) => {
    const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 3.5 + (seed % 15) / 10; // Returns between 3.5 and 5.0
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
          const rating = generateRating(story.id);
          return (
            <div
              key={story.id}
              className="relative group cursor-pointer transition-transform hover:scale-105 duration-200"
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg">
                {/* Thumbnail Image */}
                <img
                  src={`https://images.unsplash.com/${story.thumbnail}?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=533&q=80`}
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
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-200">
                      {formatDate(story.publishedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      {renderStars(rating)}
                      <span className="text-sm ml-1 text-gray-200">
                        {rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-300">
                    By {story.author}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};