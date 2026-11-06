"use client";
import {bindTrustWorkpaper,isTrustTaxEntity,trustTaxRegime,isOwnerTaxEntity} from './tax/taxEntityRates';
import { useEffect, useMemo, useRef, useState } from 'react';
import ui from './tax/TaxCalculator.module.css';
import {taxComputationRows} from './tax/taxComputationRows';
import { useParams } from 'next/navigation';
import { calculateTax, priorTaxYearEnd, decodeTaxNotes, mapped, newEntity, profitFromTb, taxDifferences, taxJournal, calculatePayments, paymentPeriodStart, TaxPayment, TaxWorkbook, TaxEntity, DeferredItem } from './tax/taxWorkpaper';
const money = (n: number) => 'R ' + (n < 0 ? '(' + Math.abs(n).toLocaleString('en-ZA') + ')' : n.toLocaleString('en-ZA'));
const input = { padding: 7, border: '1px solid #94a3b8', background: '#f8fbff', width: '100%', boxSizing: 'border-box' as const };
const panel = { padding: 12, border: '1px solid #dbe3ef', background: 'white', marginBottom: 10 };
export default function TaxCalculatorPanel({ trialBalanceLines = [], clientSetup = null, onApplied }: {
    trialBalanceLines?: any[];
    clientSetup?: Record<string, any> | null;
    onApplied?: () => void;
}) {
    const id = String(useParams()?.engagementId || '');
    const guideRef=useRef<HTMLDivElement>(null);
    const [companyName,setCompanyName]=useState(''),[reportingStart,setReportingStart]=useState('');
    const [view,setView]=useState<'computation'|'start'|'calculation'|'payments'|'deferred'|'review'>('computation');
    const [showTbPicker,setShowTbPicker]=useState(false),[tbSearch,setTbSearch]=useState('');
    const [workbook, setWorkbook] = useState<TaxWorkbook | null>(null), [lines, setLines] = useState(trialBalanceLines), [period, setPeriod] = useState(''), [yearEnd, setYearEnd] = useState(''), [scope, setScope] = useState(false), [selected, setSelected] = useState(0), [accounts, setAccounts] = useState<Record<string, string>>({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [loadError, setLoadError] = useState('');
    useEffect(() => setLines(trialBalanceLines), [trialBalanceLines]);
    useEffect(() => { let cancelled = false; (async () => { try {
        const [eng, settings] = await Promise.all([fetch(`/api/afs/engagements/${id}`).then(r => r.json()), fetch(`/api/afs/engagements/${id}/print-studio-settings`).then(r => r.json())]);
        if (cancelled)
            return;
        const end = String(eng.engagement.financial_year_end);
        setCompanyName(String(eng.engagement.client_name||clientSetup?.registered_name||clientSetup?.company_name||'Company'));
        setReportingStart(String(eng.engagement.financial_year_start||clientSetup?.financial_year_start||''));
        setYearEnd(end);
        setPeriod(end);
        setLines(eng.trialBalanceLines || []);
        setScope(settings.structuredNotesState?.presentationReview?.scope === 'consolidated');
    }
    catch (e) {
        if (!cancelled)
            setLoadError((e as Error).message);
    } })(); return () => { cancelled = true; }; }, [id]);
    const periodLines = useMemo(() => period === yearEnd ? lines : lines.map(row => ({ ...row, current_year_balance: row.prior_year_balance, prior_year_balance: 0 })), [lines, period, yearEnd]);
    useEffect(() => {
        if (!period)
            return;
        let cancelled = false;
        setWorkbook(null);
        setSelected(0);
        setView('computation');
        (async () => {
            try {
                const response = await fetch(`/api/afs/engagements/${id}/tax-calculation?taxYear=${period.slice(0, 4)}`, { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok)
                    throw Error(data.error);
                if (cancelled)
                    return;
                const row = data.taxCalculation;
                if (row?.worksheet) {
                    const loaded=bindTrustWorkpaper(structuredClone(row.worksheet) as TaxWorkbook, clientSetup);
                    for(const item of loaded.entities){if(item.id==='parent'&&item.name==='Reporting entity'&&companyName){item.name=companyName;loaded.reviewed=false;}}
                    setWorkbook(loaded);
                    setMessage('');
                    return;
                }
                const entity = newEntity('parent',companyName||'Company');
                if (isTrustTaxEntity(clientSetup)) {
                    entity.regime = trustTaxRegime(clientSetup);
                    entity.rate = 45;
                    entity.lossDtaRate = 45;
                }
                entity.openingControl = period === yearEnd ? -mapped(lines, '695.10', 'prior') - mapped(lines, '495.10', 'prior') : 0;
                entity.lossBf = clientSetup?.assessed_loss_brought_forward || 0;
                if (row) {
                    entity.adjustments = [{ id: 'legacy-permanent', kind: 'permanent', description: 'Existing permanent adjustment — review details', amount: row.permanent_differences || 0 }, { id: 'legacy-temporary', kind: 'temporary', description: 'Existing temporary adjustment — replace with supported tax-base schedules', amount: row.temporary_differences || 0 }];
                    entity.lossBf = row.assessed_loss_bf || 0;
                    entity.payments = row.provisional_tax_paid || 0;
                    entity.regime = isTrustTaxEntity(clientSetup) ? trustTaxRegime(clientSetup) : row.tax_regime === 'sbc' ? 'sbc' : 'normal';
                    entity.lossDtaClosing = row.deferred_tax_asset_recognised || 0;
                }
                setWorkbook({ version: 2, yearEnd: period, periodStart:period===yearEnd?(reportingStart||paymentPeriodStart(period)):paymentPeriodStart(period), entities: bindTrustWorkpaper({entities:[entity],reviewed:false},clientSetup).entities, notes: row?.notes || '', groupReconciliation: '', reviewed: false });
                setMessage(row ? 'Your previous calculation is here. Check the supporting details before updating the AFS.' : 'New tax workpaper. Capture the supported tax adjustments and cash payments.');
            }
            catch (e) {
                if (!cancelled)
                    setLoadError((e as Error).message);
            }
        })();
        return () => { cancelled = true; };
    }, [id, period, yearEnd, companyName, reportingStart, clientSetup]);
    const computed = useMemo(() => { if (!workbook)
        return { result: null, error: '' }; try {
        return { result: calculateTax(workbook, periodLines, scope), error: '' };
    }
    catch (e) {
        return { result: null, error: (e as Error).message };
    } }, [workbook, periodLines, scope]);
    if (loadError)
        return <p role="alert">Tax workpaper could not load: {loadError}</p>;
    if (!workbook)
        return <p>Loading tax workpaper…</p>;
    const entity = workbook.entities[selected], result = computed.result;
    const change = (patch: Partial<TaxEntity>) => setWorkbook({ ...workbook, reviewed: false, entities: workbook.entities.map((row, i) => i === selected ? { ...row, ...patch } : row) });
    const updateDeferred = (index: number, patch: Partial<DeferredItem>) => change({ deferred: entity.deferred.map((row, i) => i === index ? { ...row, ...patch } : row) });
    const field = (label: string, key: keyof TaxEntity, type = 'text') => <label style={{ display: 'grid', gap: 3 }} key={key}>{label}<input type={type} value={String(entity[key] ?? '')} onChange={event => change({ [key]: event.target.value })}/></label>;
    const notify = (saved: any) => { window.dispatchEvent(new CustomEvent('afs-tax-updated', { detail: { engagementId: id, taxCalculation: saved } })); window.localStorage.setItem('afs-tax-updated:' + id, String(Date.now())); };
    async function save(next = workbook) { const response = await fetch(`/api/afs/engagements/${id}/tax-calculation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ worksheet: next }) }); const data = await response.json(); if (!response.ok)
        throw Error(data.error); notify(data.taxCalculation); return data; }
    async function saveClick() { setBusy(true); try {
        await save();
        setMessage(workbook?.reviewed ? 'Reviewed tax calculation saved. The AFS tax note and checks now use this calculation.' : 'Tax calculation saved as a draft. Complete the review before finalising the AFS.');
    }
    catch (e) {
        setMessage((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function post() {
        setBusy(true);
        try {
            const response = await fetch(`/api/afs/engagements/${id}`, { cache: 'no-store' }), data = await response.json();
            if (!response.ok)
                throw Error(data.error);
            const fresh = data.trialBalanceLines || [];
            const current = period === yearEnd ? fresh : fresh.map((row: any) => ({ ...row, current_year_balance: row.prior_year_balance, prior_year_balance: 0 }));
            const calc = calculateTax(workbook!, current, scope), journal = taxJournal(calc, current, accounts);
            if (journal.errors.length)
                throw Error(journal.errors.join('\n'));
            if (!journal.entries.length) {
                await save();
                setMessage('Tax calculation saved. No journal is required because it already agrees to the AFS.');
                setLines(fresh);
                return;
            }
            await save({ ...workbook!, reviewed: false });
            const fingerprint = JSON.stringify(journal.entries);
            let hash = 2166136261;
            for (const char of fingerprint) {
                hash ^= char.charCodeAt(0);
                hash = Math.imul(hash, 16777619);
            }
            const reference = 'TAX-' + period + '-' + (hash >>> 0).toString(16);
            const posted = await fetch(`/api/afs/engagements/${id}/journal-post`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ journalReference: reference, journalPeriod: period === yearEnd ? 'current_year' : 'prior_year', journalPurpose: 'afs_only', description: 'Tax workpaper adjustment for ' + period, lines: journal.entries }) });
            const posting = await posted.json();
            if (!posted.ok)
                throw Error(posting.error);
            const refreshed = await fetch(`/api/afs/engagements/${id}`, { cache: 'no-store' }).then(r => r.json());
            setLines(refreshed.trialBalanceLines || []);
            notify(null);
            window.dispatchEvent(new CustomEvent('afs-signoff-refresh', { detail: { engagementId: id, sectionKey: 'adjusting-journals' } }));
            setMessage('Balanced tax adjustment posted. The mapped tax expense, tax balances, SFP and tax note now follow the journal. Recheck and mark the workpaper reviewed.');
            onApplied?.();
        }
        catch (e) {
            setMessage((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    const journal = result ? taxJournal(result, periodLines, accounts) : null, differences = result ? taxDifferences(result, periodLines) : [];
    const paymentKinds=[['p1','P1 — first provisional payment'],['p2','P2 — second provisional payment'],['topup','P3 / top-up — additional payment'],['other','Other income-tax payments']] as const;
    const paymentRows=entity.paymentSchedule||paymentKinds.map(([kind])=>({kind,amount:0,date:''}));
    let paymentSummary:ReturnType<typeof calculatePayments>;try{paymentSummary=calculatePayments(entity,workbook.yearEnd,workbook.periodStart);}catch(error){paymentSummary={inYear:0,afterYear:0,issues:[(error as Error).message]};}
    const updatePayment=(kind:TaxPayment['kind'],patch:Partial<TaxPayment>)=>setWorkbook(current=>current?({...current,reviewed:false,entities:current.entities.map((item,index)=>index===selected?{...item,paymentsConfirmed:false,paymentSchedule:(item.paymentSchedule||paymentKinds.map(([key])=>({kind:key,amount:0,date:''}))).map(row=>row.kind===kind?{...row,...patch}:row)}:item)}):current);
    const ledgerExpense=['795.10','795.20','795.30','795.90'].reduce((n,code)=>n+mapped(periodLines,code),0);
    const outstanding=[...new Set([...(journal?.errors||[]),...(workbook.taxBasisReviewRequired?[workbook.taxBasisReviewReason||'Validate the illustrative tax basis before final approval.']:[])])];
    const labels:Record<string,string>={'795.10':'Current tax expense','795.20':'Deferred tax expense','795.30':'Prior-year adjustment','795.90':'Other income tax','395.10':'Deferred tax asset','595.10':'Deferred tax liability','495.10':'Tax receivable','695.10':'Tax payable','799.10':'Discontinued operation — net result'};
    const adjustmentTotal=entity.adjustments.reduce((n,row)=>n+Number(String(row.amount).replace(/,/g,'')),0);
    const steps=[{key:'start',label:'Start',title:'Check your starting point',help:'Confirm whose profit we are using.'},{key:'calculation',label:'Adjustments',title:'Adjust profit for tax',help:'Add only the differences between your accounting profit and taxable income.'},{key:'payments',label:'Payments',title:'What have you already paid?',help:'Enter actual payments and refunds. These change the amount owing, not the tax expense.'},{key:'deferred',label:'Deferred tax',title:'Check tax timing differences',help:'Complete the supporting values where accounting and tax recognise an item at different times.'},{key:'review',label:'Finish',title:'Review and update your AFS',help:'Resolve the checks below, then apply the balanced adjustment.'}] as const;
    type Step=typeof steps[number]['key']|'computation';
    const stepIndex=steps.findIndex(step=>step.key===view),activeStep=steps[stepIndex]||steps[0];
    const setTab=(next:Step)=>{setView(next);setShowTbPicker(false);requestAnimationFrame(()=>guideRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));};
    const issueStep=(issue:string):Step=>/deferred|temporary difference|recovery/i.test(issue)?'deferred':/control|payment|refund/i.test(issue)?'payments':/entity|company|profit|sbc|rate|jurisdiction/i.test(issue)?'start':'calculation';
    return <div className={ui.workspace}>
      <header className={ui.header}>
        <div><div className={ui.eyebrow}>PROFIT TO TAX <span className={ui.draftBadge}>{workbook.reviewed?'Reviewed':'Draft calculation'}</span></div><h2>Tax computation</h2><p>Your calculation, from profit to tax owing. Open a line only when you need to change its workings.</p></div>
        <div className={ui.headerActions}><label className={ui.period}>Financial year<select aria-label="Financial year" value={period} onChange={event=>{setPeriod(event.target.value);setMessage('');}}><option value={yearEnd}>{yearEnd.slice(0,4)} · Current</option><option value={priorTaxYearEnd(yearEnd)}>{Number(yearEnd.slice(0,4))-1} · Comparative</option></select></label><button className={ui.primary} onClick={saveClick} disabled={busy||!result}>{busy?'Saving…':workbook.reviewed?'Save reviewed calculation':'Save draft'}</button></div>
      </header>
      {message&&<div role="status" className={ui.notice}>{message}</div>}
      {computed.error&&<div role="alert" className={ui.notice}>{computed.error}</div>}
      {view!=='computation'&&<div className={ui.metrics}>
        <article><span>Accounting profit</span><strong>{money(profitFromTb(periodLines))}</strong><small>From your mapped trial balance</small></article>
        <article><span>Calculated income tax expense</span><strong>{result?money(result.taxExpense):'—'}</strong><small>{result&&Math.abs(result.taxExpense-ledgerExpense)>.5?`Currently in AFS: ${money(ledgerExpense)}`:'Current tax plus deferred tax'}</small></article>
        <article className={ui.balance}><span>{result&&result.currentReceivable&&!result.currentPayable?'Tax receivable at year-end':'Tax payable at year-end'}</span><strong>{result?money(result.currentPayable||-result.currentReceivable):'—'}</strong><small>{result?.currentPayable&&result?.currentReceivable?`Separate entity receivable ${money(result.currentReceivable)}`:'After opening balances, payments and refunds'}</small></article>
      </div>}
      <div className={`${ui.body} ${ui.guidedBody}`}>
        <main>
          {view!=='computation'&&<><button className={ui.backToSheet} onClick={()=>setTab('computation')}>← Back to tax computation</button><div ref={guideRef} className={ui.stepGuide}><h3>{activeStep.title}</h3><p>{activeStep.help}</p></div></>}
          {view==='computation'&&result&&<section className={`${ui.card} ${ui.computationSheet}`} ref={guideRef}>
            <div className={ui.sheetHeading}><h3>Tax Computation</h3><span>Figures in Rand · {period.slice(0,4)}</span></div>
            <table className={ui.computationTable}><tbody>{taxComputationRows(result,periodLines).map((row,index)=>row.section?<tr key={index}><th colSpan={2} className={ui.computationSection}>{row.label}</th></tr>:<tr key={index} className={row.total?ui.computationTotal:undefined}><td>{row.label}{row.working&&<button aria-label={'Edit workings: '+row.label} onClick={()=>setTab(row.working!)}>Edit workings</button>}</td><td>{!row.amount?'–':money(row.amount).replace(/^R /,'')}</td></tr>)}</tbody></table>
            {workbook.taxBasisReviewRequired&&<p className={ui.hint}>Fictional test calculation: the arithmetic can be tested, but the tax assumptions still need technical approval before finalisation.</p>}<div className={ui.sheetActions}><span>Saving a draft does not change the financial statements.</span><button className={ui.primary} onClick={()=>setTab('review')}>Review & update AFS →</button></div>
          </section>}
          {view==='computation'&&!result&&<section className={ui.card}><h3>Check an input in your workings</h3><p>The calculation cannot be completed until the input above is corrected.</p>{steps.map(step=><button key={step.key} className={ui.secondary} onClick={()=>setTab(step.key)}>{step.label}</button>)}</section>}
          {view==='start'&&<>          <section className={ui.card}><div className={ui.profitLine}><span>Profit from your mapped TB</span><strong>{money(profitFromTb(periodLines))}</strong></div><div className={ui.settingsContent}>
            {scope&&<p className={ui.hint}>These are group financials. Calculate tax for each company using its own profit, rather than taxing the combined group profit.</p>}
            <label>Tax calculation for<select value={selected} onChange={e=>setSelected(Number(e.target.value))}>{workbook.entities.map((row,i)=><option key={row.id} value={i}>{row.name}</option>)}</select></label>
            <button className={ui.textButton} onClick={()=>{setWorkbook({...workbook,reviewed:false,entities:[...workbook.entities,newEntity('entity-'+Date.now(),'Additional company')]});setSelected(workbook.entities.length);}}>+ Add another taxpayer</button>
            {field('Business or trust name','name')}<label>Tax regime<select disabled={selected===0&&isOwnerTaxEntity(clientSetup)} value={entity.regime} onChange={e=>change({regime:e.target.value as TaxEntity['regime']})}>{!(selected===0&&isTrustTaxEntity(clientSetup))&&<><option value="normal">Normal company</option><option value="sbc">Qualifying SBC</option></>}{selected===0&&isOwnerTaxEntity(clientSetup)&&<option value="owner-tax">Income tax belongs to the owner / partners</option>}<option value="trust">Ordinary SA trust · 45%</option><option value="special-trust">Qualifying special trust · sliding scale</option>{!(selected===0&&isTrustTaxEntity(clientSetup))&&<option value="custom">Other rate</option>}</select></label>
            {entity.regime==='owner-tax'&&<p>The business profit is reported here. Personal income tax is assessed on the proprietor or partners separately and is excluded from this business tax expense. This treatment does not calculate turnover tax or the owners’ complete personal tax returns.</p>}{entity.regime==='trust'&&<p>Ordinary SA trust: 45% of taxable income retained and taxable in the trust. Check beneficiary vesting and attribution separately.</p>}{entity.regime==='special-trust'&&<>{field('Special-trust qualification support','rateEvidence')}<p>Individual tax tables apply, without individual rebates. Confirm the qualifying special-trust classification.</p></>}{entity.regime==='custom'&&<>{field('Enacted tax rate (%)','rate')}{field('Rate source','rateEvidence')}</>}{entity.regime==='sbc'&&<label className={ui.check}><input type="checkbox" checked={entity.sbcConfirmed} onChange={e=>change({sbcConfirmed:e.target.checked})}/>SBC eligibility confirmed</label>}
            <label>Which profit figure should we use?<select value={entity.profitMode} onChange={e=>change({profitMode:e.target.value as 'mapped'|'manual'})}><option value="mapped">Use profit from the mapped TB (automatic)</option><option value="manual">Enter this company’s profit (group accounts)</option></select></label><p className={ui.hint}>{entity.profitMode==='mapped'?'We use the profit calculated from your mapped trial balance.':'Enter the profit from this company’s own accounts. This is used when the TB contains group figures.'}</p>{entity.profitMode==='manual'&&<>{field('Company profit before tax','profit')}{field('Profit source / allocation support','profitEvidence')}</>}
            <details className={ui.detail}><summary>Jurisdiction & group reconciliation</summary>{field('Tax jurisdiction','jurisdiction')}<label>Group profit reconciliation<textarea value={workbook.groupReconciliation} onChange={e=>setWorkbook({...workbook,reviewed:false,groupReconciliation:e.target.value})}/></label></details>
            {workbook.entities.length>1&&<button className={ui.textButton} onClick={()=>{setWorkbook({...workbook,reviewed:false,entities:workbook.entities.filter((_,i)=>i!==selected)});setSelected(0);}}>Remove this company</button>}
            <a href="https://www.sars.gov.za/tax-rates/income-tax/companies-trusts-and-small-business-corporations-sbc/" target="_blank" rel="noreferrer">SARS rate tables ↗</a>
          </div></section></>}
          {view==='calculation'&&<>
            <section className={ui.card}>
              <div className={ui.cardHeader}><div><h3>Your tax calculation</h3><p>Start with profit. Add back non-deductible costs. Deduct eligible amounts.</p></div><span className={ui.chip}>{entity.regime==='owner-tax'?'Owner / partner tax excluded':entity.regime==='trust'?'Ordinary trust · 45%':entity.regime==='special-trust'?'Special trust · sliding scale':entity.regime==='sbc'?'SBC':entity.regime==='custom'?'Custom rate':'Normal company'}</span></div>
              <div className={ui.profitLine}><span>Profit before tax</span><strong>{money(entity.profitMode==='mapped'?profitFromTb(periodLines):Number(entity.profit))}</strong></div>
              <div className={ui.adjustmentHeading}><span>ADJUSTMENTS</span><div><button onClick={()=>setShowTbPicker(!showTbPicker)}>+ From trial balance</button> <button onClick={()=>change({adjustments:[...entity.adjustments,{id:String(Date.now()),description:'',kind:'permanent',amount:0}]})}>+ Add adjustment</button></div></div>
              {showTbPicker&&<div className={ui.tbPicker}><label>Find a mapped income or expense account<input aria-label="Find trial balance account" placeholder="Search e.g. fines, depreciation or donations" value={tbSearch} onChange={e=>setTbSearch(e.target.value)}/></label><p className={ui.hint}>Choose an amount, then confirm its tax treatment. {scope?'Group amounts must be allocated to the correct taxable company.':''}</p>{periodLines.filter(line=>/^(700|720|730|750|770|775|780|781|785)(\.|$)/.test(String(line.mapping_code||''))&&Number(line.current_year_balance)!==0&&(!tbSearch||[line.account_name,line.account_code,line.mapping_label].join(' ').toLowerCase().includes(tbSearch.toLowerCase()))).slice(0,8).map(line=><button key={line.account_code} className={ui.tbAccount} onClick={()=>{change({adjustments:[...entity.adjustments,{id:String(Date.now()),description:[line.account_code,line.account_name].filter(Boolean).join(' · '),kind:'permanent',amount:Math.round(Number(line.current_year_balance))}]});setShowTbPicker(false);setTbSearch('');}}><span>{line.account_name}<small>{line.account_code} · {line.mapping_code}</small></span><strong>{money(Number(line.current_year_balance))} <b>+</b></strong></button>)}</div>}
              {!entity.adjustments.length&&<div className={ui.empty}>No adjustments yet. Add a cost that is not deductible, exempt income or a tax allowance.</div>}
              {entity.adjustments.map((row,i)=><div className={ui.adjustment} key={row.id}>
                <input aria-label="Adjustment description" placeholder="What is the adjustment?" value={row.description} onChange={e=>change({adjustments:entity.adjustments.map((item,j)=>j===i?{...item,description:e.target.value}:item)})}/>
                <select aria-label="Tax treatment" value={row.kind} onChange={e=>change({adjustments:entity.adjustments.map((item,j)=>j===i?{...item,kind:e.target.value as 'permanent'|'temporary'}:item)})}><option value="permanent">Permanent</option><option value="temporary">Timing difference</option></select>
                <input aria-label="Adjustment amount" inputMode="decimal" placeholder="0" value={row.amount} onChange={e=>change({adjustments:entity.adjustments.map((item,j)=>j===i?{...item,amount:e.target.value}:item)})}/>
                <button aria-label={`Remove adjustment ${i+1}`} onClick={()=>change({adjustments:entity.adjustments.filter((_,j)=>i!==j)})}>×</button>
              </div>)}
              <p className={ui.hint}>Positive amounts add to taxable profit. Use a minus for deductions. Timing differences have a separate deferred-tax calculation.</p>
              <div className={ui.totalLine}><span>Net adjustments</span><strong>{Number.isFinite(adjustmentTotal)?money(adjustmentTotal):'Check amounts'}</strong></div>
              <details className={ui.detail}><summary>Assessed losses & tax credits <span>{entity.lossBf?money(Number(entity.lossBf)):'Optional'}</span></summary><div className={ui.fields}>{field('Assessed loss brought forward','lossBf')}{field('Eligible foreign tax credit','foreignCredit')}{field('Credit source and limit','creditEvidence')}</div><label className={ui.check}><input type="checkbox" checked={entity.tradeConfirmed} onChange={e=>change({tradeConfirmed:e.target.checked})}/>Loss availability and trade requirements confirmed</label><details><summary>Liquidation exception</summary><label className={ui.check}><input type="checkbox" checked={entity.liquidationExemption} onChange={e=>change({liquidationExemption:e.target.checked})}/>Qualifying statutory exemption</label>{entity.liquidationExemption&&field('Evidence for exemption','liquidationEvidence')}</details></details>
              {result&&<><div className={ui.resultLine}><span>Taxable income <small>After available losses</small></span><strong>{money(result.taxable)}</strong></div><div className={ui.totalLine}><span>Current income tax</span><strong>{money(result.current)}</strong></div></>}
            </section>

          </>}
          {view==='payments'&&<section className={ui.card}>
            <div className={ui.cardHeader}><div><h3>Provisional tax paid</h3><p>Enter the amounts actually paid and their payment dates.</p></div></div>
            {Number(entity.payments)!==0&&<div className={ui.notice}><strong>Previously imported total: {money(Number(entity.payments))}</strong><p>{entity.paymentSchedule===undefined?'No P1/P2/top-up split was recorded. This total is kept until you enter a breakdown below.':'The breakdown below replaces this imported total.'} Enter the full split from the payment records; we will not guess it.</p>{entity.paymentSchedule!==undefined&&<button className={ui.textButton} onClick={()=>change({paymentSchedule:undefined,paymentsConfirmed:false})}>Clear breakdown and keep imported total</button>}</div>}
            <div className={ui.paymentHead}><span>Payment</span><span>Amount paid (R)</span><span>Payment date</span></div>
            {paymentKinds.map(([kind,label])=>{const row=paymentRows.find(item=>item.kind===kind)||{kind,amount:0,date:''};return <div className={ui.paymentRow} key={kind}><label>{label}</label><input aria-label={label+' amount'} inputMode="decimal" value={row.amount||''} placeholder="0" onChange={e=>updatePayment(kind,{amount:e.target.value})}/><input aria-label={label+' date'} type="date" value={row.date} onInput={e=>updatePayment(kind,{date:e.currentTarget.value})} onChange={e=>updatePayment(kind,{date:e.target.value})}/></div>;})}
            <p className={ui.hint}>Only payments made during this financial period reduce the year-end balance and cash flow. A top-up paid after {period} is shown separately.</p>
            <div className={ui.totalLine}><span>Payments included in these AFS</span><strong>{money(paymentSummary.inYear)}</strong></div>
            {!!paymentSummary.afterYear&&<div className={ui.resultLine}><span>Paid after year-end <small>Excluded from the year-end AFS balance and cash flow</small></span><strong>{money(paymentSummary.afterYear)}</strong></div>}
            {!!paymentSummary.issues.length&&<div className={ui.attention}>{paymentSummary.issues.map(issue=><p key={issue}>{issue}</p>)}</div>}
            <details className={ui.detail}><summary>Opening balance, refunds & other movements</summary><div className={ui.fields}>{field('Opening tax payable / (receivable)','openingControl')}{field('Refunds received during this financial period','refunds')}{field('Other tax balance movements','controlOther')}</div></details>
            <label className={ui.check}><input type="checkbox" checked={entity.paymentsConfirmed} onChange={e=>change({paymentsConfirmed:e.target.checked})}/>The payment dates, amounts and opening balance agree to the records</label>
          </section>}
          {view==='deferred'&&<section className={ui.card}><div className={ui.cardHeader}><div><h3>Deferred tax workings</h3><p>Compare the accounting value with the tax value. We calculate the deferred tax.</p></div><button className={ui.secondary} onClick={()=>change({deferred:[...entity.deferred,{id:String(Date.now()),description:'',kind:'asset',carrying:0,taxBase:0,rate:entity.regime==='trust'?45:entity.rate,openingTax:0,recognise:false,evidence:'',allocation:'profit'}]})}>+ Add item</button></div>
            {!entity.deferred.length&&<div className={ui.empty}><strong>No temporary differences added.</strong><p>Add items such as asset allowances or provisions when their accounting and tax values differ.</p></div>}
            {entity.deferred.map((row,i)=><fieldset className={ui.deferredItem} key={row.id}><legend>{row.description||`Item ${i+1}`}</legend><div className={ui.fields}><label>Item description<input placeholder="e.g. Equipment" value={row.description} onChange={e=>updateDeferred(i,{description:e.target.value})}/></label><label>Item type<select value={row.kind} onChange={e=>updateDeferred(i,{kind:e.target.value as 'asset'|'liability'})}><option value="asset">Asset</option><option value="liability">Liability</option></select></label>{(['carrying','taxBase','rate','openingTax'] as const).map(key=><label key={key}>{{carrying:'Accounting value at year end',taxBase:'Tax value at year end',rate:'Tax rate on recovery (%)',openingTax:'Opening deferred tax (+ liability / − asset)'}[key]}<input value={row[key]} onChange={e=>updateDeferred(i,{[key]:e.target.value})}/></label>)}</div><details className={ui.detail}><summary>Recognition & presentation</summary><label className={ui.check}><input type="checkbox" checked={row.recognise} onChange={e=>updateDeferred(i,{recognise:e.target.checked})}/>Recognise the recoverable deferred-tax asset</label><label>Record the movement in<select value={row.allocation} onChange={e=>updateDeferred(i,{allocation:e.target.value as DeferredItem['allocation']})}><option value="profit">Profit or loss</option><option value="oci">Other comprehensive income</option><option value="equity">Directly in equity</option></select></label>{row.allocation!=='profit'&&<label>Tax-only account<select value={row.allocationAccount||''} onChange={e=>updateDeferred(i,{allocationAccount:e.target.value})}><option value="">Choose account</option>{periodLines.filter(line=>String(line.mapping_code).startsWith(row.allocation==='oci'?'797.':'820.')).map(line=><option key={line.account_code} value={line.account_code}>{line.account_code} · {line.account_name}</option>)}</select></label>}</details><label>Tax basis & recovery support<textarea value={row.evidence} onChange={e=>updateDeferred(i,{evidence:e.target.value})}/></label><div className={ui.totalLine}><span>Closing deferred tax</span><strong>{result?money(result.entities[selected]?.deferred[i]?.closing||0):'—'}</strong></div><button className={ui.textButton} onClick={()=>change({deferred:entity.deferred.filter((_,j)=>j!==i)})}>Remove item</button></fieldset>)}
            <details className={ui.detail}><summary>Offset deferred tax within this taxpayer</summary><label className={ui.check}><input type="checkbox" checked={!!entity.deferredOffsetConfirmed} onChange={e=>change({deferredOffsetConfirmed:e.target.checked})}/>The IAS 12 same-entity, same-authority offset criteria are met</label>{field('Offset right and supporting evidence','deferredOffsetEvidence')}</details>
            <details className={ui.detail}><summary>Deferred tax on assessed losses</summary><div className={ui.fields}>{field('Opening recognised asset','lossDtaOpening')}{field('Closing recognised asset','lossDtaClosing')}{field('Recovery tax rate (%)','lossDtaRate')}{field('Future taxable profits and recovery evidence','lossDtaEvidence')}</div></details>
          </section>}
          {view==='review'&&<details className={ui.card}><summary className={ui.settingsSummary}>Prior-year & other tax</summary><div className={ui.settingsContent}>{field('Prior-year under / (over) provision','priorTax')}{field('Other current income tax','otherTax')}<details className={ui.detail}><summary>Discontinued operation — tax allocation</summary><p>Include this operation’s pre-tax profit in the taxable-income calculation, then allocate its supported tax charge to the net discontinued result.</p>{field('Discontinued operation profit before tax','discontinuedProfit')}{field('Current tax allocated to discontinued operations','discontinuedTax')}{field('Allocation source and support','discontinuedEvidence')}</details></div></details>}
          {view==='review'&&<section className={ui.card}><div className={ui.cardHeader}><div><h3>Compare with your financials</h3><p>Check the difference between this calculation and the amounts already in your AFS.</p></div></div>
            <div className={ui.reviewTotals}><div><span>Calculated expense</span><strong>{result?money(result.taxExpense):'—'}</strong></div><div><span>Already in the AFS</span><strong>{money(ledgerExpense)}</strong></div><div><span>Difference</span><strong>{result?money(result.taxExpense-ledgerExpense):'—'}</strong></div></div>
            {outstanding.length>0?<div className={ui.attention}><h4>Before you update the AFS</h4><ul>{outstanding.map(issue=><li key={issue}><span>{issue}</span> <button className={ui.textButton} onClick={()=>setTab(issueStep(issue))}>Open {steps.find(step=>step.key===issueStep(issue))?.label.toLowerCase()} →</button></li>)}</ul></div>:<div className={ui.ready}>{journal?.entries.length ? "The proposed adjustment balances." : "Tax already agrees to the AFS. Save this calculation to link the tax note and checks."}</div>}
            <details className={ui.detail}><summary>View accounts & proposed adjustment <span>{journal?.entries.length||0} lines</span></summary><table className={ui.accountTable}><thead><tr><th>Account</th><th>Calculated</th><th>In AFS</th><th>Change</th></tr></thead><tbody>{differences.map(row=><tr key={row.code}><td>{labels[row.code]}<small>{row.code}</small>{periodLines.filter(line=>line.mapping_code===row.code).length>1&&<select aria-label={`Posting account for ${row.code}`} value={accounts[row.code]||''} onChange={e=>setAccounts({...accounts,[row.code]:e.target.value})}><option value="">Select posting account</option>{periodLines.filter(line=>line.mapping_code===row.code).map(line=><option key={line.account_code} value={line.account_code}>{line.account_code} · {line.account_name}</option>)}</select>}</td><td>{money(row.target)}</td><td>{money(row.booked)}</td><td>{money(row.difference)}</td></tr>)}</tbody></table></details>
            <label>Tax review notes<textarea placeholder="Explain the tax basis, key judgements and supporting schedules." value={workbook.notes} onChange={e=>setWorkbook({...workbook,reviewed:false,notes:e.target.value})}/></label>
            <div className={ui.applyBar}><div><strong>{journal?.entries.length ? "Update the AFS" : "Save the tax calculation"}</strong><p>{journal?.entries.length ? "Posts the balanced adjustment. Your tax note and financial balances follow it." : "No journal is needed. Save the calculation so your AFS tax note and checks can use it."}</p></div><button className={ui.primary} disabled={busy||!result||!!journal?.errors.length} onClick={journal?.entries.length ? post : saveClick}>{busy ? "Saving…" : journal?.entries.length ? "Update AFS" : "Save tax calculation"}</button></div>
            <label className={ui.check}><input type="checkbox" checked={workbook.reviewed} disabled={!!workbook.taxBasisReviewRequired||!result||!!journal?.errors.length||differences.some(row=>Math.abs(row.difference)>.5)||workbook.notes.trim().length<20} onChange={e=>setWorkbook({...workbook,reviewed:e.target.checked})}/>I have reviewed this calculation and agreed it to the AFS</label><p className={ui.hint}>Save after review. Final AFS checks include the comparative year.</p>
          </section>}
          {view!=='computation'&&<div className={ui.stepFooter}><span>Your entries are kept when you return to the computation.</span><button className={ui.primary} onClick={()=>setTab('computation')}>Done — back to computation</button></div>}

        </main>

      </div>
    </div>;
}
