"""Explicit fictional South African tax registers. No real taxpayer evidence is asserted.
Closing tax balances come from registers and actual fixture cash payments, not balance plugs.
"""
from decimal import Decimal,ROUND_HALF_UP
from copy import deepcopy
D=Decimal
q=lambda n:float(D(str(n)).quantize(D('.01'),rounding=ROUND_HALF_UP))
rnd=lambda n:int(D(str(n)).quantize(D('1'),rounding=ROUND_HALF_UP))
SOURCES={
 'rates':'https://www.sars.gov.za/tax-rates/income-tax/companies-trusts-and-small-business-corporations-sbc/',
 'cgt':'https://www.sars.gov.za/types-of-tax/capital-gains-tax/proceeds/calculation-of-taxable-capital-gains-and-assessed-capital-losses/inclusion-rate/',
 'wear':'https://www.sars.gov.za/lapd-intr-in-2012-47-wear-and-tear-depreciation-allowance/',
 'buildings':'https://www.sars.gov.za/wp-content/uploads/Legal/Notes/Legal-IntR-IN-107-Deduction-in-respect-of-commercial-buildings.pdf',
 'foreign':'https://www.sars.gov.za/legal-in-18-rebate-and-deduction-for-foreign-taxes-on-income/',
 'farming':'https://www.sars.gov.za/legal-pub-guide-it35-guide-on-the-taxation-of-farming-operations/',
 'namibia':'https://itas.namra.org.na/taxes',
}
LIVES={'leaseholdProperty':50,'plantAndMachinery':4,'furnitureAndFittings':6,'motorVehicles':5,'officeEquipment':5,'computerEquipment':3,'leaseholdImprovements':6,'otherPpe1':6,'otherPpe2':10,'otherPpe3':5,'otherPpe4':5}
SPECS={'plantAndMachinery':'portable compressors','furnitureAndFittings':'office furniture','motorVehicles':'passenger vehicles','officeEquipment':'photocopying equipment','computerEquipment':'personal computers','otherPpe1':'window air conditioners','otherPpe2':'large metal freight containers','otherPpe3':'communication systems','otherPpe4':'servers in use plus separately tracked construction in progress','leaseholdProperty':'50-year business lease premium','leaseholdImprovements':'contractually required improvements reverting to lessor in February 2030'}
def build(f):
 accounts=f['accounts']; by={}
 for code,a in accounts.items():by.setdefault(a['mapping_code'],[]).append(code)
 get=lambda book,m:q(sum(book.get(code,0) for code in by.get(m,[])))
 opening={row['account_code']:row['closing_balance'] for row in f['history']}
 snapshots={2024:opening,2025:f['periods']['2025']['closing'],2026:f['periods']['2026']['closing']}
 bases={2024:{k:(10000 if k=='land' else 80000 if k=='buildings' else 9800) for k in f['ppeClasses']}}
 allowances={}; software_bases={2024:9800}
 for year in [2025,2026]:
  n=year-2024;bases[year]={};allowances[year]={};previous=f['periods'][str(year-1)] if year==2026 else None
  for key,(cost,dep,imp) in f['ppeClasses'].items():
   add=f['periods'][str(year)]['ppe'][key]['additions'];allow=0;disposed=0
   if key=='buildings':allow=5000+(50 if year==2026 else 0)
   elif key=='motorVehicles':allow=1900+(260 if year==2026 else 0);disposed=400
   elif key!='land':
    life=LIVES[key];allow=10000/life
    if year==2026 and key!='otherPpe4':allow+=1000/(life-1 if key in ['leaseholdProperty','leaseholdImprovements'] else life)
   allow=q(min(bases[year-1][key],allow));allowances[year][key]=allow
   bases[year][key]=q(bases[year-1][key]+add-allow-disposed)
  sw=q(10000/3+(1000/3 if year==2026 else 0));allowances[year]['purchasedSoftware']=sw
  software_bases[year]=q(software_bases[year-1]+1000-sw)
 rows={}
 for year,book in snapshots.items():
  n=year-2024;items=[]
  def item(id,description,kind,carrying,base,rate=27,allocation='profit',reserve=None,explanation=''):
   difference=q(carrying-base if kind=='asset' else base-carrying)
   items.append({'id':id,'description':description,'kind':kind,'carrying':q(carrying),'taxBase':q(base),'rate':rate,'tax':rnd(difference*rate/100),'allocation':allocation,'reserve':reserve,'evidence':explanation})
  for key,codes in f['ppeClasses'].items():
   carrying=q(sum(get(book,m) for m in codes if m))
   if key=='buildings':
    reval=2000+n*1000
    item('ppe-buildings','Commercial buildings — cost/allowance component','asset',carrying-reval,bases[year][key],explanation='Fictional opening tax register: original qualifying new commercial-building cost R100,000, first used March 2020; four 5% allowances before opening leave R80,000. Subsequent additions first used the following 1 March. Section 13quin; recovery through use. Revaluation is separately allocated to OCI.')
    item('ppe-buildings-oci','Buildings revaluation component','asset',reval,0,allocation='oci',reserve='820.10',explanation='Cumulative historical revaluation R2,000 plus R1,000 each year. No corresponding tax deduction or tax-base uplift. Tax is recognised in OCI under IAS 12.')
   else:item('ppe-'+key,'PPE '+key,'asset',carrying,bases[year][key],21.6 if key=='land' else 27,explanation=('Land historical CGT cost R10,000; no annual deduction. Capital losses are recoverable against the same parent’s taxable capital gains on the existing debt FVOCI investment.' if key=='land' else 'Fictional asset tax register: '+SPECS[key]+'. Opening tax value R9,800; eligible tax cost R10,000. Write-off period '+str(LIVES[key])+' years. Year-end additions are first used the next 1 March; construction-in-progress additions remain unused until March 2027. Vehicle disposal tax value R400 matches proceeds R500 less taxable recoupment R100. Section 11(e), or sections 11(f)/(g) for the contractual lease premium/improvements.'))
  ip_total=get(book,'310.10')+get(book,'310.20')
  item('investment-land','Investment property A — rental land','asset',ip_total-10000,311600 if year>2024 else 0,21.6,explanation='Property A is bare rental land acquired March 2024 for R311,600; no wear-and-tear/building allowance. Fair-value gains are capital and unrealised. IAS 12.51C sale presumption; 80% CGT inclusion at 27%.')
  ipb=10000+get(book,'310.25')+get(book,'310.30')
  item('investment-cost','Investment property B — second-hand specialist building','asset',ipb,10000,21.6,explanation='Second-hand cost R10,000; section 13quin new/unused condition is not met and no other building allowance applies. Expected recovery by sale; future capital loss supported by taxable capital gains within the parent. No annual deduction for accounting depreciation.')
  software=sum(get(book,m) for m in ['320.10','320.20','320.30'])-n*400
  item('software','Purchased mainframe software','asset',software,software_bases[year],explanation='Fictional opening tax register R9,800; original purchased mainframe-software cost R10,000, SARS IN47 three-year write-off. R1,000 annual purchased additions first used the next 1 March. Internal development R400 annually is separately capital in nature, not yet available for use; no section 11D enhanced deduction is claimed and its R400/R800 capital tax cost equals carrying amount.')
  item('rou','Right-of-use office premises','asset',sum(get(book,m) for m in ['306.10','306.20','306.30']),0,explanation='Tax lessee has no owned asset/tax cost. Actual contractual rental instalments, not ROU depreciation, are deductible. Related lease liability is tracked separately; IAS 12 equal initial temporary differences are not ignored.')
  item('lease','Office lease liability','liability',-sum(get(book,m) for m in by if m.startswith(('555.','615.'))),0,explanation='Future deductible lease principal included in carrying liability. P&L finance interest is already included in profit. Opening liability R8,000 and R400 principal settled annually.')
  item('livestock-fv','Conventional cattle — fair-value class','asset',get(book,'330.10'),2000,explanation='Separate fictional herd: 50 adult cows, prescribed First Schedule standard value R40 each. No quantity change. Unrealised accounting fair-value gains are excluded from current taxable farming income; tax closing-stock value remains R2,000.')
  item('livestock-cost','Specialist cattle — cost exception class','asset',sum(get(book,m) for m in ['330.20','330.30','330.40']),2000,explanation='Separate prototype-genetics herd, 50 adult cows, prescribed standard value R40 each. Initial fair value is not reliably measurable for this specialist class. Accounting depreciation/impairment does not reduce tax closing livestock value; no tax wear-and-tear deduction is claimed.')
  item('quoted-equity','Capital quoted equity investment','asset',get(book,'350.30'),2000,21.6,explanation='Held as a capital investment, not share dealing. Tax historical CGT cost R2,000; unrealised quoted gains R200 each year are excluded until disposal; 80% inclusion at 27%.')
  item('fvoci-debt','Capital debt investment FVOCI','asset',get(book,'350.20'),2000,21.6,'oci','820.30','Historical capital investment cost R2,000 and carrying R4,000 throughout; cumulative unrealised gain R2,000. No current coupon or fair-value movement is recorded. Same-parent future capital gains support deductible capital differences.')
  item('hedge','Cash-flow hedge derivative','asset',get(book,'350.40'),2000,27,'oci','820.40','Unlisted OTC commodity forward, historical cash premium R2,000. Not a section 24L listed instrument; no current settlement/accrual of the contingent future gain. Future trade settlement is ordinary income; unrealised gain is taxed on settlement. No present tax-base uplift.')
  item('branch-prepayment','Foreign-branch prepaid services translation','asset',get(book,'390.91'),2000,27,'oci','820.20','USD200 non-monetary prepaid services: historical ZAR cost R2,000, for capital construction services, not deductible under section 11(a) before the completed asset is brought into use. Foreign operation functional-currency translation affects OCI; tax base remains historical ZAR cost. No amount is a section 24I monetary instrument.')
  item('pension-surplus','Refundable funded-plan employer surplus','asset',get(book,'390.20'),0,27,'oci','820.92','Refundable employer surplus will be taxable on refund. Tax base nil. Historical contributions were deducted; actuarial changes affect OCI.')
  provision_codes=[m for m in by if m.startswith(('515.','520.','660.','670.'))]
  liability=-sum(get(book,m) for m in provision_codes)-7407.41
  actuarial=n*40
  item('parent-provisions','Parent deductible employee and commercial provisions (P&L component)','liability',liability+actuarial,0,explanation='Subsidiary R7,407.41 provision is excluded from this parent schedule. Remaining obligations are conditional commercial warranty/legal settlements, leased-site repair/restoration (not capital improvements/fines), employee leave/bonuses and benefit obligations. Deductible only when unconditional/paid as applicable; section 7B variable remuneration paid basis. No existing current tax deduction is assumed. DB actuarial component is allocated separately to OCI.')
  item('db-actuarial','DB obligation actuarial gain (OCI component)','asset',actuarial,0,27,'oci','820.92','R40 annual actuarial gain reduces the deductible DB difference; this is the OCI tax allocation component of the DB obligation, not a separate recognised financial asset.')
  item('disposal-obligation','Disposal-group service-completion provision','liability',-get(book,'699.10'),0,explanation='Conditional ordinary trade-service obligation R2,000, deductible when performed/settled. It is non-financial under IAS 37 and was not yet unconditionally incurred for tax; same-parent recovery is supported by future taxable trade profits.')
  for code in [m for m in by if m.startswith(('531.','640.','650.'))]:
   item('deferred-receipts-'+code,'Previously taxed receipt '+code,'liability',-get(book,code),0,explanation='Non-refundable customer/service advance or commercial operating-grant receipt was taxable on receipt before opening. Future release to accounting income is not taxed a second time. These grants are not within section 12P listed exempt grants.')
  item('variable-bonus-payable','Accrued variable bonus payable','liability',-get(book,'630.35'),0,explanation='Variable remuneration under section 7B: deduction follows actual payment. Carrying accrual R2,000 is unchanged; future deduction is supported by parent taxable-profit forecasts.')
  item('short-prepayment','Previously deducted short-term service prepayment','asset',get(book,'430.40'),0,explanation='Ordinary short-term expenditure actually incurred and deducted before opening; section 23H six-month/small-prepayment exclusion applies. Future accounting expense is not deducted again. Long-term capital-project advances in 390.92/390.93 instead retain capital tax bases equal to carrying values.')
  allowance=-get(book,'430.20');item('trade-ecl','Lifetime trade-receivable ECL','liability',allowance,allowance*.4,explanation='Lifetime IFRS 9 ECL falls within section 11(j)(i) 40% allowance category, excluding amounts in default already written off under 11(i). Opening allowance R200, then R210/R220. The 60% balance is deductible on eventual write-off; current allowance deduction changes by R4 yearly.')
  rows[year]=items
 adjustments={}
 for year in [2025,2026]:
  book=snapshots[year];prev=snapshots[year-1];annual=f['periods'][str(year)];adj=[]
  def add(kind,description,amount):adj.append({'id':'sa-'+str(len(adj)+1),'kind':kind,'description':description,'amount':q(amount)})
  add('permanent','Non-deductible fines and specified non-trade expenditure',get(book,'750.24')+get(book,'750.81'))
  add('permanent','Donation without section 18A approval/receipt',get(book,'750.55'))
  add('permanent','Own new-share issue: no employer expenditure incurred (Labat principle)',100)
  add('permanent','Exempt domestic dividend: section 10(1)(k)(i)',-100)
  add('temporary','Accounting PPE depreciation/impairment less asset-register tax allowances',sum(v.get('depreciation',0)+v.get('impairmentLosses',0) for v in annual['ppe'].values())-sum(v for k,v in allowances[year].items() if k!='purchasedSoftware'))
  add('temporary','Purchased software amortisation less IN47 capital allowance',annual['intangibleAmortisation']-allowances[year]['purchasedSoftware'])
  add('temporary','Property A unrealised capital fair-value gain; property B non-deductible depreciation',-(10000 if year==2025 else 20100)+100)
  add('temporary','Unrealised capital quoted-equity gain',-200)
  capital_rate_effect=q((-(10000 if year==2025 else 20100)-200+100)*.2)
  add('permanent','Non-included 20% capital component of property/equity fair-value gains and cost-property depreciation',capital_rate_effect)
  add('temporary','Capital timing differences use the taxable 80% portion',-capital_rate_effect)
  add('temporary','First Schedule livestock values unchanged: FV gain excluded, book depreciation added back',-50+20)
  add('temporary','Lease: ROU depreciation less deductible principal in cash rental',1600-400)
  # Exclude OCI actuarial gains, which are not current profit/tax deductions.
  current_provisions=-sum(get(book,m)-get(prev,m) for m in by if m.startswith(('515.','520.','660.','670.')))+40
  add('temporary','Conditional provision/employee costs less qualifying cash utilisation',current_provisions)
  add('temporary','Trade ECL charge less change in section 11(j) allowance',10-4)
  adjustments[year]=adj
 return {'sources':SOURCES,'register':rows,'ppeTaxBases':bases,'taxAllowances':allowances,'adjustments':adjustments,'subsidiaryRecovery':{'contractDate':'2024-02-01','serviceStart':'2026-03-01','serviceEnd':'2027-02-28','fee':100000,'operatingCosts':40000,'legacyDeduction':7407.41,'taxableProfitBeforeLegacyDeduction':60000,'taxableProfitAfterLegacyDeduction':52592.59,'cashReceipts':100000,'cashCostsAndLegacySettlement':47407.41}}
