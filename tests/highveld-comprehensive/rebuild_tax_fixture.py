import json,sys,copy,collections
from pathlib import Path
from sa_tax_case import build,q,rnd
base=Path(__file__).resolve().parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else base/'fixture.json'
f=json.loads(source.read_text());evidence=build(f);accounts=f['accounts'];by={}
for code,a in accounts.items():by.setdefault(a['mapping_code'],[]).append(code)
a=lambda m:by[m][0]
for m,suffix in [('797.10','PENSION'),('797.20','REVALUATION'),('797.30','TRANSLATION'),('797.40','HEDGE'),('797.50','DB')]:
 code='TAXOCI_'+suffix;accounts[code]={**copy.deepcopy(accounts[a(m)]),'account_code':code,'account_name':'Deferred tax in OCI — '+suffix};by[m].append(code)
bank=a('420.10');retained=a('810.10');book=collections.defaultdict(float);journals=[]
def post(year,description,legs,category=None):
 legs=[(code,q(amount)) for code,amount in legs if abs(amount)>.00001];assert abs(sum(v for _,v in legs))<.005,(description,legs)
 for code,v in legs:book[code]=q(book[code]+v)
 cash=q(sum(v for code,v in legs if accounts[code]['mapping_code'].split('.')[0] in ['420','620']))
 if year in [2025,2026] and cash:assert category,description
 journals.append({'period':year,'description':description,'cashCategory':category,'cashAmount':cash,'postings':[{'account':code,'signed':v,'debit':max(v,0),'credit':max(-v,0)} for code,v in legs]})
def replay(j):post(j['period'],j['description'],[(leg['account'],leg['signed']) for leg in j['postings']],j.get('cashCategory'))
old_j=f['journals']
for j in old_j:
 if j['period']==2024 and not j['description'].startswith('Close prior-year performance'):replay(j)
# Reverse the historical illustrative parent DTL; retain subsidiary DTA R2,000.
post(2024,'Replace illustrative opening parent DTL with the tax register',[(a('595.10'),2000),(retained,-2000)])
for row in evidence['register'][2024]:
 t=row['tax'];counter=a(row['reserve']) if row['allocation']=='oci' else retained
 post(2024,'Opening deferred tax: '+row['description'],[(counter,t),(a('595.10') if t>0 else a('395.10'),-t)])
