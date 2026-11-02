const fs=require('fs'),root='tests/highveld-comprehensive/',facts=require('./disclosure_facts.cjs'),f=JSON.parse(fs.readFileSync(root+'fixture.json'));
Object.assign(facts,require('./dynamic_case_facts.cjs').buildDynamicFacts(f,facts));
// Current balances are contractually current; do not describe them as 2030 debt.
for(const key of ['notesGroupRelatedPartyBorrowings','notesShareholdersLoans','notesBorrowings']){
 facts[key].terms+=' Non-current principal is due in 2030. The separate current facility balances are overdue principal: only R100 per account was repaid in each year; contractual interest is fully paid. They remain payable on demand and are not reclassified as non-current.';
 facts[key].breaches='There are no financial covenants. Current facility principal is overdue at both year ends and remains payable on demand; the note’s current balances identify the exposure. Interest is fully paid, no penalty has been imposed, and no waiver or refinancing is assumed. Non-current facilities have no default or acceleration clause linked to these separate current facilities.';
}
for(const key of ['notesLeaseLiabilities','notesAssetFinance']){
 facts[key].maturity='The non-current principal is due on 28 February 2030 and bears 5% annual interest. The separately mapped current principal is overdue and payable immediately: R100 principal per account was paid in each year and all contractual interest was paid. No waiver, extension or reclassification is assumed. Lessors have not terminated the underlying leases or accelerated the separate non-current contracts.';
}
facts.notesLoansReceivable.terms+=' Current loan balances are overdue principal, separately classified current; annual interest is paid in full. Cash collateral covers principal and continuing interest and is expected to be realised within one month. These current accounts do not have a 2030 maturity.';
facts.notesLoansReceivable.impairment='External loans are cash collateralised for principal and continuing contractual interest. Current principal is past due; non-current loans remain performing. Full realisation of collateral and contractual interest is expected, giving nil discounted cash shortfall and nil expected credit loss in this test case. There are no guarantees, undrawn commitments or bad-debt expense.';
facts.notesOtherFinancialLiabilities.terms='Non-current financial debt bears fixed annual 5% interest and matures on 28 February 2030. The separate current contractual liability is interest-free, payable on demand and unchanged in both periods; it is not a new 2030 borrowing.';
facts.notesRelatedParties.terms+=' Separately mapped current loans are past-due principal and payable on demand; interest is paid. Receivables remain fully cash collateralised. No current amount is described as contractually deferred to 2030.';
facts.notesGoingConcern.assessment+=' Forecast payments include immediate settlement of the disclosed overdue current borrowing and lease principal from existing unrestricted cash. No extension or new funding is needed.';
for(const [key,prefixes]of Object.entries({notesLeaseLiabilities:['555','615'],notesAssetFinance:['550.40','550.50','610.30','610.40']})){
 const amounts=[];
 for(const [year,side]of [[2026,'current_year_balance'],[2025,'prior_year_balance']]){
  const selected=f.lines.filter(line=>prefixes.some(prefix=>line.mapping_code===prefix||line.mapping_code.startsWith(prefix+'.')));
  const current=selected.filter(line=>line.mapping_section.toLowerCase().startsWith('current')).reduce((n,line)=>n-Number(line[side]),0),noncurrent=selected.filter(line=>!line.mapping_section.toLowerCase().startsWith('current')).reduce((n,line)=>n-Number(line[side]),0);
  const within=current+noncurrent*.05,later=noncurrent*(1+.05*(2030-year-1));amounts.push(`${year}: contractual undiscounted cash flows due within one year R${within.toLocaleString('en-ZA')}; after one but within five years R${later.toLocaleString('en-ZA')}; after five years nil. Current past-due principal included in the first band is R${current.toLocaleString('en-ZA')}.`);
 }
 facts[key].maturity+=' '+amounts.join(' ');
}
facts.notesGoingConcern.basis+=' The forecasts explicitly include overdue principal; interest remains current and the available cash exceeds immediate settlement needs.';
facts.notesRelatedParties.terms=facts.notesRelatedParties.terms.replace('External related loans','Non-current external related loans');
facts.notesLoansReceivable.terms=facts.notesLoansReceivable.terms.replace('Each external loan','Each non-current external loan');
facts.notesShareholdersLoans.terms=facts.notesShareholdersLoans.terms.replace('Each external stakeholder loan','Each non-current external stakeholder loan');
facts.notesBorrowings.terms=facts.notesBorrowings.terms.replace('External bank and other borrowing accounts','Non-current bank and other borrowing accounts');
facts.notesGroupRelatedPartyBorrowings.terms=facts.notesGroupRelatedPartyBorrowings.terms.replace('External related-party debt','Non-current external related-party debt');
const prepared=JSON.parse(fs.readFileSync(root+'fixture-settings.json'));
require('./technical_case_facts.cjs').applyTechnicalReview(f,facts,prepared);
fs.writeFileSync(root+'disclosure-facts-final.json',JSON.stringify(facts,null,2));
const currentTerms='Principal is past due and payable on demand. Contractual interest of 5% on opening principal has been paid annually. Receivables are fully cash collateralised; current borrowing principal repayments are R100 per account per year. No waiver or refinancing is assumed.';
for(const link of prepared.state.relatedPartyAccounts){const line=f.lines.find(line=>'account:'+line.account_code===link.accountKey);if(line?.mapping_section.toLowerCase().startsWith('current'))link.terms=currentTerms;}
for(const[key,fields]of Object.entries(facts))for(const[field,text]of Object.entries(fields))if(prepared.state.disclosureContent[key]?.[field])prepared.state.disclosureContent[key][field].text=text;
prepared.state.goingConcernAssessment={forecast:facts.notesGoingConcern.assessment,conclusion:facts.notesGoingConcern.basis};
fs.writeFileSync(root+'fixture-settings.json',JSON.stringify(prepared,null,2));
