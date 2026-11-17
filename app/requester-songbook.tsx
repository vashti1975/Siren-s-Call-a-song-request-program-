"use client";
import Modal from "./modal";
import {useAppearance} from "./appearance-provider";
import PlayingAt from "./playing-location";
import type {PlayingLocation} from "../lib/playing-location";
import SongbookBrand from "./songbook-brand";
import { LockKeyhole, Heart, ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { compare, findSongs, setNames, type Song, type SortField } from "../lib/songs";
import ListenerProfile from "./listener-profile";
import SpecialRewards from "./special-rewards";
import ListenerPageStickers from "./listener-page-stickers";
import ListenerMusicBackground from "./listener-music-background";
import ListenerFeedbackForm from "./listener-feedback-form";
import {formatDuration} from "../lib/durations";
import type {PublicBudget} from "../lib/show-budget";
import BandLinks from "./band-links";
import { type ListenerProfileData, requestAward } from "../lib/listener-rewards";
export default function RequesterSongbook({embedded:embeddedProp=false}:{embedded?:boolean}) {
 const {appearance}=useAppearance();
 const pageRef=useRef<HTMLElement>(null);
 const [stickerRequest,setStickerRequest]=useState<{id:string|null;serial:number}|null>(null);
 const placeSticker=(id:string|null)=>setStickerRequest(previous=>({id,serial:(previous?.serial||0)+1}));
 const [embedded,setEmbedded]=useState(embeddedProp);
 useEffect(()=>{setEmbedded(embeddedProp||new URLSearchParams(window.location.search).get("embed")==="1"||window.self!==window.top);},[embeddedProp]);
 const [profile,setProfile]=useState<ListenerProfileData|null>(null),[profileBusy,setProfileBusy]=useState(false),[onlyFavorites,setOnlyFavorites]=useState(false),[rewardNotice,setRewardNotice]=useState("");
 const profileRef=useRef<ListenerProfileData|null>(null),profileSequence=useRef(0),profileWriting=useRef(false);
 function applyProfile(data:ListenerProfileData,announce=false){const previous=profileRef.current;if(previous?.enabled&&data.enabled){if(announce&&data.totalRequests>previous.totalRequests){const milestone=data.totalRequests===1?1:Math.floor(data.totalRequests/5)*5;if(milestone>previous.totalRequests&&!previous.awards.some(a=>a.milestone===milestone))setRewardNotice(`New chibi sticker: “${requestAward(milestone).title}”! Place it on your profile in My rewards.`);}if(data.noteCount>previous.noteCount)setRewardNotice(`Your song was played! You earned ${data.noteCount-previous.noteCount} music ${data.noteCount-previous.noteCount===1?"note":"notes"}.`);}profileRef.current=data;setProfile(data);}
 async function loadProfile(announce=false){if(profileWriting.current)return;const seq=++profileSequence.current;try{const r=await fetch("/api/listener",{cache:"no-store"});if(!r.ok)throw new Error("Your profile couldn’t load. Please refresh to try again.");const d=await r.json() as ListenerProfileData;if(seq===profileSequence.current)applyProfile(d,announce);}catch(e){if(seq===profileSequence.current)setError(e instanceof Error?e.message:"Unable to load profile");}}
 async function profileAction(action:Record<string,unknown>){if(profileWriting.current)return false;profileWriting.current=true;profileSequence.current++;setProfileBusy(true);try{const r=await fetch("/api/listener",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action)});const d=await r.json() as ListenerProfileData&{error?:string};if(!r.ok)throw new Error(d.error||"Couldn’t save your profile.");applyProfile(d);return true;}catch(e){setError(e instanceof Error?e.message:"Unable to save profile");return false;}finally{profileWriting.current=false;setProfileBusy(false);}}
 const [statuses,setStatuses]=useState<Record<string,{requested:boolean;played:boolean;playing?:boolean}>>({});
 const [songs,setSongs]=useState<Song[]>([]);
 const [nextSongId,setNextSongId]=useState<string|null>(null);
 const [requestsOpen,setRequestsOpen]=useState<boolean|null>(null);
 const [playingLocation,setPlayingLocation]=useState<PlayingLocation|null>(null);
 const [showLimit,setShowLimit]=useState<PublicBudget|null>(null);
 const [query,setQuery]=useState("");const [set,setSet]=useState("All");
 const [artist,setArtist]=useState("All"),[showFilter,setShowFilter]=useState("all");
 const [sort,setSort]=useState<SortField>("title"),[direction,setDirection]=useState<"asc"|"desc">("asc");
 const searchRef=useRef<HTMLInputElement>(null);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const [selected,setSelected]=useState<Song|null>(null);const [busy,setBusy]=useState(false);const [success,setSuccess]=useState("");
 const [requestId,setRequestId]=useState("");
 const [requesterName,setRequesterName]=useState("");
 async function load(quiet=false){if(!quiet)setLoading(true);try{const r=await fetch("/api/catalog",{cache:"no-store"});if(!r.ok)throw new Error("The song list couldn’t load. Please try again.");const data=await r.json() as {songs:Song[];statuses:Record<string,{requested:boolean;played:boolean;playing?:boolean}>;playingNextSongId:string|null;playingLocation:PlayingLocation|null;requestsOpen:boolean;showLimit:PublicBudget};setPlayingLocation(data.playingLocation??null);setShowLimit(data.showLimit);setRequestsOpen(data.requestsOpen);setSongs(data.songs);setStatuses(data.statuses);setNextSongId(data.playingNextSongId??null);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load songs");}finally{setLoading(false);}}
 useEffect(()=>{load();loadProfile();const timer=setInterval(()=>{load(true);loadProfile();},5000);return ()=>clearInterval(timer);},[]);
 useEffect(()=>{
  function onKey(event:KeyboardEvent){
   if(selected||event.metaKey||event.ctrlKey||event.altKey)return;
   const target=event.target as HTMLElement;
   const typing=["INPUT","TEXTAREA","SELECT"].includes(target.tagName)||target.isContentEditable;
   if(event.key==='/'&&!typing){event.preventDefault();searchRef.current?.focus();}
   if(event.key==='Escape'&&target===searchRef.current){setQuery("");searchRef.current?.blur();}
  }
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[selected]);
 const nowPlaying=songs.find(song=>statuses[song.id]?.playing);
 const playingNext=songs.find(song=>song.id===nextSongId);
 const canRequest=(song:Song)=>requestsOpen===true&&(!showLimit?.enabled||showLimit.fit[song.id]==='ok');
 const requestLabel=(song:Song)=>requestsOpen===null?'Checking…':!requestsOpen?'Requests closed':!showLimit?.enabled||showLimit.fit[song.id]==='ok'?'Request':showLimit.fit[song.id]==='length-needed'?'Length needed':'Show full';
 const artists=useMemo(()=>[...new Set(songs.map(song=>song.artist))].sort(compare),[songs]);
 const visible=useMemo(()=>findSongs({query,set,artist,sort,direction},songs).filter(s=>(!onlyFavorites||!profile?.enabled||profile.favorites.includes(s.id))&&(showFilter==='all'||(showFilter==='played'?!!statuses[s.id]?.played:!statuses[s.id]?.played))),[songs,query,set,artist,sort,direction,showFilter,statuses,onlyFavorites,profile?.enabled,profile?.favorites]);
 const filtered=!!query||set!=="All"||artist!=="All"||showFilter!=="all"||onlyFavorites;
 function clearFilters(){setQuery("");setSet("All");setArtist("All");setShowFilter("all");setOnlyFavorites(false);}
 async function submit(){if(!selected||busy||!canRequest(selected))return;setBusy(true);setError("");try{const r=await fetch("/api/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({songId:selected.id,id:requestId,requesterName:requesterName.trim(),embedded})});const d=await r.json() as {error?:string;code?:string};if(d.code==="REQUESTS_CLOSED")setRequestsOpen(false);if(!r.ok)throw new Error(d.error||"Couldn’t send request. Try again.");setSuccess(`Your request for “${selected.title}” has been sent to Songbook!`);setSelected(null);await Promise.all([load(true),loadProfile(true)]);}catch(e){setError(e instanceof Error?e.message:"Unable to send request");}finally{setBusy(false);}}
 return <main ref={pageRef} className={`listener-page${embedded?" listener-embed":""}`} data-theme={profile?.profile?.theme||"ocean"}>{!embedded&&<div className="listener-logo-header"><SongbookBrand/></div>}
 <PlayingAt location={playingLocation}/>
 <div className="listener-top">
 <aside className="listener-status-panel listener-show-panel" aria-label="Show and request status">
 {nowPlaying&&<section className="now-playing-banner" role="status" aria-live="polite"><span className="playing-indicator" aria-hidden="true">♫</span><div><strong>Playing now</strong><p>♪ {nowPlaying.title} — {nowPlaying.artist} ♪</p></div></section>}
 {requestsOpen!==null&&<section className="now-playing-banner playing-next-banner" role="status" aria-live="polite"><span className="playing-indicator" aria-hidden="true">♪</span><div><strong>Playing Next</strong><p>{playingNext?<>♪ {playingNext.title} — {playingNext.artist} ♪</>:"No requests waiting."}</p>{playingNext&&<small>Oldest waiting request · updates automatically</small>}</div></section>}
 {requestsOpen===false&&<div className="requests-closed-banner" role="status" aria-live="polite"><LockKeyhole size={24}/><div><strong>Requests are closed</strong><p>You can still browse the songbook.</p></div></div>}
 {showLimit?.enabled&&<p className="hour-limit-notice" role="status">One-hour show · {showLimit.checkingLengths?'Requests pause while Songbook confirms song lengths.':showLimit.remainingSeconds===0?'The show is full. Enjoy the performance!':`${formatDuration(showLimit.remainingSeconds)} available for requests. Songs must fit the remaining time.`}</p>}
 </aside>
 <header className="listener-header" data-sticker-anchor="header"><div className="ornament">✦ &nbsp; {embedded?"SONGBOOK · SONG REQUESTS":"THE LISTENER SONGBOOK"} &nbsp; ✦</div><h1>What would you love to hear?</h1><p>Pick a song from our repertoire and send it our way.</p><BandLinks embedded={embedded}/><div className="show-legend"><span className="show-status requested">Requested this show</span><span className="show-status played">✓ Played this show</span><p>Labels update automatically and reset for each new show.</p></div><small>{requestsOpen===null?"Checking request availability…":requestsOpen?"Requests are welcome. What we play depends on the performance.":"Requests are currently closed. Enjoy browsing our repertoire."}</small></header>
 <aside className="listener-status-panel listener-profile-panel" aria-label="Your private profile">
 {embedded&&!profile?.enabled?<aside className="embed-profile-link"><a href="/requests#my-profile" target="_blank" rel="noopener noreferrer"><span>Open your favorites, chibi rewards & private profile</span><ExternalLink size={14} aria-hidden="true"/></a><span>You can request songs here without an account.</span></aside>:<ListenerProfile data={profile} busy={profileBusy} onAction={profileAction} onPlaceSticker={placeSticker}/>}
 <SpecialRewards data={profile} busy={profileBusy} onAction={profileAction} onPlaceSticker={placeSticker}/>
 </aside></div>
 {rewardNotice&&<div className="reward-notice" role="status"><span>✦ {rewardNotice}</span><button aria-label="Dismiss reward notification" onClick={()=>setRewardNotice("")}>×</button></div>}
 <section className="listener-catalog" data-sticker-anchor="catalog" aria-label="Request a song">
 <div className="search-filter-panel listener-search-panel">
  <div className="search-field"><Search size={20} aria-hidden="true"/><label htmlFor="listener-song-search" className="sr-only">Search songs</label><input ref={searchRef} id="listener-song-search" type="search" placeholder="Search title, artist, or set…" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off"/>{query?<button type="button" aria-label="Clear search" onClick={()=>{setQuery("");searchRef.current?.focus();}}><X size={16}/></button>:<kbd>/</kbd>}</div>
  <div className="filter-controls">
   <label><span>Set</span><select aria-label="Filter by set" value={set} onChange={event=>setSet(event.target.value)}><option value="All">All sets</option>{setNames.map(name=><option key={name}>{name}</option>)}</select></label>
   <label className="artist-filter"><span>Artist / source</span><select aria-label="Filter by artist or source" value={artist} onChange={event=>setArtist(event.target.value)}><option value="All">All artists &amp; sources</option>{artists.map(name=><option key={name}>{name}</option>)}</select></label>
   <label className="show-filter"><span>This show</span><select aria-label="Filter by played status" value={showFilter} onChange={event=>setShowFilter(event.target.value)}><option value="all">All songs</option><option value="unplayed">Not played</option><option value="played">Played</option></select></label>
   <label className="sort-filter"><span>Sort by</span><select aria-label="Sort songs" value={`${sort}-${direction}`} onChange={event=>{const [field,order]=event.target.value.split('-');setSort(field as SortField);setDirection(order as "asc"|"desc");}}><option value="title-asc">Title: A–Z</option><option value="title-desc">Title: Z–A</option><option value="artist-asc">Artist: A–Z</option><option value="artist-desc">Artist: Z–A</option><option value="set-asc">Set: A–Z</option><option value="set-desc">Set: Z–A</option></select></label>
  </div>
 </div>
 {success&&<div className="success-message" role="status">✓ {success}<button aria-label="Dismiss confirmation" onClick={()=>setSuccess("")}>×</button></div>}{error&&<div className="feedback" role="alert">{error}{!selected&&<button onClick={()=>load()}>Try again</button>}</div>}
 {profile?.enabled&&<button className="listener-favorites-filter" aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(!onlyFavorites)}><Heart size={16} fill={onlyFavorites?"currentColor":"none"}/>{onlyFavorites?"My favorites":"Show my favorites"}<span>{profile.favorites.length}</span></button>}
 <div className="listener-results-toolbar"><div className="listener-result-count" role="status" aria-live="polite">{loading?"Loading the repertoire…":`${visible.length} ${visible.length===1?"song":"songs"} to discover`}</div>{filtered&&<button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}</div>
 <div className="listener-songs">{visible.map(s=><article key={s.id} className={statuses[s.id]?.played?"played-song":""}><div><span className="listener-set">{s.set}</span><h2>{s.title}</h2><p>{s.artist}{s.durationSeconds&&<> · {formatDuration(s.durationSeconds)}</>}</p><div className="song-show-status">{statuses[s.id]?.playing&&<span className="show-status playing">♫ Playing now</span>}{statuses[s.id]?.requested&&<span className="show-status requested">Requested this show</span>}{statuses[s.id]?.played&&!statuses[s.id]?.playing&&<span className="show-status played">✓ Played this show</span>}</div>{s.note&&<small>{s.note}</small>}</div><div className="listener-song-actions">{profile?.enabled&&<button className="favorite-song-button" disabled={profileBusy} aria-pressed={profile.favorites.includes(s.id)} aria-label={`${profile.favorites.includes(s.id)?"Remove":"Save"} ${s.title} ${profile.favorites.includes(s.id)?"from":"to"} favorites`} onClick={()=>profileAction({action:"favorite",songId:s.id,favorite:!profile.favorites.includes(s.id)})}><Heart size={20} fill={profile.favorites.includes(s.id)?"currentColor":"none"}/></button>}<button className="request-button" disabled={!canRequest(s)} aria-label={`${requestLabel(s)}: ${s.title}`} onClick={()=>{setSelected(s);setRequesterName("");setRequestId(crypto.randomUUID());setError("");setSuccess("");}}>{canRequest(s)?<>Request <span>＋</span></>:requestLabel(s)}</button></div></article>)}</div>{!loading&&!visible.length&&!error&&<div className="empty-state"><h2>No songs found</h2><p>{onlyFavorites?"Save a few songs with the heart button, or browse all songs.":"Try another title, artist, set or played status."}</p><button onClick={clearFilters}>Show all songs</button></div>}</section>
 <div data-sticker-anchor="feedback"><ListenerFeedbackForm embedded={embedded}/></div>
 <footer className="listener-footer" data-sticker-anchor="footer">Good friends. Great music. <span>FINAL FANTASY XIV</span>{!embedded&&<a href="/">Owner songbook →</a>}{appearance.animatedBackground&&<ListenerMusicBackground/>}</footer>
 {selected&&<Modal label="request-title" onClose={()=>{if(!busy){setSelected(null);setError("");}}}><div className="ornament">✦ YOUR SONG REQUEST ✦</div><h2 id="request-title">{selected.title}</h2><p>{selected.artist} · {selected.set}</p><p>{requestsOpen===false?"Requests have been closed by Songbook. Please check back later.":statuses[selected.id]?.played?"This song has already been played this show. You can still request it again.":statuses[selected.id]?.requested?"This song has already been requested this show. You can still add your request.":"Send this song request to Songbook?"}</p><label htmlFor="requester-name">Optional (add ingame name)<input id="requester-name" name="requesterName" type="text" maxLength={80} value={requesterName} disabled={busy} onChange={e=>setRequesterName(e.target.value)} placeholder="Your character’s name" autoComplete="off" aria-describedby="requester-name-help" /></label><p id="requester-name-help" className="requester-name-help">Not required to make a request. Your name is shown to Songbook and may be announced in game when your song plays.</p>{error&&<p role="alert">{error}</p>}<div className="editor-actions"><button disabled={busy} onClick={()=>{setSelected(null);setError("");}}>Cancel</button><button className="primary-button" autoFocus disabled={busy||!canRequest(selected)} onClick={submit}>{busy?"Sending…":requestsOpen===false?"Requests closed":"Send request"}</button></div></Modal>}
 <ListenerPageStickers data={profile} pageRef={pageRef} request={stickerRequest} busy={profileBusy} onAction={profileAction}/>
 </main>;
}
