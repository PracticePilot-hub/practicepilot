-- Private application storage. All requests are authorised by scope and practice in the API.
create table if not exists public.pp_workpapers (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null,
 scope text not null check (scope in ('afs','crm')), scope_id uuid not null,
 resource_key text not null, payload jsonb not null default '{}', version bigint not null default 1,
 created_by uuid not null, updated_by uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (organisation_id,scope,scope_id,resource_key)
);
create table if not exists public.pp_workpaper_history (
 id bigint generated always as identity primary key, workpaper_id uuid not null references public.pp_workpapers(id),
 organisation_id uuid not null, version bigint not null, payload jsonb not null,
 changed_by uuid not null, changed_at timestamptz not null default now()
);
create index if not exists pp_workpaper_history_paper on public.pp_workpaper_history(workpaper_id,version);
-- AFTER trigger records the final version; version stamping is separate to satisfy the FK on insert.
create or replace function public.pp_stamp_workpaper() returns trigger language plpgsql set search_path=public as $$
begin
 if NEW.organisation_id<>OLD.organisation_id or NEW.scope<>OLD.scope or NEW.scope_id<>OLD.scope_id or NEW.resource_key<>OLD.resource_key then raise exception 'Working paper identity cannot change'; end if;
 NEW.version=OLD.version+1; NEW.updated_at=now(); return NEW;
end $$;
create or replace function public.pp_audit_workpaper() returns trigger language plpgsql set search_path=public as $$
begin
 insert into public.pp_workpaper_history(workpaper_id,organisation_id,version,payload,changed_by)
 values(NEW.id,NEW.organisation_id,NEW.version,NEW.payload,NEW.updated_by); return NEW;
