-- Transactional e-mail notification log.
-- Run manually in Supabase before enabling order/budget e-mail notifications in production.

create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  entity_type text not null check (entity_type in ('order', 'custom_request')),
  entity_id uuid not null,
  event_type text not null,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider text not null default 'smtp',
  provider_message_id text,
  attempts integer not null default 1 check (attempts > 0),
  error_message text,
  metadata jsonb not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_notifications_set_updated_at on public.email_notifications;
create trigger email_notifications_set_updated_at
  before update on public.email_notifications
  for each row execute function public.set_updated_at();

create index if not exists email_notifications_entity_idx
on public.email_notifications (entity_type, entity_id);

create index if not exists email_notifications_status_idx
on public.email_notifications (status, created_at desc);

create index if not exists email_notifications_recipient_idx
on public.email_notifications (recipient_email, created_at desc);

alter table public.email_notifications enable row level security;

drop policy if exists "Admins can read email notifications" on public.email_notifications;
create policy "Admins can read email notifications"
on public.email_notifications
for select
using ((select public.is_admin()));
