"use client";
import {useRef,useState} from "react";
import {Check,ChevronDown,Gift} from "lucide-react";
import Modal from "./modal";
import {useAppearance} from "./appearance-provider";
import {FancyMusicNote} from "./listener-profile";
import {specialRewards,type SpecialReward} from "../lib/special-rewards";
import type {ListenerProfileData} from "../lib/listener-rewards";

type Props={data:ListenerProfileData|null;busy:boolean;onAction:(action:Record<string,unknown>)=>Promise<boolean>;onPlaceSticker:(id:string|null)=>void};
export default function SpecialRewards({data,busy,onAction,onPlaceSticker}:Props){
 const {appearance}=useAppearance();
 const [category,setCategory]=useState("All"),[selected,setSelected]=useState<SpecialReward|null>(null),[confirm,setConfirm]=useState(false),[working,setWorking]=useState(false),[message,setMessage]=useState("");
 const sending=useRef(false);
 const owned=new Set(data?.ownedSpecialRewards||[]),balance=data?.enabled?data.noteCount:0;
 function close(){if(sending.current)return;setSelected(null);setConfirm(false);}
 async function redeem(){
  if(!selected||sending.current||busy)return;
  sending.current=true;setWorking(true);setMessage("");
  try{if(await onAction({action:"redeem",rewardId:selected.id})){setConfirm(false);setMessage(`${selected.title} is yours! Place it anywhere on your page.`);}else setMessage("The exchange could not be completed. Your balance may have changed. Close the preview and try again.");}
  finally{sending.current=false;setWorking(false);}
 }
 return <details className="special-rewards" data-sticker-anchor="rewards">
  <summary><Gift size={17} aria-hidden="true"/><span><strong>Special rewards</strong><small>FFXIV chibis · preview collection</small></span><span className="special-rewards-count">{owned.size}/{specialRewards.length}</span><ChevronDown className="special-rewards-chevron" size={16} aria-hidden="true"/></summary>
  <div className="special-rewards-content">
   <div className="special-rewards-balance"><span>Your music notes</span><strong><FancyMusicNote/> × {balance}</strong></div>
   <p>One note for each of your requests played. Exchange notes for a chibi, then place it on your page.</p>
   <div className="special-rewards-categories" aria-label="Special reward categories">{["All","Chibis"].map(value=><button type="button" key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</button>)}</div>
   <div className="special-rewards-grid">{specialRewards.filter(reward=>category==="All"||reward.category===category).map(reward=><button type="button" className="special-reward-card" key={reward.id} aria-label={`Preview ${reward.title}, ${owned.has(reward.id)?"collected":`${reward.cost} music notes`}`} onClick={()=>{setSelected(reward);setConfirm(false);setMessage("");}}><img src={appearance.chibi} alt="" loading="lazy"/><strong>{reward.title}</strong><span>{owned.has(reward.id)?<><Check size={12}/> Collected</>:<>♫ {reward.cost} notes</>}</span></button>)}</div>
   {!data?.enabled&&<p className="special-rewards-help">Create your optional listener profile above to earn notes and collect rewards.</p>}
  </div>
  {selected&&<Modal label="special-reward-title" onClose={close}><div className="special-reward-detail"><span className="profile-eyebrow">{selected.category} · SPECIAL CHIBI</span><h2 id="special-reward-title">{selected.title}</h2><img className="special-reward-image" src={appearance.chibi} alt={`${selected.title} collectible chibi`}/><p>{selected.description}</p>
   {owned.has(selected.id)?<><p className="special-reward-owned"><Check size={16}/> In your collection</p>{message&&<p role="status">{message}</p>}<div className="editor-actions"><button disabled={working||busy} onClick={close}>Close preview</button><button className="primary-button" disabled={working||busy} onClick={()=>{setSelected(null);onPlaceSticker(selected.id);}}>Place on my page</button></div></>:<>
    <p className="special-reward-cost"><FancyMusicNote/><strong>{selected.cost} music notes</strong><span>Your balance: {balance}</span></p>
    {message&&<p role="alert">{message}</p>}
    {confirm?<div className="special-reward-confirm"><strong>Exchange {selected.cost} music notes for this chibi?</strong><p>Your balance will be {Math.max(0,balance-selected.cost)} notes. This unlocks the sticker permanently for your page.</p><div className="editor-actions"><button disabled={working||busy} onClick={()=>setConfirm(false)}>Cancel</button><button className="primary-button" disabled={working||busy||balance<selected.cost} onClick={redeem}>{working?"Exchanging…":`Yes, use ${selected.cost} notes`}</button></div></div>:<><p className="special-rewards-help">{!data?.enabled?"Create your listener profile to start collecting.":balance<selected.cost?`${selected.cost-balance} more ${selected.cost-balance===1?"note":"notes"} to unlock this chibi.`:"Yours to keep after one exchange."}</p><div className="editor-actions"><button onClick={close}>Close preview</button><button className="primary-button" disabled={!data?.enabled||busy||balance<selected.cost} onClick={()=>setConfirm(true)}>Exchange {selected.cost} notes</button></div></>}
   </>}
  </div></Modal>}
 </details>;
}
