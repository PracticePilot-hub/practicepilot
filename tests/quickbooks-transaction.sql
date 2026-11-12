-- Rollback-only regression: execute with the QuickBooks migration inside BEGIN / ROLLBACK.
do $$
declare org uuid;actor uuid;flight uuid:=gen_random_uuid();conn uuid:=gen_random_uuid();job uuid:=gen_random_uuid();result uuid;locked_seen boolean:=false;duplicate_seen boolean:=false;other_seen boolean:=false;
 a jsonb:='[{"code":"1000","name":"Bank","opening":80,"debit":20,"credit":0,"closing":100},{"code":"2000","name":"Capital","opening":-80,"debit":0,"credit":20,"closing":-100}]';
 r jsonb:='[{"accountCode":"1000","accountName":"Bank","date":"2026-01-01","reference":"R1","description":"Test receipt","debit":20,"credit":0},{"accountCode":"2000","accountName":"Capital","date":"2026-01-01","reference":"R1","description":"Test capital","debit":0,"credit":20}]';
begin
 select organisation_id,id into org,actor from public.user_profiles where organisation_id is not null and access_enabled limit 1;
 if org is null then raise exception 'No test practice context';end if;
 insert into public.afs_engagements(id,organisation_id,client_name,entity_type,financial_year_end,status)values(flight,org,'QuickBooks regression ROLLBACK','Company','2026-02-28','Draft');
 insert into public.afs_trial_balance_lines(engagement_id,account_code,account_name,source_balance,current_year_balance,prior_year_balance,manual_adjustment,reclassifications,mapping_code,lead_schedule_key,debit,credit)values(flight,'1000','Bank',80,95,777,10,5,'420.10','cash',80,0);
 insert into public.afs_section_signoffs(engagement_id,organisation_id,section_key,prepared_by,prepared_at,reviewed_by,reviewed_at)values(flight,org,'lead-schedule:cash',actor,now(),actor,now());
 insert into public.pp_qbo_connections(id,organisation_id,engagement_id,realm_id,environment,tokens,expires_at,created_by)values(conn,org,flight,'123','sandbox','TEST-ONLY-NOT-A-TOKEN',now()+interval '1 hour',actor);
 insert into public.pp_qbo_jobs(id,organisation_id,engagement_id,connection_id,realm_id,created_by,period_start,period_end,status,state)values(job,org,flight,conn,'123',actor,'2025-03-01','2026-02-28','review',jsonb_build_object('verified',false,'issues','[]'::jsonb,'rowCount',2,'accounts',a,'activeImportId',null));
 insert into public.pp_qbo_batches(job_id,batch,payload,source_report)values(job,0,r,'{}');
 begin perform public.pp_qbo_apply(job,org,actor,true);exception when others then other_seen:=true;end;
 if not other_seen then raise exception 'Unverified preview was applied';end if;
 update public.pp_qbo_jobs set state=jsonb_set(state,'{verified}','true')where id=job;
 update public.afs_engagements set status='Final' where id=flight;
 begin perform public.pp_qbo_apply(job,org,actor,true);exception when others then locked_seen:=true;end;
 if not locked_seen then raise exception 'Final engagement allowed import';end if;
 if exists(select 1 from public.pp_gl_imports where engagement_id=flight)then raise exception 'Failed apply created an active ledger';end if;
 update public.afs_engagements set status='Draft'where id=flight;
 result:=public.pp_qbo_apply(job,org,actor,true);
 if not exists(select 1 from public.pp_qbo_jobs where id=job and status='applied'and import_id=result)then raise exception 'Job activation not recorded';end if;
 if not exists(select 1 from public.pp_gl_imports where id=result and active)then raise exception 'Ledger not activated';end if;
 if(select count(*)from public.pp_gl_transactions where import_id=result)<>2 then raise exception 'Ledger row count changed';end if;
 if not exists(select 1 from public.afs_trial_balance_lines where engagement_id=flight and account_code='1000' and current_year_balance=115 and prior_year_balance=777 and mapping_code='420.10')then raise exception 'Existing PP mappings/adjustments/comparatives changed';end if;
 if exists(select 1 from public.afs_section_signoffs where engagement_id=flight and prepared_at is not null)then raise exception 'Stale signoff survived';end if;
 -- A source snapshot cannot be applied twice or into another practice.
 other_seen:=false;begin perform public.pp_qbo_apply(job,gen_random_uuid(),actor,false);exception when others then other_seen:=true;end;if not other_seen then raise exception 'Cross-practice import allowed';end if;
 job:=gen_random_uuid();
 insert into public.pp_qbo_jobs(id,organisation_id,engagement_id,connection_id,realm_id,created_by,period_start,period_end,status,state)values(job,org,flight,conn,'123',actor,'2025-03-01','2026-02-28','review',jsonb_build_object('verified',true,'issues','[]'::jsonb,'rowCount',2,'accounts',a,'activeImportId',result));
 insert into public.pp_qbo_batches(job_id,batch,payload,source_report)values(job,0,r,'{}');
 begin perform public.pp_qbo_apply(job,org,actor,false);exception when unique_violation then duplicate_seen:=true;end;
 if not duplicate_seen then raise exception 'Duplicate source snapshot accepted';end if;
 if not exists(select 1 from public.pp_gl_imports where id=result and active)then raise exception 'Failed duplicate replaced active ledger';end if;
 if has_table_privilege('anon','public.pp_qbo_connections','SELECT')or has_table_privilege('authenticated','public.pp_qbo_batches','SELECT')or has_function_privilege('authenticated','public.pp_qbo_apply(uuid,uuid,uuid,boolean)','EXECUTE')then raise exception 'Private QuickBooks storage exposed';end if;
end $$;
select 'PASS: preview gates, final lock, atomic ledger/TB activation, source duplicates, practice isolation, signoff invalidation and private storage' as result;
