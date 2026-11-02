"""Deterministic fictional ledger: opening journals + two years of balanced transactions.
All financial totals and cash overrides are DERIVED from journals, never closing-cash plugs.
"""
import json,copy,collections,decimal
from pathlib import Path
D=decimal.Decimal
money=lambda x:float(D(str(x)).quantize(D('.01'),rounding=decimal.ROUND_HALF_UP))
root=Path('tests/highveld-comprehensive');catalog=json.loads((root/'catalog.json').read_text())
for leaf in catalog:
 if leaf['mappingCode']=='548.10' and leaf['label'].endswith('loan 10'):
  leaf['mappingCode']='548.010';leaf['id']=leaf['id'].replace('548-10-','548-010-',1)
assert len({x['mappingCode'] for x in catalog})==len(catalog)
accounts={};code_account={}
for i,leaf in enumerate(catalog,1):
 code=f'T{i:04d}';accounts[code]={'account_code':code,'account_name':' / '.join([*leaf['path'],leaf['label']]),'mapping_code':leaf['mappingCode'],'mapping_leaf_id':leaf['id'],'mapping_label':leaf['label'],'mapping_statement':leaf['statement'],'mapping_section':leaf['section'],'mapping_path':' > '.join([*leaf['path'],leaf['label']]),'lead_schedule_number':leaf['leadScheduleNumber'],'lead_schedule_key':leaf['leadScheduleKey'],'account_type':'Memo' if leaf['statement']=='Other' else leaf['section'],'import_basis':'Yearly','amount_layout':'Single signed amount column'};code_account[leaf['mappingCode']]=code
book=collections.defaultdict(float);journals=[]
def aux(code,mapping,name):
 base=copy.deepcopy(accounts[code_account[mapping]]);base.update(account_code=code,account_name=name);accounts[code]=base;return code
bank=code_account['420.10'];retained=code_account['810.10'];capital=code_account['805.10']
def post(year,description,legs,category=None):
 legs=[(code,money(amount)) for code,amount in legs if abs(amount)>.0001]
 assert abs(sum(amount for _,amount in legs))<.005,(description,legs)
 for code,amount in legs:book[code]=money(book[code]+amount)
 delta=money(sum(amount for code,amount in legs if accounts[code]['mapping_code'].split('.')[0] in ['420','620']))
 if year in [2025,2026] and delta:assert category,description
 journals.append({'period':year,'description':description,'cashCategory':category,'cashAmount':delta,'postings':[{'account':code,'debit':max(amount,0),'credit':max(-amount,0),'signed':amount} for code,amount in legs]})
def pair(year,description,mapping,amount,category=None):post(year,description,[(code_account[mapping],amount),(bank,-amount)],category)
# Documented founding capital, not a balancing liability.
post(2024,'Founders subscribe 1,000,000 ordinary no-par-value shares for cash',[(bank,1000000),(capital,-1000000)])
for leaf in catalog:
 m=leaf['mappingCode'];a=code_account[m]
 if leaf['statement']!='SFP' or m in ['420.10','805.10','810.10','830.10']:continue
 label=leaf['label'].lower();asset='asset' in leaf['section'].lower();amount=2000 if asset else -2000
 if asset and ('accumulated' in label or 'allowance' in label):amount=-200
 if m.startswith('305.') and 'At cost'==leaf['label']:amount=10000
 if m=='305.20':amount=100000
 if m in ['306.10','320.10']:amount=10000
 if m=='321.10':amount=5000
 if m=='310.10':amount=10000
 if m=='310.20':continue
 if m=='310.25':amount=-1000
 if m=='310.30':amount=-500
 if m=='805.90':amount=200
 if m.startswith('405.'):amount=5000
 if m.startswith('820.'):
  target={'820.10':'305.20','820.20':'390.91','820.30':'350.40','820.40':'350.20'}.get(m)
  post(2024,'Historical reserve: '+leaf['label'],[(code_account[target] if target else retained,-amount),(a,amount)])
  continue
 # Opening depreciation/impairment and deferred tax arise from historical P/L, not cash.
 if asset and ('accumulated' in label or 'allowance' in label):counter=retained
 elif m in ['395.10','595.10'] or m.startswith(('515.','520.','660.','670.')):counter=retained
 else:counter=bank
 post(2024,'Opening prior-ledger balance: '+accounts[a]['account_name'],[(a,amount),(counter,-amount)])
