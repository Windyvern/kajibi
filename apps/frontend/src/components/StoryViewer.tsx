
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StoryPanel } from "./StoryPanel";
import { ProgressBar } from "./ProgressBar";
import { sampleStories } from "@/data/sampleStories";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";

export const StoryViewer = () => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const currentStory = sampleStories[currentStoryIndex];
  const currentPanel = currentStory?.panels[currentPanelIndex];

  const goToNextPanel = useCallback(() => {
    if (currentPanelIndex < currentStory.panels.length - 1) {
      setCurrentPanelIndex(prev => prev + 1);
    } else if (currentStoryIndex < sampleStories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setCurrentPanelIndex(0);
    } else {
      // Loop back to beginning
      setCurrentStoryIndex(0);
      setCurrentPanelIndex(0);
    }
  }, [currentStoryIndex, currentPanelIndex, currentStory]);

  const goToPreviousPanel = useCallback(() => {
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(prev => prev - 1);
    } else if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setCurrentPanelIndex(sampleStories[currentStoryIndex - 1].panels.length - 1);
    }
  }, [currentStoryIndex, currentPanelIndex]);

  // Auto-advance timer
  useEffect(() => {
    if (!isAutoPlaying) return;

    const timer = setTimeout(() => {
      goToNextPanel();
    }, 5000); // 5 seconds per panel

    return () => clearTimeout(timer);
  }, [currentPanelIndex, currentStoryIndex, isAutoPlaying, goToNextPanel]);

  // Swipe gesture support
  const swipeHandlers = useSwipeGestures({
    onSwipeLeft: goToNextPanel,
    onSwipeRight: goToPreviousPanel,
  });

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
    <div 
      className="relative min-h-screen bg-black overflow-hidden"
      {...swipeHandlers}
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

      {/* Story Panel */}
      <div 
        className="w-full h-screen cursor-pointer"
        onClick={handlePanelClick}
      >
        <StoryPanel panel={currentPanel} />
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:block">
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
      </div>

      {/* Story Info */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        <div className="text-white">
          <p className="text-sm opacity-80 mb-1">
            Story {currentStoryIndex + 1} of {sampleStories.length}
          </p>
          <h1 className="text-2xl font-bold mb-2">{currentStory.title}</h1>
          <p className="text-sm opacity-90">by {currentStory.author}</p>
        </div>
      </div>
    </div>
  );
};
