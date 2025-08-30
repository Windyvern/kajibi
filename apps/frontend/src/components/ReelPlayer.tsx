import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { getMute, setMute } from '@/lib/muteBus';

interface ReelPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  onClose?: () => void;
}

export const ReelPlayer = ({ src, autoPlay = true, muted = true, onClose }: ReelPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [isMuted, setIsMuted] = useState<boolean>(getMute());
  const [progress, setProgress] = useState<number>(0); // 0..1
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let hls: Hls | null = null;
    if (src.endsWith('.m3u8')) {
      if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
      } else if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(v);
      } else {
        v.src = src;
      }
    } else {
      v.src = src;
    }
    if (autoPlay) {
      try { v.play(); } catch {}
    }
    return () => { hls?.destroy(); };
  }, [src, autoPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (!v.duration) return;
      setDuration(v.duration);
      setProgress(v.currentTime / v.duration);
    };
    const onEnd = () => {
      // loop
      try { v.currentTime = 0; v.play(); setIsPlaying(true); } catch {}
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = isMuted;
    if (isPlaying) { try { v.play(); } catch {} } else { try { v.pause(); } catch {} }
  }, [isPlaying, isMuted]);

  const togglePlay = () => setIsPlaying(p => !p);
  const toggleMute = () => {
    setIsMuted((m) => {
      const next = !m;
      setMute(next);
      return next;
    });
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const v = videoRef.current;
    if (!v || !duration) return;
    try { v.currentTime = Math.max(0, Math.min(1, x)) * duration; } catch {}
  };

  return (
    <div className="relative w-full h-full bg-black">
      {/* Close */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
      )}

      {/* Controls */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <button onClick={togglePlay} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70" aria-label={isPlaying ? 'Pause' : 'Lecture'}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button onClick={toggleMute} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70" aria-label={isMuted ? 'Activer le son' : 'Couper le son'}>
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        loop
        muted={isMuted}
        autoPlay={autoPlay}
        controls={false}
      />

      {/* Bottom progress bar (clickable) */}
      <div className="absolute left-0 right-0 bottom-0 z-20 px-6 py-4">
        <div className="w-full h-1.5 bg-white/30 rounded-full cursor-pointer" onClick={onSeek}>
          <div className="h-1.5 bg-white rounded-full" style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
        </div>
      </div>
    </div>
  );
};

export default ReelPlayer;
