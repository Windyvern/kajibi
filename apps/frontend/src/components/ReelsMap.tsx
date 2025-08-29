import { Map } from './Map';
import { Story } from '@/types/story';

interface ReelsMapProps {
  reels?: Story[];
  onStorySelect: (story: Story) => void;
  selectedStoryId?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  onViewChange?: (center: { lat: number; lng: number }, zoom: number) => void;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  fitPadding?: number;
  clusterAnimate?: boolean;
}

export const ReelsMap = ({ reels, onStorySelect, selectedStoryId, center, zoom, onViewChange, onBoundsChange, fitPadding, clusterAnimate }: ReelsMapProps) => {
  // Safety check for undefined reels
  if (!reels || !Array.isArray(reels)) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground">Aucun reel à afficher sur la carte</div>;
  }

  // Filter reels that have geographic data
  const geoEnhancedReels = reels.filter(reel => reel.geo && reel.geo.lat && reel.geo.lng).map(reel => ({
    ...reel,
    // Add visual identifier that this is a reel
    title: `🎬 ${reel.title}`,
  }));

  if (geoEnhancedReels.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground">Aucun reel avec géolocalisation à afficher</div>;
  }

  return (
    <Map
      stories={geoEnhancedReels}
      onStorySelect={onStorySelect}
      selectedStoryId={selectedStoryId}
      center={center}
      zoom={zoom}
      onViewChange={onViewChange}
      onBoundsChange={onBoundsChange}
      fitPadding={fitPadding}
      clusterAnimate={clusterAnimate}
    />
  );
};
