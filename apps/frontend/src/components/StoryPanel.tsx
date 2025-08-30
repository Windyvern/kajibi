import { useRef, useState, useEffect } from "react";
import Hls from "hls.js";
import { StoryPanelData } from "@/types/story";
import { getMute, setMute } from "@/lib/muteBus";

interface StoryPanelProps {
  panel: StoryPanelData;
  paused?: boolean;
  externalMuteToggle?: number; // increments to toggle mute from parent
  onVideoMeta?: (durationSec: number) => void;
  onVideoTime?: (currentSec: number, durationSec: number) => void;
  onVideoEnded?: () => void;
}

export const StoryPanel = ({
  panel,
  paused = false,
  externalMuteToggle,
  onVideoMeta,
  onVideoTime,
  onVideoEnded,
}: StoryPanelProps) => {
  // Persist mute state for the session; default to true (muted) at session start
  const [muted, setMuted] = useState<boolean>(getMute());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Lazily load/unload the media while in/out of viewport
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [pausedInternal, setPausedInternal] = useState(true);

  // Keep a ref to the current Hls instance (if any) so we can cleanly destroy it
  const hlsRef = useRef<Hls | null>(null);

  // Observe visibility to decide when to load/unload the source
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVideoSrc(panel.media);
      } else {
        setVideoSrc(undefined);
      }
    });

    observer.observe(v);
    return () => observer.disconnect();
  }, [panel.media]);

  // Handle (re)loading the video when videoSrc changes (includes HLS support)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Cleanup any previous HLS instance
    if (hlsRef.current) {
      try {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    if (videoSrc) {
      const isHls = /\.m3u8($|\?)/i.test(videoSrc);
      const pref = getMute();
      setMuted(pref);
      v.muted = pref;

      // Assign source depending on HLS capability
      if (isHls) {
        if (v.canPlayType("application/vnd.apple.mpegURL")) {
          // Native HLS (Safari/iOS)
          v.src = videoSrc;
        } else if (Hls.isSupported()) {
          // hls.js
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(videoSrc);
          hls.attachMedia(v);
        } else {
          // Fallback: set as src anyway (some browsers/extensions might still handle)
          v.src = videoSrc;
        }
      } else {
        v.src = videoSrc;
      }

      // Try to autoplay; if blocked, mark as paused
      v.play()
        .then(() => setPausedInternal(false))
        .catch(() => setPausedInternal(true));
    } else {
      // No source: pause and completely unload the element
      try {
        v.pause();
      } catch {}
      v.removeAttribute("src");
      v.load();
      setPausedInternal(true);
    }

    // On source change/unmount, clean HLS
    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
    };
  }, [videoSrc]);

  // Mute toggle from inside the component (optional hook if you add a button here)
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
    try {
      setMute(next);
    } catch {}
    if (!next) {
      // Ensure playback resumes with audio after a user gesture
      v.play().catch(() => {});
    }
  };

  // Allow parent to sync mute without rendering the button here
  const lastToggleRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (externalMuteToggle == null) return;
    if (lastToggleRef.current === externalMuteToggle) return;
    lastToggleRef.current = externalMuteToggle;

    const v = videoRef.current;
    const target = getMute();
    setMuted(target);
    if (v) v.muted = target;
    if (videoSrc && !target) {
      try {
        v?.play();
      } catch {}
    }
  }, [externalMuteToggle, videoSrc]);

  // React to external pause/resume
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    if (paused) {
      try {
        v.pause();
      } catch {}
      setPausedInternal(true);
    } else {
      v.play()
        .then(() => setPausedInternal(false))
        .catch(() => {
          /* ignore */
        });
    }
  }, [paused, videoSrc]);

  const renderContent = () => {
    switch (panel.type) {
      case "text":
        return (
          <div className="h-full flex flex-col justify-center items-center p-8 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
            <div className="max-w-2xl text-center">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                {panel.title}
              </h2>
              {panel.content && (
                <p className="text-lg md:text-xl text-white/90 leading-relaxed">
                  {panel.content}
                </p>
              )}
            </div>
          </div>
        );

      case "image":
        return (
          <div className="relative md:h-full">
            {panel.media && (
              <img
                src={panel.media}
                alt={panel.title || "Story image"}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0" />
            {(panel.title || panel.content) && (
              <div className="absolute bottom-0 left-0 right-0 p-8">
                {panel.title && (
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    {panel.title}
                  </h2>
                )}
                {panel.content && (
                  <p className="text-lg text-white/90 leading-relaxed">
                    {panel.content}
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case "video":
        // Note: src is set programmatically in the effect for HLS/native; keeping the attribute
        // on the element isn't required, but harmless for non-HLS cases.
        return (
          <div className="relative md:h-full">
            <video
              className="w-full h-full object-cover"
              ref={videoRef}
              data-role="main-video"
              autoPlay
              muted={muted}
              preload="auto"
              playsInline
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v && isFinite(v.duration) && v.duration > 0) {
                  onVideoMeta?.(v.duration);
                }
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v && isFinite(v.duration) && v.duration > 0) {
                  onVideoTime?.(v.currentTime, v.duration);
                }
              }}
              onPlay={() => setPausedInternal(false)}
              onPause={() => setPausedInternal(true)}
              onEnded={() => onVideoEnded?.()}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {(panel.title || panel.content) && (
              <div className="absolute bottom-0 left-0 right-0 p-8">
                {panel.title && (
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    {panel.title}
                  </h2>
                )}
                {panel.content && (
                  <p className="text-lg text-white/90 leading-relaxed">
                    {panel.content}
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case "quote":
        return (
          <div className="h-full flex flex-col justify-center items-center p-8 bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900">
            <div className="max-w-3xl text-center">
              <div className="text-6xl md:text-8xl text-white/20 mb-4">"</div>
              <blockquote className="text-2xl md:text-4xl font-light text-white mb-8 leading-relaxed italic">
                {panel.content}
              </blockquote>
              {panel.title && (
                <cite className="text-lg text-white/80 font-medium not-italic">
                  — {panel.title}
                </cite>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="h-full flex items-center justify-center bg-gray-900">
            <p className="text-white">Unsupported panel type</p>
          </div>
        );
    }
  };

  return <div className="w-full h-full animate-fade-in">{renderContent()}</div>;
};
