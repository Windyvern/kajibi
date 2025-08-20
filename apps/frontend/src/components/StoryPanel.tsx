
import { useRef, useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { StoryPanelData } from "@/types/story";

interface StoryPanelProps {
  panel: StoryPanelData;
}

export const StoryPanel = ({ panel }: StoryPanelProps) => {
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Reset mute when media changes
    setMuted(true);
    if (videoRef.current) {
      videoRef.current.muted = true;
    }
    // Attempt autoplay muted on mount/change
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked until user interacts
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.media]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
    if (!next) {
      // Ensure playback resumes with audio after a user gesture
      v.play().catch(() => {});
    }
  };

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
          <div className="relative h-full">
            {panel.media && (
              <img
                src={panel.media}
                alt={panel.title || "Story image"}
                className="w-full h-full object-cover"
              />
            )}
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

      case "video":
        return (
          <div className="relative h-full">
            {panel.media && (
              <video
                src={panel.media}
                className="w-full h-full object-cover"
                ref={videoRef}
                autoPlay
                muted={muted}
                loop
                playsInline
              />
            )}
            {/* Mute/Unmute toggle */}
            <button
              onClick={toggleMute}
              className="absolute top-32 left-4 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
              aria-label={muted ? "Unmute video" : "Mute video"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
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