# Consolidated group: gross parent subsidiary investment and intragroup loans are eliminated.
subcap=aux('SUBCAP','805.10','Subsidiary issued capital — consolidation elimination source')
einv=aux('ELIM326','326.10','Elimination of parent-only subsidiary investment')
post(2024,'Bring non-trading 80%-owned subsidiary into consolidation',[(bank,2500),(subcap,-2500)])
post(2024,'Eliminate subsidiary capital against parent investment; recognise NCI',[(subcap,2500),(einv,-2000),(code_account['830.10'],-500)])
elr=aux('ELIM340','340.11','Elimination of intragroup loan receivable');elp=aux('ELIM547','547.20','Elimination of intragroup borrowing')
post(2024,'Eliminate reciprocal intragroup loan balances',[(elp,2000),(elr,-2000)])
opening=copy.deepcopy(book)
# Asset class mapping keys are explicit, not guessed from account names.
ppe_classes={'land':('305.10',None,'305.12'),'buildings':('305.20','305.21','305.22'),'leaseholdProperty':('305.30','305.31','305.32'),'plantAndMachinery':('305.40','305.41','305.42'),'furnitureAndFittings':('305.50','305.51','305.52'),'motorVehicles':('305.60','305.61','305.62'),'officeEquipment':('305.70','305.71','305.72'),'computerEquipment':('305.80','305.81','305.82'),'leaseholdImprovements':('305.90','305.91','305.92'),'otherPpe1':('305.101','305.102','305.103'),'otherPpe2':('305.111','305.112','305.113'),'otherPpe3':('305.121','305.122','305.123'),'otherPpe4':('305.131','305.132','305.133')}
remaining_lives={'buildings':50,'leaseholdProperty':50,'plantAndMachinery':10,'furnitureAndFittings':10,'motorVehicles':5,'officeEquipment':5,'computerEquipment':5,'leaseholdImprovements':6,'otherPpe1':10,'otherPpe2':10,'otherPpe3':10,'otherPpe4':10}
whole=lambda value:float(D(str(value)).quantize(D(1),rounding=decimal.ROUND_HALF_UP))
def net_class(snapshot,key):return money(sum(snapshot.get(code_account[m],0) for m in ppe_classes[key] if m))
def depreciation_charge(year,key,start):
 life=remaining_lives[key]
 if key=='motorVehicles':
  # Opening pool: existing net 8,600 / five remaining years; two separate
  # 500 vehicles become available in 2025/2026 and are sold after one year.
  old=whole((net_class(opening,key)-1000)/life)
  return whole(old+100+(annual[2025]['ppe'][key]['additions']/life if year==2026 else 0))
 if year==2025:return whole(net_class(start,key)/life)
 previous=annual[2025]['ppe'][key]
 old_net=net_class(annual[2025]['opening'],key)-previous.get('depreciation',0)-previous.get('impairmentLosses',0)+previous.get('revaluations',0)
 additions=0 if key=='otherPpe4' else previous['additions']
 new_life=5 if key=='leaseholdImprovements' else life
 return whole(old_net/(life-1)+additions/new_life)
