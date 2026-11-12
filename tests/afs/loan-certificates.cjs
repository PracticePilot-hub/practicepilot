const assert=require('node:assert/strict'),{load}=require('./load.cjs');
const {loanLinesFromMappings}=load('app/afs/[engagementId]/loanCertificateCandidates.ts');
const rows=[
 {account_name:'Loan: Gods Garden Gifts CC',mapping_code:'340.30',current_year_balance:78707.87},
 {account_name:'Loan from Family Trust',mapping_code:'547.30',current_year_balance:-897749.72},
 {account_name:'Current loan',mapping_code:'449.10',current_year_balance:100},
 {account_name:'Trustee loan',mapping_code:'548.10',current_year_balance:-100},
 {account_name:'Mortgage',mapping_code:'545.10',current_year_balance:-200},
 {account_name:'Loan movement',mapping_code:'547.30',current_year_balance:-200},
 {account_name:'Settled',mapping_code:'340.30',current_year_balance:0},
 {account_name:'Invalid',mapping_code:'340.30',current_year_balance:'NaN'},
];
const found=loanLinesFromMappings(rows);assert.equal(found.length,4);assert.equal(found[0],rows[0]);assert.equal(found[1],rows[1]);
console.log('PASS certificates include receivable and payable loans, preserve source rows and exclude settled/movement/bank accounts.');
