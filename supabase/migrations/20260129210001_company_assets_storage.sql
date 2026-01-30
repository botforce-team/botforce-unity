-- Create storage bucket for company assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true, -- Public so logos can be displayed
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company-assets bucket
-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Superadmins can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company assets" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can delete company assets" ON storage.objects;

-- Only superadmins can upload company assets
CREATE POLICY "Superadmins can upload company assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'superadmin'
      AND is_active = true
    )
  );

-- Anyone can view company assets (logos are public)
CREATE POLICY "Anyone can view company assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-assets');

-- Superadmins can update their company assets
CREATE POLICY "Superadmins can update company assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-assets')
  WITH CHECK (
    bucket_id = 'company-assets'
    AND EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'superadmin'
      AND is_active = true
    )
  );

-- Superadmins can delete company assets
CREATE POLICY "Superadmins can delete company assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'superadmin'
      AND is_active = true
    )
  );
