using System.Reflection;
namespace SongbookSync;
internal static class PlaybackDetails {
 internal static string FileName(object playback){
  const BindingFlags flags=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance;
  var type=playback.GetType();
  var path=type.GetProperty("FilePath",flags)?.GetValue(playback) as string;
  var display=type.GetProperty("DisplayName",flags)?.GetValue(playback) as string;
  return Path.GetFileName((string.IsNullOrWhiteSpace(path)?display??"":path).Replace('\\','/'));
 }
}
