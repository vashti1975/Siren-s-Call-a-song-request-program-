"use client";
import Modal from "./modal";
import SongbookBrand from "./songbook-brand";
import { pendingRequestTimes } from "../lib/request-times";
import { createRequestRefresh } from "../lib/request-refresh";
import MidiBardSync from "./midibard-sync";
import OwnerFeedback from "./owner-feedback";
import SongTimings from "./song-timings";
import OwnerPlayingLocation from "./owner-playing-location";
import OwnerAppearance from "./owner-appearance";
import {formatDuration,parseDuration} from "../lib/durations";
import type {ShowBudget} from "../lib/show-budget";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Clock3, ChevronLeft, ChevronRight, Disc3, Focus, Keyboard, ListMusic, LockKeyhole, Search, Star, UnlockKeyhole, X } from "lucide-react";
import { compare, findSongs, setNames, type Song, type SortField } from "../lib/songs";

type QueueRequest = {id:string;songId:string;createdAt:number;requesterName?:string|null;song?:Song};
const colors: Record<string, string> = { Anime: "sky", Disney: "gold", "Final Fantasy": "violet", Game: "teal", Movies: "blue", "Rock/Metal": "sand", "Pop/Soft Rock": "violet", Country: "gold" };
const favoriteKey = "songbook-updated-songbook-favorites-v1";
const stageKey = "songbook-songbook-stage-v1";
function SetTag({ name }: { name: string }) { return <span className={`set-tag ${colors[name]}`}><span />{name}</span>; }

