-- supabase/schema.sql
-- Residency+ Cloud Postgres Schema
-- Run this in the Supabase SQL Editor to bootstrap the database.

-- 1. Users Profile (tied to auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  plan TEXT DEFAULT 'free',         -- 'free' | 'pro'
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create public.users row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 2. Crate
CREATE TABLE public.crate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  soundcloud_url TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  bucket TEXT,
  kind TEXT,
  duration_ms INTEGER,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, soundcloud_url)
);
CREATE INDEX idx_crate_user ON public.crate(user_id);
ALTER TABLE public.crate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users fully own their crate" ON public.crate FOR ALL USING (auth.uid() = user_id);

-- 3. History
CREATE TABLE public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  soundcloud_url TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  bucket TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_history_user ON public.history(user_id);
CREATE INDEX idx_history_played_at ON public.history(played_at DESC);
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users fully own their history" ON public.history FOR ALL USING (auth.uid() = user_id);

-- 4. Session State (genre, source, dig_range, station)
CREATE TABLE public.session_state (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  genre TEXT DEFAULT 'all',
  source TEXT DEFAULT 'both',
  dig_range INTEGER DEFAULT 70,
  station_id TEXT DEFAULT '__all__',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.session_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users fully own their session state" ON public.session_state FOR ALL USING (auth.uid() = user_id);
<<<<<<< HEAD
=======

-- 5. Playlists
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_playlists_user ON public.playlists(user_id);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users fully own their playlists" ON public.playlists FOR ALL USING (auth.uid() = user_id);

-- 6. Playlist Items
CREATE TABLE public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  soundcloud_url TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  bucket TEXT,
  kind TEXT,
  duration_ms INTEGER,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_playlist_items_playlist ON public.playlist_items(playlist_id);
CREATE INDEX idx_playlist_items_user ON public.playlist_items(user_id);
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users fully own their playlist items" ON public.playlist_items FOR ALL USING (auth.uid() = user_id);
>>>>>>> main
