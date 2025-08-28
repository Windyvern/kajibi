import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/SearchBar';
import { ViewToggle } from '@/components/ViewToggle';
import OptionsPopover from '@/components/OptionsPopover';
import { Button } from '@/components/ui/button';
import { GalleryHorizontalEnd, Grid2x2, Film, Notebook, Award, ChevronDown } from 'lucide-react';

export function SearchHeader({
  dataLovId,
  leftSlot,
  viewToggleMode = 'route',
  showFilters,
  onToggleFilters,
  searchBarClassName,
  routeBase = '/stories',
}: {
  dataLovId?: string;
  leftSlot?: ReactNode;
  viewToggleMode?: 'route' | 'query';
  showFilters?: boolean;
  onToggleFilters?: () => void;
  searchBarClassName?: string;
  routeBase?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Hidden global mute tracker so pages can query this header if needed
  const [__muted, set__muted] = useState<boolean>(() => {
    try { return (sessionStorage.getItem('storyViewer:muted') ?? 'true') !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    const onEvt = (e: Event) => {
      // @ts-ignore
      const v = (e as CustomEvent)?.detail?.muted;
      if (typeof v === 'boolean') set__muted(v);
    };
    window.addEventListener('global:mute-change', onEvt as EventListener);
    return () => window.removeEventListener('global:mute-change', onEvt as EventListener);
  }, []);
  const current = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/posts') || p.startsWith('/post/')) return 'Posts';
    if (p.startsWith('/reels') || p.startsWith('/reel/')) return 'Reels';
    if (p.startsWith('/lists')) return 'Listes';
    if (p.startsWith('/mentions')) return 'Mentions';
    return 'Stories';
  }, [location.pathname]);
  const go = (label: string) => {
    setOpen(false);
    const params = new URLSearchParams(location.search);
    const wasMap = location.pathname === '/map' || params.get('style') === 'map';
    const mvFromUrl = params.get('mv');
    let mvFromSession: string | null = null;
    try {
      const cRaw = sessionStorage.getItem('view:map:center');
      const zRaw = sessionStorage.getItem('view:map:zoom');
      if (cRaw && zRaw) {
        const c = JSON.parse(cRaw) as { lat: number; lng: number };
        const z = parseInt(zRaw, 10);
        if (c && !Number.isNaN(z)) mvFromSession = `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(z)}`;
      }
    } catch {}
    const mv = mvFromUrl || mvFromSession || undefined;
    switch (label) {
      case 'Stories': {
        const search = new URLSearchParams(location.search);
        // Carry latest map view so gallery sections and map mode remain in sync
        if (mv) search.set('mv', mv);
        // Remove any deep-link to a specific story when switching sections
        search.delete('story');
        search.delete('panel');
        // Preserve current view mode: keep gallery if user was in gallery
        if (wasMap) search.set('style', 'map'); else search.delete('style');
        navigate({ pathname: '/stories', search: `?${search.toString()}` });
        break;
      }
      case 'Posts': {
        const search = new URLSearchParams();
        if (wasMap) search.set('style', 'map');
        if (mv) search.set('mv', mv);
        navigate({ pathname: '/posts', search: `?${search.toString()}` });
        break;
      }
      case 'Reels': {
        const search = new URLSearchParams();
        if (wasMap) search.set('style', 'map');
        if (mv) search.set('mv', mv);
        navigate({ pathname: '/reels', search: `?${search.toString()}` });
        break;
      }
      case 'Listes': navigate('/lists'); break;
      case 'Mentions': navigate('/mentions'); break;
    }
  };
  return (
    <div data-lov-id={dataLovId}>
      {/* Desktop / wide screens: row layout */}
      <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4">
        {/* Left slot (e.g., zoom controls) */}
        <div className="flex items-start">{leftSlot}</div>

        {/* Center: Search Bar */}
        <div className={`md:justify-self-center lg:justify-self-center md:w-full lg:w-[620px] xl:w-[720px] ${searchBarClassName || ''}`}>
          <SearchBar showFilters={showFilters} onToggleFilters={onToggleFilters} />
        </div>

        {/* Right: dropdown + options + toggle */}
        <div className="flex items- top-2 justify-end gap-2 relative">
          <div className="relative">
            <button onClick={() => setOpen(o=>!o)} className="bg-white text-gray-900 rounded-full border border-black/10 shadow-md h-8 px-3 py-4 text-sm inline-flex items-center gap-2">
              {current === 'Stories' && <GalleryHorizontalEnd size={16} />}
              {current === 'Posts' && <Grid2x2 size={16} />}
              {current === 'Reels' && <Film size={16} />}
              {current === 'Listes' && <Notebook size={16} />}
              {current === 'Mentions' && <Award size={16} />}
              <span>{current}</span>
              <ChevronDown size={14} />
            </button>
            {open && (
              <div className="absolute left-0 right-0 mt-2 w-30 rounded-xl border bg-white shadow-lg overflow-hidden">
                {['Stories','Posts','Reels','Listes','Mentions'].map((label)=> (
                  <button key={label} onClick={()=>go(label)} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${current===label?'font-semibold':''}`}>
                    {label === 'Stories' && <GalleryHorizontalEnd size={16} />}
                    {label === 'Posts' && <Grid2x2 size={16} />}
                    {label === 'Reels' && <Film size={16} />}
                    {label === 'Listes' && <Notebook size={16} />}
                    {label === 'Mentions' && <Award size={16} />}
                    <span>{label==='Stories'?'Stories':label==='Mentions'?'Mentions':label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <OptionsPopover />
          <ViewToggle mode={viewToggleMode} routeBase={routeBase} />
        </div>
      </div>

      {/* Mobile / narrow screens: column layout */}
      <div className="md:hidden flex flex-col gap-2 z-[12000]">
        <div className="w-full md:w-[720px] mx-auto">
          <SearchBar showFilters={showFilters} onToggleFilters={onToggleFilters} />
        </div>
        <div className="flex items-start justify-between gap-2">
          {/* Left slot stacked above actions on mobile; keep compact spacing */}
          {leftSlot && <div className="flex items-center gap-1">{leftSlot}</div>}
          <div className="flex items-center gap-2 relative ml-auto">
            <div className="relative">
              <button onClick={() => setOpen(o=>!o)} className="bg-white text-gray-900 rounded-full border border-black/10 shadow-md h-8 px-3 py-4 text-sm inline-flex items-center gap-2">
                {current === 'Stories' && <GalleryHorizontalEnd size={16} />}
                {current === 'Posts' && <Grid2x2 size={16} />}
                {current === 'Reels' && <Film size={16} />}
                {current === 'Listes' && <Notebook size={16} />}
                {current === 'Mentions' && <Award size={16} />}
                <span>{current}</span>
                <ChevronDown size={14} />
              </button>
              {open && (
                <div className="absolute left-0 right-0 mt-2 w-30 rounded-xl border bg-white shadow-lg overflow-hidden">
                  {['Stories','Posts','Reels','Listes','Mentions'].map((label)=> (
                    <button key={label} onClick={()=>go(label)} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${current===label?'font-semibold':''}`}>
                      {label === 'Stories' && <GalleryHorizontalEnd size={16} />}
                      {label === 'Posts' && <Grid2x2 size={16} />}
                      {label === 'Reels' && <Film size={16} />}
                      {label === 'Listes' && <Notebook size={16} />}
                      {label === 'Mentions' && <Award size={16} />}
                      <span>{label==='Stories'?'Stories':label==='Mentions'?'Mentions':label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <OptionsPopover />
            <ViewToggle mode={viewToggleMode} routeBase={routeBase} />
          </div>
        </div>
      </div>
    </div>
  );
}
