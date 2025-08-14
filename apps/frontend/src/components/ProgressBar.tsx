
interface ProgressBarProps {
  totalPanels: number;
  currentPanel: number;
  storyTitle: string;
  author: string;
}

export const ProgressBar = ({ totalPanels, currentPanel, storyTitle, author }: ProgressBarProps) => {
  return (
    <div className="w-full">
      {/* Progress segments */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: totalPanels }, (_, index) => (
          <div
            key={index}
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
          >
            <div
              className={`h-full transition-all duration-300 ${
                index < currentPanel
                  ? "w-full bg-white"
                  : index === currentPanel
                  ? "w-full bg-white animate-pulse"
                  : "w-0 bg-white"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Story info header */}
      <div className="flex items-center justify-between text-white text-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
            {author.charAt(0)}
          </div>
          <div>
            <p className="font-medium">{author}</p>
            <p className="text-xs opacity-75">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-75">
            {currentPanel + 1} / {totalPanels}
          </p>
        </div>
      </div>
    </div>
  );
};
