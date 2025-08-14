
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Highlight {
  id: string;
  title: string;
  thumbnail: string;
  panelIds: string[];
}

interface StoryHighlightsProps {
  highlights: Highlight[];
  onHighlightSelect: (highlight: Highlight) => void;
  selectedHighlightId?: string;
}

export const StoryHighlights = ({ 
  highlights, 
  onHighlightSelect, 
  selectedHighlightId 
}: StoryHighlightsProps) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  const scrollLeft = () => {
    setScrollPosition(prev => Math.max(0, prev - 200));
  };

  const scrollRight = () => {
    const maxScroll = Math.max(0, highlights.length * 80 - 300);
    setScrollPosition(prev => Math.min(maxScroll, prev + 200));
  };

  if (!highlights || highlights.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Highlights</h3>
      <div className="relative">
        {/* Left Arrow */}
        {scrollPosition > 0 && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all duration-200"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Highlights Container */}
        <div className="overflow-hidden">
          <div 
            className="flex gap-3 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${scrollPosition}px)` }}
          >
            {highlights.map((highlight) => (
              <button
                key={highlight.id}
                onClick={() => onHighlightSelect(highlight)}
                className={`flex-shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                  selectedHighlightId === highlight.id
                    ? 'border-blue-500 scale-105'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={`https://images.unsplash.com/${highlight.thumbnail}?ixlib=rb-4.0.3&auto=format&fit=crop&w=64&h=64&q=80`}
                  alt={highlight.title}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right Arrow */}
        {scrollPosition < highlights.length * 80 - 300 && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white shadow-md hover:bg-gray-50 transition-all duration-200"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Selected Highlight Title */}
      {selectedHighlightId && (
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-600">
            {highlights.find(h => h.id === selectedHighlightId)?.title}
          </span>
        </div>
      )}
    </div>
  );
};
