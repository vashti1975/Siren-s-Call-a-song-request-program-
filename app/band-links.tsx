import { ExternalLink } from "lucide-react";

export default function BandLinks({embedded=false}:{embedded?:boolean}){
 if(!embedded)return null;
 return <nav className="listener-band-links" aria-label="More from Songbook">
  <a href="/requests" target="_blank" rel="noopener noreferrer">Open full songbook<ExternalLink size={13} aria-hidden="true"/></a>
 </nav>;
}
