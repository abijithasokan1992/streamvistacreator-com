create or replace function public.list_public_recent_productions(_limit integer default 10)
returns table(id uuid, name text, tracking_code text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.crew->>'title_number' as tracking_code
  from public.projects p
  where p.crew->>'title_number' is not null
    and p.name is not null
  order by p.updated_at desc
  limit least(_limit, 50);
$$;

grant execute on function public.list_public_recent_productions(integer) to anon, authenticated;