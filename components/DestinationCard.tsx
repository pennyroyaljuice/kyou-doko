'use client';
import { useEffect,useRef,useState } from 'react';
import { ArrowUpRight,Check,Clock3,Leaf,Mountain,Route,Waves } from 'lucide-react';
import type { Destination } from '@/lib/domain';
export default function DestinationCard({destination:d,index,selected,onSelect,roundTrip}:{destination:Destination;index:number;selected:boolean;onSelect:(id:string)=>void;roundTrip:boolean}){
 const holder=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!d.photo||!holder.current)return;
  if(!('IntersectionObserver' in window))return; // Save API calls on unsupported clients.
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'0px',threshold:0.01});
  observer.observe(holder.current);return()=>observer.disconnect();
 },[d.photo]);
 return <div className="destination-item" ref={holder} data-photo-state={!d.photo?'none':failed?'failed':loaded?'loaded':visible?'loading':'waiting'}><button className={`destination-card ${selected?'selected':''}`} onClick={()=>onSelect(d.id)} aria-pressed={selected}>
  <span className={`spot-art art-${index%3}`}>
   <span aria-hidden="true">{d.category.includes('海')?<Waves size={34}/>:d.category.includes('渓')?<Mountain size={34}/>:<Leaf size={34}/>}</span>
   {visible&&d.photo&&!failed&&<img className="spot-photo" src={'/admin/api/photo?ticket='+encodeURIComponent(d.photo.ticket)} alt={d.name+'の参考写真'} width="240" height="180" loading="lazy" decoding="async" referrerPolicy="same-origin" onLoad={()=>setLoaded(true)} onError={()=>{setFailed(true);setLoaded(false);}}/>}
   <span className="spot-number">{String(index+1).padStart(2,'0')}</span>
  </span>
  <span className="spot-info"><span className="spot-category">{d.category}</span><strong>{d.name}</strong><span className="spot-description">{d.description}</span><span className="spot-stats"><span><Clock3 size={14}/>{Math.ceil(d.seconds/60)}分</span><span><Route size={14}/>{(d.meters/1000).toFixed(1)} km</span><span className="trip-tag">{roundTrip?'往復':'片道'}</span></span></span><span className="selected-indicator">{selected?<Check size={16}/>:<ArrowUpRight size={17}/>}</span>
 </button>{loaded&&d.photo&&<div className="photo-credit">写真：Google Maps{d.photo.authors.map((a,i)=><span key={i}> · {a.uri&&/^https:\/\//.test(a.uri)?<a href={a.uri} target="_blank" rel="noopener noreferrer">{a.name}</a>:a.name}</span>)}</div>}</div>;
}
