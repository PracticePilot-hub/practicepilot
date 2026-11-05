"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import AfsA4Page from "./AfsA4Page";

type Header={clientName?:string;registrationNumber?:string|null;yearEndLabel?:string;showReportHeader?:boolean};
type Unit={html?:string;heading?:boolean;table?:{key:number;open:string;head:string;row:string}};
function markup(units:Unit[]){
 let out="";
 for(let i=0;i<units.length;i++){
  const unit=units[i];if(!unit.table){out+=unit.html||"";continue;}
  const table=unit.table;let rows=table.row;
  while(units[i+1]?.table?.key===table.key)rows+=units[++i].table!.row;
  out+=table.open+table.head+"<tbody>"+rows+"</tbody></table>";
 }
 return out;
}
/** Split at paragraph and table-row boundaries, including notes taller than A4. */
export default function AfsPaginatedNotes({children,signature,header,onPageCount}:{children:ReactNode;signature:string;header:Header;onPageCount:(count:number)=>void}){
 const source=useRef<HTMLDivElement>(null),probe=useRef<HTMLDivElement>(null);
 const [result,setResult]=useState<{signature:string;pages:string[];complete:boolean}>({signature:"",pages:[],complete:false});
 useEffect(()=>{
  let cancelled=false;
  const paginate=async()=>{
   await document.fonts.ready;if(cancelled||!source.current||!probe.current)return;
   const root=source.current.querySelector<HTMLElement>('[data-afs-notes-root="true"]');
   const test=probe.current.querySelector<HTMLElement>('[data-note-probe-body]');
   const content=probe.current.querySelector<HTMLElement>('[data-afs-a4-content="true"]');
   if(!root||!test||!content)return;
   const css=getComputedStyle(content),capacity=content.getBoundingClientRect().bottom-parseFloat(css.paddingBottom)-test.getBoundingClientRect().top-24;
   if(capacity<400)return;
   const pages:string[]=[];let current:Unit[]=[];let tableKey=0;
   const fits=(units:Unit[])=>{test.innerHTML=markup(units);return test.getBoundingClientRect().height<=capacity;};
   const flush=()=>{if(current.length){pages.push(markup(current));current=[];}};
   for(const note of Array.from(root.children).filter(node=>node.tagName!=="STYLE"&&node.tagName!=="H1")){
    const units:Unit[]=[];const title=note.querySelector('h2')?.cloneNode(true) as HTMLElement|null;
    const walk=(element:Element)=>{
     if(element.matches('button,input,textarea,select,style,[data-work-only="true"],.afs-screen-only'))return;
     if(getComputedStyle(element).display==='none')return;
     if(element.tagName==='TABLE'){
      const table=element as HTMLTableElement,key=++tableKey,shell=table.cloneNode(false) as HTMLTableElement;
      const open=shell.outerHTML.replace(/<\/table>$/,'');
      const head=Array.from(table.children).filter(node=>['COLGROUP','THEAD'].includes(node.tagName)).map(node=>node.outerHTML).join('');
      const rows=Array.from(table.querySelectorAll(':scope > tbody > tr,:scope > tfoot > tr'));
      for(const row of rows)if(getComputedStyle(row).display!=='none')units.push({table:{key,open,head,row:row.outerHTML}});
      return;
     }
     if(['P','H2','H3','H4','UL','OL'].includes(element.tagName)||!Array.from(element.children).some(child=>['DIV','SECTION','TABLE','P','H2','H3','H4'].includes(child.tagName))){
      const clone=element.cloneNode(true) as HTMLElement;if(element===note.querySelector('h2'))clone.setAttribute('data-note-start','true');clone.querySelectorAll('button,input,textarea,select,[data-work-only="true"],.afs-screen-only').forEach(node=>node.remove());
      if(clone.textContent?.trim()||clone.querySelector('img'))units.push({html:clone.outerHTML,heading:/^H[234]$/.test(element.tagName)});return;
     }
     for(const child of Array.from(element.children))walk(child);
    };
    walk(note);
    const continuation=()=>{if(title){const clone=title.cloneNode(true) as HTMLElement;clone.textContent=(clone.textContent||'')+' — continued';clone.setAttribute('data-note-start','true');return {html:clone.outerHTML,heading:true};}return null;};
    for(let i=0;i<units.length;i++){
     const unit=units[i];const next=units[i+1];const finalTablePair=unit.table&&next?.table?.key===unit.table.key&&units[i+2]?.table?.key!==unit.table.key;
     const candidate=(unit.heading||finalTablePair)&&next?[...current,unit,units[i+1]]:[...current,unit];
     if(current.length&&!fits(candidate)){
      // A two-row table can move as a pair after its heading fitted alone.
      // Carry that heading forward instead of leaving an orphan at the foot.
      const headings:Unit[]=[];
      while(current[current.length-1]?.heading)headings.unshift(current.pop()!);
      flush();
      if(headings.length)current.push(...headings);
      else{const heading=continuation();if(heading&&i>0)current.push(heading);}
     }
     current.push(unit);
     if(!fits(current))throw new Error('A note paragraph or table row is taller than a page; shorten or split that content before export.');
    }
   }
   flush();if(cancelled)return;test.innerHTML='';setResult({signature,pages,complete:true});onPageCount(pages.length);
  };
  void paginate().catch(error=>{console.error('Note pagination failed',error);if(!cancelled)setResult({signature,pages:[],complete:false});});
  return()=>{cancelled=true;};
 },[signature,onPageCount]);
 const ready=result.signature===signature&&result.complete;
 return <div data-afs-note-pages="true" data-afs-notes-pagination-ready={ready?'true':'false'} style={{display:'grid',gap:16,justifyItems:'center'}}>
  <style>{`[data-note-measure]{position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;}[data-note-source] [data-afs-a4-page],[data-note-source] [data-afs-a4-content]{height:auto!important;max-height:none!important;overflow:visible!important;}[data-note-measure] [data-afs-a4-page]{counter-increment:none!important;}[data-note-probe-body],[data-note-page-body]{display:flow-root;}[data-note-probe-body]>[data-note-start],[data-note-page-body]>[data-note-start]{margin-top:26px!important;margin-bottom:10px!important;}[data-note-probe-body]>[data-note-start]:first-child,[data-note-page-body]>[data-note-start]:first-child{margin-top:6px!important;}[data-note-probe-body],[data-note-page-body]{font-size:10.45px!important;line-height:1.34!important;}[data-note-probe-body] table,[data-note-page-body] table{table-layout:fixed!important;width:100%!important;max-width:100%!important;border-collapse:separate!important;border-spacing:0!important;}[data-note-probe-body] th:first-child,[data-note-probe-body] td:first-child,[data-note-page-body] th:first-child,[data-note-page-body] td:first-child{width:auto!important;}[data-note-probe-body] th:not(:first-child),[data-note-probe-body] td:not(:first-child),[data-note-page-body] th:not(:first-child),[data-note-page-body] td:not(:first-child){width:68px!important;}@media print{[data-afs-note-pages]{display:block!important;gap:0!important;}[data-note-measure]{display:none!important;}}`}</style>
  <div data-note-measure="true" data-note-source="true" ref={source}><AfsA4Page {...header}>{children}</AfsA4Page></div>
  <div data-note-measure="true" ref={probe}><AfsA4Page {...header}><h1>Notes to the Financial Statements — continued</h1><div data-afs-notes-root="true" data-note-probe-body="true"/></AfsA4Page></div>
  {ready?result.pages.map((html,index)=><AfsA4Page key={index} {...header}><h1>Notes to the Financial Statements{index?' — continued':''}</h1><div data-afs-notes-root="true" data-note-page-body="true" dangerouslySetInnerHTML={{__html:html}}/></AfsA4Page>):<p>Preparing complete note pages…</p>}
 </div>;
}
