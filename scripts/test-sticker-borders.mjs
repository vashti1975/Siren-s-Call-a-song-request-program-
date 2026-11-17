import assert from 'node:assert/strict';
import {borderPlacement,stickerBorderPosition,pagePlacement,stickerPagePosition} from '../lib/listener-stickers.ts';
for(const [width,gutter,stickerWidth,stickerHeight] of [[1280,100,86,146],[780,100,86,146],[390,52,40,76],[320,52,40,76]]){
 for(const height of [500,20000])for(const y of [0,.37,1])for(const anchor of ['border-left','border-right']){
  const p={id:'request:1',anchor,x:anchor==='border-left'?0:1,y};
  const box=stickerBorderPosition(p,width,height,gutter,stickerWidth,stickerHeight);
  assert(box.left>=0&&box.left+stickerWidth<=width,'sticker stays inside the page');
  assert(box.top>=0&&box.top+stickerHeight<=height,'vertical placement stays on the page');
  assert(anchor==='border-left'?box.left+stickerWidth<gutter:box.left>width-gutter,'sticker never overlaps the content boxes');
  const dropped=borderPlacement(p.id,box.left,box.top,width,height,stickerWidth,stickerHeight);
  assert.equal(dropped.anchor,anchor);assert(Math.abs(dropped.y-y)<1e-10,'saving and reopening preserves vertical placement');
 }
 assert.equal(borderPlacement('request:1',-100,-100,width,500,stickerWidth,stickerHeight).y,0);
 assert.equal(borderPlacement('request:1',width,10000,width,500,stickerWidth,stickerHeight).y,1);
}
console.log('PASS: phone/desktop border clearance, no content overlap or horizontal overflow, top/bottom clamping and stable saved positions on short and long pages.');
for(const [width,height,stickerWidth,stickerHeight] of [[1280,20000,86,146],[390,3000,40,76]]){
 for(const left of [0,15,width*.14,width*.32,width-stickerWidth])for(const top of [0,180,500,height-stickerHeight]){
  const p=pagePlacement('request:1',left,top,width,height,stickerWidth,stickerHeight);
  const restored=stickerPagePosition(p,width,height,stickerWidth,stickerHeight);
  assert.equal(p.anchor,'page');assert(Math.abs(restored.left-left)<1e-8);assert(Math.abs(restored.top-top)<1e-8,'free drop coordinates survive saving without a border snap');
 }
}
const besideBox=pagePlacement('request:1',158,200,1280,20000,86,146);
assert.equal(stickerPagePosition(besideBox,1280,20000,86,146).left,158,'the space beside a centered catalog is available beyond the old 100px rail');
console.log('PASS: exact free placement in side margins, including beside content boxes, preserved across phone/desktop save round trips.');
