#!/usr/bin/env python3
"""Versioned code/data deposit; includes complete JSONL trials and frozen plan."""
from pathlib import Path
from hashlib import sha256
import argparse
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True)
source=parser.parse_args().source.resolve()
assert (source/'research/evidence/swc-assurance-v1/trials.jsonl').is_file()
files={}
for p in sorted((source/'research').rglob('*')):
    if p.is_file() and p.suffix in ('.md','.py','.json','.jsonl','.cpp'):
        files[str(p.relative_to(source))]=p.read_bytes()
files['LICENSE-code']=(source/'LICENSE').read_bytes()
files['LICENSE-content.txt']=b'Explanatory text and numerical records: CC BY 4.0.\nhttps://creativecommons.org/licenses/by/4.0/\n'
original=Path('/Users/kt/Downloads/stochastic_witness_calculus_artifact_v3.zip')
original_hash='e22bc0f376244744e6b506b9562465ffc5174239f0fb9f0f7e8e1368f7121899'
assert sha256(original.read_bytes()).hexdigest()==original_hash
prefixes=('experiments/','experiments_v3/','results/','results_v3/','tests/','tests_v3/','src/','examples/','schemas/','formal/')
with zipfile.ZipFile(original) as archive:
    for info in archive.infolist():
        name=info.filename
        if info.is_dir() or '__pycache__' in name or name.endswith('.pyc'):continue
        if name.startswith(prefixes) or name in ('requirements.txt','README.md','EXPERIMENT_MANIFEST.json','MANIFEST.sha256','CLAIMS_AND_LIMITS.md'):
            assert '..' not in Path(name).parts and not name.startswith('/')
            files['original-v3/'+name]=archive.read(info)
files['original-v3/DEPOSIT-NOTE.txt']=(
    'Historical experimental sources and data, preserved from the supplied v3 archive.\n'
    f'Original archive SHA-256: {original_hash}\n'
    'This is a selected source/data deposit, not a replacement copy of the full archive.\n'
    'Its original MANIFEST.sha256 is retained for provenance and has six known stale entries.\n'
    'Use the outer SHA256.json to identify the bytes delivered here.\n'
    'No historical physical experiment or large prime sweep was rerun for this release.\n').encode()
files['README.md']=b'''# SWC version 6 research supplement

Exact-output contracts, complete finite-domain certificates, and a recorded
fixed-horizon reliability evaluation. This package is a public research
preprint artifact, not an accepted journal deposit or a universal solution.
The evidence uses generated mathematical inputs, not physical measurements.

From research/, verify the existing experiment without sampling again:
python3 -B verify_swc_assurance_pilot.py evidence/swc-assurance-v1
python3 -B verify_swc_canonical_obstruction.py evidence/swc-canonical-obstructions.json
python3 -B -m unittest test_swc_assurance test_swc_canonical_pair test_swc_lonely_runner test_swc_certificate_kernel

The complete ledger, plan, and finite witnesses are included. Treat IID
provenance as a stated assumption, not something established by fingerprints.
Do not silently replace a failed run or pool fresh runs without a valid plan.
Historical large prime searches are not needed to verify this release.
Historical experiment sources, requirements, and raw outputs are included
under original-v3/ with an explicit provenance note; its old manifest has
known stale entries and is not silently repaired. Use the outer SHA256.json.

Paper: https://ephemerent.com/assets/research/stochastic-witness-calculus-arxiv-v6.pdf
HTML: https://ephemerent.com/journal/preprint/stochastic-witness-calculus
Code: Apache-2.0. Text and numerical records: CC BY 4.0.
'''
hashes={name:sha256(data).hexdigest() for name,data in files.items()}
files['SHA256.json']=(json.dumps(hashes,indent=2,sort_keys=True)+'\n').encode()
output=ROOT/'assets/research/swc-v6-research-supplement.zip'
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for name,data in sorted(files.items()):
        entry=zipfile.ZipInfo(name,date_time=(2026,9,5,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED
        entry.external_attr=0o100644<<16;archive.writestr(entry,data)
summary=(source/'research/evidence/swc-assurance-v1/summary.json').read_bytes()
(ROOT/'assets/research/swc-v6-assurance-summary.json').write_bytes(summary)
manifest={'filename':output.name,'sha256':sha256(output.read_bytes()).hexdigest(),
          'bytes':output.stat().st_size,'files':len(files),'date':'2026-09-05',
          'scope':'research_supplement_not_accepted_journal_deposit'}
(ROOT/'assets/research/swc-v6-supplement-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
