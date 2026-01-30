-- Add project_id column to documents table
-- This allows linking a document (invoice/credit note) to a project

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

-- Add comment
COMMENT ON COLUMN documents.project_id IS 'Optional link to a project for reference on invoice';
