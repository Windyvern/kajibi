import { Link } from 'react-router-dom';
import { useLists } from '@/hooks/useLists';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ViewToggle } from '@/components/ViewToggle';
import { SearchBar } from '@/components/SearchBar';
import { useState } from 'react';

const ListsPage = () => {
  const { data: lists, isLoading, error } = useLists();
  const [filtersOpen, setFiltersOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" size={20} />
          <span>Chargement…</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>Erreur de chargement</span>
      </div>
    );
  }

  const q = new URLSearchParams(window.location.search).get('q') || '';
  const qn = q.toLowerCase();
  const filteredLists = (lists || []).filter(l =>
    (l.name || '').toLowerCase().includes(qn)
    || (l.description || '').toLowerCase().includes(qn)
    || (l.category || '').toLowerCase().includes(qn)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header with centered search and right nav (desktop), stacked on mobile */}
      <div className="px-4 md:px-6 pt-4">
        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4">
          <div />
          <div className="justify-self-center w-full lg:w-[620px] xl:w-[720px]">
            <SearchBar
              showFilters={filtersOpen}
              onToggleFilters={() => setFiltersOpen(o => !o)}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <ViewToggle mode="route" />
          </div>
        </div>
        <div className="md:hidden flex flex-col gap-2">
          <div className="w-full md:w-[720px] mx-auto">
            <SearchBar
              showFilters={filtersOpen}
              onToggleFilters={() => setFiltersOpen(o => !o)}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <ViewToggle mode="route" />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="w-full flex justify-center">
          <h2 className="w-full xl:max-w-[1460px] mx-auto text-2xl font-bold mb-6 text-foreground">Listes</h2>
        </div>
        <div className="w-full flex justify-center">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 w-full xl:max-w-[1460px] mx-auto">
            {filteredLists.map((l) => (
              <Link key={l.id} to={`/lists/${encodeURIComponent(l.slug || l.id)}`} className="block group">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg">
                  {l.thumbnail ? (
                    <img src={l.thumbnail} alt={l.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-semibold text-lg mb-1 line-clamp-2">{l.name}</h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListsPage;
