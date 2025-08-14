
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Grid3X3, X, ChevronDown, ChevronUp } from "lucide-react";
import { StoryPanel } from "./StoryPanel";
import { ProgressBar } from "./ProgressBar";
import { StoryGalleryOverlay } from "./StoryGalleryOverlay";
import { StoryMetadata } from "./StoryMetadata";
import { Story } from "@/types/story";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";

interface TwoPanelStoryViewerProps {
  initialStoryId?: string;
  stories: Story[];
  onClose?: () => void;
  rightPanelContent?: React.ReactNode;
}

export const TwoPanelStoryViewer = ({ 
  initialStoryId, 
  stories,
  onClose,
  rightPanelContent
}: TwoPanelStoryViewerProps) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(() => {
    if (initialStoryId) {
      const index = stories.findIndex(story => story.id === initialStoryId);
      return index >= 0 ? index : 0;
    }
    return 0;
  });
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  const currentStory = stories[currentStoryIndex];
  const currentPanel = currentStory?.panels[currentPanelIndex];

  // Mock highlights data - in real app, this would come from the story data
  const mockHighlights = [
    {
      id: '1',
      title: 'Appetizers',
      thumbnail: 'photo-1565299624946-b28f40a0ca4b',
      panelIds: ['panel1', 'panel2']
    },
    {
      id: '2',
      title: 'Main Course',
      thumbnail: 'photo-1567620905732-2d1ec7ab7445',
      panelIds: ['panel3', 'panel4']
    },
    {
      id: '3',
      title: 'Desserts',
      thumbnail: 'photo-1551024506-0bccd828d307',
      panelIds: ['panel5', 'panel6']
    },
    {
      id: '4',
      title: 'Ambiance',
      thumbnail: 'photo-1514933651103-005eec06c04b',
      panelIds: ['panel7', 'panel8']
    }
  ];

  // Reset panel index when story changes externally
  useEffect(() => {
    if (initialStoryId) {
      const index = stories.findIndex(story => story.id === initialStoryId);
      if (index >= 0 && index !== currentStoryIndex) {
        setCurrentStoryIndex(index);
        setCurrentPanelIndex(0);
      }
    }
  }, [initialStoryId, stories, currentStoryIndex]);

  const goToNextPanel = useCallback(() => {
    if (currentPanelIndex < currentStory.panels.length - 1) {
      setCurrentPanelIndex(prev => prev + 1);
    } else if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setCurrentPanelIndex(0);
    } else {
      // Loop back to beginning
      setCurrentStoryIndex(0);
      setCurrentPanelIndex(0);
    }
  }, [currentStoryIndex, currentPanelIndex, currentStory, stories.length]);

  const goToPreviousPanel = useCallback(() => {
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(prev => prev - 1);
    } else if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setCurrentPanelIndex(stories[currentStoryIndex - 1].panels.length - 1);
    }
  }, [currentStoryIndex, currentPanelIndex, stories]);

  const goToNextHighlight = useCallback(() => {
    const currentIndex = mockHighlights.findIndex(h => h.id === selectedHighlightId);
    if (currentIndex < mockHighlights.length - 1) {
      setSelectedHighlightId(mockHighlights[currentIndex + 1].id);
    }
  }, [selectedHighlightId, mockHighlights]);

  const goToPreviousHighlight = useCallback(() => {
    const currentIndex = mockHighlights.findIndex(h => h.id === selectedHighlightId);
    if (currentIndex > 0) {
      setSelectedHighlightId(mockHighlights[currentIndex - 1].id);
    } else {
      // Go back to main story viewer
      setSelectedHighlightId(null);
    }
  }, [selectedHighlightId, mockHighlights]);

  const jumpToPanel = (panelIndex: number) => {
    setCurrentPanelIndex(panelIndex);
    setShowGallery(false);
  };

  const handleHighlightSelect = (highlight: any) => {
    console.log("Selected highlight:", highlight);
    setSelectedHighlightId(highlight.id);
    setShowMetadataPanel(false);
  };

  // Auto-advance timer
  useEffect(() => {
    if (!isAutoPlaying || showGallery) return;

    const timer = setTimeout(() => {
      goToNextPanel();
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentPanelIndex, currentStoryIndex, isAutoPlaying, goToNextPanel, showGallery]);

  // Mobile swipe gesture support
  const mobileSwipeHandlers = useSwipeGestures({
    onSwipeUp: () => {
      if (!showMetadataPanel && !selectedHighlightId) {
        setShowMetadataPanel(true);
      }
    },
    onSwipeDown: () => {
      if (showMetadataPanel) {
        setShowMetadataPanel(false);
      } else if (!selectedHighlightId && onClose) {
        onClose();
      }
    },
    onSwipeLeft: () => {
      if (selectedHighlightId) {
        goToPreviousHighlight();
      } else {
        goToPreviousPanel();
      }
    },
    onSwipeRight: () => {
      if (selectedHighlightId) {
        goToNextHighlight();
      } else if (!selectedHighlightId && mockHighlights.length > 0) {
        setSelectedHighlightId(mockHighlights[0].id);
      } else {
        goToNextPanel();
      }
    },
  });

  // Desktop swipe gesture support for story panel only
  const desktopSwipeHandlers = useSwipeGestures({
    onSwipeLeft: goToNextPanel,
    onSwipeRight: goToPreviousPanel,
  });

  // Calculate responsive panel visibility based on window aspect ratio
  const [windowAspectRatio, setWindowAspectRatio] = useState(window.innerWidth / window.innerHeight);
  
  useEffect(() => {
    const updateAspectRatio = () => {
      setWindowAspectRatio(window.innerWidth / window.innerHeight);
    };
    
    window.addEventListener('resize', updateAspectRatio);
    return () => window.removeEventListener('resize', updateAspectRatio);
  }, []);

  const shouldShowRightPanel = windowAspectRatio >= 16/9; // Show only if aspect ratio is 16:9 or wider
  const shouldShowMetadataPanel = windowAspectRatio >= 4/3; // Show only if aspect ratio is 4:3 or wider

  const handlePanelClick = (event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    
    if (clickX < width / 2) {
      goToPreviousPanel();
    } else {
      goToNextPanel();
    }
  };

  if (!currentStory || !currentPanel) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Mobile Layout - Single Panel with sliding metadata */}
      <div className="md:hidden">
        <div 
          className="relative min-h-screen overflow-hidden"
          {...mobileSwipeHandlers}
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 z-20 p-4">
            <ProgressBar
              totalPanels={currentStory.panels.length}
              currentPanel={currentPanelIndex}
              storyTitle={currentStory.title}
              author={currentStory.author}
            />
          </div>

          {/* Gallery Button */}
          <button
            onClick={() => setShowGallery(true)}
            className="absolute top-20 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
          >
            <Grid3X3 size={20} />
          </button>

          {/* Story Panel */}
          <div 
            className="w-full h-screen cursor-pointer"
            onClick={handlePanelClick}
          >
            <StoryPanel panel={currentPanel} />
          </div>

          {/* Sliding Metadata Panel */}
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-white transition-transform duration-300 ease-out z-40 ${
              showMetadataPanel ? 'transform translate-y-0' : 'transform translate-y-full'
            }`}
            style={{ height: '70vh' }}
          >
            <div className="p-4 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Story Details</h2>
                <button
                  onClick={() => setShowMetadataPanel(false)}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
              <StoryMetadata 
                story={currentStory}
                currentPanel={currentPanel}
                onHighlightSelect={handleHighlightSelect}
              />
            </div>
          </div>

          {/* Story Gallery Overlay */}
          {showGallery && (
            <StoryGalleryOverlay
              story={currentStory}
              currentPanelIndex={currentPanelIndex}
              onPanelSelect={jumpToPanel}
              onClose={() => setShowGallery(false)}
            />
          )}
        </div>
      </div>

      {/* Desktop Layout - Responsive Panels */}
      <div className="hidden md:flex min-h-screen">
        {/* Story Viewer Panel - Always 9:16 aspect ratio */}
        <div 
          className="flex justify-center items-center bg-black flex-shrink-0"
          style={{ 
            width: `${Math.min(56.25, 100 * (9/16) / windowAspectRatio)}vh`,
            height: '100vh'
          }}
        >
          <div 
            className="relative bg-black w-full"
            style={{ 
              aspectRatio: '9/16',
              height: '100vh'
            }}
            {...desktopSwipeHandlers}
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4">
              <ProgressBar
                totalPanels={currentStory.panels.length}
                currentPanel={currentPanelIndex}
                storyTitle={currentStory.title}
                author={currentStory.author}
              />
            </div>

            {/* Gallery Button */}
            <button
              onClick={() => setShowGallery(true)}
              className="absolute top-20 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
            >
              <Grid3X3 size={20} />
            </button>

            {/* Story Panel */}
            <div 
              className="w-full h-screen cursor-pointer"
              onClick={handlePanelClick}
            >
              <StoryPanel panel={currentPanel} />
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={goToPreviousPanel}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all duration-200"
              disabled={currentStoryIndex === 0 && currentPanelIndex === 0}
            >
              <ChevronLeft size={24} />
            </button>
            
            <button
              onClick={goToNextPanel}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all duration-200"
            >
              <ChevronRight size={24} />
            </button>

            {/* Story Gallery Overlay */}
            {showGallery && (
              <StoryGalleryOverlay
                story={currentStory}
                currentPanelIndex={currentPanelIndex}
                onPanelSelect={jumpToPanel}
                onClose={() => setShowGallery(false)}
              />
            )}
          </div>
        </div>

        {/* Metadata Panel - Hide if window too narrow */}
        {shouldShowMetadataPanel && (
          <div className="bg-white relative flex-1 max-w-md">
            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
              >
                <X size={20} />
              </button>
            )}
            
            <StoryMetadata 
              story={currentStory}
              currentPanel={currentPanel}
              onHighlightSelect={handleHighlightSelect}
            />
          </div>
        )}

        {/* Right Panel - Show only if window is wide enough */}
        {shouldShowRightPanel && !isRightPanelCollapsed && (
          <div className="bg-white relative flex-1 max-w-md border-l">
            {/* Collapse Button */}
            <button
              onClick={() => setIsRightPanelCollapsed(true)}
              className="absolute top-4 left-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="h-full p-6 pt-16">
              {rightPanelContent || (
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-700 mb-4">Related Places</h3>
                  <p className="text-gray-600">Content can be customized here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reopen Button for Right Panel */}
        {shouldShowRightPanel && isRightPanelCollapsed && (
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={() => setIsRightPanelCollapsed(false)}
              className="p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-all duration-200"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
