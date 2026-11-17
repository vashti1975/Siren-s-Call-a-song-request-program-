"""Validate the compiled SDK package and prepare files for a custom Dalamud repo.

This script never uploads files or changes repository visibility.
"""
import argparse
import hashlib
import json
import re
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
INTERNAL_NAME = "SongbookSync"  # Retained so existing settings keep working.


def validate_base_url(value):
    url = urlsplit(value)
    if (url.scheme != "https" or not url.hostname or url.username or url.password
            or url.query or url.fragment or "\\" in value or any(c.isspace() for c in value)):
        raise ValueError("Public base URL must be a plain HTTPS folder without credentials, query or fragment.")
    return value.rstrip("/")


def prepare(package, output, public_base_url=None, now=None):
    project = ET.parse(ROOT / "bridge/SongbookSync.csproj").getroot()
    expected_version = project.findtext(".//AssemblyVersion")
    expected_api = int(project.attrib["Sdk"].split("/")[1].split(".")[0])
    required = {f"{INTERNAL_NAME}.dll", f"{INTERNAL_NAME}.json", "LICENSE"}
    with ZipFile(package) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate paths in SDK package.")
        if not required.issubset(names):
            raise ValueError("A compiled plugin DLL, generated manifest and LICENSE are required at the ZIP root.")
        # Only this plugin's runtime files ship, excluding source, PDBs, keys
        # and host-provided Dalamud/game libraries.
        contents = {name: archive.read(name) for name in required}
    if not contents[f"{INTERNAL_NAME}.dll"].startswith(b"MZ"):
        raise ValueError("The package does not contain a compiled Windows DLL.")
    manifest = json.loads(contents[f"{INTERNAL_NAME}.json"])
    if (manifest.get("InternalName") != INTERNAL_NAME
            or manifest.get("AssemblyVersion") != expected_version
            or manifest.get("DalamudApiLevel") != expected_api):
        raise ValueError("Generated manifest does not match the assembly identity, project version or SDK API.")
    if not re.fullmatch(r"\d+\.\d+\.\d+\.\d+", str(expected_version)):
        raise ValueError("A four-part assembly version is required for installer updates.")
    for field in ["Author", "Name", "Description", "Punchline"]:
        if not isinstance(manifest.get(field), str) or not manifest[field].strip():
            raise ValueError(f"Manifest is missing {field}.")
    base = validate_base_url(public_base_url) if public_base_url else None
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    installer = output / "latest.zip"
    with ZipFile(installer, "w", ZIP_DEFLATED) as archive:
        for name in sorted(contents):
            archive.writestr(name, contents[name])
    (output / f"{INTERNAL_NAME}.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    digest = hashlib.sha256(installer.read_bytes()).hexdigest()
    (output / "SHA256SUMS.txt").write_text(f"{digest}  latest.zip\n", encoding="utf-8")
    feed = output / "pluginmaster.json"
    if base:
        entry = dict(manifest)
        entry.update(IsHide=False, IsTestingExclusive=False,
                     DownloadLinkInstall=base + "/latest.zip",
                     DownloadLinkUpdate=base + "/latest.zip",
                     LastUpdate=int(time.time() if now is None else now))
        feed.write_text(json.dumps([entry], indent=2) + "\n", encoding="utf-8")
    else:
        feed.unlink(missing_ok=True)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--public-base-url")
    args = parser.parse_args()
    packages = list(args.build_root.rglob("SongbookSync/latest.zip"))
    if len(packages) != 1:
        parser.error("Expected exactly one SDK-generated SongbookSync/latest.zip. Clean old output and rebuild Release.")
    manifest = prepare(packages[0], args.output, args.public_base_url)
    print(f"Prepared {manifest['Name']} {manifest['AssemblyVersion']} (API {manifest['DalamudApiLevel']}).")
    print("Installer feed prepared." if args.public_base_url else
          "No public installer URL configured; build files remain private until separately published.")


if __name__ == "__main__":
    main()