function RequestStamp({times}: {times: number[]}) {
  if (!times.length) return null;
  const first = new Date(times[0]);
  return <span className="request-stamp" title={times.map(time => new Date(time).toLocaleString()).join(" · ")}><Clock3 size={14} aria-hidden="true" /><span>Requested at <time dateTime={first.toISOString()}>{first.toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"})}</time>{times.length > 1 && <span> · {times.length} waiting</span>}</span></span>;
}

export default function Home() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [requestCounts, setRequestCounts] = useState<Record<string,number>>({});
  const [queue,setQueue]=useState<QueueRequest[]>([]);
  const [requestsOpen,setRequestsOpen]=useState<boolean|null>(null);
  const [requestGateBusy,setRequestGateBusy]=useState(false);
  const [includeRequesterNames,setIncludeRequesterNames]=useState<boolean|null>(null);
  const [nameSettingBusy,setNameSettingBusy]=useState(false);
  const [showBudget,setShowBudget]=useState<ShowBudget|null>(null);
  const [statuses,setStatuses]=useState<Record<string,{requested:boolean;played:boolean}>>({});
  const [resetShow,setResetShow]=useState(false);
  const [confirmTotalsReset,setConfirmTotalsReset]=useState(false),[totalsResetError,setTotalsResetError]=useState("");
  const totalsResetOperation=useRef("");
  const [queueBusy,setQueueBusy]=useState(false);
  const mutationBusy=useRef(false);
  const catalogRefresh=useRef(createRequestRefresh()).current;
  const [confirmPlayed,setConfirmPlayed]=useState<{entry:QueueRequest}|{song:Song}|null>(null);
  const [queueError,setQueueError]=useState("");
  const [lastPlayed,setLastPlayed]=useState<QueueRequest|null>(null);
  const [queueLoaded,setQueueLoaded]=useState(false);
  const [queueUpdated,setQueueUpdated]=useState("");
  const [totalRequests,setTotalRequests]=useState(0);
  const [editor, setEditor] = useState<Partial<Song> | null>(null);
  const [confirmRemoval,setConfirmRemoval]=useState<Song|null>(null);
  const [durationInput,setDurationInput]=useState("");
  useEffect(()=>{setDurationInput(editor?.durationSeconds?formatDuration(editor.durationSeconds):"");},[editor?.id,!!editor]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function refreshCatalog() {
    if (mutationBusy.current) return;
    await catalogRefresh.run(async signal => {
      const response=await fetch("/api/manage",{cache:"no-store",signal});
      if(!response.ok) throw new Error("Could not load your songs and requests.");
      return await response.json() as {songs:Song[];counts:{songId:string;total:number}[];totalRequests:number;queue:QueueRequest[];statuses:Record<string,{requested:boolean;played:boolean}>;requestsOpen:boolean;includeRequesterNames:boolean;showBudget:ShowBudget};
    }, data => {
      setShowBudget(data.showBudget);
      setIncludeRequesterNames(data.includeRequesterNames);setRequestsOpen(data.requestsOpen);setStatuses(data.statuses);setQueue(data.queue);setQueueLoaded(true);setQueueUpdated(new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"}));setQueueError("");setSongs(data.songs);setTotalRequests(data.totalRequests);setRequestCounts(Object.fromEntries(data.counts.map(r=>[r.songId,r.total])));
    }, error => setQueueError(error instanceof Error?error.message:"Unable to load requests."));
  }
  useEffect(()=>{
    void refreshCatalog();
    const resume=()=>{if(document.visibilityState!=="hidden")void refreshCatalog();};
    const timer=setInterval(resume,5000);
    window.addEventListener("focus",resume);
    document.addEventListener("visibilitychange",resume);
    return ()=>{clearInterval(timer);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);catalogRefresh.invalidate();};
  },[]);
  function beginQueueChange() {
    if(mutationBusy.current)return false;
    mutationBusy.current=true;setQueueBusy(true);setQueueError("");catalogRefresh.invalidate();
    return true;
  }
  function endQueueChange(updated:boolean) {
    mutationBusy.current=false;setQueueBusy(false);if(updated)void refreshCatalog();
  }
  function needsPlayedConfirmation() {
    return window.matchMedia("(max-width: 1100px), (any-pointer: coarse)").matches;
  }
  function choosePlayed(target:{entry:QueueRequest}|{song:Song}) {
    if(mutationBusy.current)return;
    if(needsPlayedConfirmation())setConfirmPlayed(target);
    else if("entry" in target)void finishRequest(target.entry);
    else void markSongPlayed(target.song);
  }
  async function toggleRequests() {
    if(requestsOpen===null||requestGateBusy)return;
    setRequestGateBusy(true);setQueueError("");
    try {
      const r=await fetch("/api/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"set-requests-open",open:!requestsOpen})});
      const data=await r.json() as {requestsOpen:boolean;error?:string};
      if(!r.ok)throw new Error(data.error||"Could not change request availability. Please try again.");
      setRequestsOpen(data.requestsOpen);await refreshCatalog();
    } catch(error){setQueueError(error instanceof Error?error.message:"Unable to change request availability.");}
    finally{setRequestGateBusy(false);}
  }
  async function toggleRequesterNames() {
    if(includeRequesterNames===null||nameSettingBusy||!beginQueueChange())return;
    setNameSettingBusy(true);let updated=false;
    try {
      const response=await fetch("/api/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"set-say-requester-names",includeNames:!includeRequesterNames})});
      const data=await response.json() as {includeRequesterNames:boolean;error?:string};
      if(!response.ok)throw new Error(data.error||"Could not save the announcement setting. Please try again.");
      setIncludeRequesterNames(data.includeRequesterNames);updated=true;
    } catch(error){setQueueError(error instanceof Error?error.message:"Could not save the announcement setting.");}
    finally{setNameSettingBusy(false);endQueueChange(updated);}
  }
  async function markSongPlayed(song:Song){
    if(!beginQueueChange())return;
    let updated=false;
    try{const r=await fetch("/api/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"mark-song-played",songId:song.id})});if(!r.ok)throw new Error("Could not mark song played. Please try again.");setConfirmPlayed(null);updated=true;}
    catch(e){setQueueError(e instanceof Error?e.message:"Unable to mark played");}finally{endQueueChange(updated);}
  }
  async function toggleHourLimit(){
    if(!showBudget||!beginQueueChange())return;let updated=false;
    try{const r=await fetch('/api/manage',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set-hour-limit',enabled:!showBudget.enabled})});if(!r.ok)throw new Error('Could not update the one-hour limit.');setShowBudget({...showBudget,enabled:!showBudget.enabled});updated=true;}catch(e){setQueueError(e instanceof Error?e.message:'Unable to change limit.');}finally{endQueueChange(updated);}
  }
  async function startNewShow(){
    if(!beginQueueChange())return;
    let updated=false;
    try{const r=await fetch("/api/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset-show"})});if(!r.ok)throw new Error("Could not reset the show. Please try again.");setLastPlayed(null);setQueue([]);setResetShow(false);setMessage("New show started. Listener labels and request list are clear; lifetime totals are saved.");updated=true;}
    catch(e){setQueueError(e instanceof Error?e.message:"Unable to reset show");}finally{endQueueChange(updated);}
  }
  async function resetAllRequestTotals(){
    if(!confirmTotalsReset||!totalsResetOperation.current||!beginQueueChange())return;
    setTotalsResetError("");let updated=false;
    try{const response=await fetch('/api/manage',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reset-request-totals',confirmed:true,operationId:totalsResetOperation.current})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Could not reset request totals. Please try again.');setConfirmTotalsReset(false);setMessage('All song request totals have been reset to zero.');updated=true;}
    catch(e){setTotalsResetError(e instanceof Error?e.message:'Unable to reset request totals.');}finally{endQueueChange(updated);}
  }
  async function finishRequest(entry:QueueRequest,undo=false) {
    if(!beginQueueChange())return;
    let updated=false;
    try {const response=await fetch("/api/manage",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:entry.id,undo})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"Could not update request");setQueue(previous=>undo?[...previous,entry].sort((a,b)=>a.createdAt-b.createdAt):previous.filter(r=>r.id!==entry.id));setLastPlayed(undo?null:entry);setConfirmPlayed(null);updated=true;}
    catch(error){setQueueError(error instanceof Error?error.message:"Could not update request");}finally{endQueueChange(updated);}
  }
  async function saveSong(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(saving||confirmRemoval)return;const durationSeconds=parseDuration(durationInput);if(durationSeconds===undefined){setMessage('Enter the song length as minutes:seconds, such as 3:45.');return;}setSaving(true);setMessage("");
    try {const response=await fetch("/api/manage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...editor,durationSeconds})});const data=await response.json() as {error?:string};if(!response.ok) throw new Error(data.error||"Could not save song");await refreshCatalog();setEditor(null);setMessage("Song saved. It is now available for listener requests.");}
    catch(error){setMessage(error instanceof Error?error.message:"Unable to save song.");}finally{setSaving(false);}
  }
  async function removeSong() {
    if(!confirmRemoval||saving||!beginQueueChange())return;
    const song=confirmRemoval;setSaving(true);setMessage("");let updated=false;
    try {
      const response=await fetch('/api/manage',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:song.id,confirmed:true})});
      const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Could not remove song. Please try again.');
      setSongs(previous=>previous.filter(s=>s.id!==song.id));setQueue(previous=>previous.filter(r=>r.songId!==song.id));setFavorites(previous=>previous.filter(id=>id!==song.id));
      if(currentId===song.id)setCurrentId(null);if(lastPlayed?.songId===song.id)setLastPlayed(null);
      setConfirmRemoval(null);setEditor(null);setMessage(`“${song.title}” removed from your songbook and listener catalog.`);updated=true;
    }catch(error){setMessage(error instanceof Error?error.message:'Unable to remove song.');}finally{setSaving(false);endQueueChange(updated);}
  }

  const [query, setQuery] = useState("");
  const [set, setSet] = useState("All");
  const [artist, setArtist] = useState("All");
  const [showFilter, setShowFilter] = useState("all");
  const [sort, setSort] = useState<SortField>("title");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [stage, setStage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const artists = useMemo(() => [...new Set(songs.map(song => song.artist))].sort(compare), [songs]);
  const visible = useMemo(() => findSongs({ query, set, artist, sort, direction, favoritesOnly, favorites }, songs).filter(song => showFilter === "all" || (queueLoaded && (showFilter === "played" ? !!statuses[song.id]?.played : !statuses[song.id]?.played))), [query, set, artist, sort, direction, favoritesOnly, favorites, songs, showFilter, statuses, queueLoaded]);
  const requestTimes = useMemo(() => pendingRequestTimes(songs, queue), [songs, queue]);
  const current = songs.find(song => song.id === currentId);
  const currentIndex = visible.findIndex(song => song.id === currentId);
  const filtered = !!query || set !== "All" || artist !== "All" || favoritesOnly || showFilter !== "all";

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoriteKey) || "[]");
      if (Array.isArray(saved)) setFavorites(saved.filter(id => typeof id === "string"));
      setStage(localStorage.getItem(stageKey) === "true");
    } catch { setStorageWarning(true); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(favoriteKey, JSON.stringify(favorites)); localStorage.setItem(stageKey, String(stage)); }
    catch { setStorageWarning(true); }
  }, [favorites, stage, loaded]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (event.metaKey || event.ctrlKey || event.altKey || helpRef.current?.open) return;
      if (event.key === "/" && !typing) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape") { setQuery(""); searchRef.current?.blur(); }
      if (event.key.toLowerCase() === "p" && !typing) setStage(value => !value);
      if (!typing && currentIndex >= 0 && event.key === "ArrowRight" && currentIndex < visible.length - 1) { event.preventDefault(); setCurrentId(visible[currentIndex + 1].id); }
      if (!typing && currentIndex > 0 && event.key === "ArrowLeft") { event.preventDefault(); setCurrentId(visible[currentIndex - 1].id); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentIndex, visible]);
  function reset() { setQuery(""); setSet("All"); setArtist("All"); setFavoritesOnly(false); setShowFilter("all"); }
  function toggleFavorite(song: Song) { setFavorites(previous => previous.includes(song.id) ? previous.filter(id => id !== song.id) : [...previous, song.id]); }
  function columnSort(field: SortField) { if (sort === field) setDirection(value => value === "asc" ? "desc" : "asc"); else { setSort(field); setDirection("asc"); } }
  function sortIcon(field: SortField) { return sort === field ? direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} />; }

  return <div className={`songbook ${stage ? "stage-view" : ""} ${current ? "has-current" : ""}`}>
    <a href="#song-library" className="skip-link">Skip to songs</a>
    <div className="main-shell">
      <header className="topbar"><span className="breadcrumb"><span>Songbook</span><span className="crumb-slash">/</span> Songbook</span><div className="topbar-actions"><a className="queue-shortcut" href="#request-queue">♫ Requests <strong aria-live="polite">{queue.length}</strong></a><button type="button" className="reset-totals-button" aria-label="Reset request totals" title="Reset all song request counts" disabled={queueBusy||!queueLoaded} onClick={()=>{totalsResetOperation.current=crypto.randomUUID();setTotalsResetError("");setConfirmTotalsReset(true);}}>Reset totals</button><a className="request-link" href="/requests" target="_blank" rel="noreferrer">Listener request page ↗</a><span className="private-badge"><LockKeyhole size={12} />Private songbook</span><button className={`stage-toggle ${stage ? "enabled" : ""}`} onClick={() => setStage(value => !value)} aria-pressed={stage}><Focus size={16} /><span>{stage ? "Exit performance view" : "Performance view"}</span><kbd>P</kbd></button></div></header>
      <main id="song-library">
        <OwnerAppearance/>
        <OwnerPlayingLocation/>
        <MidiBardSync songs={songs} onChange={refreshCatalog}/><section id="request-queue" className="request-queue" aria-labelledby="queue-title">
          <div className="queue-heading"><div><div className="section-overline">OWNER · LIVE REQUESTS</div><h2 id="queue-title">Request list <span>{queue.length}</span></h2><p>Oldest requests first · updates every 5 seconds{queueUpdated&&` · Checked ${queueUpdated}`}</p></div><div className="queue-actions"><button className="edit-button" onClick={refreshCatalog}>Refresh now</button><button className="edit-button" disabled={queueBusy} onClick={()=>setResetShow(true)}>Start new show / reset</button></div></div>
          <div className="owner-request-controls" role="group" aria-label="Request settings">
          <div className={`request-gate ${requestsOpen===false?"is-closed":"is-open"}`} title="Open or close incoming song requests. Waiting requests stay in your list.">
            <div role="status" aria-live="polite"><strong>{requestsOpen===null?"Requests…":requestsOpen?"Requests open":"Requests closed"}</strong></div>
            <button className="request-gate-button" aria-label={requestsOpen===false?"Reopen requests":"Close requests"} disabled={requestsOpen===null||requestGateBusy} onClick={toggleRequests}>{requestsOpen===false?<UnlockKeyhole size={14}/>:<LockKeyhole size={14}/>}<span>{requestGateBusy?"Saving…":requestsOpen===false?"Reopen":"Close"}</span></button>
          </div>
          <div className="say-name-setting" title="Include requester names in /s announcements. Names stay visible in your owner request list.">
            <strong>Names in /s</strong>
            <button type="button" className="say-name-switch" role="switch" aria-label="Include requester names in say announcements" aria-checked={includeRequesterNames===true} disabled={includeRequesterNames===null||nameSettingBusy||queueBusy} onClick={toggleRequesterNames}><span aria-hidden="true" className="switch-track"><span/></span><span>{nameSettingBusy?"Saving…":includeRequesterNames===null?"Loading…":includeRequesterNames?"On":"Off"}</span></button>
          </div>
          <div className="request-gate" title="Limit played music plus waiting requests to 60 minutes."><strong>1-hour limit</strong><button type="button" className="request-gate-button" role="switch" aria-label="Limit show to one hour" aria-checked={showBudget?.enabled===true} disabled={!showBudget||queueBusy} onClick={toggleHourLimit}><Clock3 size={14}/>{showBudget?.enabled?"On":"Off"}</button></div>
          </div>
          {showBudget?.enabled&&<div className="show-time-summary" role="status"><p><strong>{formatDuration(showBudget.totalSeconds)} / 60:00</strong> · {formatDuration(showBudget.playedSeconds)} played + {formatDuration(showBudget.queuedSeconds)} waiting · {formatDuration(showBudget.remainingSeconds)} free</p>{!!(showBudget.unknownPlayed||showBudget.unknownQueued)&&<p>Requests are paused: {showBudget.unknownPlayed} played and {showBudget.unknownQueued} waiting songs need a length or a MidiBard match.</p>}{showBudget.totalSeconds>3600&&<p>Over the hour by {formatDuration(showBudget.totalSeconds-3600)}. New requests are blocked; your waiting list is kept.</p>}<small>Includes non-requested music. Start a new show to reset the total.</small></div>}
          {showBudget&&<SongTimings known={showBudget.knownSongs} total={songs.length} onChange={refreshCatalog}/>}
          <p className="sr-only" role="status" aria-live="polite">{queueLoaded?`${queue.length} requests waiting`:"Loading requests"}</p>
          {queueError&&<p className="feedback" role="alert">{queueError} <button onClick={refreshCatalog}>Try again</button></p>}
          {lastPlayed&&<div className="queue-undo" role="status">Cleared “{lastPlayed.song?.title||"Song request"}” as played. <button disabled={queueBusy} onClick={()=>finishRequest(lastPlayed,true)}>Undo</button></div>}
          {queue.length>0?<ol className="queue-list">{queue.map((entry,index)=><li key={entry.id}><span className="queue-position">{index+1}</span><div className="queue-song"><button onClick={()=>setCurrentId(entry.songId)}>{entry.song?.title||"Song request"}</button><p>{entry.song?.artist}{entry.song?.durationSeconds&&<> · {formatDuration(entry.song.durationSeconds)}</>}</p>{entry.requesterName&&<p className="queue-requester">Requested by <strong>{entry.requesterName}</strong></p>}<p className="queue-request-time"><Clock3 size={14} aria-hidden="true" />Requested at <time dateTime={new Date(entry.createdAt).toISOString()} title={new Date(entry.createdAt).toLocaleString()}>{new Date(entry.createdAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"})}</time></p></div><button className="primary-button" disabled={queueBusy} aria-label={`Mark ${entry.song?.title||"request"} played and clear from request list`} onClick={()=>choosePlayed({entry})}>✓ Played · clear</button></li>)}</ol>:<p className="queue-empty">{queueLoaded?"No requests waiting. New listener requests appear here automatically.":"Loading your request list…"}</p>}
          <small>Only you can see this list. Clearing played requests keeps your lifetime request totals.</small>
        </section>
        <OwnerFeedback/>
        <div className="logo-header"><SongbookBrand/><span>THE SONGBOOK</span></div><section className="hero" aria-labelledby="hero-title"><div><div className="eyebrow"><span />THE SONGBOOK REPERTOIRE</div><h1 id="hero-title">A song for <em>every mood.</em></h1><p>From soulful melodies to a little chaos. Find what’s next.</p></div><div className="hero-stat"><span>{songs.length}<span className="stat-dot">.</span></span><small>SONG ENTRIES · {setNames.length} SETS</small></div></section>
        <section className="library-section" aria-labelledby="library-title">
          <div className="manage-tools"><button className="primary-button" onClick={()=>{setMessage("");setEditor({title:"",artist:"",set:"Pop/Soft Rock",note:""});}}>＋ Add song</button><span>Listener requests: <strong>{totalRequests}</strong> total · only you can see totals</span><button onClick={refreshCatalog}>Refresh requests</button></div>{message && <p role="status" className="feedback">{message}</p>}<div className="library-heading"><div><div className="section-overline">BROWSE THE COLLECTION</div><h2 id="library-title">{favoritesOnly ? "Your favorites" : set === "All" ? "All songs" : set}<span>{visible.length}</span></h2></div><span className="updated"><Check size={13} />Your song collection</span></div>
          <div className="search-filter-panel"><div className="search-field"><Search size={20} /><label htmlFor="song-search" className="sr-only">Search songs</label><input ref={searchRef} id="song-search" type="search" placeholder="Search title, artist, or set…" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />{query ? <button onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search"><X size={16} /></button> : <kbd>/</kbd>}</div><div className="filter-controls"><label><span>Set</span><select aria-label="Filter by set" value={set} onChange={event => setSet(event.target.value)}><option value="All">All sets</option>{setNames.map(name => <option key={name}>{name}</option>)}</select></label><label className="artist-filter"><span>Artist / source</span><select aria-label="Filter by artist or source" value={artist} onChange={event => setArtist(event.target.value)}><option value="All">All artists & sources</option>{artists.map(name => <option key={name}>{name}</option>)}</select></label><label className="show-filter"><span>This show</span><select aria-label="Filter by played status" value={showFilter} onChange={event => setShowFilter(event.target.value)}><option value="all">All songs</option><option value="unplayed">Not played</option><option value="played">Played</option></select></label><label className="sort-filter"><span>Sort by</span><select aria-label="Sort songs" value={`${sort}-${direction}`} onChange={event => { const [field, order] = event.target.value.split("-"); setSort(field as SortField); setDirection(order as "asc" | "desc"); }}><option value="title-asc">Title: A–Z</option><option value="title-desc">Title: Z–A</option><option value="artist-asc">Artist: A–Z</option><option value="artist-desc">Artist: Z–A</option><option value="set-asc">Set: A–Z</option><option value="set-desc">Set: Z–A</option></select></label></div></div>
          <div className="result-toolbar"><div className="result-status" role="status" aria-live="polite" aria-atomic="true">Showing <strong>{visible.length}</strong> of {songs.length} entries{favoritesOnly && <span className="favorite-status"><Star size={12} fill="currentColor" />Favorites</span>}</div><div className="result-actions"><button className={`favorite-filter ${favoritesOnly ? "selected" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Star size={14} fill={favoritesOnly ? "currentColor" : "none"} />Favorites</button><span className="toolbar-divider" /><button className="clear-filters" onClick={reset} disabled={!filtered}>Clear filters</button></div></div>
          <p className="played-hint">✓ Green rows have been played this show. Labels update automatically.</p>
          <div className="song-table-wrap"><table className="song-table" role="table">
            <caption className="sr-only">Songbook song entries. Select a title to focus on a song for performance.</caption>
            <thead role="rowgroup"><tr role="row">
              <th className="number-cell" scope="col" role="columnheader">#</th>
              <th scope="col" role="columnheader" aria-sort={sort === "title" ? direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => columnSort("title")}>SONG TITLE{sortIcon("title")}</button></th>
              <th scope="col" role="columnheader" className="artist-heading" aria-sort={sort === "artist" ? direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => columnSort("artist")}>ARTIST / SOURCE{sortIcon("artist")}</button></th>
              <th scope="col" role="columnheader" aria-sort={sort === "set" ? direction === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => columnSort("set")}>SET{sortIcon("set")}</button></th>
              <th scope="col" role="columnheader" className="requests-heading">REQUESTS<br /><small>PRIVATE TOTAL</small></th>
              <th scope="col" role="columnheader" className="show-heading">THIS SHOW</th>
              <th scope="col" role="columnheader" className="edit-heading">EDIT</th>
              <th scope="col" role="columnheader" className="favorite-cell"><span className="sr-only">Favorite</span><Star size={14} /></th>
            </tr></thead>
            <tbody role="rowgroup">{visible.map((song, index) => {
              const played = !!statuses[song.id]?.played;
              return <tr key={song.id} role="row" className={[currentId === song.id ? "current-row" : "", queueLoaded && played ? "played-row" : ""].filter(Boolean).join(" ")}>
                <td role="cell" className="number-cell">{currentId === song.id ? <span className="current-dot" /> : String(index + 1).padStart(2, "0")}</td>
                <td role="cell" className="title-cell"><button className="song-title" onClick={() => setCurrentId(song.id)} aria-label={`Focus ${song.title}`} aria-pressed={currentId === song.id}>{song.title}</button><span className="mobile-artist">{song.artist}</span>{song.note && <small className="song-note">{song.note}</small>}<RequestStamp times={requestTimes[song.id] || []} /></td>
                <td role="cell" className="artist-cell">{song.artist}</td>
                <td role="cell" className="set-cell"><SetTag name={song.set} /></td>
                <td role="cell" className="request-total"><span className="mobile-cell-label">Requests · total</span>{requestCounts[song.id] || 0}</td>
                <td role="cell" className="show-cell"><div className="song-play-state">
                  {!queueLoaded ? <span className="show-status unplayed">Loading status…</span> : played ? <><span className="show-status played">✓ Played this show</span>{!!requestTimes[song.id]?.length && <button className="mark-played-button" disabled={queueBusy} aria-label={`Mark ${song.title} played again this show`} onClick={() => choosePlayed({song})}>Mark played again</button>}</> : <><span className="show-status unplayed">Not played</span><button className="mark-played-button" disabled={queueBusy} aria-label={`Mark ${song.title} played this show`} onClick={() => choosePlayed({song})}>Mark played</button></>}
                </div></td>
                <td role="cell" className="edit-cell"><button className="edit-button" aria-label={`Edit ${song.title}`} onClick={() => {setMessage("");setEditor({...song});}}>Edit</button></td>
                <td role="cell" className="favorite-cell"><button className={`star-button ${favorites.includes(song.id) ? "is-starred" : ""}`} aria-label={`${favorites.includes(song.id) ? "Unfavorite" : "Favorite"} ${song.title} (${song.set})`} aria-pressed={favorites.includes(song.id)} onClick={() => toggleFavorite(song)}><Star size={17} fill={favorites.includes(song.id) ? "currentColor" : "none"} /></button></td>
              </tr>;
            })}</tbody>
          </table>
            {visible.length === 0 && <div className="empty-state"><Search size={28} /><h3>{favoritesOnly && !query && artist === "All" && set === "All" && showFilter === "all" ? "Your favorites start here" : "No songs found"}</h3><p>{favoritesOnly && !query && artist === "All" && set === "All" && showFilter === "all" ? "Star a song to keep it close for your next performance." : "Try another title, artist, set, or played status, or clear your filters."}</p><button onClick={reset}>Browse all songs<ChevronRight size={15} /></button></div>}
          </div>
          <footer className="library-footer"><span><ListMusic size={14} />Your repertoire, ready when you are.</span><button className="keyboard-help" onClick={() => helpRef.current?.showModal()}><Keyboard size={14} />Keyboard shortcuts</button><span>Credits & set assignments as provided.</span></footer>
          {storageWarning && <p className="storage-warning">This browser can’t save favorites or view preferences. They’ll remain available for this session.</p>}
        </section>
      </main>
    </div>
    {current && <section className="current-bar" aria-label="Current performance song"><div className="current-symbol"><Disc3 size={24} /></div><div className="current-song-info" aria-live="polite"><span className="current-caption">ON STAGE <span>· SONG FOCUS</span></span><h3>{current.title}</h3><p>{current.artist} <span>· {current.set}</span></p></div><div className="current-navigation"><span className="current-position">{currentIndex >= 0 ? `${currentIndex + 1} / ${visible.length}` : "Outside filters"}</span><button aria-label="Previous song" disabled={currentIndex <= 0} onClick={() => setCurrentId(visible[currentIndex - 1].id)}><ChevronLeft size={20} /></button><button aria-label="Next song" disabled={currentIndex < 0 || currentIndex >= visible.length - 1} onClick={() => setCurrentId(visible[currentIndex + 1].id)}><ChevronRight size={20} /></button><span className="current-divider" /><button aria-label="Close song focus" onClick={() => setCurrentId(null)}><X size={19} /></button></div></section>}
    {confirmPlayed&&<Modal label="confirm-played-title" onClose={()=>{if(!queueBusy)setConfirmPlayed(null);}}><h2 id="confirm-played-title">Mark as played?</h2><p><strong>{"entry" in confirmPlayed?confirmPlayed.entry.song?.title||"Song request":confirmPlayed.song.title}</strong></p>{"entry" in confirmPlayed&&confirmPlayed.entry.requesterName&&<p className="queue-requester">Requested by <strong>{confirmPlayed.entry.requesterName}</strong></p>}<p>{"entry" in confirmPlayed?"Confirm this request has been played and remove it from the waiting list.":"Confirm this song has been played. This also clears its waiting requests."}</p><p>Choose Keep waiting if it hasn’t been played yet.</p>{queueError&&<p role="alert">{queueError}</p>}<div className="editor-actions"><button autoFocus disabled={queueBusy} onClick={()=>setConfirmPlayed(null)}>Keep waiting</button><button className="primary-button" disabled={queueBusy} onClick={()=>{"entry" in confirmPlayed?void finishRequest(confirmPlayed.entry):void markSongPlayed(confirmPlayed.song);}}>{queueBusy?"Saving…":"Confirm played"}</button></div></Modal>}
    {confirmTotalsReset&&<Modal label="reset-totals-title" onClose={()=>{if(!queueBusy)setConfirmTotalsReset(false);}}><h2 id="reset-totals-title">Reset request totals?</h2><p>Are you sure you want to reset the request count for <strong>every song</strong> and the overall request total to <strong>zero</strong>?</p><p>Your waiting requests, played labels and one-hour show total will stay as they are.</p>{totalsResetError&&<p role="alert">{totalsResetError}</p>}<div className="editor-actions"><button type="button" autoFocus disabled={queueBusy} onClick={()=>setConfirmTotalsReset(false)}>Cancel</button><button type="button" className="primary-button confirm-totals-button" disabled={queueBusy} onClick={resetAllRequestTotals}>{queueBusy?"Resetting…":"Yes, reset totals"}</button></div></Modal>}
    {resetShow&&<Modal label="reset-show-title" onClose={()=>{if(!queueBusy)setResetShow(false);}}><h2 id="reset-show-title">Start a new show?</h2><p>Clear all Requested and Played labels on the listener page and empty the current request list. Your lifetime request totals stay saved. The one-hour total resets to zero.</p><p>Use this at the start of each show. Previous show requests will leave the active list.</p>{queueError&&<p role="alert">{queueError}</p>}<div className="editor-actions"><button disabled={queueBusy} onClick={()=>setResetShow(false)}>Cancel</button><button className="primary-button" disabled={queueBusy} onClick={startNewShow}>{queueBusy?"Resetting…":"Start new show"}</button></div></Modal>}
    {editor && <Modal label={confirmRemoval?"remove-song-title":"editor-title"} onClose={()=>{if(!saving){if(confirmRemoval){setConfirmRemoval(null);setMessage("");}else setEditor(null);}}}>{confirmRemoval?<><h2 id="remove-song-title">Remove song?</h2><p>Are you sure you want to remove this song?</p><p><strong>{confirmRemoval.title}</strong><br/>{confirmRemoval.artist} · {confirmRemoval.set}</p><p>This removes this entry from your songbook, the listener catalog and the waiting request list. Other copies of the song stay in your list.</p><p>Past request totals, earned rewards and time already played stay saved. You can add the song again later.</p>{message&&<p role="alert">{message}</p>}<div className="editor-actions"><button type="button" autoFocus disabled={saving} onClick={()=>{setConfirmRemoval(null);setMessage("");}}>Cancel</button><button type="button" className="primary-button confirm-remove-button" disabled={saving} onClick={removeSong}>{saving?"Removing…":"Yes, remove song"}</button></div></>:<><h2 id="editor-title">{editor.id?"Edit song":"Add a song"}</h2><p>Your saved song appears in both your songbook and the listener catalog.</p><form onSubmit={saveSong}><label>Song title<input required maxLength={200} autoFocus value={editor.title||""} onChange={e=>setEditor({...editor,title:e.target.value})}/></label><label>Artist / source<input required maxLength={200} value={editor.artist||""} onChange={e=>setEditor({...editor,artist:e.target.value})}/></label><label>Set<select value={editor.set} onChange={e=>setEditor({...editor,set:e.target.value as Song["set"]})}>{setNames.map(n=><option key={n}>{n}</option>)}</select></label><label>Song length (minutes:seconds)<input inputMode="text" placeholder="3:45" value={durationInput} onChange={e=>setDurationInput(e.target.value)} maxLength={7}/><small>Use your MIDI arrangement’s length. Leave blank if unknown.</small></label><label>Notes <small>(visible to listeners)</small><textarea maxLength={500} value={editor.note||""} onChange={e=>setEditor({...editor,note:e.target.value})}/></label>{message&&<p role="alert">{message}</p>}<div className="editor-actions">{editor.id&&<button type="button" className="editor-remove-button" disabled={saving||queueBusy} onClick={()=>{const song=songs.find(s=>s.id===editor.id);if(song){setMessage("");setConfirmRemoval(song);}}}>Remove song</button>}<button type="button" disabled={saving} onClick={()=>setEditor(null)}>Cancel</button><button className="primary-button" disabled={saving}>{saving?"Saving…":"Save song"}</button></div></form></>}</Modal>}<dialog ref={helpRef} className="shortcuts-dialog"><div className="dialog-header"><div className="eyebrow">AT YOUR FINGERTIPS</div><button aria-label="Close keyboard shortcuts" onClick={() => helpRef.current?.close()}><X size={20} /></button></div><h2>Keep the music moving.</h2><p>A few shortcuts for your next performance.</p><dl><div><dt>Search the songbook</dt><dd><kbd>/</kbd></dd></div><div><dt>Clear search</dt><dd><kbd>Esc</kbd></dd></div><div><dt>Toggle performance view</dt><dd><kbd>P</kbd></dd></div><div><dt>Previous / next focused song</dt><dd><kbd>←</kbd><kbd>→</kbd></dd></div></dl><small>Favorites and view preferences are saved in this browser.</small></dialog>
  </div>;
}