end $$;
drop trigger if exists pp_workpaper_stamp on public.pp_workpapers;
create trigger pp_workpaper_stamp before update on public.pp_workpapers for each row execute function public.pp_stamp_workpaper();
drop trigger if exists pp_workpaper_audit on public.pp_workpapers;
create trigger pp_workpaper_audit after insert or update on public.pp_workpapers for each row execute function public.pp_audit_workpaper();
alter table public.pp_workpapers enable row level security;
alter table public.pp_workpaper_history enable row level security;
revoke all on public.pp_workpapers,public.pp_workpaper_history from anon,authenticated;
grant all on public.pp_workpapers,public.pp_workpaper_history to service_role;
grant usage,select on sequence public.pp_workpaper_history_id_seq to service_role;
alter table public.afs_review_points add column if not exists assigned_to uuid;
alter table public.afs_review_points add column if not exists resource_key text;
alter table public.afs_review_points add column if not exists document_path text;
alter table public.afs_review_points add column if not exists document_page integer;
create table if not exists public.pp_evidence_archives (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null,
 engagement_id uuid not null references public.afs_engagements(id),
 created_by uuid not null, created_at timestamptz not null default now(),
 status text not null check (status='complete'), storage_prefix text not null,
 source_fingerprint text not null, manifest jsonb not null
);
create index if not exists pp_evidence_archive_engagement on public.pp_evidence_archives(organisation_id,engagement_id,created_at desc);
alter table public.pp_evidence_archives enable row level security;
revoke all on public.pp_evidence_archives from anon,authenticated;
grant all on public.pp_evidence_archives to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('pp-evidence','pp-evidence',false,100000000) on conflict(id) do nothing;
create table if not exists public.pp_gl_imports (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null,
 engagement_id uuid not null references public.afs_engagements(id), fingerprint text not null,
 filename text not null, period_start date not null, period_end date not null,
 accounts jsonb not null, active boolean not null default true,
 created_by uuid not null, created_at timestamptz not null default now(),
 unique(engagement_id,fingerprint)
);
create unique index if not exists pp_gl_active_engagement on public.pp_gl_imports(engagement_id) where active;
create table if not exists public.pp_gl_transactions (
 id bigint generated always as identity primary key, import_id uuid not null references public.pp_gl_imports(id),
 organisation_id uuid not null, engagement_id uuid not null references public.afs_engagements(id),
 row_number integer not null, account_code text not null, account_name text not null,
 journal_date date not null, reference text not null default '', description text not null default '',
 debit numeric(18,2) not null default 0 check(debit>=0), credit numeric(18,2) not null default 0 check(credit>=0),
 unique(import_id,row_number)
);
create index if not exists pp_gl_account_detail on public.pp_gl_transactions(import_id,account_code,journal_date,row_number);
alter table public.pp_gl_imports enable row level security;
alter table public.pp_gl_transactions enable row level security;
revoke all on public.pp_gl_imports,public.pp_gl_transactions from anon,authenticated;
grant all on public.pp_gl_imports,public.pp_gl_transactions to service_role;
grant usage,select on sequence public.pp_gl_transactions_id_seq to service_role;
create or replace function public.pp_import_general_ledger(
 p_organisation_id uuid,p_engagement_id uuid,p_user_id uuid,p_fingerprint text,p_filename text,
 p_start date,p_end date,p_rows jsonb,p_accounts jsonb,p_update_tb boolean
) returns uuid language plpgsql set search_path=public as $$
declare v_import uuid:=gen_random_uuid(); v_status text; account jsonb; existing_id uuid; adjustment numeric; final_amount numeric; source_amount numeric; opening_adjustment numeric;
begin
 select status into v_status from public.afs_engagements where id=p_engagement_id and organisation_id=p_organisation_id for update;
 if not found then raise exception 'Engagement not found'; end if;
 if lower(v_status) in ('final','archived') then raise exception 'Engagement is locked'; end if;
 update public.pp_gl_imports set active=false where engagement_id=p_engagement_id and organisation_id=p_organisation_id;
 insert into public.pp_gl_imports(id,organisation_id,engagement_id,fingerprint,filename,period_start,period_end,accounts,created_by)
 values(v_import,p_organisation_id,p_engagement_id,p_fingerprint,p_filename,p_start,p_end,p_accounts,p_user_id);
 insert into public.pp_gl_transactions(import_id,organisation_id,engagement_id,row_number,account_code,account_name,journal_date,reference,description,debit,credit)
 select v_import,p_organisation_id,p_engagement_id,ordinality::integer,entry->>'accountCode',entry->>'accountName',(entry->>'date')::date,entry->>'reference',entry->>'description',(entry->>'debit')::numeric,(entry->>'credit')::numeric from jsonb_array_elements(p_rows) with ordinality as t(entry,ordinality);
 if p_update_tb then
  for account in select * from jsonb_array_elements(p_accounts) loop
   existing_id:=null;
   select id into existing_id from public.afs_trial_balance_lines where engagement_id=p_engagement_id and upper(regexp_replace(account_code,'\s','','g'))=account->>'code';
   select coalesce(sum(l.debit-l.credit),0) into adjustment from public.afs_adjusting_journal_lines l join public.afs_adjusting_journals j on j.id=l.journal_id where j.engagement_id=p_engagement_id and lower(coalesce(j.status,'posted'))<>'draft' and coalesce(j.journal_period,'current_year')='current_year' and upper(regexp_replace(l.account_code,'\s','','g'))=account->>'code';
   select coalesce(sum(l.debit-l.credit),0) into opening_adjustment from public.afs_adjusting_journal_lines l join public.afs_adjusting_journals j on j.id=l.journal_id where j.engagement_id=p_engagement_id and lower(coalesce(j.status,'posted'))<>'draft' and j.journal_period='opening_balance' and upper(regexp_replace(l.account_code,'\s','','g'))=account->>'code';
   source_amount:=(account->>'closing')::numeric+opening_adjustment;
   if existing_id is null then
    insert into public.afs_trial_balance_lines(engagement_id,account_code,account_name,opening_balance,source_balance,current_year_balance,current_balance,final_balance,adjustments,debit,credit,import_basis)
    values(p_engagement_id,account->>'code',account->>'name',(account->>'opening')::numeric+opening_adjustment,source_amount,source_amount+adjustment,source_amount+adjustment,source_amount+adjustment,adjustment,greatest(source_amount,0),greatest(-source_amount,0),'general_ledger');
   else
    select source_amount+adjustment+coalesce(manual_adjustment,0)+coalesce(reclassifications,0) into final_amount from public.afs_trial_balance_lines where id=existing_id;
    update public.afs_trial_balance_lines set opening_balance=(account->>'opening')::numeric+opening_adjustment,source_balance=source_amount,current_year_balance=final_amount,current_balance=final_amount,final_balance=final_amount,adjustments=adjustment,debit=greatest(source_amount,0),credit=greatest(-source_amount,0),import_basis='general_ledger',updated_at=now() where id=existing_id;
   end if;
  end loop;
 end if;
 update public.afs_section_signoffs set prepared_by=null,prepared_at=null,reviewed_by=null,reviewed_at=null,captain_cleared_by=null,captain_cleared_at=null,reopened_by=p_user_id,reopened_at=now(),reopen_reason='General ledger detail imported',updated_at=now() where engagement_id=p_engagement_id and organisation_id=p_organisation_id and (section_key like 'lead-schedule:%' or section_key in ('trial-balance','mapping','lead-schedules','financial-statements','adjusting-journals'));
 return v_import;
