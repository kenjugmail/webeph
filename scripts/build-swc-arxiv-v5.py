#!/usr/bin/env python3
"""Build a cohesive arXiv-facing SWC v5 manuscript and deterministic source archive."""
from pathlib import Path
from hashlib import sha256
import io
import gzip
import json
import os
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ARCHIVE = Path('/Users/kt/Downloads/stochastic_witness_calculus_arxiv_source_v3.tar.gz')
WORK = ROOT / 'tmp/pdfs/swc-arxiv-v5'
SOURCE = WORK / 'source'
OUT = ROOT / 'output/pdf/stochastic-witness-calculus-arxiv-v5.pdf'
WEB = ROOT / 'assets/research/stochastic-witness-calculus-arxiv-v5.pdf'
WEB_SOURCE = ROOT / 'assets/research/stochastic-witness-calculus-arxiv-v5-source.tar.gz'
MANIFEST = ROOT / 'assets/research/swc-arxiv-v5-manifest.json'

if WORK.exists():
    shutil.rmtree(WORK)
SOURCE.mkdir(parents=True)
with tarfile.open(SOURCE_ARCHIVE, 'r:gz') as archive:
    archive.extractall(SOURCE, filter='data')

for name in ('arxiv-v5-revision.tex', 'arxiv-v5-appendix.tex'):
    shutil.copy2(ROOT / 'research/stochastic-witness-calculus' / name, SOURCE / name)

main = (SOURCE / 'main.tex').read_text()
main = main.replace('\\pdfoutput=1', '\\ifdefined\\XeTeXversion\\else\\pdfoutput=1\\fi', 1)
main = main.replace('backend=biber', 'backend=bibtex', 1)
main = main.replace(
    'Formal probabilistic reasoning already appears in Coq, Isabelle/HOL, EasyCrypt, probabilistic program logics, and formalizations of the probabilistic method \\cite{AudebaudPaulin2006,EberlHolzlNipkow2017,BartheEtAl2017,EdmondsPaulson2023}.',
    'Formal probabilistic reasoning already appears in Coq, Isabelle/HOL, EasyCrypt, and probabilistic program logics \\cite{AudebaudPaulin2006,EberlHolzlNipkow2017,BartheEtAl2017}. Formalizations also cover reusable arguments from the probabilistic method \\cite{EdmondsPaulson2023}.',
    1,
)
main = main.replace('\\date{September 4, 2026}', '\\date{September 5, 2026 -- Version 5}')
abstract_anchor = ('For the Erd\\H{o}s--Straus case study, exact enumeration certifies finite witnesses for all '
                   '$82{,}887$ primes $p\\equiv1\\pmod{24}$ below $10^7$ using shifts $c\\le127$; this is finite '
                   'verification, not a proof of the open conjecture.')
abstract_replacement = abstract_anchor + (' A post-audit exact refinement proves a signed-box criterion, excludes '
    '$c=p-2$ for $p>5$, narrows the complete least-denominator range to $c\\le p-6$, and adds conditional '
    'character-mass and fail-closed reachability certificates. These refinements improve the proof interface but '
    'do not establish positive witness mass for every prime.')
if abstract_anchor not in main:
    raise RuntimeError('abstract anchor changed')
main = main.replace(abstract_anchor, abstract_replacement, 1)
main_anchor = '\\section{What the Experiments Establish}'
if main_anchor not in main:
    raise RuntimeError('main insertion anchor changed')
main = main.replace(main_anchor, '\\input{arxiv-v5-revision.tex}\n\n' + main_anchor, 1)
appendix_anchor = '\\section{Exact Finite Certificate Schema}'
if appendix_anchor not in main:
    raise RuntimeError('appendix insertion anchor changed')
main = main.replace(appendix_anchor, '\\input{arxiv-v5-appendix.tex}\n\n' + appendix_anchor, 1)
disclosure = ('GPT-5.6 Pro assisted with literature synthesis, code and figure generation, and manuscript drafting. '
              'The human author directed the project, selected and audited the retained claims, and is responsible for the manuscript.')
main = main.replace(disclosure, disclosure + (' Codex assisted the September 4--5 follow-up derivations, exact '
    'checkers, literature audit, and presentation; this assistance is not independent peer review.'), 1)
(SOURCE / 'main.tex').write_text(main)

tectonic = str(Path('/tmp/swc-tectonic/bin/tectonic'))
if not Path(tectonic).is_file():
    tectonic = shutil.which('tectonic') or '/opt/homebrew/bin/tectonic'
environment = dict(os.environ)
environment['SOURCE_DATE_EPOCH'] = '1788566400'
subprocess.run([tectonic, '--keep-logs', '--keep-intermediates', 'main.tex'], cwd=SOURCE, env=environment, check=True)
built = SOURCE / 'main.pdf'
if not built.is_file():
    raise RuntimeError('tectonic did not produce main.pdf')
log = (SOURCE / 'main.log').read_text(errors='replace')
if 'Overfull \\hbox' in log or 'Overfull \\vbox' in log:
    raise RuntimeError('TeX layout overflow detected; inspect main.log')
OUT.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(built, OUT)
shutil.copy2(built, WEB)

for transient in ('main.aux', 'main.log', 'main.run.xml'):
    path = SOURCE / transient
    if path.exists():
        path.unlink()

members = [p for p in sorted(SOURCE.rglob('*')) if p.is_file() and p.name != 'main.pdf']
with WEB_SOURCE.open('wb') as raw:
    with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for path in members:
                info = archive.gettarinfo(str(path), arcname=str(path.relative_to(SOURCE)))
                info.mtime = 0
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                with path.open('rb') as stream:
                    archive.addfile(info, stream)

from pypdf import PdfReader
reader = PdfReader(WEB)
record = {
    'schemaVersion': 1,
    'version': '5-arxiv',
    'status': 'public-preprint-not-peer-reviewed',
    'filename': WEB.name,
    'pages': len(reader.pages),
    'sha256': sha256(WEB.read_bytes()).hexdigest(),
    'sourceArchive': {
        'filename': WEB_SOURCE.name,
        'sha256': sha256(WEB_SOURCE.read_bytes()).hexdigest(),
        'bytes': WEB_SOURCE.stat().st_size,
    },
    'construction': 'Cohesive recompilation of the v3 LaTeX source with integrated v5 exact refinements.',
    'universalExistenceStatus': 'unproved',
    'dateModified': '2026-09-05',
}
MANIFEST.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
