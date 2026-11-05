const assert=require('assert/strict'),{load}=require('./load.cjs'),{ppeWorkScheduleIssues}=load('app/afs/[engagementId]/print-studio/afsWorkScheduleIssues.ts');
assert.equal(ppeWorkScheduleIssues([]).length,0);
const rows=ppeWorkScheduleIssues([{label:'Motor vehicles',side:'current',costDifference:0,depDifference:20000},{label:'Motor vehicles',side:'prior',costDifference:0,depDifference:20000,openingMissing:true}]);
assert.equal(rows.length,2);assert(rows.every(r=>r.severity==='critical'&&r.target==='notes-work'));
assert(rows[0].message.includes('20'));assert(rows[1].message.includes('historical trial balance'));assert(rows[1].title.includes('prior year'));
console.log('PASS unreconciled PPE schedules show actionable FlightDeck blockers; reconciled schedules add none.');
