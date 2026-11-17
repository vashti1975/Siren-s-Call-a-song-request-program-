"use client";
import {useAppearance} from "./appearance-provider";
import {useEffect,useRef,useState,type RefObject,type PointerEvent as ReactPointerEvent} from 'react';
import {Check,Move,Trash2,X} from 'lucide-react';
import {awardArtwork} from './listener-profile';
import {stickerAnchors,pagePlacement,stickerPagePosition,stickerBorderPosition,clampSticker,type StickerAnchor,type StickerPlacement} from '../lib/listener-stickers';
import type {ListenerProfileData} from '../lib/listener-rewards';

type Box={left:number;top:number;width:number;height:number};
type Geometry={width:number;height:number;gutter:number;mobile:boolean;boxes:Partial<Record<StickerAnchor,Box>>};
type Drag={id:string;pointerId:number;startX:number;startY:number;clientX:number;clientY:number;grabX:number;grabY:number;moved:boolean};
type Props={data:ListenerProfileData|null;pageRef:RefObject<HTMLElement|null>;request:{id:string|null;serial:number}|null;busy:boolean;onAction:(action:Record<string,unknown>)=>Promise<boolean>};
export default function ListenerPageStickers({data,pageRef,request,busy,onAction}:Props){
 const [editing,setEditing]=useState(false),[selected,setSelected]=useState<string|null>(null),[draft,setDraft]=useState<StickerPlacement[]>([]),[error,setError]=useState('');
 const [geometry,setGeometry]=useState<Geometry>({width:0,height:0,gutter:100,mobile:false,boxes:{}});
 const [preview,setPreview]=useState<{id:string;left:number;top:number}|null>(null);
 const drag=useRef<Drag|null>(null),frame=useRef<number|null>(null),toolsRef=useRef<HTMLElement>(null),saving=useRef(false),ignoreClickUntil=useRef(0);
 const profile=data?.enabled?data.profile:undefined;
 const {appearance}=useAppearance();
 const placements=(editing?draft:profile?.placements||[]).filter(p=>p.id!=="music-notes"),awards=data?.awards||[];
 const title=(id:string)=>awards.find(a=>a.id===id)?.title||'Sticker';
 const size=()=>({width:geometry.mobile?40:86,height:geometry.mobile?76:146});
 function savedPosition(p:StickerPlacement){
  const s=size();
  if(p.anchor==='page')return stickerPagePosition(p,geometry.width,geometry.height,s.width,s.height);
  if(p.anchor==='border-left'||p.anchor==='border-right')return stickerBorderPosition(p,geometry.width,geometry.height,geometry.gutter,s.width,s.height);
  const box=geometry.boxes[p.anchor];
  const top=box?box.top+p.y*Math.max(0,box.height-s.height):p.y*Math.max(0,geometry.height-s.height);
  return stickerBorderPosition({...p,anchor:p.x<.5?'border-left':'border-right',y:clampSticker(top/Math.max(1,geometry.height-s.height))},geometry.width,geometry.height,geometry.gutter,s.width,s.height);
 }
 function toPage(p:StickerPlacement):StickerPlacement{
  if(p.anchor==='page')return p;
  const position=savedPosition(p),s=size();
  return pagePlacement(p.id,position.left,position.top,geometry.width,geometry.height,s.width,s.height);
 }
 function upsert(placement:StickerPlacement){
  // Keep the keyed element in the same DOM position throughout a drag so
  // pointer capture is never lost when there is more than one sticker.
  setDraft(previous=>previous.some(p=>p.id===placement.id)?previous.map(p=>p.id===placement.id?placement:p):[...previous,placement]);
 }
 useEffect(()=>{
  if(!request||!profile)return;
  if(!editing)setDraft(profile.placements.filter(p=>p.id!=="music-notes"));
  setEditing(true);setSelected(request.id);setError('');
 },[request?.serial]);
 useEffect(()=>{
  const page=pageRef.current;if(!page||!profile)return;
  const measure=()=>{
   const root=page.getBoundingClientRect(),boxes:Geometry['boxes']={};let bottom=0;
   page.querySelectorAll<HTMLElement>('[data-sticker-anchor]').forEach(element=>{const anchor=element.dataset.stickerAnchor as StickerAnchor;if(!stickerAnchors.includes(anchor))return;const b=element.getBoundingClientRect();boxes[anchor]={left:b.left-root.left,top:b.top-root.top,width:b.width,height:b.height};bottom=Math.max(bottom,b.bottom-root.top);});
   // Exclude the temporary space under the editor from saved coordinates.
   const next={width:root.width,height:bottom+30,gutter:parseFloat(getComputedStyle(page).paddingLeft),mobile:window.matchMedia('(max-width:700px)').matches,boxes};
   setGeometry(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(page);page.querySelectorAll('[data-sticker-anchor]').forEach(element=>observer.observe(element));
  window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[profile?.name,!!profile,editing,placements.length,pageRef]);
 useEffect(()=>{
  const page=pageRef.current;if(!page||!editing||!selected)return;
  const placeInOpenSpace=(event:MouseEvent)=>{
   const target=event.target as Element;
   if(busy||saving.current||Date.now()<ignoreClickUntil.current||target.closest('button,a,input,select,textarea,dialog,[data-sticker-tools],[data-sticker-anchor]'))return;
   const root=page.getBoundingClientRect(),s=size();
   upsert(pagePlacement(selected,event.clientX-root.left-s.width/2,event.clientY-root.top-s.height/2,geometry.width,geometry.height,s.width,s.height));
  };
  page.addEventListener('click',placeInOpenSpace,true);return()=>page.removeEventListener('click',placeInOpenSpace,true);
 },[editing,selected,geometry,busy]);
 function stopDrag(){
  drag.current=null;if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;setPreview(null);
 }
 useEffect(()=>{if(!editing)stopDrag();return()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);};},[editing]);
 function pointerPosition(current:Drag){
  const root=pageRef.current!.getBoundingClientRect(),s=size();
  return {left:Math.max(0,Math.min(geometry.width-s.width,current.clientX-root.left-current.grabX)),top:Math.max(0,Math.min(geometry.height-s.height,current.clientY-root.top-current.grabY))};
 }
 function animateDrag(){
  const current=drag.current;if(!current)return;
  if(current.moved&&pageRef.current){
   const bottom=toolsRef.current?.getBoundingClientRect().top??window.innerHeight;
   const edge=55,dy=current.clientY<edge?-Math.min(18,(edge-current.clientY)/3):current.clientY>bottom-edge?Math.min(18,(current.clientY-bottom+edge)/3):0;
   const scroll=document.scrollingElement;if(scroll&&dy)scroll.scrollTop+=dy;
   const position=pointerPosition(current);
   setPreview(previous=>previous?.id===current.id&&previous.left===position.left&&previous.top===position.top?previous:{id:current.id,...position});
  }
  frame.current=requestAnimationFrame(animateDrag);
 }
 function pointerDown(event:ReactPointerEvent<HTMLButtonElement>,id:string){
  if(busy||saving.current)return;event.preventDefault();
  const box=event.currentTarget.getBoundingClientRect();setSelected(id);
  drag.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,clientX:event.clientX,clientY:event.clientY,grabX:event.clientX-box.left,grabY:event.clientY-box.top,moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);frame.current=requestAnimationFrame(animateDrag);
 }
 function pointerMove(event:ReactPointerEvent<HTMLButtonElement>){
  const current=drag.current;if(!current||current.pointerId!==event.pointerId||busy)return;
  current.clientX=event.clientX;current.clientY=event.clientY;
  if(Math.hypot(event.clientX-current.startX,event.clientY-current.startY)>2)current.moved=true;
 }
 function pointerUp(event:ReactPointerEvent<HTMLButtonElement>){
  const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
  current.clientX=event.clientX;current.clientY=event.clientY;
  if(current.moved){ignoreClickUntil.current=Date.now()+200;const position=pointerPosition(current),s=size();upsert(pagePlacement(current.id,position.left,position.top,geometry.width,geometry.height,s.width,s.height));}
  stopDrag();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 }
 function placeBesideList(side:'left'|'right'){
  if(!selected||busy||saving.current||!pageRef.current)return;
  const root=pageRef.current.getBoundingClientRect(),s=size(),toolsTop=toolsRef.current?.getBoundingClientRect().top??window.innerHeight;
  const top=Math.max(100,toolsTop/2)-root.top-s.height/2,box=geometry.boxes.catalog,gap=geometry.mobile?6:16;
  const left=box?(side==='left'?box.left-s.width-gap:box.left+box.width+gap):(side==='left'?0:geometry.width-s.width);
  upsert(pagePlacement(selected,left,top,geometry.width,geometry.height,s.width,s.height));
 }
 async function save(){
  if(busy||saving.current)return;saving.current=true;setError('');
  try{if(await onAction({action:'stickers',placements:draft.map(toPage)})){setEditing(false);setSelected(null);}else setError('Your stickers could not be saved. Try again.');}finally{saving.current=false;}
 }
 if(!profile)return null;
 const available=awards;
 return <>
  <div className={`page-sticker-layer${editing?' is-editing':''}${editing||placements.length?' has-stickers':''}`} aria-label="Your private page stickers">
   {placements.map(saved=>{
    const p=toPage(saved),s=size(),award=awards.find(a=>a.id===p.id);if(!geometry.width||!award)return null;
    const position=preview?.id===p.id?preview:stickerPagePosition(p,geometry.width,geometry.height,s.width,s.height);
    const style={left:position.left,top:position.top,width:s.width,height:s.height};
    const art=<><img src={appearance.chibi} alt={award.title} draggable={false}/><small>{award.artwork?'Special reward':award.milestone===1?'1 request':`${award.milestone} requests`}</small></>;
    return editing?<button key={p.id} type="button" className={`page-sticker${selected===p.id?' is-selected':''}${preview?.id===p.id?' is-dragging':''}`} style={style} aria-label={`Move ${title(p.id)} sticker`} aria-pressed={selected===p.id} disabled={busy} onPointerDown={event=>pointerDown(event,p.id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={stopDrag} onLostPointerCapture={()=>{if(drag.current)stopDrag();}} onClick={()=>setSelected(p.id)} onKeyDown={event=>{
     if(busy)return;
     if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();setDraft(previous=>previous.filter(s=>s.id!==p.id));return;}
     if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();upsert({...p,x:clampSticker(p.x+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?30:8)/Math.max(1,geometry.width-s.width))});}
     if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();upsert({...p,y:clampSticker(p.y+(event.key==='ArrowUp'?-1:1)*(event.shiftKey?30:8)/Math.max(1,geometry.height-s.height))});}
    }}>{art}</button>:<div key={p.id} className="page-sticker" style={style}>{art}</div>;
   })}
  </div>
  {editing&&<aside ref={toolsRef} className="sticker-placement-tools" data-sticker-tools aria-label="Place my page stickers">
   <div className="sticker-tools-heading"><div><strong><Move size={15}/> Place stickers · just for you</strong><p>{selected?`Drag “${title(selected)}” beside any box, or tap an open space. It stays exactly where you drop it.`:'Choose a sticker, then tap an open space beside a box or drag it into place.'}</p></div><button type="button" aria-label="Cancel sticker placement" disabled={busy} onClick={()=>{setEditing(false);setSelected(null);}}><X size={20}/></button></div>
   <div className="sticker-picker">{available.length?available.map(a=><button type="button" key={a.id} disabled={busy} aria-label={`Choose ${a.title} sticker`} aria-pressed={selected===a.id} onClick={()=>setSelected(a.id)}><img src={appearance.chibi} alt=""/><span>{a.title}</span></button>):<p>Request a song to earn your first sticker.</p>}</div>
   <div className="sticker-tools-actions">{selected&&<div className="sticker-side-buttons"><button type="button" className="profile-secondary" disabled={busy} onClick={()=>placeBesideList('left')}>Beside list · left</button><button type="button" className="profile-secondary" disabled={busy} onClick={()=>placeBesideList('right')}>Beside list · right</button></div>}<small>Arrow keys fine tune · Shift moves farther</small>{selected&&draft.some(p=>p.id===selected)&&<button type="button" className="profile-secondary" disabled={busy} onClick={()=>setDraft(previous=>previous.filter(p=>p.id!==selected))}><Trash2 size={14}/> Remove</button>}<button type="button" className="profile-secondary" disabled={busy} onClick={()=>{setEditing(false);setSelected(null);}}>Cancel</button><button type="button" className="profile-primary" disabled={busy} onClick={save}><Check size={15}/>{busy?'Saving…':'Save stickers'}</button></div>
   {error&&<p role="alert">{error}</p>}
  </aside>}
 </>;
}
