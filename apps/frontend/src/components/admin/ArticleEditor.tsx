
import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Eye, Upload, GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Story, StoryPanelData } from '@/types/story';
import { sampleStories } from '@/data/sampleStories';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

interface ArticleEditorProps {
  articleId: string | null;
  onBack: () => void;
}

export const ArticleEditor = ({ articleId, onBack }: ArticleEditorProps) => {
  const [article, setArticle] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (articleId) {
      const existingArticle = sampleStories.find(s => s.id === articleId);
      if (existingArticle) {
        setArticle(existingArticle);
      }
    } else {
      // Create new article template
      setArticle({
        id: `story-${Date.now()}`,
        title: '',
        author: '',
        handle: '',
        subtitle: '',
        publishedAt: new Date().toISOString(),
        thumbnail: '',
        thumbnailPanelId: '',
        tags: [],
        address: '',
        description: '',
        geo: undefined,
        panels: []
      });
    }
  }, [articleId]);

  const handleSave = async () => {
    if (!article) return;
    
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Saving article:', article);
    setIsLoading(false);
  };

  const handleAddTag = () => {
    if (!article || !newTag.trim()) return;
    
    if (!article.tags?.includes(newTag.trim())) {
      setArticle({
        ...article,
        tags: [...(article.tags || []), newTag.trim()]
      });
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!article) return;
    
    setArticle({
      ...article,
      tags: article.tags?.filter(tag => tag !== tagToRemove) || []
    });
  };

  const handleAddPanel = () => {
    if (!article) return;
    
    const newPanel: StoryPanelData = {
      id: `panel-${Date.now()}`,
      type: 'text',
      title: '',
      content: '',
      duration: 5,
      orderIndex: article.panels.length
    };
    
    setArticle({
      ...article,
      panels: [...article.panels, newPanel]
    });
  };

  const handleRemovePanel = (panelId: string) => {
    if (!article) return;
    
    setArticle({
      ...article,
      panels: article.panels.filter(p => p.id !== panelId)
    });
  };

  const handlePanelReorder = (result: any) => {
    if (!article || !result.destination) return;

    const items = Array.from(article.panels);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order indices
    const updatedPanels = items.map((panel, index) => ({
      ...panel,
      orderIndex: index
    }));

    setArticle({
      ...article,
      panels: updatedPanels
    });
  };

  if (!article) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {articleId ? 'Edit Article' : 'Create Article'}
        </h1>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Eye size={16} />
            Preview
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Article Details */}
        <Card>
          <CardHeader>
            <CardTitle>Article Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={article.title}
                onChange={(e) => setArticle({ ...article, title: e.target.value })}
                placeholder="Enter article title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={article.author}
                  onChange={(e) => setArticle({ ...article, author: e.target.value })}
                  placeholder="Author name"
                />
              </div>
              <div>
                <Label htmlFor="handle">Handle</Label>
                <Input
                  id="handle"
                  value={article.handle || ''}
                  onChange={(e) => setArticle({ ...article, handle: e.target.value })}
                  placeholder="@username"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={article.address || ''}
                onChange={(e) => setArticle({ ...article, address: e.target.value })}
                placeholder="Location address"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={article.description || ''}
                onChange={(e) => setArticle({ ...article, description: e.target.value })}
                placeholder="Article description"
                rows={4}
              />
            </div>

            {/* Tags */}
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {article.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag} size="sm">Add</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Story Panels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Story Panels
              <Button onClick={handleAddPanel} size="sm">
                <Upload size={16} className="mr-1" />
                Add Panel
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={handlePanelReorder}>
              <Droppable droppableId="panels">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                    {article.panels.map((panel, index) => (
                      <Draggable key={panel.id} draggableId={panel.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div {...provided.dragHandleProps}>
                              <GripVertical size={16} className="text-gray-400" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {panel.type}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {panel.title || `Panel ${index + 1}`}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-1">
                                {panel.content}
                              </p>
                            </div>
                            
                            <Button
                              onClick={() => handleRemovePanel(panel.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {article.panels.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No panels yet. Add your first panel to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
