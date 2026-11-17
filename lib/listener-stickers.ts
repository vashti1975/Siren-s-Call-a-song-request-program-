export const stickerAnchors=["header","profile","catalog","feedback","footer","border-left","border-right","page"] as const;
export type StickerAnchor=typeof stickerAnchors[number];
export type StickerPlacement={id:string;anchor:StickerAnchor;x:number;y:number};
export const clampSticker=(value:number)=>Math.max(0,Math.min(1,value));
export function pagePlacement(id:string,left:number,top:number,width:number,height:number,stickerWidth:number,stickerHeight:number):StickerPlacement{
 return {id,anchor:'page',x:clampSticker(left/Math.max(1,width-stickerWidth)),y:clampSticker(top/Math.max(1,height-stickerHeight))};
}
export function stickerPagePosition(p:StickerPlacement,width:number,height:number,stickerWidth:number,stickerHeight:number){
 return {left:p.x*Math.max(0,width-stickerWidth),top:p.y*Math.max(0,height-stickerHeight)};
}
export function borderPlacement(id:string,left:number,top:number,width:number,height:number,stickerWidth:number,stickerHeight:number):StickerPlacement{
 const right=left+stickerWidth/2>=width/2;
 return {id,anchor:right?'border-right':'border-left',x:right?1:0,y:clampSticker(top/Math.max(1,height-stickerHeight))};
}
export function stickerBorderPosition(p:StickerPlacement,width:number,height:number,gutter:number,stickerWidth:number,stickerHeight:number){
 return {left:p.anchor==='border-left'?(gutter-stickerWidth)/2:width-gutter+(gutter-stickerWidth)/2,top:p.y*Math.max(0,height-stickerHeight)};
}

export function isStickerPlacement(value:unknown):value is StickerPlacement{
 if(!value||typeof value!=="object")return false;
 const p=value as StickerPlacement;
 return typeof p.id==='string'&&stickerAnchors.includes(p.anchor)&&Number.isFinite(p.x)&&p.x>=0&&p.x<=1&&Number.isFinite(p.y)&&p.y>=0&&p.y<=1;
}
// Existing shelf selections become page decorations without losing earned art.
export function readStickerPlacements(raw:string,featured:string[]):StickerPlacement[]{
 let saved:unknown;try{saved=JSON.parse(raw);}catch{saved=[];}
 const placements=new Map<string,StickerPlacement>();
 if(Array.isArray(saved))for(const p of saved)if(isStickerPlacement(p)&&featured.includes(p.id))placements.set(p.id,p);
 featured.forEach((id,index)=>{if(!placements.has(id))placements.set(id,{id,anchor:index<6?'header':'footer',x:(index%6)/5,y:index<6?.9:.5});});
 return [...placements.values()];
}
