"use client";
import {useState} from 'react';
import {midiDuration} from '../lib/midi-duration';
export default function SongTimings({known,total,onChange}:{known:number;total:number;onChange:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[issues,setIssues]=useState<string[]>([]);
 async function importFiles(files:FileList|null){if(!files?.length||busy)return;setBusy(true);setMessage('Reading MIDI lengths…');setIssues([]);const valid:{file:string;seconds:number}[]=[],skipped:string[]=[];let matched=0;
  try{for(const file of Array.from(files)){try{if(file.size>32*1024*1024)throw new Error('File is too large.');valid.push({file:file.name,seconds:midiDuration(await file.arrayBuffer())});}catch(e){skipped.push(`${file.name}: ${e instanceof Error?e.message:'Could not read.'}`);}}
   for(let i=0;i<valid.length;i+=50){const r=await fetch('/api/durations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:valid.slice(i,i+50)})});const data=await r.json() as {error?:string;matched:number;unmatched:string[];conflicts:string[]};if(!r.ok)throw new Error(data.error||'Could not save lengths.');matched+=data.matched;skipped.push(...data.unmatched.map(n=>`${n}: no clear song match; set its length with Edit.`),...data.conflicts.map(n=>`${n}: multiple versions; the longest length was kept.`));}
   setMessage(`${matched} song lengths loaded. ${skipped.length?`${skipped.length} files need review.`:'Ready to use.'}`);
  }catch(e){setMessage(e instanceof Error?e.message:'Could not import lengths.');}finally{setIssues(skipped);setBusy(false);onChange();}
 }
 return <details className="song-timings"><summary>Song lengths · {known} / {total} ready</summary><p>Load the MIDI arrangements you play, or enter a length in each song’s Edit window. MIDI files stay on your device; only names and lengths are saved.</p><label className="edit-button timing-file-button">{busy?'Loading…':'Load MIDI lengths'}<input type="file" accept=".mid,.midi" multiple disabled={busy} onChange={e=>{void importFiles(e.target.files);e.target.value='';}}/></label>{message&&<p role="status">{message}</p>}{!!issues.length&&<ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}</details>;
}
