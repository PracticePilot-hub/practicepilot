export type NotePageUnit = {html?:string;heading?:boolean;table?:{key:number;open:string;head:string;row:string}};
/** Measure a complete heading chain with its first content, not just the next heading. */
export function notePageCandidate(current:NotePageUnit[],units:NotePageUnit[],index:number):NotePageUnit[]{
 const candidate=[...current,units[index]];
 let next=index+1;
 if(units[index].heading){
  while(units[next]?.heading)candidate.push(units[next++]);
  if(units[next])candidate.push(units[next++]);
 }
 const table=units[next-1]?.table;
 if(table&&units[next]?.table?.key===table.key&&units[next+1]?.table?.key!==table.key)candidate.push(units[next]);
 return candidate;
}
