
import { X } from "lucide-react";
import { Story } from "@/types/story";

interface StoryGalleryOverlayProps {
  story: Story;
  currentPanelIndex: number;
  onPanelSelect: (index: number) => void;
  onClose: () => void;
}

export const StoryGalleryOverlay = ({ 
  story, 
  currentPanelIndex, 
  onPanelSelect, 
  onClose 
}: StoryGalleryOverlayProps) => {
  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm mb-3 px-3">
      {/* Header */}
      <div className="flex items-center justify-between mt-3 p-4 text-white">
        <h3 className="text-lg font-semibold">Contenu</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-3 p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
        {story.panels.map((panel, index) => (
          <button
            key={panel.id}
            onClick={() => onPanelSelect(index)}
            className={`relative aspect-[9/16] rounded-lg overflow-hidden transition-all duration-200 ${
              index === currentPanelIndex 
                ? "ring-2 ring-white scale-105" 
                : "hover:scale-105 hover:ring-1 hover:ring-white/50"
            }`}
          >
            {panel.type === "image" && panel.media ? (
              <img
                src={panel.media}
                alt={panel.title || `Panel ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : panel.type === 'video' && panel.media ? (
              <div className="w-full h-full relative">
                <video
                  src={panel.media}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                  autoPlay={false}
                  controls={false}
                  onPlay={(e) => { try { e.currentTarget.pause(); } catch {} }}
                  onLoadedMetadata={(e) => {
                    // Try to display first frame
                    const v = e.currentTarget;
                    try { v.currentTime = 0.01; } catch {}
                    try { v.pause(); } catch {}
                  }}
                />
                {/* Play overlay icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <img src="/icons/play.svg" alt="Play" className="w-12 h-12 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <div className="text-center p-2">
                  <p className="text-white text-xs font-medium line-clamp-3">
                    {panel.title || panel.content || `Panel ${index + 1}`}
                  </p>
                </div>
              </div>
            )}
            
            {/* Number indicator removed as requested */}
            
            {/* Current Indicator */}
            {index === currentPanelIndex && (
              <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
