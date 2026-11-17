# MidiBard companion

**Songbook Sync v1.1.0** observes MidiBard 2 on the lead bard, reports playback, marks matching songs played, updates Playing now and optionally sends one `/s` announcement per new matched song.

## Install and pair

Use `public/SongbookSync-source.zip` and [bridge/SETUP.txt](../bridge/SETUP.txt). Install only on the lead bard. It is separate from MidiBard; do not overwrite MidiBard's DLL.

Build the source on Windows first, then generate a connection key in the owner page and paste `/songbooksync https://YOUR-HOST TOKEN` into FFXIV. The endpoint is configurable and no production website is hardcoded. No song list, saved filename matches or connection key is included.

| Command | Behavior |
| --- | --- |
| `/songbooksync status` | Connection status |
| `/songbooksync announcements off` | Disable say messages, keep website sync |
| `/songbooksync announcements on` | Enable say messages |
| `/songbooksync disconnect` | Remove the PC's connection |

Website Disconnect revokes the server key. Pairing elsewhere needs that deployment's URL and key.

## Announcements

- Requested: `By Request ♪ Title — Artist ♪`
- Named request: `By Request by Player Name ♪ Title — Artist ♪`
- Other song: `♪ Title — Artist ♪`

The owner may omit requester names from say while keeping names privately. Retries and heartbeats do not repeat announcements. Pause/stop clears Playing now; disconnects expire its lease in about 20 seconds. Played history stays saved.

## Build

The project targets .NET 10 on Windows and the included manifest declares Dalamud API 15. It references locally installed Dalamud libraries. Later game, Dalamud or MidiBard changes may require companion changes.

```powershell
dotnet build bridge/SongbookSync.csproj -c Release -p:DalamudLibPath="C:\path\to\Dalamud"
```

The directory needs `Dalamud.dll`, `FFXIVClientStructs.dll` and `InteropGenerator.Runtime.dll`. The default is `%APPDATA%/XIVLauncher/addon/Hooks/dev`. Package the built DLL with the manifest and setup instructions.

```bash
dotnet run --project bridge-tests/test.csproj
```

Web/database checks cover matching, pairing and playback without FFXIV. Actual loading/chat delivery requires the Windows game client. MIDI music files are not included; this project stores metadata and filename matches.
