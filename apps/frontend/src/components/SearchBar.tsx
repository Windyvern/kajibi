import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  const has = (key: string) => (sf.includes(key));

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = new URLSearchParams(params);
    const val = e.target.value;
    if (val) next.set('q', val); else next.delete('q');
    setParams(next, { replace: true });
  };

  return (
    <div className={className || ''}>
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={onChange}
          placeholder={"Nom du lieu, ville, plat, @instagram..."}
          className="w-full h-12 rounded-full border bg-white/90 backdrop-blur px-5 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { k: 't', label: 'Titre' },
            { k: 'u', label: 'Username' },
            { k: 'a', label: 'Adresse' },
            { k: 'd', label: 'Description' },
            { k: 'i', label: 'Images' },
          ].map(({k,label}) => (
            <button
              key={k}
              onClick={() => setField(k, !has(k))}
              className={`px-3 py-1 rounded-full text-xs ${has(k) ? 'bg-blue-600 text-white' : 'bg-white/80 border'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
