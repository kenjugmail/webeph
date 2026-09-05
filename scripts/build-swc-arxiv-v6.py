#!/usr/bin/env python3
"""Versioned SWC v6 manuscript/source build, retaining previous releases."""
from pathlib import Path
from hashlib import sha256
import gzip
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
base=ROOT/'assets/research/stochastic-witness-calculus-arxiv-v5-source.tar.gz'
assert sha256(base.read_bytes()).hexdigest()=='b473614d11144a6800c44e4dcc85e78a4086ab5a43b13bb52c84d2d0aa8c5f98'
work=Path(tempfile.mkdtemp(prefix='swc-arxiv-v6-'))
source=work/'source';source.mkdir()
with tarfile.open(base,'r:gz') as archive:archive.extractall(source,filter='data')
addition=ROOT/'research/stochastic-witness-calculus/arxiv-v6-assurance.tex'
shutil.copy2(addition,source/addition.name)
main=(source/'main.tex').read_text()
main=main.replace('September 5, 2026 -- Version 5','September 5, 2026 -- Version 6')
abstract=r'''Probability can establish deterministic existence when a sound verifier accepts
a witness set of proved positive measure. Stochastic Witness Calculus (SWC)
packages this classical principle as an instance-indexed certificate interface
for learned proof search, exact counting, and a separate empirical mode.
We give compositional rules, explicit quantifier obligations, and an exact
implementation whose generator remains outside the trusted verification base.
On 60 planted SAT instances, a support-preserving learned mixture gives a
median $27{,}810$-fold increase in exact accepted witness mass. A structured
dynamic program checks mass over a space of size $2^{2048}$ without enumeration.
Exact number-theory certificates cover $82{,}887$ specified primes below $10^7$;
neither this finite result nor the follow-up constructions solve the universal
Erd\H{o}s--Straus conjecture.

Version 6 integrates three operating contracts: correctness of each returned
mathematical answer, complete coverage of a declared finite domain, and
fixed-horizon availability under a stated input distribution. The new
demonstration verifies all $12{,}673$ inputs in a declared finite Lonely Runner
domain and all $4{,}603$ fresh generated inputs in a separately specified
evaluation. Zero failures support a one-sided $99\%$ confidence statement of
at least $99.9\%$ verified-answer availability for the frozen solver under the
stated IID model. A canonical-target counterexample motivates retaining complete
fallback support. All conclusions retain their mathematical, finite-domain,
or statistical scope. No physical deployment was evaluated, and the executable
checker is not a proof-assistant formalization.'''
start=main.index(r'\begin{abstract}')+len(r'\begin{abstract}')
end=main.index(r'\end{abstract}',start)
main=main[:start]+'\n'+abstract+'\n'+main[end:]
anchor=r'\section{What the Experiments Establish}'
assert anchor in main
main=main.replace(anchor,r'\input{arxiv-v6-assurance.tex}'+'\n\n'+anchor,1)
main=main.replace(r'\section*{Reproducibility Statement}',
    r'''\paragraph{Operational scope.} The new operating-contract study certifies
returned mathematical witnesses, all members of an explicit finite domain,
and an IID-qualified availability bound for a frozen solver. These are useful
standalone conclusions with explicit evidence; they do not require closing
the universal conjectures used as case studies.

\section*{Reproducibility Statement}''',1)
main=main.replace('The exact finite results can be regenerated without network access.',
    'The deterministic finite checks can be rerun without network access. The version 6 '
    'supplement also includes the frozen plan and complete fresh-input trial ledger; '
    'verify that recorded run rather than silently substituting a new sample.')
main=main.replace('Codex assisted the September 4--5 follow-up derivations, exact checkers, literature audit, and presentation;',
    'Codex assisted the September 4--5 follow-up derivations, exact checkers, literature audit, '
    'operating-contract implementation and evaluation, and presentation;')
(source/'main.tex').write_text(main)
# Restore hypotheses needed for the inherited character-conditioning statement.
revision=source/'arxiv-v5-revision.tex'
body=revision.read_text().replace('For a state $(n,x)$ set $h=4x-n$ and factor',
    'For positive integer states $(n,x)$ with $n\\ge2$, set $h=4x-n$. '
    'Assume $h\\ge3$, $h\\equiv3\\pmod4$, and $\\gcd(x,h)=1$, and factor')
