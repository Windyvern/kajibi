import { Map } from './Map';
import { Story } from '@/types/story';

interface PostsMapProps {
  posts?: Story[];
  onStorySelect: (story: Story) => void;
  selectedStoryId?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  onViewChange?: (center: { lat: number; lng: number }, zoom: number) => void;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  fitPadding?: number;
  clusterAnimate?: boolean;
}

export const PostsMap = ({ posts, onStorySelect, selectedStoryId, center, zoom, onViewChange, onBoundsChange, fitPadding, clusterAnimate }: PostsMapProps) => {
  // Safety check for undefined posts
  if (!posts || !Array.isArray(posts)) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground">Aucun post à afficher sur la carte</div>;
  }

  // Filter posts that have geographic data
  const geoEnhancedPosts = posts.filter(post => post.geo && post.geo.lat && post.geo.lng).map(post => ({
    ...post,
    // Add visual identifier that this is a post
    title: `📸 ${post.title}`,
  }));

  if (geoEnhancedPosts.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground">Aucun post avec géolocalisation à afficher</div>;
  }

  return (
    <Map
      stories={geoEnhancedPosts}
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
