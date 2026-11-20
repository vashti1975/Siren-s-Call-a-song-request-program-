"""Prepare both build-verified companions and a shared Dalamud repository feed."""
import argparse
import hashlib
import json
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('package_plugin', ROOT / 'scripts/package-plugin.py')
packager = module_from_spec(spec)
spec.loader.exec_module(packager)

def prepare_release(repository):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Expected a GitHub owner/repository.')
    output = ROOT / 'plugin-dist'
    output.mkdir(exist_ok=True)
    project = ET.parse(ROOT / 'bridge/SongbookSync.csproj').getroot()
    version = project.findtext('.//Version')
    if not re.fullmatch(r'\d+\.\d+\.\d+', version or ''):
        raise ValueError('A stable three-part release version is required.')
    base = f'https://github.com/{repository}/releases/download/v{version}'
    entries, checksums = [], []
    for internal, folder in [('SongbookSync', 'bridge'), ('TramaticSync', 'bridge-tramatic')]:
        packages = list((ROOT / folder / 'bin').rglob(f'{internal}/latest.zip'))
        if len(packages) != 1:
            raise ValueError(f'Expected exactly one compiled SDK package for {internal}.')
        temporary = output / internal
        manifest = packager.prepare(packages[0], temporary, base, internal_name=internal, archive_name=internal+'.zip')
        if manifest['AssemblyVersion'] != version+'.0':
            raise ValueError('Both companions must use the same release version.')
        archive = output / (internal+'.zip')
        shutil.copyfile(temporary / archive.name, archive)
        checksums.append(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name)
        entries.extend(json.loads((temporary / 'pluginmaster.json').read_text(encoding='utf-8')))
    (output / 'pluginmaster.json').write_text(json.dumps(entries, indent=2)+'\n', encoding='utf-8')
    (output / 'SHA256SUMS.txt').write_text('\n'.join(checksums)+'\n', encoding='utf-8')
    feed = f'https://raw.githubusercontent.com/{repository}/main/pluginmaster.json'
    notes = f'''Normal Dalamud installation for Siren's Call Song Request Book and Tramatic Sync {version}.

Add this URL in /xlsettings > Experimental > Custom Plugin Repositories:
{feed}

Then open /xlplugins and install ONE companion on the lead bard:
- Siren's Call Song Request Book (SongbookSync): configurable hosted songbook; /songbooksync HTTPS_URL TOKEN.
- Tramatic Sync (TramaticSync): compatible with the existing Tramatic installation and saved key; /tramaticsync status.

Before moving from Dev Tools, disable the development copy and remove its Dev Plugin Locations entry. Keep your local configuration. Do not run the development and installed copies together. The Tramatic build retains its internal name and existing connection.json format; no key is shipped in these packages.

Built against Dalamud API 15 with .NET 10. Playback/announcement logic and installer packaging are checked by the build. Live FFXIV operation has not been tested in this environment. Keep the old files until you have verified Playing now, request completion and one /s announcement in game.

Web updates include persistent Ignore this song, Allow matching, same-key Refresh connection, and listener location refresh. The reusable web source starts with an empty catalog and generic appearance. Packages contain only the compiled companion, its matching manifest and AGPL-3.0 license; no songs, private artwork, connection keys, MidiBard DLLs or game libraries.
'''
    (output / 'release-notes.md').write_text(notes, encoding='utf-8')
    print(f'Prepared v{version}: two compiled companions, checksums and a shared installer feed.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', required=True)
    prepare_release(parser.parse_args().repository)
