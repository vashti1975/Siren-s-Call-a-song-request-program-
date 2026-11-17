# Siren's Call plugin: normal installation

The companion is being prepared for Dalamud's normal plugin installer so it can replace the manual Dev Plugin Locations setup. It connects MidiBard 2 to the hosted songbook; the website remains the listener request page and owner interface. MidiBard still plays the music.

**Release status:** distribution source and build automation are prepared. A successful Windows compilation, in-game testing and an approved public download location are required before an install link is available. Do not remove a working development installation yet.

## Build and package

The project uses the official `Dalamud.NET.Sdk/15.0.0` with .NET 10. The internal name remains `SongbookSync`, preserving the command and configuration identity. Version 1.2.0 appears in the installer as **Siren's Call Song Request Book**.

The GitHub Actions workflow **Build Siren's Call plugin** runs on plugin pull requests and changes merged into main. It downloads pinned official Dalamud 15.0.4.0 libraries, runs playback/announcement and packaging tests, builds on Windows, and retains a private artifact named `SirensCall-SongbookSync`. A compile failure prevents an install artifact from being uploaded. The workflow has read-only repository permission and does not publish releases or alter repository access.

For a local Windows build with .NET 10 and installed Dalamud:

```powershell
dotnet run --project bridge-tests/test.csproj --configuration Release
dotnet build bridge/SongbookSync.csproj --configuration Release
python scripts/test-plugin-package.py
python scripts/package-plugin.py --build-root bridge/bin --output plugin-dist
```

Set `DALAMUD_HOME` or pass `-p:DalamudLibPath="C:\path\to\Dalamud"` for a custom library location. Clean old build folders before packaging if more than one `SongbookSync/latest.zip` exists.

The validated output contains `latest.zip`, its generated `SongbookSync.json`, and `SHA256SUMS.txt`. The install ZIP contains only the compiled plugin DLL, matching generated manifest and license. The separate `public/SongbookSync-source.zip` download contains source and is not installable through Dalamud.

## Public download location

Dalamud custom repository URLs must serve a JSON array without authentication. Keep the private source repository private. After choosing a public folder for the compiled release, generate the listing with its real URL:

```powershell
python scripts/package-plugin.py --build-root bridge/bin --output plugin-dist --public-base-url https://YOUR-DOWNLOAD-HOST/sirens-call
```

This additionally writes `pluginmaster.json`, using the version and API level from the generated manifest, and install/update links to that folder's `latest.zip`. Without a base URL, no listing is produced. This command only writes files; it does not upload or publish them. The same option is available when manually running the GitHub workflow after it is merged.

Publish the validated files together to the chosen public location, then verify both the listing and ZIP can be downloaded without signing in. A private GitHub Actions artifact or private release URL cannot serve as a Dalamud installer feed. Never include connection settings, pairing keys, catalogs or personal artwork in a distribution.

On later updates, increase both `Version` and `AssemblyVersion` in `bridge/SongbookSync.csproj`, rebuild, test and republish the ZIP and regenerated listing together. Rebuild against the applicable SDK when Dalamud changes API levels. Automatic client updates require a reachable feed and a higher assembly version; the prepared workflow does not automatically publish new releases.

## Install after the release is tested

1. In `/xlsettings`, open Experimental and add the published `pluginmaster.json` URL under Custom Plugin Repositories.
2. Open `/xlplugins`, find **Siren's Call Song Request Book** and install it.
3. Pair it using the command from the owner page's MidiBard Sync panel.

Install only on the lead bard. Keep MidiBard 2 installed. A custom repository is separate from acceptance into Dalamud's official plugin list.

## Replace the existing development installation

Back up the `SongbookSync` configuration folder locally before making the switch. Its `connection.json` contains the private key and should never be uploaded. Once a tested normal release is available, disable the development instance and remove its Dev Plugin Locations entry before enabling the installed copy. Two copies must not run together.

The internal name, connection format, endpoint and `/songbooksync` command are retained. The normal installation should reuse the saved configuration; if it does not, generate a new connection command on the owner page and pair it again. Confirm `/songbooksync status`, then play one requested song and check Playing now, request clearing and one `/s` announcement. Test pause/resume and playing the same song twice. Keep the previous files until these checks pass.

## References

- [Custom Dalamud repositories](https://dalamud.dev/plugin-publishing/custom-repositories/)
- [Official API 15 SDK and packaging guidance](https://dalamud.dev/versions/v15/)
- [Official sample plugin build workflow](https://github.com/goatcorp/SamplePlugin/blob/master/.github/workflows/pr-build.yml)
