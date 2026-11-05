const assert=require('node:assert/strict'),{load}=require('../highveld-comprehensive/load.cjs'),p='app/afs/[engagementId]/';
const d=load(p+'components/AfsPolicyNoteDefaults.ts'),req=load(p+'print-studio/afsNoteDisclosureRequirements.ts'),review=load(p+'print-studio/afsPolicyFrameworkReview.ts');
const old=d.buildAccountingPolicyTextsForEdition('2015',null,'smes'),now=d.buildAccountingPolicyTextsForEdition('2025',null,'smes'),full=d.buildAccountingPolicyTextsForEdition('2025',null,'full');
assert(old.policyGoodwillBusinessCombinations.text.includes('directly attributable acquisition costs'));
assert(now.policyGoodwillBusinessCombinations.text.includes('Acquisition-related costs are expensed'));
assert(old.policyFinancialInstruments.text.includes('rather than the alternative IAS 39'));
assert(now.policyFinancialInstruments.text.includes('former option to use IAS 39'));
assert(!full.policyGoodwillBusinessCombinations.text.includes('accumulated amortisation'));
for(const edition of ['2015','2025']){const fields=req.disclosureFields('notesRevenue',{framework:'smes',edition});assert.equal(fields.some(f=>f.id==='contractDetails'),edition==='2025');assert.equal(req.disclosureFields('notesOtherFinancialAssets',{framework:'smes',edition}).some(f=>f.id==='fairValue'),edition==='2025');assert.equal(review.policyFrameworkIssues(d.accountingPolicySections,Object.fromEntries(d.accountingPolicySections.map(s=>[s.optionKey,true])),edition==='2015'?old:now,{framework:'smes',edition}).length,0);}
const client={policyLeases:{title:'My leases',text:'The entity recognises right-of-use assets under IFRS 16.'}};
assert.equal(d.buildAccountingPolicyTextsForEdition('2015',client,'smes').policyLeases.text,client.policyLeases.text);
assert.equal(review.policyFrameworkIssues(d.accountingPolicySections,{policyLeases:true},client,{framework:'smes',edition:'2015'}).length,1);
assert.equal(review.policyFrameworkIssues(d.accountingPolicySections,{policyLeases:true},client,{framework:'full',edition:'2025'}).length,0);
console.log('PASS SME editions: acquisition costs, instrument-policy election, additional 2025 disclosures and preserved-but-flagged incompatible client policies.');

const rp=load(p+'print-studio/afsRelatedPartyDisclosure.ts');const meta={kmp:{shortTerm:{current:75,prior:60},postEmployment:{current:5,prior:5},otherLongTerm:{current:0,prior:0},termination:{current:0,prior:0},shareBased:{current:1,prior:1}}};assert.equal(rp.completeRelatedPartyKmp(meta).kmp.total.current,81);assert(!meta.kmp.total);delete meta.kmp.termination;assert(!rp.completeRelatedPartyKmp(meta).kmp.total);

assert.equal(review.frameworkLeaseLabel('Right-of-use assets',{framework:'smes',edition:'2015'}),'Finance-leased assets');assert.equal(review.frameworkLeaseLabel('Right-of-use assets',{framework:'full',edition:'2025'}),'Right-of-use assets');assert.equal(review.frameworkLeaseLabel('My leased premises',{framework:'smes',edition:'2025'}),'My leased premises');
