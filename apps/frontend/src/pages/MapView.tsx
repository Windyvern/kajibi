
import { useEffect, useState } from 'react';
import { Map } from '@/components/Map';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { RestaurantCards } from '@/components/RestaurantCards';
import { StoryMetadata } from '@/components/StoryMetadata';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { X, List, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MapView = () => {
  const { data: stories, isLoading, error } = useStories();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);
  const [mapView, setMapView] = useState<{ center: { lat: number; lng: number }; zoom: number }>({ center: { lat: 39.8283, lng: -98.5795 }, zoom: 4 });
  // Track viewport to trigger re-render on resize and switch layouts live
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
                            src={story.thumbnail}
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
                center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                zoom={mapView.zoom}
                onViewChange={(c, z) => setMapView({ center: c, zoom: z })}
              />
            )}
          </div>
        )}
      </div>

      {/* Desktop Layout - Aspect-driven */}
      <div className="hidden md:flex h-screen w-full">
        {(viewport.w / viewport.h >= 1.4) ? (
          // Wide screens: viewer (fixed 9:16) centered; left map grows; right description fixed; right blank space fills remainder
          selectedStory ? (
            <div className="flex w-full h-full items-stretch bg-white">
              {/* Left Map grows to fill remaining width */}
              <div className="flex-1 min-w-0">
                <Map
                  stories={stories}
                  onStorySelect={handleStorySelect}
                  selectedStoryId={selectedStory?.id}
                  center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                  zoom={mapView.zoom}
                  onViewChange={(c, z) => setMapView({ center: c, zoom: z })}
                />
              </div>

              {/* Center viewer: fixed 9:16 */}
              <div className="flex items-center justify-center" style={{ width: '56.25vh', height: '100vh' }}>
                <TwoPanelStoryViewer
                  initialStoryId={selectedStory.id}
                  stories={stories}
                  onClose={handleCloseStory}
                  hideMetadataPanel
                  hideRightPanel
                />
              </div>

              {/* Right description: fixed width matching viewer */}
              <div className="flex-shrink-0 bg-white" style={{ width: '56.25vh' }}>
                <div className="h-full">
                  <StoryMetadata
                    story={selectedStory}
                    currentPanel={selectedStory.panels[0]}
                  />
                </div>
              </div>

              {/* Right blank space matches description background */}
              <div className="flex-1 bg-white" />
            </div>
          ) : (
            <div className="w-full h-full">
              <Map
                stories={stories}
                onStorySelect={handleStorySelect}
                selectedStoryId={undefined}
                center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                zoom={mapView.zoom}
                onViewChange={(c, z) => setMapView({ center: c, zoom: z })}
              />
            </div>
          )
        ) : (
          // Near-square: right viewer fixed 9:16; left column fills remaining width and is split into map (top) + description (bottom)
          selectedStory ? (
            <div className="grid w-full h-full" style={{ gridTemplateColumns: '1fr 56.25vh' }}>
              {/* Left column fills remaining width */}
              <div className="flex flex-col h-full min-w-0">
                <div className="flex-1 min-h-0">
                  <Map
                    stories={stories}
                    onStorySelect={handleStorySelect}
                    selectedStoryId={selectedStory?.id}
                    center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                    zoom={mapView.zoom}
                    onViewChange={(c, z) => setMapView({ center: c, zoom: z })}
                  />
                </div>
                <div className="flex-1 min-h-0 bg-white overflow-hidden">
                  <div className="h-full">
                    <StoryMetadata
                      story={selectedStory}
                      currentPanel={selectedStory.panels[0]}
                    />
                  </div>
                </div>
              </div>

              {/* Right viewer fixed 9:16, no extra black bars */}
              <div className="flex items-center justify-center" style={{ height: '100vh' }}>
                <div style={{ width: '56.25vh', height: '100vh' }}>
                  <TwoPanelStoryViewer
                    initialStoryId={selectedStory.id}
                    stories={stories}
                    onClose={handleCloseStory}
                    hideMetadataPanel
                    hideRightPanel
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full">
              <Map
                stories={stories}
                onStorySelect={handleStorySelect}
                selectedStoryId={undefined}
                center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                zoom={mapView.zoom}
                onViewChange={(c, z) => setMapView({ center: c, zoom: z })}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default MapView;
