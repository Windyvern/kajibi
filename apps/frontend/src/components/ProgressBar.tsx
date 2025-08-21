
import { X } from 'lucide-react';

interface ProgressBarProps {
  totalPanels: number;
  currentPanel: number;
  // 0..1 progress for the current panel
  currentProgress?: number;
  storyTitle: string;
  author: string;
  uploaderName?: string;
  dateText?: string;
  avatarUrl?: string;
  onClose?: () => void;
}

export const ProgressBar = ({ totalPanels, currentPanel, currentProgress = 0, storyTitle, author, uploaderName, dateText, avatarUrl, onClose }: ProgressBarProps) => {
  const name = uploaderName || author;
  const dateLabel = dateText || new Date().toLocaleDateString();
  return (
    <div className="w-full">
      {/* Progress segments */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: totalPanels }, (_, index) => {
          const isPast = index < currentPanel;
          const isCurrent = index === currentPanel;
          const baseColor = '#ffffff4d'; // half-transparent white background
          const fillWidth = isPast ? '100%' : isCurrent ? `${Math.max(0, Math.min(100, currentProgress * 100))}%` : '0%';
          return (
            <div key={index} className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: baseColor }}>
              <div
                className="h-full"
                style={{ width: fillWidth, backgroundColor: '#ffffffff', transition: 'width 120ms linear' }}
              />
            </div>
          );
        })}
      </div>

      {/* Story info header */}
      <div className="flex items-center justify-between text-white text-sm">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-xs opacity-75">{dateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs opacity-75 min-w-[60px] text-right">
            {currentPanel + 1} / {totalPanels}
          </p>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 transition flex items-center justify-center"
            >
              <X size={22} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
