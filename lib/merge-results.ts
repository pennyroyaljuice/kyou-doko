import type {SearchResult} from './domain';
export function mergeResults(previous:SearchResult,next:SearchResult):SearchResult {
 const seen=new Set(previous.destinations.map(d=>d.id));const added=next.destinations.filter(d=>{if(seen.has(d.id))return false;seen.add(d.id);return true;});
 return {...previous,input:{...previous.input,explorationPage:next.input.explorationPage},destinations:[...previous.destinations,...added],ratingsAvailable:previous.ratingsAvailable||next.ratingsAvailable,notices:next.notices};
}
