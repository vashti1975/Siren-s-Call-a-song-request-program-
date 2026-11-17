namespace SongbookSync;
internal sealed record PlaybackUpdate(string Action,string EventId,string File,bool Playing,object Playback);
internal sealed class PlaybackTracker {
 object? lastPlayback,ignoredPlayback;
 double? lastPosition;
 long nextHeartbeat;
 bool playing;
 string eventId="",file="";
 internal void Baseline(object? playback){ignoredPlayback=playback;lastPlayback=playback;eventId="";lastPosition=null;playing=false;}
 internal PlaybackUpdate? Observe(object? playback,bool isPlaying,double? seconds,long now){
  if(!isPlaying||playback==null){
   if(!playing||eventId.Length==0)return null;
   playing=false;nextHeartbeat=now+6000;
   return new("state",eventId,file,false,lastPlayback!);
  }
  var rewind=lastPosition is >3&&seconds is not null&&seconds<lastPosition-3&&seconds<3;
  if(ReferenceEquals(playback,ignoredPlayback)&&!rewind)return null;
  ignoredPlayback=null;
  var start=!ReferenceEquals(playback,lastPlayback)||eventId.Length==0||rewind;
  lastPlayback=playback;lastPosition=seconds;
  if(start){file=PlaybackDetails.FileName(playback);if(string.IsNullOrWhiteSpace(file))return null;eventId=Guid.NewGuid().ToString();}
  var changed=!playing;playing=true;
  if(!start&&!changed&&now<nextHeartbeat)return null;
  nextHeartbeat=now+6000;
  return new(start?"start":"state",eventId,file,true,playback);
 }
}
