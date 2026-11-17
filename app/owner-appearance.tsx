"use client";
import {useEffect,useRef,useState} from "react";
import {Palette} from "lucide-react";
import {defaultAppearance,type Appearance} from "../lib/appearance";
import {useAppearance} from "./appearance-provider";
export default function OwnerAppearance(){
  const {appearance,apply}=useAppearance();
  const [draft,setDraft]=useState(appearance),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const dirty=useRef(false);
  useEffect(()=>{if(!dirty.current)setDraft(appearance);},[appearance]);
  function field<K extends keyof Appearance>(key:K,value:Appearance[K]){dirty.current=true;setDraft(previous=>({...previous,[key]:value}));setNotice('');}
  async function upload(key:'logo'|'backgroundImage'|'chibi',file:File|undefined){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>300*1024){setError('Choose a PNG, JPEG, WebP or GIF under 300 KB. Larger images can use an HTTPS URL.');return;}
    try{const value=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read image.'));reader.readAsDataURL(file);});field(key,value);setError('');}catch{setError('Could not read that image.');}
  }
  async function save(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{const response=await fetch('/api/appearance',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});const data=await response.json() as Appearance&{error?:string};if(!response.ok)throw new Error(data.error||'Could not save appearance.');dirty.current=false;apply(data);setNotice('Appearance saved. Open listener pages refresh within 30 seconds.');}catch(cause){setError(cause instanceof Error?cause.message:'Could not save appearance.');}finally{setBusy(false);}}
  return <details className="owner-location appearance-editor"><summary><Palette size={16}/><strong>Appearance</strong><span>Title, colors, background, logo & chibi</span></summary><form className="location-editor" onSubmit={save}><fieldset disabled={busy}>
    <div className="appearance-text-fields"><label>Songbook title<input required maxLength={60} value={draft.title} onChange={e=>field('title',e.target.value)}/></label><label>Subtitle<input maxLength={120} value={draft.subtitle} onChange={e=>field('subtitle',e.target.value)}/></label></div>
    <div className="appearance-colors">{(['accent','background','panel','text'] as const).map(key=><label key={key}>{key.charAt(0).toUpperCase()+key.slice(1)}<input aria-label={`${key} color`} type="color" value={draft[key]} onChange={e=>field(key,e.target.value)}/></label>)}</div>
    <div className="appearance-images">{([{key:'logo',label:'Logo (optional)'},{key:'backgroundImage',label:'Background image (optional)'},{key:'chibi',label:'Default reward chibi'}] as const).map(({key,label})=><div key={key} className="appearance-image-field"><label>{label}<input aria-label={`${label} URL`} value={draft[key].startsWith('data:')?'':draft[key]} placeholder={draft[key].startsWith('data:')?'Uploaded image ready':'/asset.png or https://…'} maxLength={2000} onChange={e=>field(key,e.target.value)}/></label><label className="appearance-upload">Upload image<input aria-label={`Upload ${label}`} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>void upload(key,e.target.files?.[0])}/></label>{draft[key]&&<img src={draft[key]} alt={`${label} preview`} width={64} height={64}/>}<button type="button" onClick={()=>field(key,key==='chibi'?defaultAppearance.chibi:'')}>Use default</button></div>)}</div>
    <label className="appearance-motion"><input type="checkbox" checked={draft.animatedBackground} onChange={e=>field('animatedBackground',e.target.checked)}/> Enable animated music background</label>
    <p className="location-help">Uploads: PNG, JPEG, WebP or GIF up to 300 KB each. These images are visible to listeners after saving. Changing the chibi updates milestone awards and default reward stickers.</p>
    <div className="location-actions"><button type="submit" className="location-publish">{busy?'Saving…':'Save appearance'}</button><button type="button" onClick={()=>{dirty.current=true;setDraft(defaultAppearance);setNotice('Defaults selected. Save to apply.');}}>Reset draft to defaults</button></div>
  </fieldset>{error&&<p className="location-error" role="alert">{error}</p>}{notice&&<p className="location-notice" role="status">{notice}</p>}</form></details>;
}
