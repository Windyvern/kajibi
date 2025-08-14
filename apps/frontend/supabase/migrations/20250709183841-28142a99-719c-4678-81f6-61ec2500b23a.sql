
-- Create a table for stories
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  subtitle TEXT,
  handle TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  thumbnail TEXT,
  thumbnail_panel_id UUID,
  tags TEXT[],
  address TEXT,
  description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table for story panels
CREATE TABLE public.story_panels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'quote')),
  title TEXT,
  content TEXT,
  media TEXT,
  duration INTEGER,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_stories_geo ON public.stories(latitude, longitude);
CREATE INDEX idx_story_panels_story_id ON public.story_panels(story_id);
CREATE INDEX idx_story_panels_order ON public.story_panels(story_id, order_index);

-- Enable Row Level Security (making tables public for now - we'll add auth later)
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_panels ENABLE ROW LEVEL SECURITY;

-- Create policies that allow public read access for now
CREATE POLICY "Stories are publicly readable" 
  ON public.stories 
  FOR SELECT 
  USING (true);

CREATE POLICY "Story panels are publicly readable" 
  ON public.story_panels 
  FOR SELECT 
  USING (true);

-- Insert sample data
INSERT INTO public.stories (id, title, author, subtitle, handle, address, description, latitude, longitude, tags, thumbnail) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'The Hidden Gem of Brooklyn', 'Sarah Chen', 'A photojournalist discovers street art in unexpected places', '@sarahc_photo', '123 Atlantic Ave, Brooklyn, NY', 'An intimate look at the underground street art scene in Brooklyn, revealing stories behind the vibrant murals that transform forgotten corners into canvases of hope and rebellion.', 40.6892, -73.9442, ARRAY['street art', 'Brooklyn', 'urban culture'], 'photo-1518710843675-2540dd79065c'),
('550e8400-e29b-41d4-a716-446655440001', 'Mountain Solitude', 'Alex Rivera', 'Finding peace in the wilderness', '@alexr_hikes', 'Rocky Mountain National Park, CO', 'A solo hiking journey through the Colorado Rockies, exploring themes of solitude, self-discovery, and the healing power of nature in our increasingly connected world.', 40.3428, -105.6836, ARRAY['hiking', 'mountains', 'solitude'], 'photo-1506905925346-21bda4d32df4'),
('550e8400-e29b-41d4-a716-446655440002', 'City Lights', 'Maya Patel', 'Urban photography at its finest', '@maya.captures', 'Times Square, New York, NY', 'An exploration of New York City after dark, capturing the interplay between artificial light and human stories in the city that never sleeps.', 40.7580, -73.9855, ARRAY['photography', 'urban', 'nightlife'], 'photo-1542831371-29b0f74f9713');

-- Insert sample panels for the first story
INSERT INTO public.story_panels (story_id, type, title, content, media, order_index) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'text', 'The Discovery', 'Walking through the narrow alleys of Brooklyn, I stumbled upon something extraordinary. What started as a routine photography walk turned into a journey of discovery.', null, 0),
('550e8400-e29b-41d4-a716-446655440000', 'image', 'First Glimpse', 'The mural appeared around the corner like a revelation.', 'photo-1541961017774-22349e4a1262', 1),
('550e8400-e29b-41d4-a716-446655440000', 'quote', 'Artist''s Words', '"Art is not what you see, but what you make others see." - Edgar Degas', null, 2),
('550e8400-e29b-41d4-a716-446655440000', 'text', 'The Story Behind', 'Each piece tells a story of the community, the struggles, and the dreams of people who call this neighborhood home.', null, 3);

-- Insert sample panels for the second story
INSERT INTO public.story_panels (story_id, type, title, content, media, order_index) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'image', 'The Summit Call', 'The mountain called, and I had to answer.', 'photo-1464822759844-d150d4e2e2e4', 0),
('550e8400-e29b-41d4-a716-446655440001', 'text', 'Early Morning', 'Starting before dawn, the trail ahead promised both challenge and reward.', null, 1),
('550e8400-e29b-41d4-a716-446655440001', 'image', 'Mountain Vista', 'The view from 12,000 feet changes everything.', 'photo-1506905925346-21bda4d32df4', 2);

-- Insert sample panels for the third story
INSERT INTO public.story_panels (story_id, type, title, content, media, order_index) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'text', 'Neon Dreams', 'The city transforms after sunset, becoming a canvas of light and shadow.', null, 0),
('550e8400-e29b-41d4-a716-446655440002', 'image', 'Times Square Magic', 'Where millions of stories intersect every day.', 'photo-1542831371-29b0f74f9713', 1),
('550e8400-e29b-41d4-a716-446655440002', 'quote', 'City Wisdom', '"The city seen from the Queensboro Bridge is always the city seen for the first time." - F. Scott Fitzgerald', null, 2);
