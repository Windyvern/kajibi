import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Map, List as ListIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { useState, useMemo } from 'react';
import { useAuthors } from '@/hooks/useAuthors';
import { useStories } from '@/hooks/useStories';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { useAuthorPosts, useAuthorReels } from '@/hooks/useAuthorMedia';

const AuthorDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const { data: authors, isLoading: aLoading, error: aError } = useAuthors();
  const { data: stories, isLoading: sLoading, error: sError } = useStories();

  const author = useMemo(() => (authors || []).find(a => (a.slug || a.id) === slug), [authors, slug]);
  const authorStories = useMemo(() => {
    if (!author || !stories) return [];
    return stories.filter(s => (s.author || '').trim() === (author.name || '').trim());
  }, [author, stories]);
  const { data: posts } = useAuthorPosts(author?.slug || author?.name);
  const { data: reels } = useAuthorReels(author?.slug || author?.name);
  const [tab, setTab] = useState<'stories'|'posts'|'reels'>('stories');

  if (aLoading || sLoading) {
    return <div className="min-h-screen flex items-center justify-center"><span>Chargement…</span></div>;
  }
  if (aError || sError || !author) {
    return <div className="min-h-screen flex items-center justify-center"><span>Auteur introuvable</span></div>;
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

      <div className="px-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate('/authors')} className="text-sm text-gray-600 hover:text-gray-800">← Auteurs</button>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-1 ring-black/10">
            {author.avatarUrl ? (
              <img src={author.avatarUrl} alt={author.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-200" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-foreground">{author.name}</h2>
        </div>
        <div className="flex items-center gap-3 border-b border-border mb-4">
          {[
            { key: 'stories', label: 'Stories' },
            { key: 'posts', label: 'Posts' },
            { key: 'reels', label: 'Reels' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-3 py-2 text-sm border-b-2 ${tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'stories' && (
        <LatestArticlesGallery
          stories={authorStories}
          onSelect={(story) => navigate(`/story/${encodeURIComponent(story.handle || story.id)}?from=authors`)}
        />
      )}
      {tab !== 'stories' && (
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(tab === 'posts' ? (posts || []) : (reels || [])).map((m) => (
              <div key={m.id} className="relative group w-full aspect-square rounded-xl overflow-hidden bg-muted">
                {m.thumbUrl ? (
                  <img src={m.thumbUrl} alt={m.caption || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorDetailPage;
