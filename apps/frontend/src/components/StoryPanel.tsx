
import { useRef, useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
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

export const StoryPanel = ({ panel, paused = false, externalMuteToggle, onVideoMeta, onVideoTime, onVideoEnded }: StoryPanelProps) => {
  // Persist mute state for the session; default to true (muted) at session start
  const [muted, setMuted] = useState<boolean>(getMute());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [pausedInternal, setPausedInternal] = useState(true);

  // Load/unload video based on viewport visibility
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

  // React when the video source is toggled
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (videoSrc) {
      const pref = getMute();
      setMuted(pref);
      v.muted = pref;
      v.play().then(() => setPausedInternal(false)).catch(() => {
        setPausedInternal(true);
      });
    } else {
      try { v.pause(); } catch {}
      v.removeAttribute("src");
      v.load();
      setPausedInternal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
    try { setMute(next); } catch {}
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
    if (videoSrc && !target) { try { v?.play(); } catch {} }
  }, [externalMuteToggle, videoSrc]);

  // React to external pause/resume
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    if (paused) {
      try { v.pause(); } catch {}
      setPausedInternal(true);
    } else {
      v.play().then(() => setPausedInternal(false)).catch(() => {/* ignore */});
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
        return (
          <div className="relative md:h-full">
            <video
              src={videoSrc}
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
            {/* Mute button rendered by parent for consistent alignment across layouts */}
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

  return (
    <div className="w-full h-full animate-fade-in">
      {renderContent()}
    </div>
  );
};
