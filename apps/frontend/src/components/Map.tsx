
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
  center?: { lat: number; lng: number };
  zoom?: number;
  onViewChange?: (center: { lat: number; lng: number }, zoom: number) => void;
  fitBounds?: [[number, number], [number, number]];
  fitPadding?: number;
}

export const Map = ({ stories, onStorySelect, selectedStoryId, center, zoom, onViewChange, fitBounds, fitPadding = 60 }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const lastFitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const initCenter: [number, number] = center ? [center.lat, center.lng] : [39.8283, -98.5795];
    const initZoom: number = typeof zoom === 'number' ? zoom : 4;
    mapInstanceRef.current = L.map(mapRef.current, { zoomControl: false }).setView(initCenter, initZoom);

    // Add tile layer (Carto light style to match legacy design)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
      subdomains: 'abcd'
    }).addTo(mapInstanceRef.current);

    // Initialize marker cluster group
    markersRef.current = L.markerClusterGroup({
      maxClusterRadius: 80,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const childMarkers = cluster.getAllChildMarkers();
        const first = childMarkers[0] as any;
        const thumbnailUrl = first?.thumbnailUrl || null;
        return L.divIcon({
          html: `
            <div class="marker-container">
              <div class="marker-frame">
                ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="Cluster" />` : ''}
              </div>
              <span class="arrow"></span>
            </div>
            <div class="cluster-counter ${count < 10 ? 'cluster-small' : ''}">${count}</div>
          `,
          className: 'custom-cluster-icon',
          iconSize: L.point(96, 190),
          iconAnchor: [48, 190]
        });
      }
    });

    mapInstanceRef.current.addLayer(markersRef.current);

    // Emit view changes to parent (e.g., to persist center/zoom across remounts)
    if (onViewChange) {
      const emit = () => {
        const c = mapInstanceRef.current!.getCenter();
        const z = mapInstanceRef.current!.getZoom();
        onViewChange({ lat: c.lat, lng: c.lng }, z);
      };
      mapInstanceRef.current.on('moveend', emit);
    }

    // Add custom CSS styles to document head
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .marker-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform 0.2s ease;
      }
      .marker-frame {
        display: inline-block;
        background: none;
        border: 2px solid #fff;
        border-radius: 15px;
        box-sizing: border-box;
        background-color: #f0f0f0;
        padding: 5px;
        width: 96px;
        height: 170px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        box-shadow: 0px 4px 8px rgba(0,0,0,0.2);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .marker-container:hover {
        transform: scale(1.05);
      }
      .marker-container:hover .marker-frame {
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      }
      .marker-frame.selected {
        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        border: 2px solid #3b82f6;
      }
      .marker-frame img {
        display: block;
        background: none;
        width: 96px;
        height: 170px;
        margin-top: 5px;
        margin-bottom: 0px;
        max-width: 100%;
        max-height: 100%;
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
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 10px solid #fff;
      }
      .cluster-counter {
        position: absolute;
        top: 8px;
        right: -12px;
        background-color: red;
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 700;
        height: 28px;
        min-width: 28px;
        padding: 0 8px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        box-shadow: 0px 4px 8px rgba(0,0,0,0.2);
      }
      .cluster-counter.cluster-small {
        width: 28px;
        min-width: 28px;
        padding: 0;
        border-radius: 50%;
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
      const thumbnailUrl = thumbnailPanel?.media || null;

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
        // Center and zoom to street level before opening the story
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([story.geo!.lat, story.geo!.lng], 16, { animate: true });
          if (onViewChange) {
            onViewChange({ lat: story.geo!.lat, lng: story.geo!.lng }, 16);
          }
        }
        onStorySelect(story);
      });

      markersRef.current.addLayer(marker);
    });
  }, [stories, onStorySelect, selectedStoryId]);

  // Apply external center/zoom changes without creating feedback loops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const curr = map.getCenter();
    const currZoom = map.getZoom();
    const nextLat = center?.lat ?? curr.lat;
    const nextLng = center?.lng ?? curr.lng;
    const nextZoom = typeof zoom === 'number' ? zoom : currZoom;

    const latDiff = Math.abs(curr.lat - nextLat);
    const lngDiff = Math.abs(curr.lng - nextLng);
    const zoomDiff = Math.abs(currZoom - nextZoom);

    // Avoid jitter: require a meaningful delta and don't animate sync
    const EPS = 1e-4; // ~11m threshold
    const needsMove = latDiff > EPS || lngDiff > EPS || zoomDiff >= 1;
    if (needsMove) {
      map.setView([nextLat, nextLng], nextZoom, { animate: false });
    }
  }, [center?.lat, center?.lng, zoom]);

  // Apply fitBounds when prop changes (once per unique bounds)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !fitBounds) return;
    const key = JSON.stringify(fitBounds);
    if (lastFitKeyRef.current === key) return;
    try {
      const b = L.latLngBounds([L.latLng(fitBounds[0][0], fitBounds[0][1]), L.latLng(fitBounds[1][0], fitBounds[1][1])]);
      map.fitBounds(b, { padding: [fitPadding, fitPadding], animate: false });
      lastFitKeyRef.current = key;
    } catch {}
  }, [fitBounds, fitPadding]);

  // Force map to resize when its container changes size (layout switches, panel open/close)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const el = mapRef.current;
    if (!map || !el) return;

    // Initial invalidate after mount/layout (do a couple to be safe)
    setTimeout(() => map.invalidateSize(), 0);
    setTimeout(() => map.invalidateSize(), 250);

    // Observe container size changes
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(el);
    }

    const onWinResize = () => map.invalidateSize();
    window.addEventListener('resize', onWinResize);

    return () => {
      window.removeEventListener('resize', onWinResize);
      if (ro) {
        try { ro.unobserve(el); } catch {}
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};
