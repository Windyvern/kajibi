import { useSearchParams } from 'react-router-dom';
import LiquidGlass from '@/components/LiquidGlass';
import { ChevronDown, ChevronUp, AtSign, MapPinned, Tags, FileText } from 'lucide-react';

interface SearchBarProps {
  showFilters?: boolean;
  onToggleFilters?: () => void;
  className?: string;
}

export const SearchBar = ({ showFilters, onToggleFilters, className }: SearchBarProps) => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const sf = params.get('sf') || 't,u,a,d,i';
  const setField = (key: string, on: boolean) => {
    const list = new Set((sf || '').split(',').filter(Boolean));
    if (on) list.add(key); else list.delete(key);
    const next = new URLSearchParams(params);
    const val = Array.from(list).join(',');
    if (val) next.set('sf', val); else next.delete('sf');
    setParams(next, { replace: true });
  };
  const setFields = (keys: string[], on: boolean) => {
    const list = new Set((sf || '').split(',').filter(Boolean));
    keys.forEach(k => {
      if (on) list.add(k); else list.delete(k);
    });
    const next = new URLSearchParams(params);
    const val = Array.from(list).join(',');
    if (val) next.set('sf', val); else next.delete('sf');
    setParams(next, { replace: true });
  };
  const has = (key: string) => (sf.includes(key));

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = new URLSearchParams(params);
    const val = e.target.value;
    if (val) next.set('q', val); else next.delete('q');
    setParams(next, { replace: true });
  };
  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      const next = new URLSearchParams(params);
      next.set('fit', '1');
      setParams(next, { replace: true });
      // Remove the flag shortly after to avoid lingering
      setTimeout(() => {
        const clear = new URLSearchParams(next);
        clear.delete('fit');
        setParams(clear, { replace: true });
      }, 100);
    }
  };

  return (
    <div className={className || ''}>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={"Nom du lieu, ville, plat, @instagram..."}
            className="w-full h-12 rounded-full border bg-white/90 backdrop-blur px-5 text-sm shadow-md focus:outline-none focus:ring-2 ring-brand"
          />
          <button
            aria-label="Afficher les options de recherche"
            onClick={onToggleFilters}
            className="shrink-0 h-12 w-12 rounded-full bg-white/90 border shadow-md flex items-center justify-center"
          >
            {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

      {showFilters && (
        <div className="mt-2 flex justify-center">
          {/* Mobile filters: compact with icons, fused Nom/@Insta, no checkmarks */}
          <div className="flex flex-wrap gap-2">
            {/* Nom + @Insta fused */}
            {(() => {
              const enabled = has('t') && has('u');
              return (
                <button
                  key="tu"
                  onClick={() => setFields(['t','u'], !enabled)}
                  className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1 transition backdrop-blur ${enabled ? 'bg-brand text-white border' : 'bg-white/80 text-gray-700 border opacity-70 backdrop-blur-sm'}`}
                >
                  <AtSign size={14} /> <span>Nom</span>
                </button>
              );
            })()}

            {/* Adresse -> Lieu */}
            {(() => {
              const k = 'a'; const enabled = has(k);
              return (
                <button
                  key={k}
                  onClick={() => setField(k, !enabled)}
                  className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1 transition ${enabled ? 'bg-brand text-white border' : 'bg-white/80 text-gray-700 border opacity-70 backdrop-blur-sm'}`}
                >
                  <MapPinned size={14} /> <span>Lieu</span>
                </button>
              );
            })()}

            {/* Mots-clés -> Tags */}
            {(() => {
              const k = 'd'; const enabled = has(k);
              return (
                <button
                  key={k}
                  onClick={() => setField(k, !enabled)}
                  className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1 transition ${enabled ? 'bg-brand text-white border' : 'bg-white/80 text-gray-700 border opacity-70 backdrop-blur-sm'}`}
                >
                  <Tags size={14} /> <span>Tags</span>
                </button>
              );
            })()}

            {/* Contenu */}
            {(() => {
              const k = 'i'; const enabled = has(k);
              return (
                <button
                  key={k}
                  onClick={() => setField(k, !enabled)}
                  className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1 transition ${enabled ? 'bg-brand text-white border' : 'bg-white/80 text-gray-700 border opacity-70 backdrop-blur-sm'}`}
                >
                  <FileText size={14} /> <span>Contenu</span>
                </button>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
