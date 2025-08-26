
import { MapPin, Bookmark, Share2, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Story, StoryPanelData } from "@/types/story";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// import { StoryHighlights } from "./StoryHighlights";

interface StoryMetadataProps {
  story: Story;
  currentPanel: StoryPanelData;
  onHighlightSelect?: (highlight: any) => void;
  hideUsername?: boolean;
}

export const StoryMetadata = ({ story, currentPanel, onHighlightSelect, hideUsername }: StoryMetadataProps) => {
  const normalizeUsername = (u?: string) => {
    if (!u) return '';
    const trimmed = u.trim();
    const noAt = trimmed.replace(/^@+/, '');
    return '@' + noAt;
  };
  const usernameHandle = (u?: string) => {
    if (!u) return '';
    return u.trim().replace(/^@+/, '');
  };
  const handleSave = () => {
    console.log("Save story:", story.id);
    // TODO: Implement save functionality
  };

  const [showShare, setShowShare] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const linkRef = useRef<HTMLInputElement | null>(null);
  const shareUrl = (() => {
    const base = window.location.origin;
    const slug = encodeURIComponent(story.handle || story.id);
    return `${base}/story/${slug}`;
  })();
  const handleShare = () => {
    setShowShare((s) => !s);
    setTimeout(() => linkRef.current?.select(), 0);
  };
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch { linkRef.current?.select(); }
  };
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!showShare) return;
      const t = e.target as Node;
      if (shareRef.current && !shareRef.current.contains(t)) setShowShare(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showShare]);

  const lists = story.lists || [];

  return (
    <div className="h-full overflow-y-auto p-6 bg-white">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">{story.title}</h1>
          {story.isClosed && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white">Fermé</span>
          )}
        </div>
        {story.username && !hideUsername && (
          <p className="text-lg text-gray-600">
            <a href={`https://instagram.com/${usernameHandle(story.username)}`}
               target="_blank" rel="noopener noreferrer"
               className="hover:underline">
              {normalizeUsername(story.username)}
            </a>
          </p>
        )}
        {/* Type just below the username */}
        {(() => {
          const typeText = Array.isArray(story.types) && story.types.length > 0
            ? story.types.join(', ')
            : (story.category || (story as any).type);
          return typeText ? (
            <p className="italic text-gray-700">{typeText}</p>
          ) : null;
        })()}
        {story.address && (
          <div className="flex items-center text-gray-500 text-sm">
            <MapPin size={14} className="mr-1" />
            <span>{story.address}</span>
          </div>
        )}
        <div className="text-sm text-gray-500 space-y-1 mb-2">
          {(() => {
            const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
            if (story.postedDate) {
              return <p>Publié le {fmt(story.postedDate)}</p>;
            }
            const last = story.lastVisit || story.publishedAt;
            const first = story.firstVisit;
            const same = first && last && new Date(first).toDateString() === new Date(last).toDateString();
            if (same) return <p>Visité le {fmt(last)}</p>;
            return (
              <>
                <p>Dernière visite le {fmt(last)}</p>
                {first && <p>Première visite le {fmt(first)}</p>}
              </>
            );
          })()}
        </div>
        {/* Prizes below the address */}
        {Array.isArray(story.prizes) && story.prizes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 ">
            {story.prizes.map((p) => (
              <PrizeCapsule key={p.id} name={p.name} slug={p.slug} iconUrl={p.iconUrl} textColor={p.textColor} bgColor={p.bgColor} />
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {story.tags && story.tags.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Tags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {story.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
      )}


      {/* Description */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Description</h3>
        <div className="prose prose-sm text-gray-700">
          {story.description ? (
            <p>{story.description}</p>
          ) : (
            <p className="text-gray-500">Aucune description.</p>
          )}
        </div>
      </div>

      {/* Lists Section (round icons, clickable). Hidden if none. */}
      {lists.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Listes</h3>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {lists.map((l) => {
              const thumb = l.thumbnail || story.thumbnail;
              const to = `/gallery?list=${encodeURIComponent(l.slug || l.id)}`;
              return (
                <Link key={l.id} to={to} className="group flex-shrink-0 text-center">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                    {thumb ? (
                      <img src={thumb} alt={l.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                  </div>
                  <div className="mt-2 w-16">
                    <p className="text-xs text-gray-700 leading-tight line-clamp-2">{l.name}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Panel Info - hidden for now */}

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6 relative">
        {/* Save hidden for now */}
        {/* <Button onClick={handleSave} variant="outline" className="flex-1">
          <Bookmark size={16} className=\"mr-2\" />
          Save
        </Button> */}
        <Button onClick={handleShare} variant="outline" className="flex-1">
          <Share2 size={16} className="mr-2" />
          Partager
        </Button>
        {showShare && (
          <div ref={shareRef} className="absolute left-0 right-0 top-full mt-2 bg-white border rounded-lg shadow-lg p-3 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Partager le lien</span>
              <button onClick={() => setShowShare(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="flex gap-2">
              <input ref={linkRef} readOnly value={shareUrl} className="flex-1 border rounded px-2 py-1 text-sm" />
              <Button size="sm" onClick={handleCopy}>Copier</Button>
            </div>
          </div>
        )}
      </div>

      {/* Details panel removed */}
    </div>
  );
};

function PrizeCapsule({ name, slug, iconUrl, textColor, bgColor }: { name: string; slug?: string; iconUrl?: string; textColor?: string; bgColor?: string }) {
  const color = textColor || '#111111';
  const bg = bgColor || 'rgba(255,255,255,0.85)';
  const size = 20;
  const to = slug ? `/mentions/${encodeURIComponent(slug)}` : `/mentions/${encodeURIComponent(name)}`;
  return (
    <a
      href={to}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold hover:opacity-90 transition"
      style={{ color, backgroundColor: bg, border: '1px solid rgba(0,0,0,0.06)' }}
    >
      {iconUrl ? (
        <span
          aria-hidden
          style={{
            width: size,
            height: size,
            backgroundColor: 'currentColor',
            WebkitMaskImage: `url(${iconUrl})`,
            maskImage: `url(${iconUrl})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            display: 'inline-block',
          }}
        />
      ) : null}
      <span>{name}</span>
    </a>
  );
}
