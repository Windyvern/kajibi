
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
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h3 className="text-lg font-semibold">Story Gallery</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
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
                src={`https://images.unsplash.com/${panel.media}?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80`}
                alt={panel.title || `Panel ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <div className="text-center p-2">
                  <p className="text-white text-xs font-medium line-clamp-3">
                    {panel.title || panel.content || `Panel ${index + 1}`}
                  </p>
                </div>
              </div>
            )}
            
            {/* Panel Number */}
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {index + 1}
            </div>
            
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
