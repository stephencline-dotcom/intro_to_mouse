create extension if not exists pgcrypto;

create table if not exists public.mouse_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mouse_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.mouse_classes(id) on delete cascade,
  display_name text not null,
  normalized_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(class_id, normalized_name)
);

create table if not exists public.mouse_class_lessons (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.mouse_classes(id) on delete cascade,
  lesson_id text not null,
  assigned_at timestamptz not null default now(),
  included_in_grade boolean not null default true,
  unique(class_id, lesson_id)
);

create table if not exists public.mouse_attempts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.mouse_classes(id) on delete cascade,
  student_id uuid not null references public.mouse_students(id) on delete cascade,
  lesson_id text not null,
  step_id text not null,
  step_title text not null default '',
  attempt_number integer not null default 1,
  status text not null default 'started' check (status in ('started','incomplete','completed')),
  active_ms bigint not null default 0,
  correct_actions integer not null default 0,
  wrong_actions integer not null default 0,
  freeze_count integer not null default 0,
  frozen_ms bigint not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(student_id, lesson_id, step_id, attempt_number)
);

create index if not exists mouse_students_class_idx on public.mouse_students(class_id);
create index if not exists mouse_class_lessons_class_idx on public.mouse_class_lessons(class_id);
create index if not exists mouse_attempts_class_idx on public.mouse_attempts(class_id);
create index if not exists mouse_attempts_student_idx on public.mouse_attempts(student_id);
create index if not exists mouse_attempts_step_idx on public.mouse_attempts(lesson_id, step_id);

alter table public.mouse_classes enable row level security;
alter table public.mouse_students enable row level security;
alter table public.mouse_class_lessons enable row level security;
alter table public.mouse_attempts enable row level security;

-- Browsers never access these tables directly. The Express server uses the
-- existing Supabase service-role key and validates teacher/student sessions.

-- Allow the server-side Supabase service role to use the data tables.
grant usage on schema public to service_role;

grant select, insert, update, delete
on table public.mouse_classes
to service_role;

grant select, insert, update, delete
on table public.mouse_students
to service_role;

grant select, insert, update, delete
on table public.mouse_class_lessons
to service_role;

grant select, insert, update, delete
on table public.mouse_attempts
to service_role;
