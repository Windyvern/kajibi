
import { useState } from 'react';
import { Map } from '@/components/Map';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { RestaurantCards } from '@/components/RestaurantCards';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { X, List, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MapView = () => {
  const { data: stories, isLoading, error } = useStories();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);

  const handleStorySelect = (story: Story) => {
    setSelectedStory(story);
    setShowMobileList(false);
  };

  const handleCloseStory = () => {
    setSelectedStory(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading stories...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-2">Error loading stories</h2>
          <p className="text-gray-600">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  if (!stories || stories.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-2">No stories found</h2>
          <p className="text-gray-600">Check back later for new content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Layout */}
      <div className="md:hidden">
        {selectedStory ? (
          <div className="relative min-h-screen">
            <button
              onClick={handleCloseStory}
              className="absolute top-4 left-4 z-50 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
            >
              <X size={20} />
            </button>
            <TwoPanelStoryViewer 
              initialStoryId={selectedStory.id}
              stories={stories}
              onClose={handleCloseStory}
            />
          </div>
        ) : (
          <div className="relative h-screen">
            {/* Mobile Map/List Toggle */}
            <div className="absolute top-4 right-4 z-20">
              <Button
                onClick={() => setShowMobileList(!showMobileList)}
                className="rounded-full shadow-lg"
                size="sm"
              >
                <List size={16} />
              </Button>
            </div>

            {showMobileList ? (
              <div className="h-full overflow-y-auto bg-white p-4">
                <h2 className="text-xl font-bold mb-4">Stories</h2>
                <div className="space-y-4">
                  {stories.map((story) => (
                    <button
                      key={story.id}
                      onClick={() => handleStorySelect(story)}
                      className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex gap-3">
                        {story.thumbnail && (
                          <img
                            src={`https://images.unsplash.com/${story.thumbnail}?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&h=80&q=80`}
                            alt={story.title}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{story.title}</h3>
                          <p className="text-sm text-gray-600">{story.handle}</p>
                          <p className="text-xs text-gray-500 mt-1">{story.address}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Map
                stories={stories}
                onStorySelect={handleStorySelect}
                selectedStoryId={selectedStory?.id}
              />
            )}
          </div>
        )}
      </div>

      {/* Desktop Layout - Responsive based on window ratio */}
      <div className="hidden md:flex h-screen">
        {/* Check window aspect ratio for responsive behavior */}
        {((window.innerWidth / window.innerHeight) < 0.75) ? (
          /* Mobile-like view for very narrow windows */
          selectedStory ? (
            <TwoPanelStoryViewer 
              initialStoryId={selectedStory.id}
              stories={stories}
              onClose={handleCloseStory}
              rightPanelContent={<RestaurantCards />}
            />
          ) : (
            <Map
              stories={stories}
              onStorySelect={handleStorySelect}
              selectedStoryId={selectedStory?.id}
            />
          )
        ) : selectedStory ? (
          <>
            {/* Show map only if window ratio allows */}
            {(window.innerWidth / window.innerHeight) >= (4/3) && (
              <div className="flex-shrink-0" style={{ width: 'calc(100vw - 56.25vh - 32rem)' }}>
                <Map
                  stories={stories}
                  onStorySelect={handleStorySelect}
                  selectedStoryId={selectedStory.id}
                />
              </div>
            )}
            
            {/* Story Viewer + Panels */}
            <div className="flex-1">
              <TwoPanelStoryViewer 
                initialStoryId={selectedStory.id}
                stories={stories}
                onClose={handleCloseStory}
                rightPanelContent={<RestaurantCards />}
              />
            </div>
          </>
        ) : (
          <div className="w-full">
            <Map
              stories={stories}
              onStorySelect={handleStorySelect}
              selectedStoryId={selectedStory?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
