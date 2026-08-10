import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Browser-safe production fallback for the existing StreamVista Supabase project.
// The anon/publishable key is public by design; privileged operations still rely on RLS/server-side secrets.
const FALLBACK_SUPABASE_URL = 'https://hllgmkfqgeuqlmpcirvn.supabase.co';
const FALLBACK_PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbGdta2ZxZ2V1cWxtcGNpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1MTcsImV4cCI6MjA5NDY0MDUxN30.0X_qVm8wGWLxQ9hPx7wdAbmzYIsC5FFH8taYY1aevSs';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLIC_KEY;

export const isBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
