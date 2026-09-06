#!/usr/bin/env python3
"""Package versioned research notes/checkers without executing their searches."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True)
args=parser.parse_args();source=args.source.resolve()
if not (source/'research/swc_certificate_kernel.py').is_file():raise SystemExit('wrong research source')
files={}
for path in sorted((source/'research').rglob('*')):
    if path.is_file() and path.suffix in {'.md','.py','.json','.cpp'}:
        files[str(path.relative_to(source))]=path.read_bytes()
files['LICENSE']=(source/'LICENSE').read_bytes()
files['revision-v5.json']=(ROOT/'research/stochastic-witness-calculus/revision-v5.json').read_bytes()
files['README.md']=b'''# SWC v5 research supplement

This supplement contains exact checkers, certificates, and research notes.
It is not a universal Erdos-Straus proof or an accepted journal release.
The original v3 source archive is separate and still needs checksum/build
reconciliation. Code: Apache-2.0; accompanying text/data: CC BY 4.0.

Recommended lightweight commands from research/:
python3 -B -m unittest test_swc_certificate_kernel
python3 -B swc_certificate_kernel.py evidence/swc-combined-cases.json
python3 -B verify_character_induction.py evidence/swc-character-induction.json
python3 -B verify_swc_reachability.py evidence/swc-reachability-certificate.json

Historical large-prime search programs are included for provenance but are
not required for these checks. Do not run large sweeps on a memory-limited
machine. Read final-literature-audit-2026-09-05.md and the notes' scope limits.

PDF: https://ephemerent.com/assets/research/stochastic-witness-calculus-arxiv-v5.pdf
Web: https://ephemerent.com/journal/preprint/stochastic-witness-calculus
'''
hashes={name:hashlib.sha256(data).hexdigest() for name,data in files.items()}
files['SHA256.json']=(json.dumps(hashes,indent=2,sort_keys=True)+'\n').encode()
output=ROOT/'assets/research/swc-v5-research-supplement.zip'
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name,data in sorted(files.items()):
        entry=zipfile.ZipInfo(name,date_time=(2026,9,5,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED
        entry.external_attr=0o100644<<16;archive.writestr(entry,data)
record=dict(filename=output.name,sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
            bytes=output.stat().st_size,files=len(files),scope='research_supplement_not_accepted_journal_deposit',
            date='2026-09-05')
(ROOT/'assets/research/swc-v5-supplement-manifest.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
