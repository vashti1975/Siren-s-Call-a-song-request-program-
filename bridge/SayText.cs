using System.Globalization;
using System.Text;
namespace SongbookSync;
internal static class SayText {
 internal static string Command(string text){
  var result=new StringBuilder("/s ");
  foreach(var rune in text.EnumerateRunes()){
   var category=Rune.GetUnicodeCategory(rune);
   if(category is UnicodeCategory.Control or UnicodeCategory.Format or UnicodeCategory.Surrogate)continue;
   if(rune.Value is '<' or '>')continue;
   if(Encoding.UTF8.GetByteCount(result.ToString())+rune.Utf8SequenceLength>450)break;
   result.Append(rune.ToString());
  }
  return result.ToString();
 }
}
