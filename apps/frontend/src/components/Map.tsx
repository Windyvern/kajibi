
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Story } from '@/types/story';

// Cache fetched SVGs by URL to avoid repeated network requests
const svgCache: Map<string, string> = new globalThis.Map<string, string>();
let prizeSvgCounter = 0;

// Very small sanitizer for inline SVGs coming from our CMS
function sanitizeSvg(raw: string): string {
  try {
    // Remove XML/DOCTYPE and comments
    let s = raw
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .replace(/<!--([\s\S]*?)-->/g, '')
      .trim();
    // Keep only the first <svg>...</svg> block
    const match = s.match(/<svg[\s\S]*?<\/svg>/i);
    s = match ? match[0] : s;
    // Strip script tags
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Remove inline event handlers like onload=, onclick=
    s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '');
    // Neutralize javascript: URLs in href/xlink:href
    s = s.replace(/(href|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1=""');
    return s;
  } catch {
    return '';
  }
}

function isSvgUrl(url?: string) {
  return typeof url === 'string' && /\.svg(\?|#|$)/i.test(url);
}

function inlinePrizeSvg(svgRaw: string, fillColor: string, strokeColor = '#ffffff', strokeWidth = 3) {
  try {
    const safe = sanitizeSvg(svgRaw);
    const clsUnique = `prize-svg-${++prizeSvgCounter}`;
    // Inject a style to force fill and stroke on shapes, preserving viewBox
    const styled = safe.replace(
      /<svg(\b[^>]*)>/i,
      (m, attrs) => {
        // Ensure a unique class on the root svg to hard-scope styles
        const hasClass = /\bclass=/.test(attrs);
        const newAttrs = hasClass
          ? attrs.replace(/class=(['"])([^'"]*)(['"])/, (mm, q1, classes, q2) => `class=${q1}${classes} prize-svg ${clsUnique}${q2}`)
          : `${attrs} class="prize-svg ${clsUnique}"`;
        return `
<svg${newAttrs} width="40" height="40" preserveAspectRatio="xMidYMid meet">
  <style>
    .${clsUnique} path, .${clsUnique} circle, .${clsUnique} rect, .${clsUnique} polygon, .${clsUnique} polyline, .${clsUnique} ellipse, .${clsUnique} line, .${clsUnique} g, .${clsUnique} use {
      fill: ${fillColor} !important;
      stroke: ${strokeColor} !important;
      stroke-width: ${strokeWidth}px !important;
      stroke-linejoin: round;
      stroke-linecap: round;
      paint-order: stroke fill;
      vector-effect: non-scaling-stroke;
    }
  </style>`;
      }
    );
    return `<div class="prize-badge">${styled}</div>`;
  } catch {
    return '';
  }
}

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
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  fitBounds?: [[number, number], [number, number]];
  fitPadding?: number;
  suppressZoomOnMarkerClick?: boolean;
  clusterAnimate?: boolean;
  centerOffsetPixels?: { x: number; y: number };
  clusterRadiusByZoom?: (zoom: number) => number;
}

// Assets (avatar + instagram icon)
// Use bundler-imported assets to ensure availability
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const Map = ({ stories, onStorySelect, selectedStoryId, center, zoom, onViewChange, onBoundsChange, fitBounds, fitPadding = 60, suppressZoomOnMarkerClick = false, clusterAnimate = true, centerOffsetPixels, clusterRadiusByZoom }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const lastFitKeyRef = useRef<string | null>(null);
  // Render zone padding to keep edge markers visible (per spec: +60 left, +60 right, +200 top, +40 bottom)
  const renderPad = useRef<{ left: number; right: number; bottom: number; top: number }>({ left: 60, right: 60, bottom: 40, top: 200 });
  const defaultCenterOffset = useRef<{ x: number; y: number }>({ x: 0, y: -95 }); // center on visual middle of 190px marker
  const lastZoomRef = useRef<number | null>(null);
  // Lazy imports for assets (vite resolves at build time)
  let avatarUrl: string | undefined;
  let igUrl: string | undefined;
  try { avatarUrl = new URL('../../../../ForCodex/117545.png', import.meta.url).toString(); } catch {}
  try { igUrl = new URL('../../../../ForCodex/instagram.svg', import.meta.url).toString(); } catch {}

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
      maxClusterRadius: (z: number) => (typeof clusterRadiusByZoom === 'function' ? clusterRadiusByZoom(z) : (z < 6 ? 80 : z < 12 ? 60 : 40)),
      animate: clusterAnimate,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
  const childMarkers = cluster.getAllChildMarkers();
  const first = childMarkers[0] as any;
  const thumbnailUrl = first?.thumbnailUrl || null;
  const closed = Boolean(first?.isClosed);
        return L.divIcon({
          html: `
            <div class="marker-container">
              <div class="marker-frame">
    ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="Cluster" ${closed ? 'style=\"filter:grayscale(100%)\"' : ''} />` : ''}
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

    // Apply custom padding when clicking clusters (override default focus)
    markersRef.current.on('clusterclick', (a: any) => {
      try {
        const b = a.layer.getBounds();
        const padTopLeft = L.point(renderPad.current.left, renderPad.current.top);
        const padBottomRight = L.point(renderPad.current.right, renderPad.current.bottom);
        mapInstanceRef.current!.fitBounds(b, { paddingTopLeft: padTopLeft, paddingBottomRight: padBottomRight, animate: true });
      } catch {}
      a.originalEvent?.preventDefault?.();
    });

    // Emit view changes to parent (e.g., to persist center/zoom across remounts)
    if (onViewChange || onBoundsChange) {
      const emit = () => {
        const c = mapInstanceRef.current!.getCenter();
        const z = mapInstanceRef.current!.getZoom();
        if (onViewChange) onViewChange({ lat: c.lat, lng: c.lng }, z);
        if (onBoundsChange) {
          const b = mapInstanceRef.current!.getBounds();
          onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
        }
      };
      mapInstanceRef.current.on('moveend', emit);
    }

    // Zoom direction classes for subtle deploy/collapse animation
    mapInstanceRef.current.on('zoomstart', () => {
      const map = mapInstanceRef.current!;
      const nextZoom = map.getZoom();
      const prev = lastZoomRef.current;
      lastZoomRef.current = nextZoom;
      const el = mapRef.current;
      if (!el || prev == null) return;
      const zoomingIn = nextZoom > prev;
      el.classList.remove('zoom-in', 'zoom-out');
      el.classList.add(zoomingIn ? 'zoom-in' : 'zoom-out');
      setTimeout(() => el.classList.remove('zoom-in', 'zoom-out'), 300);
    });

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
      .marker-container .prize-badge {
        position: absolute;
        top: -14px;
        right: -14px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        background: transparent;
        border: none;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,0.25));
      }
      .marker-container .prize-badge .icon {
        width: 40px;
        height: 40px;
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        display: inline-block;
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
        margin-top: 0px;
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
      .marker-container .marker-frame.selected + .arrow {
        border-top-color: #3b82f6;
        filter: drop-shadow(0 6px 20px rgba(59, 130, 246, 0.4));
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
  /* Subtle deploy/collapse */
  .zoom-in .custom-story-marker .marker-frame { transform: scale(0.92); opacity: 0.8; }
  .zoom-in .custom-story-marker .marker-frame, .zoom-out .custom-story-marker .marker-frame { transition: transform 220ms ease, opacity 220ms ease; }
  .zoom-out .custom-story-marker .marker-frame { transform: scale(1.06); opacity: 0.8; }
  .zoom-in .custom-cluster-icon, .zoom-out .custom-cluster-icon { transition: transform 220ms ease, opacity 220ms ease; }
  .zoom-in .custom-cluster-icon { transform: scale(0.92); opacity: 0.9; }
  .zoom-out .custom-cluster-icon { transform: scale(1.06); opacity: 0.9; }
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

  // Recreate cluster group when clusterAnimate toggles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (markersRef.current) {
      try { map.removeLayer(markersRef.current); } catch {}
    }
    markersRef.current = L.markerClusterGroup({
      maxClusterRadius: (z: number) => (typeof clusterRadiusByZoom === 'function' ? clusterRadiusByZoom(z) : (z < 6 ? 80 : z < 12 ? 60 : 40)),
      animate: clusterAnimate,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const childMarkers = cluster.getAllChildMarkers();
        const first = childMarkers[0] as any;
        const thumbnailUrl = first?.thumbnailUrl || null;
        const closed = Boolean(first?.isClosed);
        return L.divIcon({
          html: `
            <div class="marker-container">
              <div class="marker-frame">
                ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="Cluster" ${closed ? 'style="filter:grayscale(100%)"' : ''} />` : ''}
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
    map.addLayer(markersRef.current);
    // Force markers to re-add
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterAnimate, clusterRadiusByZoom]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Add markers for each story
    stories.forEach((story) => {
      if (!story.geo) return;

      // Prefer provided story.thumbnail (guaranteed image), else first image panel
      const firstImagePanel = story.panels.find(p => p.type === 'image');
      const thumbnailUrl = story.thumbnail || firstImagePanel?.media || null;

      const isSelected = story.id === selectedStoryId;
      const prize = Array.isArray(story.prizes) && story.prizes.length > 0 ? story.prizes[0] : undefined;
      const fillColor = prize ? (prize.useTextColor ? (prize.textColor || '#111') : (prize.bgColor || '#111')) : undefined;
      let prizeHtml = '';
      if (prize && prize.iconUrl) {
        if (isSvgUrl(prize.iconUrl) && svgCache.has(prize.iconUrl)) {
          prizeHtml = inlinePrizeSvg(svgCache.get(prize.iconUrl) || '', fillColor || '#111');
        } else {
          // Fallback to CSS-mask until SVG is fetched
          prizeHtml = `
            <div class="prize-badge">
              <span class="icon" style="background-color: ${fillColor || '#111'}; -webkit-mask-image: url(${prize.iconUrl}); mask-image: url(${prize.iconUrl});"></span>
            </div>`;
        }
      }

      const markerIcon = L.divIcon({
        html: `
          <div class="marker-container">
            ${prizeHtml}
            <div class="marker-frame ${isSelected ? 'selected' : ''}" data-story-id="${story.id}">
              ${thumbnailUrl 
                ? `<img src="${thumbnailUrl}" alt="${story.title}" ${story.isClosed ? 'style="filter: grayscale(100%);"' : ''} />` 
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
  (marker as any).isClosed = story.isClosed;
      
  marker.on('click', () => {
        if (!suppressZoomOnMarkerClick) {
          // Center and zoom to street level before opening the story
          if (mapInstanceRef.current) {
            if (centerOffsetPixels) {
              const map = mapInstanceRef.current;
              const z = 16;
              const pt = map.project([story.geo!.lat, story.geo!.lng], z);
              const target = L.point(pt.x + (centerOffsetPixels.x || 0), pt.y + (centerOffsetPixels.y || 0));
              const latlng = map.unproject(target, z);
      map.setView(latlng, z, { animate: true });
            } else {
      // Offset center to visual middle of marker and apply padding to avoid cut-offs
      const map = mapInstanceRef.current;
      const z = 16;
      const pt = map.project([story.geo!.lat, story.geo!.lng], z);
      const target = L.point(pt.x + defaultCenterOffset.current.x, pt.y + defaultCenterOffset.current.y);
      const latlng = map.unproject(target, z);
      map.setView(latlng, z, { animate: true });
      try {
        const paddingTopLeft = L.point(renderPad.current.left, renderPad.current.top);
        const paddingBottomRight = L.point(renderPad.current.right, renderPad.current.bottom);
        (map as any).panInside?.([story.geo!.lat, story.geo!.lng], { paddingTopLeft, paddingBottomRight });
      } catch {}
            }
            if (onViewChange) {
              onViewChange({ lat: story.geo!.lat, lng: story.geo!.lng }, 16);
            }
          }
        }
        onStorySelect(story);
      });

      markersRef.current.addLayer(marker);

      // If prize is an SVG and not cached yet, fetch and inline it to get true stroke + shadow
      if (prize && isSvgUrl(prize.iconUrl) && !svgCache.has(prize.iconUrl!)) {
        fetch(prize.iconUrl!)
          .then(async (r) => {
            const ct = r.headers.get('content-type') || '';
            if (!ct.includes('svg')) {
              // Still attempt to read text; some servers omit content-type
              return r.text();
            }
            return r.text();
          })
          .then((text) => {
            if (!text) return;
            svgCache.set(prize.iconUrl!, text);
            const el = marker.getElement();
            if (!el) return;
            const badge = el.querySelector('.prize-badge');
            if (badge) {
              badge.outerHTML = inlinePrizeSvg(text, fillColor || '#111');
            }
          })
          .catch(() => {});
      }
    });
  }, [stories, onStorySelect, selectedStoryId, clusterAnimate]);

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
      if ((centerOffsetPixels || defaultCenterOffset.current) && typeof nextLat === 'number' && typeof nextLng === 'number') {
        try {
          const pt = map.project([nextLat, nextLng], nextZoom);
          const off = centerOffsetPixels || defaultCenterOffset.current;
          const target = L.point(pt.x + (off.x || 0), pt.y + (off.y || 0));
          const latlng = map.unproject(target, nextZoom);
          map.setView(latlng, nextZoom, { animate: false });
        } catch {
          map.setView([nextLat, nextLng], nextZoom, { animate: false });
        }
      } else {
        map.setView([nextLat, nextLng], nextZoom, { animate: false });
      }
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
  // Expand bounds visually by render padding
  const padLeft = fitPadding + renderPad.current.left;
  const padRight = fitPadding + renderPad.current.right;
  const padTop = fitPadding + renderPad.current.top;
  const padBottom = fitPadding + renderPad.current.bottom;
  map.fitBounds(b, { paddingTopLeft: L.point(padLeft, padTop), paddingBottomRight: L.point(padRight, padBottom), animate: false });
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
      <div ref={mapRef} className="w-full h-full transition-all" />
      {/* Bottom-left avatar and Instagram link */}
      <div className="pointer-events-auto absolute left-4 bottom-4 flex items-center gap-3 z-[11000]">
        <a
          href={avatarUrl || '#'}
          target={avatarUrl ? '_blank' : undefined}
          rel={avatarUrl ? 'noopener noreferrer' : undefined}
          className="shrink-0 h-12 w-12 rounded-full bg-white/90 border shadow-md flex items-center justify-center overflow-hidden"
          aria-label="Logo"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Logo" className="h-10 w-10 object-cover rounded-full" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gray-200" />
          )}
        </a>
        <a
          href="https://instagram.com/alex_kajiru"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 h-12 w-12 rounded-full bg-white/90 border shadow-md flex items-center justify-center"
          aria-label="Instagram"
        >
          {igUrl ? (
            <img src={igUrl} alt="Instagram" className="h-6 w-6" style={{ filter: 'invert(1)' }} />
          ) : (
            <span className="text-pink-600 font-bold">IG</span>
          )}
        </a>
      </div>
    </div>
  );
};
