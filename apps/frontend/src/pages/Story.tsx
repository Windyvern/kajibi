import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStories } from '@/hooks/useStories';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { Loader2, X } from 'lucide-react';
import { StoryMetadata } from '@/components/StoryMetadata';

const StoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: stories, isLoading, error } = useStories();
  const [params] = useSearchParams();
  const initialPanelId = params.get('panel') || undefined;

  // Track viewport for conditional rendering (avoid double-mount viewers)
  const [isMdUp, setIsMdUp] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      return window.matchMedia('(min-width: 768px)').matches;
    }
    return false;
  });
  useEffect(() => {
    if (!(typeof window !== 'undefined' && 'matchMedia' in window)) return;
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsMdUp(mql.matches);
    try { mql.addEventListener('change', onChange); } catch { mql.addListener(onChange); }
    onChange();
    return () => { try { mql.removeEventListener('change', onChange); } catch { mql.removeListener(onChange); } };
  }, []);

  const target = useMemo(() => {
    if (!stories || !slug) return null;
    return stories.find((s) => (s.handle || '').toLowerCase() === slug.toLowerCase()) || null;
  }, [stories, slug]);

  useEffect(() => {
    if (!isLoading && stories && !target) {
      // unknown slug -> back to gallery
      navigate('/gallery', { replace: true });
    }
  }, [isLoading, stories, target, navigate]);

  // Redirect geo stories to map once target is known (preserve ?panel and ?from)
  useEffect(() => {
    if (target && target.geo) {
      const params = new URLSearchParams(window.location.search);
      const panel = params.get('panel');
      const from = params.get('from');
      const base = `/map?story=${encodeURIComponent(target.handle || target.id)}`;
      let to = base;
      if (panel) to += `&panel=${encodeURIComponent(panel)}`;
      if (from) to += `&from=${encodeURIComponent(from)}`;
      navigate(to, { replace: true });
    }
  }, [target, navigate]);

  // Close with Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const p = new URLSearchParams(window.location.search);
        const from = p.get('from');
        if (from) navigate(decodeURIComponent(from)); else navigate('/gallery');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (isLoading || !stories) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" size={20} />
          <span>Chargement…</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <span>Erreur de chargement</span>
      </div>
    );
  }
  if (!target) return null;

  // Non-geo: center viewer + description on desktop; keep full-screen viewer on mobile
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {isMdUp ? (
        // Desktop/landscape: centered 2-column layout (viewer + description)
        <div className="grid w-full h-full bg-white" style={{ gridTemplateColumns: '1fr 56.25vh minmax(0,56.25vh) 1fr' }}>
          <div />
          <div className="flex items-center justify-center" style={{ height: '100vh' }}>
            <div style={{ width: '56.25vh', height: '100vh' }}>
              <TwoPanelStoryViewer
                initialStoryId={target.id}
                initialPanelId={initialPanelId}
                stories={stories}
                onClose={() => {
                  const p = new URLSearchParams(window.location.search);
                  const from = p.get('from');
                  if (from) navigate(decodeURIComponent(from)); else navigate('/gallery');
                }}
                hideRightPanel
                hideMetadataPanel
              />
            </div>
          </div>
          <div className="bg-white relative">
            <button
              onClick={() => {
                const p = new URLSearchParams(window.location.search);
                const from = p.get('from');
                if (from) navigate(decodeURIComponent(from)); else navigate('/gallery');
              }}
              className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={22} />
            </button>
            <div className="h-full">
              <StoryMetadata
                story={target}
                currentPanel={target.panels[0]}
              />
            </div>
          </div>
          <div />
        </div>
      ) : (
        // Mobile/vertical: fullscreen viewer with sliding metadata
        <TwoPanelStoryViewer
          initialStoryId={target.id}
          initialPanelId={initialPanelId}
          stories={stories}
          onClose={() => {
            const p = new URLSearchParams(window.location.search);
            const from = p.get('from');
            if (from) navigate(decodeURIComponent(from)); else navigate('/gallery');
          }}
        />
      )}
    </div>
  );
};

export default StoryPage;
