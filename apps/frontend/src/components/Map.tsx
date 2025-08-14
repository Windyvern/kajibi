
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Story } from '@/types/story';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  stories: Story[];
  onStorySelect: (story: Story) => void;
  selectedStoryId?: string;
}

export const Map = ({ stories, onStorySelect, selectedStoryId }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    mapInstanceRef.current = L.map(mapRef.current).setView([39.8283, -98.5795], 4);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    // Initialize marker cluster group
    markersRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        const latestMarker = markers[0]; // Get the first marker
        const thumbnailUrl = (latestMarker as any).thumbnailUrl || null;
        
        return L.divIcon({
          html: `
            <div class="marker-container">
              <div class="cluster-marker">
                ${thumbnailUrl 
                  ? `<img src="${thumbnailUrl}" alt="Cluster" class="cluster-thumbnail" />` 
                  : `<div class="marker-placeholder">+</div>`
                }
                <div class="cluster-count">${count}</div>
              </div>
              <span class="arrow"></span>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: L.point(96, 190),
          iconAnchor: [48, 190]
        });
      }
    });

    mapInstanceRef.current.addLayer(markersRef.current);

    // Add custom CSS styles to document head
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .marker-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .marker-frame {
        display: inline-block;
        background: #f0f0f0;
        border: 2px solid #fff;
        border-radius: 15px;
        box-sizing: border-box;
        padding: 5px;
        width: 96px;
        height: 170px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .marker-frame:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      }
      .marker-frame.selected {
        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        border: 2px solid #3b82f6;
      }
      .marker-frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 10px;
      }
      .marker-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 24px;
      }
      .arrow {
        width: 0;
        height: 0;
        border-left: 12px solid transparent;
        border-right: 12px solid transparent;
        border-top: 20px solid #fff;
        margin-top: -2px;
        position: relative;
      }
      .arrow::before {
        content: '';
        position: absolute;
        top: -23px;
        left: -10px;
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 18px solid #f0f0f0;
      }
      .cluster-marker {
        display: inline-block;
        background: none;
        border: 2px solid #fff;
        border-radius: 15px;
        box-sizing: border-box;
        background-color: #f0f0f0;
        padding: 5px;
        width: 96px;
        height: 170px;
        position: relative;
        overflow: hidden;
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.2);
        cursor: pointer;
      }
      .cluster-count {
        position: absolute;
        top: 5px;
        right: 5px;
        background: #3b82f6;
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        z-index: 1;
      }
      .cluster-thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 10px;
      }
      .custom-cluster-icon {
        background: transparent !important;
        border: none !important;
      }
      .custom-story-marker {
        background: transparent !important;
        border: none !important;
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      // Clean up styles
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Add markers for each story
    stories.forEach((story) => {
      if (!story.geo) return;

      const thumbnailPanel = story.panels.find(p => p.id === story.thumbnailPanelId) || story.panels[0];
      const thumbnailUrl = thumbnailPanel?.media 
        ? `https://images.unsplash.com/${thumbnailPanel.media}?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200&q=80`
        : null;

      const isSelected = story.id === selectedStoryId;

      const markerIcon = L.divIcon({
        html: `
          <div class="marker-container">
            <div class="marker-frame ${isSelected ? 'selected' : ''}" data-story-id="${story.id}">
              ${thumbnailUrl 
                ? `<img src="${thumbnailUrl}" alt="${story.title}" />` 
                : `<div class="marker-placeholder">${story.title[0]}</div>`
              }
            </div>
            <span class="arrow"></span>
          </div>
        `,
        className: 'custom-story-marker',
        iconSize: [96, 190],
        iconAnchor: [48, 190]
      });

      const marker = L.marker([story.geo.lat, story.geo.lng], { icon: markerIcon });
      
      // Store thumbnail URL for cluster use
      (marker as any).thumbnailUrl = thumbnailUrl;
      
      marker.on('click', () => {
        onStorySelect(story);
      });

      markersRef.current.addLayer(marker);
    });
  }, [stories, onStorySelect, selectedStoryId]);

  // Force map to resize and re-center when container size changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 300); // Wait for transition to complete
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};