annual={};pnl_by_code={}
for year in [2025,2026]:
 if year==2026:
  for code,amount in list(book.items()):
   if accounts[code]['mapping_statement']=='P/L' and amount:
    target=code_account[{'797.10':'820.92','797.20':'820.10','797.30':'820.20','797.40':'820.40','797.50':'820.92'}[accounts[code]['mapping_code']]] if accounts[code]['mapping_code'].startswith('797.') else retained
    post(2024,'Close prior-year performance to '+('OCI reserves' if target!=retained else 'retained earnings'),[(code,-amount),(target,amount)])
 start=copy.deepcopy(book);start_journal=len(journals);ppe={key:{} for key in ppe_classes};register={}
 # Capital additions and depreciation, with separately identified non-cash financing.
 for key,(cost,dep,imp) in ppe_classes.items():
  additions=1000 if year==2025 else 1500
  pair(year,f'Cash acquisition: {key}',cost,additions,'purchasePpe');ppe[key]['additions']=additions
  if dep:
   charge=depreciation_charge(year,key,start)
   post(year,f'Register-based depreciation: {key}',[(code_account['750.14'],charge),(code_account[dep],-charge)]);ppe[key]['depreciation']=charge
   register[key]={'openingCarrying':net_class(start,key),'remainingLifeAt2024':remaining_lives[key],'depreciation':charge,'newCashAdditions':additions,'newFinancedAdditions':300 if key=='motorVehicles' else 0,'availableFrom':str(2027 if key=='otherPpe4' else year)+'-03-01'}
 post(year,'Asset acquired on finance at year end (no cash)',[(code_account['305.60'],300),(code_account['550.40'],-300)]);ppe['motorVehicles']['additions']+=300
 post(year,'Cash disposal of vehicle: cost 500, accumulated depreciation 100, proceeds 500',[(bank,500),(code_account['305.61'],100),(code_account['305.60'],-500),(code_account['780.10'],-100)],'disposalPpe');ppe['motorVehicles'].update(disposals=500,accumulatedDepreciationDisposals=100)
 post(year,'Impairment of cost-model Other PPE 1 component',[(code_account['780.40'],50),(code_account['305.103'],-50)]);ppe['otherPpe1']['impairmentLosses']=50
 # One property at FV and a specialist cost-exception property: every 310 mapping is exercised.
 if year==2025:pair(year,'Acquire rental property A for cash','310.10',311600,'purchaseInvestmentProperty')
 gain=10000 if year==2025 else 20100
 post(year,'Property A independent valuation increase',[(code_account['310.20'],gain),(code_account['780.20'],-gain)])
 post(year,'Specialist property B cost-exception depreciation',[(code_account['750.14'],100),(code_account['310.25'],-100)])
 pair(year,'Purchase software licence for cash','320.10',1000,'purchaseIntangibles')
 software_opening=sum(value for code,value in opening.items() if accounts[code]['mapping_code'].startswith('320.'))
 amortisation=whole(software_opening/20+(1000/20 if year==2026 else 0))
 post(year,'Software amortisation: opening net 9,600 / 20 remaining years plus prior additions / 20',[(code_account['750.141'],amortisation),(code_account['320.20'],-amortisation)])
 post(year,'Capitalise qualifying construction borrowing costs at year end',[(code_account['305.131'],200),(bank,-200)],'financeCostsPaid');ppe['otherPpe4']['additions']+=200
 post(year,'Capitalise development costs meeting all IAS 38 criteria',[(code_account['320.10'],400),(bank,-400)],'purchaseIntangibles')
 post(year,'Right-of-use depreciation: opening net 9,600 / six remaining lease years',[(code_account['750.14'],1600),(code_account['306.20'],-1600)])
 # Biological asset classes: cost and fair-value models are separate.
 post(year,'Livestock fair value increase',[(code_account['330.10'],50),(code_account['780.20'],-50)])
 post(year,'Cost-model biological asset depreciation',[(code_account['750.14'],20),(code_account['330.30'],-20)])
 # Every ordinary performance mapping has an actual source transaction.
 special={'750.12','750.14','750.141','750.29','780.10','780.20','780.30','780.40','795.10','795.20','795.30','795.90'}
 revenue_values={'700.10':5000,'700.20':600000,'700.30':180000,'700.40':50000,'700.50':60000,'700.60':10000,'700.70':10000,'700.80':60000,'700.90':10000}
 for leaf in catalog:
  m=leaf['mappingCode']
  if leaf['statement']!='P/L' or m in special or m.startswith(('770.','775.','797.')):continue
  if m.startswith('700.'):
   amount=money(revenue_values[m]*(1 if year==2025 else 1.1));pair(year,'Customer receipts: '+leaf['label'],m,-amount,'receiptsCustomers')
  elif m.startswith('730.') or m=='785.10':pair(year,'Operating receipt: '+leaf['label'],m,-1000,'otherOperating')
  elif m=='799.10':pair(year,'Cash proceeds from discontinued operation (post-tax result)',m,-500,'otherOperating')
  elif m=='720.30':
   post(year,'Inventory produced and held at year end',[(code_account['405.30'],500),(code_account[m],-500)])
  else:
   amount=1000
   if m.startswith('750.9') and len(m.split('.')[1])==3:amount=10+int(m[-2:])
   if m=='750.20':amount=120000 if year==2025 else 150000
   if m=='750.28':amount=60000 if year==2025 else 75000
   if m=='750.24':amount=2500 if year==2025 else 3000
   if m=='750.81':amount=1500 if year==2025 else 2000
   pair(year,'Supplier/employee payment: '+leaf['label'],m,amount,'paymentsSuppliersEmployees')
 post(year,'Equity-settled director option service expense',[(code_account['750.21'],100),(code_account['820.50'],-100)])
 pair(year,'Employer defined contribution for key management','750.29',5000,'paymentsSuppliersEmployees')
 post(year,'Expected credit loss allowance on customer receivables',[(code_account['750.12'],10),(code_account['430.20'],-10)])
 # Provision and employee service costs; usage is cash, additions are not.
 for leaf in catalog:
  m=leaf['mappingCode']
  if m.startswith(('515.','660.')):
   post(year,'Provision added: '+leaf['label'],[(code_account['750.90'],10),(code_account[m],-10)])
   pair(year,'Provision utilised in cash: '+leaf['label'],m,5,'paymentsSuppliersEmployees')
  if m.startswith(('520.','670.')):post(year,'Employee benefit service cost: '+leaf['label'],[(code_account['750.29'],10),(code_account[m],-10)])
 for leaf in catalog:
  m=leaf['mappingCode']
  if m.startswith('515.'):
   unwind=whole(-start[code_account[m]]*.05)
   post(year,'Unwind non-current provision discount at 5%: '+leaf['label'],[(code_account['775.50'],unwind),(code_account[m],-unwind)])
 pair(year,'Supplier-finance non-current fixed 5% coupon paid','775.10',100,'financeCostsPaid')
 # IAS 19 net interest is separate from current service and actuarial remeasurement.
 pension_interest=whole(-start[code_account['520.10']]*.05)
 post(year,'Defined-benefit net interest at 5% on opening obligation',[(code_account['750.29'],pension_interest),(code_account['520.10'],-pension_interest)])
 # Financing principal and interest are explicitly separate, not inferred from liability changes.
 debt=[leaf for leaf in catalog if leaf['mappingCode'].split('.')[0] in ['547','548','550','551','555','610','615'] and leaf['mappingCode']!='547.20']
 for leaf in debt:
  m=leaf['mappingCode'];principal=max(0,-start[code_account[m]]);interest=money(principal*.05)
  finance_code='775.30' if m.startswith(('555.','615.')) or m in ['550.40','550.50','610.30','610.40'] else '775.40'
  if interest:pair(year,'Five-percent interest paid: '+leaf['label'],finance_code,interest,'financeCostsPaid')
  pair(year,'Voluntary principal repayment: '+leaf['label'],m,100,'loansRepaid')
 pair(year,'New bank loan drawn on year-end date','550.20',-1000,'loansRaised')
 pair(year,'Bank overdraft interest','775.20',money(abs(start[code_account['620.10']])*.05),'financeCostsPaid')
 pair(year,'General borrowing interest','775.10',100,'financeCostsPaid');pair(year,'Facility fees','775.90',50,'financeCostsPaid')
 # Actual investment returns and remeasurements.
 interest=money(sum(max(0,start[code_account[leaf['mappingCode']]])*.05 for leaf in catalog if leaf['mappingCode'].startswith(('340.','449.')) and leaf['mappingCode']!='340.11'))
 pair(year,'Loan and deposit interest received','770.10',-interest,'interestReceived')
 post(year,'Interest earned but accrued at reporting date',[(code_account['430.60'],25),(code_account['770.10'],-25)])
 pair(year,'Dividend on external financial investment received','770.20',-100,'dividendsReceived');pair(year,'Other investment distribution received','770.90',-50,'otherOperating')
 post(year,'Quoted equity instrument fair-value gain',[(code_account['350.30'],200),(code_account['770.30'],-200)])
 post(year,'Non-cash FX gain on foreign debt instrument',[(code_account['350.10'],20),(code_account['780.30'],-20)])
 # Each permitted OCI category has its own defined cause.
 for mapping,asset,amount in [('797.10','390.20',10),('797.20','305.20',1000),('797.30','390.91',20),('797.40','350.40',30),('797.50','520.10',40)]:
  post(year,'OCI transaction: '+mapping,[(code_account[asset],amount),(code_account[mapping],-amount)])
 ppe['buildings']['revaluations']=1000
 # Tax amounts follow the actual pre-tax ledger profit and explicit permanent/timing differences.
 pbt=-sum(book[code] for code,a in accounts.items() if a['mapping_statement']=='P/L' and not a['mapping_code'].startswith(('795.','797.','799.')))
 permanent=book[code_account['750.24']]+book[code_account['750.81']]
 temporary=-1000;current_tax=float(D(str((pbt+permanent+temporary)*.27)).quantize(D(1),rounding=decimal.ROUND_HALF_UP));assert current_tax>0
 post(year,'Current-year tax at 27% on computed taxable income',[(code_account['795.10'],current_tax),(code_account['695.10'],-current_tax)])
 post(year,'Deferred tax on temporary difference at 27%',[(code_account['795.20'],270),(code_account['595.10'],-270)])
 post(year,'Prior-year current tax underprovision',[(code_account['795.30'],100),(code_account['695.10'],-100)])
 post(year,'Foreign withholding tax separately assessed',[(code_account['795.90'],50),(code_account['695.10'],-50)])
 pair(year,'Income tax paid (assessment less 1,000 remaining payable)','695.10',current_tax+150-1000,'taxPaid')
 year_journals=journals[start_journal:];cf=collections.defaultdict(float)
 for journal in year_journals:
  if journal['cashCategory']:cf[journal['cashCategory']]=money(cf[journal['cashCategory']]+journal['cashAmount'])
 close=copy.deepcopy(book);cash_sum=lambda snapshot:money(sum(amount for code,amount in snapshot.items() if accounts[code]['mapping_code'].split('.')[0] in ['420','620']))
 assert abs(sum(close.values()))<.005
 assert abs(cash_sum(close)-cash_sum(start)-sum(cf.values()))<.005
 annual[year]={'opening':dict(start),'closing':dict(close),'cash':dict(cf),'cashOpening':cash_sum(start),'cashClosing':cash_sum(close),'pbt':money(pbt),'permanentDifferences':money(permanent),'temporaryDifferences':temporary,'currentTax':current_tax,'ppe':ppe,'assetRegister':register,'intangibleAmortisation':amortisation,'rightOfUseDepreciation':1600}
