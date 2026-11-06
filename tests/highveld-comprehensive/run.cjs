const {spawnSync}=require('node:child_process'),path=require('node:path');
process.chdir(path.resolve(__dirname,'../..'));
for(const file of ['extract_catalog.cjs','build_fixture.py','rebuild_tax_fixture.py','audit_fixture.cjs','build_state.cjs','complete_state.cjs','finalize_facts.cjs','test_fixture.cjs','test_paragraph_review.cjs','test_variants.cjs','test_sme_review.cjs','entity_review_cases.cjs']){
 const result=spawnSync(file.endsWith('.py')?'python3':process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
console.log('Highveld comprehensive regression passed; no database writes were performed.');
