-- User Uploads: metadata table for owned user audio.
-- Storage: use Supabase Storage bucket "uploads" with path {user_id}/{id}/{filename}.
-- RLS: users can only access their own rows.

CREATE TABLE IF NOT EXISTS public.user_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  artist text DEFAULT '',
  original_filename text,
  mime_type text,
  duration_ms integer,
  artwork_url text,
  storage_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON public.user_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_uploads_created_at ON public.user_uploads(created_at DESC);

ALTER TABLE public.user_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own uploads"
  ON public.user_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploads"
  ON public.user_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploads"
  ON public.user_uploads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads"
  ON public.user_uploads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_uploads IS 'Residency+ user upload metadata; playback via storage_url. RLS enforces ownership.';
