import { useMemo } from 'react';
import { useStories } from '@/hooks/useStories';
import { SearchHeader } from '@/components/SearchHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function MentionsIndexPage() {
  const { data: stories } = useStories();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = (params.get('q') || '').toLowerCase();

  const prizes = useMemo(() => {
    const map = new Map<string, { id: string; slug?: string; name: string; iconUrl?: string }>();
    for (const s of stories || []) {
      for (const p of (s.prizes || [])) {
        const key = (p.slug || p.id) as string;
        if (!map.has(key)) map.set(key, { id: String(p.id), slug: p.slug, name: p.name || String(p.id), iconUrl: p.iconUrl });
      }
    }
    let arr = Array.from(map.values());
    if (q) arr = arr.filter(p => p.name.toLowerCase().includes(q));
    return arr.sort((a,b) => a.name.localeCompare(b.name));
  }, [stories, q]);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-6 pt-4">
        <SearchHeader />
      </div>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Mentions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {prizes.map(p => (
            <button key={p.slug || p.id} onClick={() => navigate(`/mentions/${encodeURIComponent(p.slug || p.id)}`)} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50">
              {p.iconUrl ? (
                <img src={p.iconUrl} className="h-10 w-10 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              ) : (
                <div className="h-10 w-10 bg-gray-200" />
              )}
              <div className="text-left">
                <div className="font-medium">{p.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
