import { useState, useRef, useEffect } from 'react';
import { X as CloseIcon, Leaf, Clover, Cog } from 'lucide-react';
import { useOptions } from '@/context/OptionsContext';

interface OptionsPopoverProps {
  align?: 'left' | 'right';
}

export const OptionsPopover = ({ align = 'right' }: OptionsPopoverProps) => {
  const { showClosed, setShowClosed, darkMode, setDarkMode, clusterAnim, setClusterAnim, vegMode, setVegMode, galleryMap, setGalleryMap, chunkedLoading, setChunkedLoading } = useOptions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-white text-gray-900 rounded-full border border-black/10 shadow-md h-8 px-1 py-1 text-sm"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Cog size={16} className="ml-1 mr-1" />
      </button>
      {open && (
        <div className="fixed top-0 right-3 md:top-4 md:right-3 z-[99999]">
            <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-28 md:top-12 z-[10001] bg-white border rounded-lg shadow-lg p-3 w-64 text-gray-900`}>
            <div className="flex items-center justify-between py-2">
                <span className="text-sm">Établissements fermés</span>
                {/* Reverse logic: true = show closed, false = hide closed (visuals unchanged) */}
                <button onClick={() => setShowClosed(!showClosed)} className={`relative w-12 h-6 rounded-full ${showClosed ? 'bg-green-500' : 'bg-red-500'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showClosed ? 'translate-x-6' : ''}`} />
                </button>
            </div>
            <div className="flex items-center justify-between py-2">
                <span className="text-sm">Carte en vue Galerie</span>
                <button onClick={() => setGalleryMap(!galleryMap)} className={`relative w-12 h-6 rounded-full ${galleryMap ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${galleryMap ? 'translate-x-6' : ''}`} />
                </button>
            </div>
            <div className="flex items-center justify-between py-2 opacity-60 cursor-not-allowed" title="Bientôt disponible">
                <span className="text-sm">Mode végétarien</span>
                <div className="flex items-center gap-1">
                <button className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center cursor-not-allowed" title="Désactivé">
                    <CloseIcon size={14} />
                </button>
                <button className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center cursor-not-allowed" title="Végétarien">
                    <Leaf size={14} />
                </button>
                <button className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center cursor-not-allowed" title="Vegan">
                    <Clover size={14} />
                </button>
                </div>
            </div>
            <div className="flex items-center justify-between py-2 opacity-60 cursor-not-allowed">
                <span className="text-sm">Mode sombre</span>
                <button onClick={() => setDarkMode(!darkMode)} className={`relative w-12 h-6 rounded-full cursor-not-allowed ${darkMode ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : ''}`} />
                </button>
            </div>
            <div className="flex items-center justify-between py-2">
                <span className="text-sm">Animations de zoom</span>
                <button onClick={() => setClusterAnim(!clusterAnim)} className={`relative w-12 h-6 rounded-full ${clusterAnim ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${clusterAnim ? 'translate-x-6' : ''}`} />
                </button>
            </div>
            <div className="flex items-center justify-between py-2" title="Ajoute les marqueurs en petits morceaux pour garder l'UI fluide (expérimental)">
                <span className="text-sm">Chargement progressif</span>
                <button onClick={() => setChunkedLoading(!chunkedLoading)} className={`relative w-12 h-6 rounded-full ${chunkedLoading ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${chunkedLoading ? 'translate-x-6' : ''}`} />
                </button>
            </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default OptionsPopover;
