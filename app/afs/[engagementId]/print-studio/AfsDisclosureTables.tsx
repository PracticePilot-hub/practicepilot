"use client";
import { disclosureCell, type DisclosureTable } from './disclosureTableData';
/** Same semantic tables in Notes AFS, Work and the PDF; the existing paginator repeats headers. */
export default function AfsDisclosureTables({tables=[],edit=false,onChange}:{tables?:DisclosureTable[];edit?:boolean;onChange?:(tables:DisclosureTable[])=>void}){
 const change=(index:number,next:DisclosureTable)=>onChange?.(tables.map((t,i)=>i===index?next:t));
 return <>{tables.map((t,i)=><div key={i} style={{margin:'10px 0 14px'}}>
  {edit?<label>Table title <input aria-label={`Disclosure table ${i+1} title`} value={t.title} onChange={e=>change(i,{...t,title:e.target.value})}/></label>:<h3 style={{fontSize:'inherit',margin:'6px 0',breakAfter:'avoid'}}>{t.title}</h3>}
  {t.reference&&<p style={{fontSize:10,margin:'2px 0 5px'}}>{t.reference}</p>}
  {edit&&<div><button type="button" onClick={()=>change(i,{...t,rows:[...t.rows,{label:"New row",cells:t.columns.map(()=>0)}]})}>Add row</button> <button type="button" onClick={()=>onChange?.(tables.filter((_,n)=>n!==i))}>Remove table</button></div>}
  <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed',fontSize:'inherit'}}><thead><tr><th style={{width:'42%',textAlign:'left',padding:'4px 3px',borderBottom:'1px solid #64748b'}}>Description</th>{t.columns.map((c,j)=><th key={j} style={{textAlign:'right',padding:'4px 3px',borderBottom:'1px solid #64748b'}}>{edit?<input aria-label={`${t.title} column ${j+1}`} style={{width:"94%"}} value={c} onChange={e=>change(i,{...t,columns:t.columns.map((v,n)=>n===j?e.target.value:v)})}/>:c}</th>)}</tr></thead>
   <tbody>{t.rows.map((r,k)=><tr key={k} style={{fontWeight:r.total?700:400,breakInside:'avoid'}}><td style={{padding:'4px 3px'}}>{edit?<input aria-label={`${t.title} row ${k+1}`} style={{width:'95%'}} value={r.label} onChange={e=>change(i,{...t,rows:t.rows.map((v,n)=>n===k?{...v,label:e.target.value}:v)})}/>:r.label}</td>{t.columns.map((_,j)=><td key={j} style={{textAlign:'right',padding:'4px 3px',borderTop:r.total?'1px solid #64748b':undefined}}>{edit?<input aria-label={`${t.title}: ${r.label}, ${t.columns[j]}`} inputMode={typeof r.cells[j]==='number'?'decimal':undefined} style={{width:'94%',textAlign:'right'}} value={r.cells[j]??''} onChange={e=>{const raw=e.target.value;const next=(typeof r.cells[j]==='number'||r.cells[j]===null)?(raw.trim()===''?null:Number(raw)):raw;change(i,{...t,rows:t.rows.map((v,n)=>n===k?{...v,cells:v.cells.map((c,p)=>p===j?next:c)}:v)})}}/>:disclosureCell(r.cells[j])}</td>)}</tr>)}</tbody></table>
 </div>)}</>;
}
