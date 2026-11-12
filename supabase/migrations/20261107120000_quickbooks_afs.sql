-- QBO credentials and staged reports are server-only and scoped to a practice and engagement.
create table public.pp_qbo_connections (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null,
 engagement_id uuid not null references public.afs_engagements(id), realm_id text not null,
 environment text not null check(environment in ('sandbox','production')),
 status text not null default 'connected' check(status in ('connected','reconnect_required','disconnected')),
 tokens text not null, expires_at timestamptz not null, created_by uuid not null,
 refresh_lease text,refresh_until timestamptz, created_at timestamptz not null default now(),
 unique(organisation_id,engagement_id)
);
create table public.pp_qbo_oauth_states (
 state_hash text primary key, browser_hash text not null, organisation_id uuid not null,
 engagement_id uuid not null references public.afs_engagements(id), profile_id uuid not null,
 environment text not null, expires_at timestamptz not null
);
create table public.pp_qbo_jobs (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null,
 engagement_id uuid not null references public.afs_engagements(id), connection_id uuid not null references public.pp_qbo_connections(id),
 realm_id text not null, created_by uuid not null,
 period_start date not null,period_end date not null,
 status text not null default 'loading' check(status in ('loading','review','applied','cancelled')),
 step integer not null default 0, state jsonb not null default '{}',
 lease text,lease_until timestamptz, import_id uuid references public.pp_gl_imports(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index pp_qbo_one_pending on public.pp_qbo_jobs(engagement_id) where status in ('loading','review');
create table public.pp_qbo_batches (
 job_id uuid not null references public.pp_qbo_jobs(id) on delete cascade,
 batch integer not null, payload jsonb not null, source_report jsonb not null, primary key(job_id,batch)
);
alter table public.pp_qbo_connections enable row level security;
alter table public.pp_qbo_oauth_states enable row level security;
alter table public.pp_qbo_jobs enable row level security;
alter table public.pp_qbo_batches enable row level security;
revoke all on public.pp_qbo_connections,public.pp_qbo_oauth_states,public.pp_qbo_jobs,public.pp_qbo_batches from public,anon,authenticated;
grant all on public.pp_qbo_connections,public.pp_qbo_oauth_states,public.pp_qbo_jobs,public.pp_qbo_batches to service_role;

-- Apply a fully reconciled preview atomically using the existing ledger/TB workflow.
-- The engagement row lock prevents finalisation racing with the import.
create function public.pp_qbo_apply(p_job uuid,p_organisation uuid,p_actor uuid,p_update_tb boolean)
returns uuid language plpgsql set search_path=public as $$
declare j public.pp_qbo_jobs%rowtype; e public.afs_engagements%rowtype; rows jsonb; accounts jsonb; result uuid; fingerprint text;
begin
 select * into j from public.pp_qbo_jobs where id=p_job and organisation_id=p_organisation for update;
 if not found or j.status<>'review' then raise exception 'Import preview is not ready';end if;
 select * into e from public.afs_engagements where id=j.engagement_id and organisation_id=p_organisation for update;
 if not found or lower(coalesce(e.status,'')) in ('final','archived','finalising') then raise exception 'Engagement is locked';end if;
 if not exists(select 1 from public.pp_qbo_connections c where c.id=j.connection_id and c.realm_id=j.realm_id and c.status='connected') then raise exception 'Connection changed; restart the import';end if;
 if (select id::text from public.pp_gl_imports where engagement_id=e.id and organisation_id=p_organisation and active) is distinct from j.state->>'activeImportId' then raise exception 'The active ledger changed after this import started. Cancel and restart to review the latest figures.';end if;
 if j.state->>'verified' is distinct from 'true' or jsonb_array_length(coalesce(j.state->'issues','[]'))<>0 then raise exception 'Resolve the source reconciliation before applying';end if;
 if j.period_end<>e.financial_year_end::date or j.period_start<>coalesce((select reporting_period_start::date from public.afs_client_setup where engagement_id=e.id),(e.financial_year_end::date+1-interval '1 year')::date) then raise exception 'Reporting period changed; restart the import';end if;
 select coalesce(jsonb_agg(t.item order by b.batch,t.ordinality),'[]') into rows from public.pp_qbo_batches b cross join lateral jsonb_array_elements(b.payload) with ordinality t(item,ordinality) where b.job_id=j.id;
 accounts:=j.state->'accounts';
 if jsonb_array_length(rows)<> (j.state->>'rowCount')::integer then raise exception 'Staged ledger is incomplete';end if;
 -- Reject stale accounts rather than leaving obsolete source balances in the TB.
 if p_update_tb and exists(select 1 from public.afs_trial_balance_lines l where l.engagement_id=e.id and not exists(select 1 from jsonb_array_elements(accounts) a where a->>'code'=upper(regexp_replace(l.account_code,'\s','','g')))) then raise exception 'Existing TB accounts are absent from QuickBooks. Resolve account mapping before updating figures, or import supporting detail only.';end if;
 fingerprint:=encode(sha256(convert_to(j.realm_id||j.period_start::text||j.period_end::text||rows::text||accounts::text,'UTF8')),'hex');
 result:=public.pp_import_general_ledger(p_organisation,j.engagement_id,p_actor,fingerprint,'QuickBooks Online '||j.realm_id,j.period_start,j.period_end,rows,accounts,p_update_tb);
 update public.pp_qbo_jobs set status='applied',import_id=result,updated_at=now() where id=j.id;
 return result;
end $$;
revoke all on function public.pp_qbo_apply(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.pp_qbo_apply(uuid,uuid,uuid,boolean) to service_role;
