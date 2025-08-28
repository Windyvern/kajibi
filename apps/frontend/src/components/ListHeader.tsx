import { ArrowLeft } from 'lucide-react';
import { ViewToggle } from '@/components/ViewToggle';
import { useList } from '@/hooks/useList';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function ListHeader({
  title,
  count,
  onBack,
  viewToggleMode = 'query',
  routeBase = '/lists',
  listSlug,
}: {
  title?: string;
  count?: number;
  onBack: () => void;
  viewToggleMode?: 'route' | 'query';
  routeBase?: string;
  listSlug?: string;
}) {
  // Optional: fetch list data when title/count not explicitly provided
  const { data: list } = useList(listSlug || '');
  const effectiveTitle = title ?? (list?.name || '');
  const effectiveCount = (() => {
    if (typeof count === 'number') return count;
    if (!list) return 0;
    const lt = (list.listType || 'articles');
    return lt === 'media' ? (list.media?.length || 0) : (list.articles?.length || 0);
  })();

  // Compose subtitle suffix e.g. "(articles avec media avec map view)"
  const typeLabel = list ? ((list.listType || 'articles') === 'media' ? 'articles avec media' : 'articles') : undefined;
  const mapLabel = list && !list.disableMapView ? 'avec map view' : undefined;
  const suffix = [typeLabel, mapLabel].filter(Boolean).join(' ');
  const fullTitle = suffix ? `${effectiveTitle} (${suffix})` : effectiveTitle;

  // ESC key should behave like back
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try { onBack(); } catch { navigate('/lists'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, navigate]);
  return (
    <div className="fixed top-3 left-3 right-3 z-[11000]">
      <div className="flex items-center justify-between gap-3">
        {/* Back pill (same height as search bar) */}
        <Link
            to="/lists"
            data-lov-id="src/components/ListHeader.tsx:33:8"
            aria-label="Retour aux listes"
            className="h-12 w-12 rounded-full bg-white/90 border shadow-md flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </Link>

        {/* Title + count in a glass-like pill (same feel as search) */}
        <div className="liquid-glass px-4 h-12 rounded-full inline-flex items-center gap-2 shrink-0" data-lov-id="src/components/ListHeader.tsx:42:8">
          <span className="text-sm text-gray-900 whitespace-nowrap">{fullTitle}</span>
          <span className="px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-xs whitespace-nowrap">{effectiveCount}</span>
        </div>

        {/* View toggle: icon-only on mobile, labeled on md+ */}
        <div className="hidden md:block">
          <ViewToggle mode={viewToggleMode} routeBase={routeBase} />
        </div>
        <div className="md:hidden">
          <ViewToggle mode={viewToggleMode} routeBase={routeBase} showLabels={false} />
        </div>
      </div>
    </div>
  );
}