end $$;
revoke all on function public.pp_import_general_ledger(uuid,uuid,uuid,text,text,date,date,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.pp_import_general_ledger(uuid,uuid,uuid,text,text,date,date,jsonb,jsonb,boolean) to service_role;
-- Same in-app assignment as the CRM review workflow, deliberately without an email call.
create or replace function public.pp_return_document_query(p_organisation_id uuid,p_client_id uuid,p_work_id uuid,p_user_id uuid,p_note text,p_path text,p_page integer)
returns uuid language plpgsql set search_path=public as $$
declare task public.crm_work_items%rowtype;
begin
 select * into task from public.crm_work_items where id=p_work_id and organisation_id=p_organisation_id and client_id=p_client_id for update;
 if not found or task.reviewer_user_id is distinct from p_user_id then raise exception 'Only the assigned task reviewer can return this query'; end if;
 if task.preparer_user_id is null then raise exception 'The task has no assigned preparer'; end if;
 if task.review_status not in ('awaiting_review','returned') then raise exception 'This task is not awaiting review'; end if;
 update public.crm_work_item_checklist set status='outstanding',updated_at=now() where work_item_id=p_work_id and item_type='review';
 update public.crm_work_items set assigned_user_id=task.preparer_user_id,review_status='returned',review_completed_at=null,review_notes=concat_ws(E'\n\n',nullif(review_notes,''),p_note),status='in_progress',updated_at=now() where id=p_work_id;
 insert into public.crm_work_item_activity(organisation_id,work_item_id,action_type,action_summary,from_status,to_status,performed_by_user_id)
 values(p_organisation_id,p_work_id,'review_returned',p_note,task.status,'in_progress',p_user_id);
 return p_work_id;
end $$;
revoke all on function public.pp_return_document_query(uuid,uuid,uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.pp_return_document_query(uuid,uuid,uuid,uuid,text,text,integer) to service_role;
create or replace function public.pp_save_workpaper(p_organisation_id uuid,p_scope text,p_scope_id uuid,p_key text,p_payload jsonb,p_version bigint,p_user_id uuid)
returns jsonb language plpgsql set search_path=public as $$
declare v_status text; saved public.pp_workpapers%rowtype;
begin
 if p_scope='afs' then
  select status into v_status from public.afs_engagements where id=p_scope_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Working file not found'; end if;
  if lower(v_status) in ('final','archived','finalising') then raise exception 'Working file is locked'; end if;
 elsif p_scope='crm' then
  perform 1 from public.crm_clients where id=p_scope_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Client not found'; end if;
 else raise exception 'Invalid working paper scope'; end if;
 if p_version is null then
  insert into public.pp_workpapers(organisation_id,scope,scope_id,resource_key,payload,created_by,updated_by)
  values(p_organisation_id,p_scope,p_scope_id,p_key,p_payload,p_user_id,p_user_id) returning * into saved;
 else
  update public.pp_workpapers set payload=p_payload,updated_by=p_user_id where organisation_id=p_organisation_id and scope=p_scope and scope_id=p_scope_id and resource_key=p_key and version=p_version returning * into saved;
  if not found then raise exception using errcode='40001',message='Working paper version conflict'; end if;
 end if;
 if p_scope='afs' and p_key like 'lead:%' then
  update public.afs_section_signoffs set prepared_by=null,prepared_at=null,reviewed_by=null,reviewed_at=null,captain_cleared_by=null,captain_cleared_at=null,reopened_by=p_user_id,reopened_at=now(),reopen_reason='Working paper changed',updated_at=now()
  where organisation_id=p_organisation_id and engagement_id=p_scope_id and section_key in ('lead-schedules','lead-schedule:'||split_part(p_key,':',2));
 elsif p_scope='afs' and p_key like 'markup:%' then
  update public.afs_section_signoffs set reviewed_by=null,reviewed_at=null,captain_cleared_by=null,captain_cleared_at=null,reopened_by=p_user_id,reopened_at=now(),reopen_reason='Document review marks changed',updated_at=now()
  where organisation_id=p_organisation_id and engagement_id=p_scope_id and (section_key='lead-schedules' or section_key in (
    select 'lead-schedule:'||split_part(w.resource_key,':',2) from public.pp_workpapers w where w.organisation_id=p_organisation_id and w.scope='afs' and w.scope_id=p_scope_id and w.resource_key like 'lead:%' and exists(select 1 from jsonb_array_elements(coalesce(w.payload->'evidence','[]'::jsonb)) e where e->>'path'=p_payload->'source'->>'path')
  ));
 end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.pp_save_workpaper(uuid,text,uuid,text,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.pp_save_workpaper(uuid,text,uuid,text,jsonb,bigint,uuid) to service_role;