revision.write_text(body)
(source/'00README.txt').write_text('''SWC version 6 source
Main file: main.tex. The source includes all referenced figures and TeX inputs.
Validated compiler: Tectonic 0.17.0, XeTeX engine and BibTeX backend.
Rebuild: SOURCE_DATE_EPOCH=1788566400 tectonic main.tex
Conventional route: xelatex main; bibtex main; xelatex main; xelatex main.
The conventional route and arXiv server processing have not been run here.
The .bbl is included. No external scripts or shell escape are required.
This is a research preprint, not an arXiv acceptance or journal review record.
Article, figures, and numerical records: CC BY 4.0.
Code in the separate research supplement: Apache-2.0.
''')
(source/'LICENSE-content.txt').write_text('Article, figures, and numerical records: Creative Commons Attribution 4.0 International.\nhttps://creativecommons.org/licenses/by/4.0/\nAuthor: Kenju Tomita. Third-party citations retain their respective rights.\n')
engine=os.environ.get('SWC_TECTONIC') or '/tmp/swc-tectonic/bin/tectonic'
if not Path(engine).is_file():engine=shutil.which('tectonic') or engine
environment=dict(os.environ,SOURCE_DATE_EPOCH='1788566400')
subprocess.run([engine,'--keep-logs','--keep-intermediates','main.tex'],cwd=source,env=environment,check=True)
log=(source/'main.log').read_text(errors='replace')
for bad in ('Overfull \\hbox','Overfull \\vbox','There were undefined references','Citation `'):
    if bad in log:raise RuntimeError(f'PDF QA failed: {bad}; inspect {source}/main.log')
output=ROOT/'output/pdf/stochastic-witness-calculus-arxiv-v6.pdf'
output.parent.mkdir(parents=True,exist_ok=True)
web=ROOT/'assets/research'/output.name
shutil.copy2(source/'main.pdf',output);shutil.copy2(output,web)
archive_path=ROOT/'assets/research/stochastic-witness-calculus-arxiv-v6-source.tar.gz'
members=[p for p in sorted(source.rglob('*')) if p.is_file() and
         (p.suffix in ('.tex','.bib','.bbl') or p.parent.name=='figures' or p.name in ('00README.txt','LICENSE-content.txt'))]
with archive_path.open('wb') as raw:
    with gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as compressed:
        with tarfile.open(fileobj=compressed,mode='w',format=tarfile.PAX_FORMAT) as archive:
            for p in members:
                info=archive.gettarinfo(str(p),arcname=str(p.relative_to(source)))
                info.mtime=0;info.uid=info.gid=0;info.uname=info.gname=''
                with p.open('rb') as stream:archive.addfile(info,stream)
manifest={'schemaVersion':1,'version':'6','status':'public-preprint-not-peer-reviewed',
          'filename':web.name,'pages':len(PdfReader(web).pages),'sha256':sha256(web.read_bytes()).hexdigest(),
          'sourceArchive':{'filename':archive_path.name,'sha256':sha256(archive_path.read_bytes()).hexdigest(),
                           'bytes':archive_path.stat().st_size},
          'parentPdf':{'filename':'stochastic-witness-calculus-arxiv-v5.pdf',
                       'sha256':'bd4b3a9ad3cdebf7265d6dec7e4823e6cafcd1fa0c854374bc151e9cf7f650d2'},
          'dateModified':'2026-09-05','universalExistenceStatus':'unproved',
          'physicalDeploymentValidated':False,'finiteCoverage':12673,'freshTrials':4603,'freshFailures':0,
          'availabilityConfidence':'99/100','availabilityLowerBound':'999/1000',
          'availabilityScope':'Uniform seven-element subsets of integers 1..60, frozen solver, stated IID assumptions.',
          'buildEngine':'Tectonic 0.17.0 (XeTeX/BibTeX)','arxivServerValidated':False}
(ROOT/'assets/research/swc-arxiv-v6-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2));print('BUILD_SOURCE='+str(source))
