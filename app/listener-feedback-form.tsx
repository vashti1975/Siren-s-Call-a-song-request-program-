"use client";
import { useRef,useState } from "react";
export default function ListenerFeedbackForm({embedded=false}:{embedded?:boolean}) {
 const [name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(false);
 const requestId=useRef("");
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!message.trim())return;
  setBusy(true);setError("");setSent(false);
  if(!requestId.current)requestId.current=crypto.randomUUID();
  try{
   const response=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:requestId.current,name:name.trim(),message:message.trim(),embedded})});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||"Couldn’t send your feedback. Please try again.");
   setMessage("");setName("");requestId.current="";setSent(true);
  }catch(e){setError(e instanceof Error?e.message:"Unable to send feedback.");}finally{setBusy(false);}
 }
 return <section className="listener-feedback" aria-labelledby="feedback-title">
  <h2 id="feedback-title">Feedback & ideas</h2>
  <p id="feedback-privacy" className="feedback-privacy">Share what you like or suggest an update. Only Songbook can read your comments.</p>
  <form onSubmit={submit}>
   <label htmlFor="feedback-name">Ingame name (optional)<input id="feedback-name" name="name" value={name} maxLength={80} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="Leave blank to stay anonymous" autoComplete="off"/></label>
   <label htmlFor="feedback-message">Your comment<textarea id="feedback-message" name="message" value={message} maxLength={1000} rows={2} required disabled={busy} onChange={e=>{setMessage(e.target.value);setSent(false);}} placeholder="Share what you enjoy or suggest an improvement…" aria-describedby="feedback-privacy feedback-limit"/></label>
   <div className="feedback-form-actions"><small id="feedback-limit">{message.length.toLocaleString()} / 1,000 characters</small><button className="primary-button" type="submit" disabled={busy||!message.trim()}>{busy?"Sending…":"Send feedback"}</button></div>
   {error&&<p className="feedback" role="alert">{error}</p>}
   {sent&&<p className="success-message" role="status">Thank you! Your feedback was sent privately to Songbook.</p>}
  </form>
 </section>;
}