# Emit an ordinary importable TB and opening history, plus the entire double-entry evidence.
lines=[];history=[]
for code,account in accounts.items():
 current=annual[2026]['closing'].get(code,0);prior=annual[2025]['closing'].get(code,0)
 lines.append({**account,'current_year_balance':current,'prior_year_balance':prior,'source_balance':current,'opening_balance':annual[2026]['opening'].get(code,0),'debit':current,'credit':prior})
 history.append({**account,'financial_year_end':'2024-02-29','closing_balance':opening.get(code,0)})
covered={line['mapping_code'] for line in lines};assert covered=={leaf['mappingCode'] for leaf in catalog}
for leaf in catalog:
 group=[line for line in lines if line['mapping_code']==leaf['mappingCode']]
 assert leaf['statement']=='Other' or any(abs(line['current_year_balance'])>.005 and abs(line['prior_year_balance'])>.005 for line in group),leaf
fixture={'name':'Highveld comprehensive mapping fixture','version':1,'fictional':True,'framework':'Full IFRS','scope':'consolidated','catalogueCount':len(catalog),'lines':lines,'history':history,'journals':journals,'periods':annual,'accounts':accounts,'ppeClasses':ppe_classes,'remainingLivesAt2024':remaining_lives,'scenario':{'ordinaryCapital':1000000,'specialistInvestmentPropertyCostException':True,'intercompanyBalancesEliminated':['326.10','340.11','547.20'],'loanInterestRate':.05,'approvalDate':'2026-10-21','incorporationDate':'2020-03-01','capitalCommitment':10000}}
(root/'fixture.json').write_text(json.dumps(fixture,indent=2));(root/'catalog-corrected.json').write_text(json.dumps(catalog,indent=2))
print('Fixture:',len(lines),'accounts;',len(catalog),'mapping leaves;',len(journals),'balanced journals')
for year,p in annual.items():print(year,'PBT',p['pbt'],'Cash',p['cashOpening'],'+',money(sum(p['cash'].values())),'=',p['cashClosing'])
