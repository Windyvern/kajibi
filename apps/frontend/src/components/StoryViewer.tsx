
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
  const [panelProgress, setPanelProgress] = useState(0);
  const [panelDuration, setPanelDuration] = useState<number>(5);

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

  // Reset progress/duration on panel change
  useEffect(() => {
    setPanelProgress(0);
    const d = currentPanel?.duration && currentPanel.duration > 0 ? currentPanel.duration : 5;
    setPanelDuration(d);
  }, [currentPanelIndex, currentStoryIndex, currentPanel?.duration]);

  // Smooth progress timer
  useEffect(() => {
    if (!isAutoPlaying) return;
    const totalMs = Math.max(0.5, panelDuration) * 1000;
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / totalMs);
      setPanelProgress(p);
      if (p >= 1) {
        clearInterval(id);
        goToNextPanel();
      }
    }, 100);
    return () => clearInterval(id);
  }, [panelDuration, isAutoPlaying, goToNextPanel]);

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

  // Keyboard arrow navigation
  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if ((t as HTMLElement).isContentEditable) return true;
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPanel();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousPanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToNextPanel, goToPreviousPanel]);

  if (!currentStory || !currentPanel) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div 
      className="relative min-h-screen bg-black overflow-hidden"
      {...swipeHandlers}
    >
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <ProgressBar
          totalPanels={currentStory.panels.length}
          currentPanel={currentPanelIndex}
          currentProgress={panelProgress}
          storyTitle={currentStory.title}
          author={currentStory.author}
          dateText={(() => {
            const media = currentPanel?.media || '';
            const file = media.split('?')[0].split('#')[0].split('/').pop() || media;
            const m = file.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
            if (m) {
              const iso = `${m[1]}-${m[2]}-${m[3]}`;
              const d = new Date(iso);
              if (!isNaN(d.getTime())) return d.toLocaleDateString();
            }
            return undefined;
          })()}
        />
      </div>

      {/* Story Panel */}
      <div 
        className="w-full h-screen cursor-pointer"
        onClick={handlePanelClick}
      >
        <StoryPanel panel={currentPanel} />
      </div>

      {/* Navigation Arrows (mobile + desktop) */}
      <button
        onClick={(e) => { e.stopPropagation(); goToPreviousPanel(); }}
        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all duration-200"
        disabled={currentStoryIndex === 0 && currentPanelIndex === 0}
        aria-label="Previous"
      >
        <ChevronLeft size={24} />
      </button>
      
      <button
        onClick={(e) => { e.stopPropagation(); goToNextPanel(); }}
        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all duration-200"
        aria-label="Next"
      >
        <ChevronRight size={24} />
      </button>

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
