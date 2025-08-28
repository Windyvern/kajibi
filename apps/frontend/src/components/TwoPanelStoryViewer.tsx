
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Grid3X3, X, ChevronDown, ChevronUp, Pause, Play, Volume2, VolumeX, ChevronsUp } from "lucide-react";
import { StoryPanel } from "./StoryPanel";
import { ProgressBar } from "./ProgressBar";
import { StoryGalleryOverlay } from "./StoryGalleryOverlay";
import { StoryMetadata } from "./StoryMetadata";
import { Story } from "@/types/story";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import { getMute, setMute } from "@/lib/muteBus";

interface TwoPanelStoryViewerProps {
  initialStoryId?: string;
  initialPanelId?: string;
  stories: Story[];
  onClose?: () => void;
  rightPanelContent?: React.ReactNode;
  hideMetadataPanel?: boolean;
  hideRightPanel?: boolean;
  onStoryChange?: (story: Story, index: number) => void;
  // Gallery-only behavior: on mobile, advance to next/prev story via swipe and after last panel
  advanceStoryOnMobile?: boolean;
  // When advancing stories on mobile, treat the first group (e.g., in-bounds) as cyclic among itself
  firstGroupCount?: number;
}

export const TwoPanelStoryViewer = ({ 
  initialStoryId, 
  initialPanelId,
  stories,
  onClose,
  rightPanelContent,
  hideMetadataPanel,
  hideRightPanel,
  onStoryChange,
  advanceStoryOnMobile = false,
  firstGroupCount,
}: TwoPanelStoryViewerProps) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(() => {
    if (initialStoryId) {
      const index = stories.findIndex(story => story.id === initialStoryId);
      return index >= 0 ? index : 0;
    }
    return 0;
  });
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  // Persistent and hold-to-pause controls; effective play state derives from these
  const [pausedPersistent, setPausedPersistent] = useState(false);
  const [holdPaused, setHoldPaused] = useState(false);
  // Mute UI state kept in parent so button aligns consistently; StoryPanel enforces actual mute
  const [mutedUI, setMutedUI] = useState<boolean>(getMute());
  const [muteToggleTick, setMuteToggleTick] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [panelProgress, setPanelProgress] = useState(0); // 0..1
  const [panelDuration, setPanelDuration] = useState<number>(5);
  const [showGallery, setShowGallery] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  // Refs to stabilize timers and callbacks
  const nextRef = useRef<() => void>(() => {});
  const nonVideoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nonVideoLastTickRef = useRef<number | null>(null);
  const nonVideoProgressRef = useRef<number>(0);

  const currentStory = stories[currentStoryIndex];
  const hasPanels = (currentStory?.panels?.length || 0) > 0;
  const currentPanel = hasPanels ? currentStory?.panels[currentPanelIndex] : undefined;

  // Notify parent when the current story changes
  useEffect(() => {
    if (currentStory && typeof onStoryChange === 'function') {
      try { onStoryChange(currentStory, currentStoryIndex); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryIndex, currentStory?.id]);

  // Simple prefetch of next image to reduce visible loading/cancellations
  useEffect(() => {
    if (!hasPanels) return;
    const nextIndex = currentPanelIndex + 1;
    const next = currentStory?.panels[nextIndex];
    if (next && next.type === 'image' && next.media) {
      const img = new Image();
      img.src = next.media;
    }
  }, [currentPanelIndex, currentStory, hasPanels]);

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

  // Apply initialStoryId only when it changes (or stories list changes),
  // so user-initiated navigation (swipes) doesn't get reverted.
  const appliedInitialStoryIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialStoryId) return;
    if (appliedInitialStoryIdRef.current === initialStoryId) return;
    const index = stories.findIndex((s) => s.id === initialStoryId);
    if (index >= 0) {
      setCurrentStoryIndex(index);
      const story = stories[index];
      if (initialPanelId) {
        const idx = story.panels.findIndex((p) => p.id === initialPanelId);
        setCurrentPanelIndex(idx >= 0 ? idx : 0);
      } else {
        setCurrentPanelIndex(0);
      }
      appliedInitialStoryIdRef.current = initialStoryId;
    }
  }, [initialStoryId, initialPanelId, stories]);

  // Ensure we jump to the requested panel only once per story selection
  const appliedInitialForStoryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialPanelId) return;
    const story = stories[currentStoryIndex];
    if (!story) return;
    if (appliedInitialForStoryRef.current === story.id) return;
    const idx = story.panels.findIndex(p => p.id === initialPanelId || p.slug === initialPanelId);
    if (idx >= 0) {
      setCurrentPanelIndex(idx);
      appliedInitialForStoryRef.current = story.id;
    }
  }, [initialPanelId, currentStoryIndex, stories]);

  // Calculate responsive panel visibility based on window aspect ratio
  const [windowAspectRatio, setWindowAspectRatio] = useState(window.innerWidth / window.innerHeight);
  const [isMdUp, setIsMdUp] = useState(() => {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      return window.matchMedia('(min-width: 768px)').matches;
    }
    return false;
  });


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
  // Keep a stable ref to the latest next handler without retriggering effects
  nextRef.current = goToNextPanel;

  const goToPreviousPanel = useCallback(() => {
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(prev => prev - 1);
    } else if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setCurrentPanelIndex(stories[currentStoryIndex - 1].panels.length - 1);
    }
  }, [currentStoryIndex, currentPanelIndex, stories]);

  // Story-level navigation helpers
  const goToNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex((i) => i + 1);
      setCurrentPanelIndex(0);
    }
  }, [currentStoryIndex, stories.length]);

  const goToPreviousStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((i) => i - 1);
      // Jump to first panel for prior story by default
      setCurrentPanelIndex(0);
    }
  }, [currentStoryIndex]);

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

  // Reset progress and set duration on panel/story changes
  useEffect(() => {
    setPanelProgress(0);
    nonVideoProgressRef.current = 0;
    nonVideoLastTickRef.current = null;
    const fallback = currentPanel?.duration && currentPanel.duration > 0 ? currentPanel.duration : 5;
    setPanelDuration(fallback);
  }, [currentPanelIndex, currentStoryIndex, currentPanel?.duration]);

  // Smooth progress for non-video panels using delta timer that pauses/resumes without resetting
  useEffect(() => {
    const isVideo = currentPanel?.type === 'video';
    const effectivePlaying = !(pausedPersistent || holdPaused);
    // Cleanup any existing timer first
    if (nonVideoTimerRef.current) {
      clearInterval(nonVideoTimerRef.current);
      nonVideoTimerRef.current = null;
    }
    if (!effectivePlaying || showGallery || isVideo) return;
    const totalMs = Math.max(0.5, panelDuration) * 1000;
    nonVideoLastTickRef.current = null; // restart delta tracking
    nonVideoTimerRef.current = setInterval(() => {
      const now = Date.now();
      const last = nonVideoLastTickRef.current;
      nonVideoLastTickRef.current = now;
      const delta = last ? now - last : 0;
      const inc = delta / totalMs;
      if (inc > 0) {
        nonVideoProgressRef.current = Math.min(1, nonVideoProgressRef.current + inc);
        const p = nonVideoProgressRef.current;
        setPanelProgress(p);
        if (p >= 1) {
          if (nonVideoTimerRef.current) {
            clearInterval(nonVideoTimerRef.current);
            nonVideoTimerRef.current = null;
          }
          nextRef.current();
        }
      }
    }, 50);
    return () => {
      if (nonVideoTimerRef.current) {
        clearInterval(nonVideoTimerRef.current);
        nonVideoTimerRef.current = null;
      }
    };
  }, [currentPanelIndex, currentStoryIndex, currentPanel?.type, pausedPersistent, holdPaused, showGallery, panelDuration]);

  // Keep UI mute state in sync with session pref on panel change
  useEffect(() => { setMutedUI(getMute()); }, [currentPanelIndex]);

  // Intentionally do not subscribe to global mute while the viewer is open;
  // the local toggle controls the global bus, not the other way around.

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
      if (e.key === ' ') {
        e.preventDefault();
        setPausedPersistent((p) => !p);
        return;
      }
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

  // Lock page scroll on mobile while the viewer is open
  useEffect(() => {
    if (isMdUp) return;
    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyPos = body.style.position;
    const prevBodyWidth = body.style.width;
    const prevBodyTouch = (body.style as any).touchAction || '';
    try {
      body.style.overflow = 'hidden';
      documentElement.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.width = '100%';
      (body.style as any).touchAction = 'none';
    } catch {}
    return () => {
      try {
        body.style.overflow = prevBodyOverflow;
        documentElement.style.overflow = prevHtmlOverflow;
        body.style.position = prevBodyPos;
        body.style.width = prevBodyWidth;
        (body.style as any).touchAction = prevBodyTouch;
      } catch {}
    };
  }, [isMdUp]);
  
  useEffect(() => {
    const updateAspectRatio = () => {
      setWindowAspectRatio(window.innerWidth / window.innerHeight);
      try { setIsMdUp(window.matchMedia('(min-width: 768px)').matches); } catch {}
    };
    
    window.addEventListener('resize', updateAspectRatio);
    return () => window.removeEventListener('resize', updateAspectRatio);
  }, []);

  const shouldShowRightPanel = !hideRightPanel && windowAspectRatio >= 16/9; // Show only if aspect ratio is 16:9 or wider
  const shouldShowMetadataPanel = !hideMetadataPanel && windowAspectRatio >= 4/3; // Show only if aspect ratio is 4:3 or wider

  // Show a furtive swipe-up hint on mobile each time a story opens
  useEffect(() => {
    if (isMdUp) return; // only mobile layout
    try {
      setShowSwipeHint(true);
      // total visible time = delay (0.5s) + animation duration (1s)
      const t = setTimeout(() => setShowSwipeHint(false), 1500);
      return () => clearTimeout(t);
    } catch {}
  }, [isMdUp, currentStory?.id]);

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

  if (!currentStory) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  if (!hasPanels) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <p>No content panels for this article yet.</p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pause any stray videos when switching panels/layout or opening gallery
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll('video')) as HTMLVideoElement[];
    for (const v of nodes) {
      // If gallery is open, pause everything. Otherwise pause all except the main video.
      const isMain = v.getAttribute('data-role') === 'main-video';
      if (showGallery || !isMain) {
        try { v.pause(); } catch {}
        // Ensure muted to avoid any audio glitch
        try { v.muted = true; } catch {}
      }
    }
  }, [currentPanelIndex, isMdUp, showGallery]);

  const isControlTarget = (evt: React.SyntheticEvent | MouseEvent | TouchEvent) => {
    const t = (evt.target as HTMLElement) || null;
    return !!(t && t.closest('[data-ui-control="true"]'));
  };

  const withinPlayPauseZone = (evt: React.MouseEvent | React.TouchEvent, el: HTMLElement | null) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const clientX = 'touches' in evt && evt.touches[0] ? evt.touches[0].clientX : (evt as React.MouseEvent).clientX;
    const clientY = 'touches' in evt && evt.touches[0] ? evt.touches[0].clientY : (evt as React.MouseEvent).clientY;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    // Central zone (adjust if needed to match ForCodex/limits.png)
    const X0 = 0.20, X1 = 0.80; // 20% .. 80% width
    const Y0 = 0.15, Y1 = 0.85; // 15% .. 85% height
    return x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
  };

  // Pinch-to-close gesture tracking (two-finger inward pinch)
  const pinchRef = useRef<{ start?: number; active?: boolean }>({ start: undefined, active: false });
  const onTouchStartPinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current.start = Math.hypot(dx, dy);
      pinchRef.current.active = true;
    }
  };
  const onTouchMovePinch = (e: React.TouchEvent) => {
    if (pinchRef.current.active && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const start = pinchRef.current.start || dist;
      if (start > 0) {
        const scale = dist / start;
        if (scale < 0.8) {
          pinchRef.current.active = false;
          if (onClose) onClose();
        }
      }
    }
  };

  // Compose swipe + pinch handlers so both work
  const composedTouchStart: React.TouchEventHandler = (e) => {
    try { mobileSwipeHandlers.onTouchStart?.(e as any); } catch {}
    onTouchStartPinch(e);
  };
  const composedTouchMove: React.TouchEventHandler = (e) => {
    try { mobileSwipeHandlers.onTouchMove?.(e as any); } catch {}
    onTouchMovePinch(e);
  };
  const composedTouchEnd: React.TouchEventHandler = (e) => {
    try { mobileSwipeHandlers.onTouchEnd?.(e as any); } catch {}
  };

  const mobileLayout = (
    <div 
      className="fixed inset-0 overflow-hidden"
      style={{ height: '100svh', touchAction: 'none' }}
      ref={containerRef}
      onTouchStart={composedTouchStart}
      onTouchMove={composedTouchMove}
      onTouchEnd={composedTouchEnd}
      onMouseDown={mobileSwipeHandlers.onMouseDown as any}
      onMouseMove={mobileSwipeHandlers.onMouseMove as any}
      onMouseUp={mobileSwipeHandlers.onMouseUp as any}
      onWheel={(e) => {
        // Allow opening with either direction to match user expectation
        if (!showMetadataPanel && (e.deltaY < -30 || e.deltaY > 60)) setShowMetadataPanel(true);
        if (showMetadataPanel && e.deltaY > 30) setShowMetadataPanel(false);
      }}
    >
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <ProgressBar
          totalPanels={currentStory.panels.length}
          currentPanel={currentPanelIndex}
          currentProgress={panelProgress}
          storyTitle={currentStory.title}
          author={currentStory.author}
          authorSlug={currentStory.authorSlug}
          uploaderName={currentStory.username}
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
          avatarUrl={currentStory.avatarUrl}
          onClose={onClose}
        />
      </div>

      <button
        onClick={() => setShowGallery(true)}
        className="absolute top-20 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
        data-ui-control="true"
      >
        <Grid3X3 size={20} />
      </button>

      {/* Pause/Play toggle under gallery button */}
        <button
          onClick={() => setPausedPersistent((p) => !p)}
          className="absolute top-32 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
          aria-label={(pausedPersistent || holdPaused) ? 'Play' : 'Pause'}
          data-ui-control="true"
        >
          {(pausedPersistent || holdPaused) ? <Play size={20} /> : <Pause size={20} />}
        </button>

        {/* Mute/Unmute aligned with controls, only for videos */}
        {currentPanel?.type === 'video' && (
          <button
            onClick={() => { setMutedUI((m) => { const v = !m; setMute(v); return v; }); setMuteToggleTick((t) => t + 1); }}
            className="absolute top-44 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
            aria-label={mutedUI ? 'Unmute' : 'Mute'}
            data-ui-control="true"
          >
            {mutedUI ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}

      <div 
        className="w-full h-screen cursor-pointer bg-black flex items-center justify-center"
        onClick={handlePanelClick}
        onMouseDown={(e) => { if (!isControlTarget(e) && withinPlayPauseZone(e, (e.currentTarget as HTMLElement))) setHoldPaused(true); }}
        onMouseUp={() => setHoldPaused(false)}
        onMouseLeave={() => setHoldPaused(false)}
        onTouchStart={(e) => { if (!isControlTarget(e) && withinPlayPauseZone(e, (e.currentTarget as HTMLElement))) setHoldPaused(true); }}
        onTouchEnd={() => setHoldPaused(false)}
        onTouchCancel={() => setHoldPaused(false)}
      >
        <div style={{ width: '56.25vh', height: '100vh' }} className="flex items-center justify-center">
          <StoryPanel 
            panel={currentPanel}
            paused={pausedPersistent || holdPaused}
            externalMuteToggle={muteToggleTick}
            onVideoMeta={(dur) => setPanelDuration(dur)}
            onVideoTime={(t, d) => {
              const p = Math.max(0, Math.min(1, t / d));
              setPanelProgress(p);
            }}
            onVideoEnded={() => {
              const effectivePlaying = !(pausedPersistent || holdPaused);
              if (effectivePlaying) goToNextPanel();
            }}
          />
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); goToPreviousPanel(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 active:bg-black/60"
          aria-label="Previous"
          disabled={currentStoryIndex === 0 && currentPanelIndex === 0}
          data-ui-control="true"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); goToNextPanel(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 active:bg-black/60"
          aria-label="Next"
          data-ui-control="true"
        >
          <ChevronRight size={22} />
        </button>

        {/* Furtive swipe-up hint – white, subtle, 1s animation */}
        {showSwipeHint && (
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-14 z-30 flex flex-col items-center justify-center opacity-90">
            <style>{`
              @keyframes kajiSwipeUpOnce {
                0% { transform: translateY(8px); opacity: 0; }
                20% { opacity: 1; }
                80% { opacity: 1; }
                100% { transform: translateY(-8px); opacity: 0; }
              }
            `}</style>
            <div style={{ animation: 'kajiSwipeUpOnce 1s ease-out 0.5s forwards', opacity: 0 }}>
              <ChevronsUp size={56} color="#FFFFFF" />
            </div>
          </div>
        )}
      </div>

      <div 
        className={`absolute bottom-0 left-0 right-0 bg-white transition-transform duration-300 ease-out z-40 ${
          showMetadataPanel ? 'transform translate-y-0' : 'transform translate-y-full'
        }`}
        style={{ height: '50vh' }}
      >
        <div className="p-4 h-full overflow-y-auto">
          <div className="flex justify-end items-center mb-2">
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

      {showGallery && (
        <StoryGalleryOverlay
          story={currentStory}
          currentPanelIndex={currentPanelIndex}
          onPanelSelect={jumpToPanel}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );

  const desktopLayout = (
    <div className="min-h-screen flex" ref={containerRef}>
      <div 
        className="flex justify-center items-center bg-black flex-shrink-0"
        style={{ width: '56.25vh', height: '100vh' }}
      >
        <div 
          className="relative bg-black w-full h-full"
          style={{ width: '100%', height: '100%' }}
          {...desktopSwipeHandlers}
        >
          <div className="absolute top-0 left-0 right-0 z-20 p-4">
            <ProgressBar
              totalPanels={currentStory.panels.length}
              currentPanel={currentPanelIndex}
              currentProgress={panelProgress}
              storyTitle={currentStory.title}
              author={currentStory.author}
              uploaderName={currentStory.username}
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
              avatarUrl={currentStory.avatarUrl}
              onClose={onClose}
            />
          </div>

          <button
            onClick={() => setShowGallery(true)}
            className="absolute top-20 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
            data-ui-control="true"
          >
            <Grid3X3 size={20} />
          </button>

          {/* Pause/Play toggle under gallery button */}
          <button
            onClick={() => setPausedPersistent((p) => !p)}
            className="absolute top-32 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
            aria-label={(pausedPersistent || holdPaused) ? 'Play' : 'Pause'}
            data-ui-control="true"
          >
            {(pausedPersistent || holdPaused) ? <Play size={20} /> : <Pause size={20} />}
          </button>

          {currentPanel?.type === 'video' && (
            <button
              onClick={() => { setMutedUI((m) => { const v = !m; setMute(v); return v; }); setMuteToggleTick((t) => t + 1); }}
              className="absolute top-44 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all duration-200"
              aria-label={mutedUI ? 'Unmute' : 'Mute'}
              data-ui-control="true"
            >
              {mutedUI ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          )}

          <div 
            className="w-full h-screen cursor-pointer"
            onClick={handlePanelClick}
            onMouseDown={(e) => { if (!isControlTarget(e) && withinPlayPauseZone(e, (e.currentTarget as HTMLElement))) setHoldPaused(true); }}
            onMouseUp={() => setHoldPaused(false)}
            onMouseLeave={() => setHoldPaused(false)}
            onTouchStart={(e) => { if (!isControlTarget(e) && withinPlayPauseZone(e, (e.currentTarget as HTMLElement))) setHoldPaused(true); }}
            onTouchEnd={() => setHoldPaused(false)}
            onTouchCancel={() => setHoldPaused(false)}
          >
            <StoryPanel 
              panel={currentPanel}
              paused={pausedPersistent || holdPaused}
              externalMuteToggle={muteToggleTick}
              onVideoMeta={(dur) => setPanelDuration(dur)}
              onVideoTime={(t, d) => {
                const p = Math.max(0, Math.min(1, t / d));
                setPanelProgress(p);
              }}
              onVideoEnded={() => {
                const effectivePlaying = !(pausedPersistent || holdPaused);
                if (effectivePlaying) goToNextPanel();
              }}
            />
          </div>

            <button
              onClick={(e) => { e.stopPropagation(); goToPreviousPanel(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all duration-200"
              disabled={currentStoryIndex === 0 && currentPanelIndex === 0}
              data-ui-control="true"
            >
              <ChevronLeft size={24} />
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); goToNextPanel(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all duration-200"
              data-ui-control="true"
            >
              <ChevronRight size={24} />
            </button>

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

      {shouldShowMetadataPanel && (
        <div className="bg-white relative flex-1 max-w-md">
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

      {shouldShowRightPanel && !isRightPanelCollapsed && (
        <div className="bg-white relative flex-1 max-w-md border-l">
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
  );

  return (
    <div className="min-h-screen bg-black">
      {isMdUp ? desktopLayout : mobileLayout}
    </div>
  );
};
