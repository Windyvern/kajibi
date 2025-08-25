import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Map, List as ListIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { useState } from 'react';
import { useAuthors } from '@/hooks/useAuthors';

const AuthorsPage = () => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const { data: authors, isLoading, error } = useAuthors();

  const q = new URLSearchParams(window.location.search).get('q') || '';
  const qn = q.toLowerCase();
  const list = (authors || []).filter(a => (a.name || '').toLowerCase().includes(qn));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><span>Chargement…</span></div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center"><span>Erreur de chargement</span></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with centered search and right nav (desktop), stacked on mobile */}
      <div className="px-4 md:px-6 pt-4">
        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4">
          <div />
          <div className="justify-self-center w-full md:w-[540px] lg:w-[620px] xl:w-[720px]">
            <SearchBar showFilters={filtersOpen} onToggleFilters={() => setFiltersOpen(o => !o)} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Link to="/lists">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <ListIcon size={16} className="mr-2" />
                Listes
              </Button>
            </Link>
            <Link to="/map">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <Map size={16} className="mr-2" />
                Carte
              </Button>
            </Link>
          </div>
        </div>

        <div className="md:hidden flex flex-col gap-2">
          <div className="w-full md:w-[720px] mx-auto">
            <SearchBar showFilters={filtersOpen} onToggleFilters={() => setFiltersOpen(o => !o)} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Link to="/lists">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <ListIcon size={16} className="mr-2" />
                Listes
              </Button>
            </Link>
            <Link to="/map">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <Map size={16} className="mr-2" />
                Carte
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Auteurs</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-6">
          {list.map(a => (
            <button key={a.id} onClick={() => navigate(`/authors/${encodeURIComponent(a.slug || a.id)}`)} className="flex flex-col items-center group">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden ring-1 ring-black/10 shadow-sm group-hover:ring-black/20 transition">
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <div className="mt-2 text-sm text-foreground/90 truncate max-w-[7rem] md:max-w-[8rem]">{a.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuthorsPage;
