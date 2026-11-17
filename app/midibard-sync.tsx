'use client';
import {useEffect,useState} from 'react';
import type {Song} from '../lib/songs';
type State={connection:null|{paired:number;lastSeen:number|null;lastFile:string|null;lastMatch:string|null};unmatched:{id:string;file:string}[];matches:{fileKey:string;songId:string;file:string}[];matchedSongCount:number};
export default function MidiBardSync({songs,onChange}:{songs:Song[];onChange:()=>void}){
 const [choices,setChoices]=useState<Record<string,string>>({});
 const [state,setState]=useState<State|null>(null),[token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
 async function refresh(){try{const r=await fetch('/api/midibard/manage',{cache:'no-store'});if(!r.ok)throw Error('Could not load MidiBard connection.');setState(await r.json());}catch(e){setError(String(e));}}
 useEffect(()=>{refresh();const timer=setInterval(refresh,5000);return()=>clearInterval(timer);},[]);
 async function action(body:object){setBusy(true);setError('');try{const r=await fetch('/api/midibard/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json() as {error?:string;token?:string};if(!r.ok)throw Error(data.error||'Connection update failed');if(data.token){setToken(data.token);setCopied(false);}if('action' in body&&body.action==='disconnect')setToken('');await refresh();onChange();}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <details className="midibard-sync">
  <summary>♫ MidiBard Sync <span>{state?.connection?.lastSeen?'Connection received':state?.connection?.paired?'Waiting for companion':'Set up automatic played labels'}{state&&<> · {state.matchedSongCount} of {songs.length} songs matched · {state.matches?.length||0} saved filenames{state.unmatched.length>0&&<> · {state.unmatched.length} to match</>}</>}</span></summary>
  <div className="midibard-content" role="region" aria-label="MidiBard Sync controls" tabIndex={0}>
   <p><strong>Companion update · v1.1.0</strong> — <a href="/SongbookSync-source.zip" download>Download Songbook Sync source</a> for automatic /s song announcements and live Playing now labels. Build the source on Windows with .NET 10 and your Dalamud libraries; see the included setup guide.</p>
   {state?.connection?.lastSeen&&<p className="sync-last-contact">Last contact: {new Date(state.connection.lastSeen).toLocaleString()}.{state.connection.lastFile&&<><br/>Last detected: <strong>{state.connection.lastFile}</strong> — {state.connection.lastMatch?`matched to ${state.connection.lastMatch}`:'needs matching below'}.</>}</p>}
   {!!state?.unmatched.length?<section aria-labelledby="sync-match-title">
    <h4 id="sync-match-title">Match detected songs ({state.unmatched.length})</h4>
    <p>Choose the correct song once; the match is remembered for future shows.</p>
    {state.unmatched.map(e=><div className="sync-match" key={e.id}>
     <label htmlFor={'match-'+e.id}>{e.file}</label>
     <select id={'match-'+e.id} disabled={busy} value={choices[e.id]||''} onChange={event=>setChoices(previous=>({...previous,[e.id]:event.target.value}))}>
      <option value="" disabled>Choose song…</option>
      {songs.map(s=><option key={s.id} value={s.id}>{s.title} — {s.artist} ({s.set})</option>)}
     </select>
     <button className="edit-button" disabled={busy||!choices[e.id]} onClick={()=>action({action:'match',id:e.id,songId:choices[e.id]})}>Save match</button>
    </div>)}
   </section>:state&&<p>New songs that need a match will appear here.</p>}
   {!!state?.matches?.length&&<details className="sync-section">
    <summary>Saved filename matches <span>({state.matches.length})</span></summary>
    <p>Automatic and manually confirmed filename matches are saved here. A song can have more than one filename. Reset a match to choose a different song. Existing played labels stay saved.</p>
    {state.matches.map(m=><div className="sync-match sync-saved-match" key={m.fileKey}>
     <span>{m.file} → <strong>{songs.find(s=>s.id===m.songId)?.title||m.songId}</strong></span>
     <button className="edit-button" disabled={busy} onClick={()=>action({action:'reset-match',fileKey:m.fileKey})}>Reset match</button>
    </div>)}
   </details>}
   <details className="sync-section">
    <summary>Setup &amp; connection</summary>
    <p>The companion checks MidiBard 2 when a song starts and saves its filename match automatically. Previously detected filenames that can be recognized are also added to your saved matches. Songs without a detected filename remain in your songbook and can match when you play them. Genre prefixes, music notes, punctuation and Octet Songbook labels are ignored. A clear, unique song title can match even when the artist or source is worded differently. The listener page shows Playing now while the game is playing; pause or stop clears it. Say chat announces each new song with title and artist, plus By Request and any supplied requester names. Pausing and resuming does not repeat the announcement. Use /songbooksync announcements off to turn chat announcements off.</p>
    <p>Keep MidiBard 2 and the companion enabled on your lead bard’s PC. Only install the companion on one bard.</p>
    <ol>
     <li><a href="/SongbookSync-source.zip" download>Download the companion source</a>, then build it using the included guide. Install the resulting DLL from a permanent folder.</li>
     <li>In FFXIV, open <code>/xlsettings</code> → <strong>Experimental</strong>. Under <strong>Dev Plugin Locations</strong>, add the full path to <code>SongbookSync.dll</code> in that folder.</li>
     <li>Open <code>/xlplugins</code> → <strong>Dev Tools</strong> and enable <strong>Songbook Sync</strong>. If your menu labels differ, see the included setup guide.</li>
     <li>Generate a connection key below, then paste the command into the game chat. The companion handles this command locally.</li>
    </ol>
    <div className="queue-actions">
     <button className="primary-button" disabled={busy} onClick={()=>action({action:'pair'})}>{state?.connection?.paired?'Replace connection key':'Generate connection key'}</button>
     {!!state?.connection?.paired&&<button className="edit-button" disabled={busy} onClick={()=>action({action:'disconnect'})}>Disconnect</button>}
    </div>
    {token&&<div className="sync-command"><p>Keep this key private. Replacing it disconnects the previous key.</p><code>/songbooksync {typeof window!=='undefined'?window.location.origin:'https://your-songbook.example'} {token}</code><button className="edit-button" onClick={async()=>{try{await navigator.clipboard.writeText('/songbooksync '+window.location.origin+' '+token);setCopied(true);}catch{setError('Select and copy the command manually.');}}}>{copied?'Copied':'Copy command'}</button></div>}
    <p><small>Last contact shows the last successful contact, not a live connection check. Use <code>/songbooksync status</code> in game to check the companion.</small></p>
   </details>
   {error&&<p role="alert">{error}</p>}
   <p><small>Start new show / reset clears the show’s played labels. The connection and filename matches stay saved.</small></p>
  </div>
 </details>;
}
