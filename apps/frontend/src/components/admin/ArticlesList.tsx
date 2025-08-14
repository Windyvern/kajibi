
import { Story } from '@/types/story';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, MapPin, Eye } from 'lucide-react';

interface ArticlesListProps {
  articles: Story[];
  onEditArticle: (articleId: string) => void;
}

export const ArticlesList = ({ articles, onEditArticle }: ArticlesListProps) => {
  return (
    <div className="grid gap-4">
      {articles.map((article) => (
        <Card key={article.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                {article.thumbnail && (
                  <img
                    src={`https://images.unsplash.com/${article.thumbnail}?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80`}
                    alt={article.title}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{article.title}</h3>
                    <p className="text-sm text-gray-600">{article.handle}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditArticle(article.id)}
                      className="flex items-center gap-1"
                    >
                      <Edit size={14} />
                      Edit
                    </Button>
                  </div>
                </div>

                {article.address && (
                  <div className="flex items-center text-sm text-gray-500">
                    <MapPin size={14} className="mr-1" />
                    {article.address}
                  </div>
                )}

                <p className="text-sm text-gray-700 line-clamp-2">
                  {article.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {article.tags?.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {article.panels.length} panels
                    </span>
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
