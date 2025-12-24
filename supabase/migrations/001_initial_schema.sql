-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create profiles table for user data
create table public.profiles (
  id uuid references auth.users on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

-- Create analyses table to store analysis metadata
create table public.analyses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  analysis_id text unique not null, -- The UUID from the analysis service
  directory_path text not null,
  status text not null check (status in ('pending', 'parsing', 'analyzing', 'building_graph', 'completed', 'failed')),
  progress float default 0.0,
  current_step text default '',
  files_processed integer default 0,
  total_files integer default 0,
  file_count integer default 0,
  edge_count integer default 0,
  analysis_time_seconds float,
  error_message text,
  languages jsonb default '{}',
  errors jsonb default '[]',
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create analysis_nodes table to store node data
create table public.analysis_nodes (
  id uuid default uuid_generate_v4() primary key,
  analysis_id uuid references public.analyses(id) on delete cascade,
  node_id text not null, -- The node ID from the analysis
  path text not null,
  name text not null,
  folder text default '',
  language text not null,
  role text not null,
  description text default '',
  category text not null,
  imports jsonb default '[]',
  size_bytes integer default 0,
  line_count integer default 0,
  position_x float default 0,
  position_y float default 0,
  created_at timestamptz default now()
);

-- Create analysis_edges table to store edge data
create table public.analysis_edges (
  id uuid default uuid_generate_v4() primary key,
  analysis_id uuid references public.analyses(id) on delete cascade,
  edge_id text not null, -- The edge ID from the analysis
  source_node_id text not null,
  target_node_id text not null,
  import_type text not null,
  label text,
  style jsonb default '{}',
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_nodes enable row level security;
alter table public.analysis_edges enable row level security;

-- Create policies for profiles table
create policy "Users can view their own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

create policy "Users can insert their own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Create policies for analyses table
create policy "Users can view their own analyses" 
  on public.analyses for select 
  using (auth.uid() = user_id);

create policy "Users can create their own analyses" 
  on public.analyses for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own analyses" 
  on public.analyses for update 
  using (auth.uid() = user_id);

create policy "Users can delete their own analyses" 
  on public.analyses for delete 
  using (auth.uid() = user_id);

-- Create policies for analysis_nodes table
create policy "Users can view nodes from their analyses" 
  on public.analysis_nodes for select 
  using (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_nodes.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

create policy "Users can create nodes for their analyses" 
  on public.analysis_nodes for insert 
  with check (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_nodes.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

create policy "Users can update nodes from their analyses" 
  on public.analysis_nodes for update 
  using (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_nodes.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

create policy "Users can delete nodes from their analyses" 
  on public.analysis_nodes for delete 
  using (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_nodes.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

-- Create policies for analysis_edges table
create policy "Users can view edges from their analyses" 
  on public.analysis_edges for select 
  using (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_edges.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

create policy "Users can create edges for their analyses" 
  on public.analysis_edges for insert 
  with check (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_edges.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

create policy "Users can update edges from their analyses" 
  on public.analysis_edges for update 
  using (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_edges.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

create policy "Users can delete edges from their analyses" 
  on public.analysis_edges for delete 
  using (
    exists (
      select 1 from public.analyses 
      where analyses.id = analysis_edges.analysis_id 
      and analyses.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
create index idx_analyses_user_id on public.analyses(user_id);
create index idx_analyses_analysis_id on public.analyses(analysis_id);
create index idx_analyses_status on public.analyses(status);
create index idx_analysis_nodes_analysis_id on public.analysis_nodes(analysis_id);
create index idx_analysis_edges_analysis_id on public.analysis_edges(analysis_id);

-- Create function to handle user profile creation
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger to automatically create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_analyses
  before update on public.analyses
  for each row execute function public.handle_updated_at();