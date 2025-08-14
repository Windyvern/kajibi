
import { StoryPanelData } from "@/types/story";

interface StoryPanelProps {
  panel: StoryPanelData;
}

export const StoryPanel = ({ panel }: StoryPanelProps) => {
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
            <img
              src={`https://images.unsplash.com/${panel.media}?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80`}
              alt={panel.title || "Story image"}
              className="w-full h-full object-cover"
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

  return (
    <div className="w-full h-full animate-fade-in">
      {renderContent()}
    </div>
  );
};
