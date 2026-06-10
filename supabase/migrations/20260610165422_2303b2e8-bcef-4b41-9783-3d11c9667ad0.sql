CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);