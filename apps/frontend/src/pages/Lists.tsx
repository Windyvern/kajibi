import { Link } from 'react-router-dom';
import { useLists } from '@/hooks/useLists';
import { Button } from '@/components/ui/button';
import { Loader2, Map, Grid3X3 } from 'lucide-react';

const ListsPage = () => {
  const { data: lists, isLoading, error } = useLists();

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

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 flex justify-end gap-2">
        <Link to="/gallery">
          <Button variant="outline" className="bg-white/10 border-white/20">
            <Grid3X3 size={16} className="mr-2" />
            Galerie
          </Button>
        </Link>
        <Link to="/map">
          <Button variant="outline" className="bg-white/10 border-white/20">
            <Map size={16} className="mr-2" />
            Carte
          </Button>
        </Link>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Listes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(lists || []).map((l) => (
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
  );
};

export default ListsPage;
