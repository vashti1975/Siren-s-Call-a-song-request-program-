"use client";
import {useEffect,useRef,useState} from "react";
import {createRequestRefresh} from "../lib/request-refresh";
import type {ListenerFeedback} from "../lib/feedback";
export default function OwnerFeedback(){
 const [comments,setComments]=useState<ListenerFeedback[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false),[lastArchived,setLastArchived]=useState<ListenerFeedback|null>(null);
 const refresh=useRef(createRequestRefresh()).current,writing=useRef(false);
 async function load(){if(writing.current)return;await refresh.run(async signal=>{const r=await fetch("/api/feedback",{cache:"no-store",signal});if(!r.ok)throw new Error("Couldn’t load listener feedback.");return await r.json() as {comments:ListenerFeedback[]};},data=>{setComments(data.comments);setLoaded(true);setError("");},e=>setError(e instanceof Error?e.message:"Unable to load feedback."));}
 useEffect(()=>{void load();const resume=()=>{if(document.visibilityState!=="hidden")void load();};const timer=setInterval(resume,5000);window.addEventListener("focus",resume);return()=>{clearInterval(timer);window.removeEventListener("focus",resume);refresh.invalidate();};},[]);
 async function archive(comment:ListenerFeedback,undo=false){
  if(writing.current)return;writing.current=true;refresh.invalidate();setBusy(true);setError("");
  try{const r=await fetch("/api/feedback",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:comment.id,undo})});if(!r.ok)throw new Error("Couldn’t update this comment. Please try again.");setLastArchived(undo?null:comment);setComments(previous=>undo?[...previous,comment].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id)):previous.filter(c=>c.id!==comment.id));}
  catch(e){setError(e instanceof Error?e.message:"Unable to update feedback.");}finally{writing.current=false;setBusy(false);void load();}
 }
 return <section className="request-queue owner-feedback" aria-labelledby="owner-feedback-title">
  <div className="queue-heading"><div><h2 id="owner-feedback-title">Listener comments <span>{comments.length}</span></h2><p>Private feedback & update ideas · only you can read these</p></div><button className="edit-button" disabled={busy} onClick={load}>Refresh comments</button></div>
  {error&&<p className="feedback" role="alert">{error}</p>}
  {lastArchived&&<div className="queue-undo" role="status">Comment cleared. <button disabled={busy} onClick={()=>archive(lastArchived,true)}>Undo</button></div>}
  {comments.length?<ol className="owner-feedback-list">{comments.map(comment=><li key={comment.id}><div><strong>{comment.name||"Anonymous listener"}</strong><time dateTime={new Date(comment.createdAt).toISOString()}>{new Date(comment.createdAt).toLocaleString()}</time><p>{comment.message}</p></div><button className="edit-button" disabled={busy} onClick={()=>archive(comment)}>Read · clear</button></li>)}</ol>:<p className="queue-empty">{loaded?"No comments waiting. New feedback appears here automatically.":"Loading listener comments…"}</p>}
 </section>;
}
