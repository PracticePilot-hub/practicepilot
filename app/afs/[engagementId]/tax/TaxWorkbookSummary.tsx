import {calculateTax,taxWorkbookIssues} from './taxWorkpaper';
import {taxComputationRows} from './taxComputationRows';
const money=(n:number)=>!n?'–':n<0?'('+Math.abs(n).toLocaleString('en-ZA')+')':n.toLocaleString('en-ZA');
export default function TaxWorkbookSummary({saved,lines,consolidated=false}:{saved:any;lines:any[];consolidated?:boolean}){
 let result;try{result=calculateTax(saved.worksheet,lines,consolidated);}catch(error){return <p>Tax workpaper requires correction: {String((error as Error).message)}</p>;}
 const issues=taxWorkbookIssues(saved,lines,consolidated);
 return <div data-tax-workpaper-summary="v2" style={{fontSize:10,lineHeight:1.3}}><table style={{width:'100%',borderCollapse:'collapse'}}><tbody>{taxComputationRows(result,lines).map((row,index)=>row.section?<tr key={index}><td colSpan={2} style={{padding:'15px 0 6px',fontWeight:700}}>{row.label}</td></tr>:<tr key={index}><td style={{padding:'4px 0',fontWeight:row.total?700:400}}>{row.label}</td><td style={{textAlign:'right',padding:'4px 0',width:110,fontWeight:row.total?700:400,borderTop:row.total?'1px solid #111827':undefined}}>{money(row.amount||0)}</td></tr>)}</tbody></table><p style={{fontSize:9,marginTop:15,color:'#475569'}}>{issues.length?'Draft computation: supporting workings or review remain outstanding.':'The computation agrees to the mapped tax balances.'}</p></div>;
}
