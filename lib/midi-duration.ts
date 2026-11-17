// Standard MIDI format 0/1: integrate the tempo map across the longest track.
// Only file names and computed lengths are sent to the songbook.
export function midiDuration(buffer:ArrayBuffer):number{
 const data=new DataView(buffer);let offset=0;
 const need=(n:number,end=data.byteLength)=>{if(offset+n>end)throw new Error('Incomplete MIDI file.');};
 const byte=()=>{need(1);return data.getUint8(offset++);};
 const word=()=>{need(2);const n=data.getUint16(offset);offset+=2;return n;};
 const long=()=>{need(4);const n=data.getUint32(offset);offset+=4;return n;};
 const tag=()=>String.fromCharCode(byte(),byte(),byte(),byte());
 const variable=(end:number)=>{let n=0;for(let i=0;i<4;i++){need(1,end);const b=byte();n=n*128+(b&127);if(!(b&128))return n;}throw new Error('Invalid MIDI delta time.');};
 if(tag()!=='MThd')throw new Error('Choose a standard .mid or .midi file.');
 const header=long(),headerEnd=offset+header;need(header);
 if(header<6)throw new Error('Invalid MIDI header.');
 const format=word(),tracks=word(),division=word();offset=headerEnd;
 if(format>1||!tracks||!division||(format===0&&tracks!==1))throw new Error('Use MIDI format 0 or 1.');
 let lastTick=0;const tempos:{tick:number;tempo:number}[]=[];
 for(let track=0;track<tracks;track++){
  if(tag()!=='MTrk')throw new Error('Invalid MIDI track.');
  const length=long(),end=offset+length;need(length);let tick=0,running=0,ended=false;
  while(offset<end){
   tick+=variable(end);need(1,end);let status=data.getUint8(offset);
   if(status&128){offset++;if(status<240)running=status;else running=0;}else{if(!running)throw new Error('Invalid MIDI running status.');status=running;}
   if(status===255){
    need(1,end);const type=byte(),size=variable(end);need(size,end);
    if(type===81){if(size!==3)throw new Error('Invalid MIDI tempo.');const tempo=data.getUint8(offset)*65536+data.getUint8(offset+1)*256+data.getUint8(offset+2);if(!tempo)throw new Error('Invalid MIDI tempo.');tempos.push({tick,tempo});}
    offset+=size;if(type===47){lastTick=Math.max(lastTick,tick);ended=true;break;}
   }else if(status===240||status===247){const size=variable(end);need(size,end);offset+=size;}
   else if(status<240){const size=(status>>4)===12||(status>>4)===13?1:2;need(size,end);for(let i=0;i<size;i++)if(byte()&128)throw new Error('Invalid MIDI message.');}
   else throw new Error('Unsupported MIDI event.');
  }
  if(!ended)throw new Error('MIDI track has no end marker.');offset=end;
 }
 let seconds=0;
 if(division&32768){const frameCode=256-(division>>8),ticks=division&255,frames=frameCode===29?30000/1001:frameCode;if(![24,25,29,30].includes(frameCode)||!ticks)throw new Error('Invalid MIDI frame timing.');seconds=lastTick/(frames*ticks);}
 else{let previous=0,tempo=500000;for(const event of tempos.sort((a,b)=>a.tick-b.tick)){if(event.tick>lastTick)break;seconds+=(event.tick-previous)*tempo/division/1000000;previous=event.tick;tempo=event.tempo;}seconds+=(lastTick-previous)*tempo/division/1000000;}
 if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)throw new Error('Song length must be between one second and 24 hours.');
 return Math.ceil(seconds-1e-9);
}
