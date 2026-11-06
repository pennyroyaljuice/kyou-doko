'use client';
import {useEffect,useId,useRef,useState} from 'react';

const rowHeight=44;
type Props={id:string;label:string;value:string;min:number;max:number;optional?:boolean;unit:string;onChange:(value:string)=>void};

export default function BudgetInput({id,label,value,min,max,optional=false,unit,onChange}:Props){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),wheel=useRef<HTMLDivElement>(null);
 const title=useId();
 const values=Array.from({length:Math.max(0,Math.floor(max/10)-Math.ceil(min/10)+1)},(_,i)=>String((Math.ceil(min/10)+i)*10));
 // Preserve a value entered on desktop until the user explicitly changes it.
 if(value!==''&&Number(value)>=min&&Number(value)<=max&&!values.includes(value))values.push(value);
 values.sort((a,b)=>Number(a)-Number(b));
 if(optional)values.unshift('');
 const text=(index:number)=>values[index]===''?'指定なし':`${values[index]} ${unit}`;
 useEffect(()=>{
  if(!open)return;
  const element=dialog.current,roller=wheel.current;
  if(!element||!roller)return;
  const index=Math.max(0,values.indexOf(value));
  setSelected(index);element.showModal();roller.scrollTop=index*rowHeight;roller.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{element.close();document.body.style.overflow=overflow;};
 // Values stay fixed while the picker is open; only confirmation updates the parent.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open]);
 const nearest=()=>Math.max(0,Math.min(values.length-1,Math.round((wheel.current?.scrollTop??0)/rowHeight)));
 const move=(index:number)=>{const next=Math.max(0,Math.min(values.length-1,index));setSelected(next);wheel.current?.scrollTo({top:next*rowHeight,behavior:'smooth'});};
 return <>
  <input className="budget-desktop-input" id={id} aria-label={label} type="number" min={min} max={max} step="any" value={value} placeholder={optional?'下限（目安）':'上限'} onChange={e=>onChange(e.target.value)} required={!optional}/>
  <button className={`budget-mobile-input${value===''?' is-empty':''}`} type="button" aria-label={`${label}：${value===''?'指定なし':value+unit}。選択する`} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{value===''?'下限（任意）':value}<span aria-hidden="true">⌄</span></button>
  {open&&<dialog className="budget-picker" ref={dialog} aria-labelledby={title} onCancel={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
   <div className="budget-picker-sheet"><div className="budget-picker-heading"><button type="button" onClick={()=>setOpen(false)}>キャンセル</button><h2 id={title}>{label.replace(/（.*）/,'')}</h2><button type="button" className="budget-picker-done" onClick={()=>{onChange(values[nearest()]??'');setOpen(false);}}>決定</button></div>
    <div className="budget-wheel-frame"><div className="budget-wheel-selection" aria-hidden="true"/><div ref={wheel} className="budget-wheel" role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={`${title}-${selected}`} onScroll={()=>setSelected(nearest())} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();move(selected+(e.key==='ArrowDown'?1:-1));}else if(e.key==='Home'||e.key==='End'){e.preventDefault();move(e.key==='Home'?0:values.length-1);}}}>{values.map((v,i)=><div key={v} id={`${title}-${i}`} role="option" aria-selected={i===selected} className={i===selected?'is-selected':''} onClick={()=>move(i)}>{text(i)}</div>)}</div></div>
   </div>
  </dialog>}
 </>;
}