net=sum(row['tax'] for row in evidence['register'][2024]);gross_dta=-sum(min(row['tax'],0) for row in evidence['register'][2024]);gross_dtl=sum(max(row['tax'],0) for row in evidence['register'][2024]);offset=min(gross_dta,gross_dtl)
post(2024,'IAS 12 same-parent/authority deferred-tax offset; subsidiary remains separate',[(a('595.10'),offset),(a('395.10'),-offset)])
opening=copy.deepcopy(book);periods={};taxcase={}
exclude=('Current-year tax at ','Deferred tax on temporary difference','Prior-year current tax underprovision','Foreign withholding tax separately assessed','Income tax paid (assessment')
oci_mapping={'820.10':'TAXOCI_REVALUATION','820.20':'TAXOCI_TRANSLATION','820.30':'TAXOCI_PENSION','820.40':'TAXOCI_HEDGE','820.92':'TAXOCI_DB'}
for year in [2025,2026]:
 if year==2026:
  for code,amount in list(book.items()):
   if accounts[code]['mapping_statement']=='P/L' and amount:
    mapping=accounts[code]['mapping_code'];target=a({'797.10':'820.92','797.20':'820.10','797.30':'820.20','797.40':'820.40','797.50':'820.92'}[mapping]) if mapping.startswith('797.') else retained
    post(2024,'Close revised prior-year performance to reserves/retained earnings',[(code,-amount),(target,amount)])
 start=copy.deepcopy(book);start_j=len(journals)
 for j in old_j:
  if j['period']==year and not j['description'].startswith(exclude):replay(j)
 # The R500 discontinued result is before tax. Current tax is allocated explicitly to the operation.
 pbt=q(-sum(book[code] for code,x in accounts.items() if x['mapping_statement']=='P/L' and not x['mapping_code'].startswith(('795.','797.','799.'))))
 adjustments=evidence['adjustments'][year];perm=q(sum(row['amount'] for row in adjustments if row['kind']=='permanent'));temp=q(sum(row['amount'] for row in adjustments if row['kind']=='temporary'))
 taxable=rnd(pbt+500+perm+temp);gross=rnd(taxable*.27);foreign_credit=50;domestic=gross-foreign_credit;disc_tax=135
 post(year,'SA current tax from tax register, with R50 section 6quat credit and separate discontinued allocation',[(a('795.10'),domestic-disc_tax),(a('799.10'),disc_tax),(a('695.10'),-domestic)])
 post(year,'Prior-year current tax underprovision — fictional final assessment',[(a('795.30'),100),(a('695.10'),-100)])
 post(year,'Namibian R500 gross loan interest: actual 10% withholding R50, eligible foreign credit',[(a('795.90'),50),(bank,-50)],'taxPaid')
 domestic_paid=200456 if year==2025 else 217264
 post(year,'Actual recorded domestic provisional tax payment (original amount preserved)',[(a('695.10'),domestic_paid),(bank,-domestic_paid)],'taxPaid')
 # Offset the parent's own current balances only; the subsidiary's R2,000 receivable stays separate.
 parent_control=q(-book[a('695.10')]-(book[a('495.10')]-2000));target_recv=2000+max(0,-parent_control);target_pay=-max(0,parent_control)
 post(year,'Reclassify parent prepaid current tax without offsetting another entity',[(a('495.10'),target_recv-book[a('495.10')]),(a('695.10'),target_pay-book[a('695.10')])])
 current=evidence['register'][year];previous={row['id']:row for row in evidence['register'][year-1]};alloc=collections.defaultdict(float)
 for row in current:
  movement=row['tax']-previous[row['id']]['tax'];row['openingTax']=previous[row['id']]['tax'];row['movement']=movement
  counter=a('795.20') if row['allocation']=='profit' else ('TAXOCI_DB' if row['id']=='db-actuarial' else 'TAXOCI_PENSION' if row['id'] in ['pension-surplus','fvoci-debt'] else oci_mapping[row['reserve']])
  row['allocationAccount']=counter if row['allocation']=='oci' else '';alloc[counter]+=movement
 net=sum(row['tax'] for row in current);target_dta=2000+max(-net,0);target_dtl=-max(net,0)
 legs=[(code,amount) for code,amount in alloc.items()]+[(a('395.10'),target_dta-book[a('395.10')]),(a('595.10'),target_dtl-book[a('595.10')])]
 post(year,'Deferred tax from individual source tax bases and OCI allocations; same-parent offset only',legs)
 cf=collections.defaultdict(float)
 for j in journals[start_j:]:
  if j.get('cashCategory'):cf[j['cashCategory']]=q(cf[j['cashCategory']]+j['cashAmount'])
 cash=lambda state:q(sum(amount for code,amount in state.items() if accounts[code]['mapping_code'].split('.')[0] in ['420','620']))
 close=copy.deepcopy(book);assert abs(sum(close.values()))<.005
 assert abs(cash(close)-cash(start)-sum(cf.values()))<.005
 period=copy.deepcopy(f['periods'][str(year)]);period.update(opening=dict(start),closing=dict(close),cash=dict(cf),cashOpening=cash(start),cashClosing=cash(close),pbt=pbt,permanentDifferences=perm,temporaryDifferences=temp,currentTax=domestic-disc_tax)
 periods[str(year)]=period
 taxcase[str(year)]={'profit':pbt,'discontinuedProfit':500,'discontinuedTax':disc_tax,'permanent':perm,'temporary':temp,'taxable':taxable,'gross':gross,'foreignCredit':50,'domesticCurrentTax':domestic,'continuingCurrentTax':domestic-disc_tax,'domesticPayments':domestic_paid,'foreignPayments':50,'parentOpeningControl':q(-start.get(a('695.10'),0)-(start.get(a('495.10'),0)-2000)),'parentClosingControl':parent_control,'deferredProfit':alloc[a('795.20')],'deferredOci':sum(value for key,value in alloc.items() if key!=a('795.20')),'netParentDeferredLiability':net,'groupDta':target_dta,'groupDtl':-target_dtl,'rows':current,'adjustments':adjustments}
lines=[];history=[]
for code,account in accounts.items():
 current=periods['2026']['closing'].get(code,0);prior=periods['2025']['closing'].get(code,0)
 lines.append({**account,'current_year_balance':current,'prior_year_balance':prior,'source_balance':current,'opening_balance':periods['2026']['opening'].get(code,0),'debit':current,'credit':prior})
 history.append({**account,'financial_year_end':'2024-02-29','closing_balance':opening.get(code,0)})
f.update(version=2,lines=lines,history=history,journals=journals,periods=periods,accounts=accounts,saTaxCase=taxcase,saTaxSources=evidence['sources'],subsidiaryRecovery=evidence['subsidiaryRecovery'])
(base/'fixture.json').write_text(json.dumps(f,indent=2));(base/'tax-register.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps({year:{k:v for k,v in p.items() if k not in ['rows','adjustments']} for year,p in taxcase.items()},indent=2))
