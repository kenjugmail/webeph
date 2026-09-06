#!/usr/bin/env python3
"""Stage the audited SWC v3 PDF and deterministic web figure crops."""

from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import shutil
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/kt/Downloads/stochastic_witness_calculus_arxiv_v3.pdf')
OUT = ROOT / 'assets' / 'research'
EXPECTED = '17ff47c284b79207e2365d286c18aaa19915c63bf0af655a587066a5647b462a'

if not SOURCE.is_file():
    raise SystemExit(f'missing audited PDF: {SOURCE}')
if sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED:
    raise SystemExit('SWC v3 PDF hash changed; refusing to stage an unaudited file')

OUT.mkdir(parents=True, exist_ok=True)
pdf_target = OUT / 'stochastic-witness-calculus-v3.pdf'
shutil.copyfile(SOURCE, pdf_target)

crops = [
    ('swc-architecture.webp', 14, (0.08, 0.055, 0.92, 0.255), 'Trusted-boundary architecture and Figure 1 caption'),
    ('swc-sat-mass.webp', 16, (0.10, 0.055, 0.90, 0.50), 'SAT accepted-mass speedup and Figure 2 caption'),
    ('swc-path-mass.webp', 17, (0.10, 0.055, 0.90, 0.515), 'Non-enumerative path-graph mass and Figure 3 caption'),
    ('swc-quantifier-audit.webp', 19, (0.09, 0.055, 0.91, 0.965), 'Quantifier-audit Figures 5 and 6'),
    ('swc-erdos-finite.webp', 21, (0.09, 0.055, 0.91, 0.965), 'Finite Erdős–Straus Figures 7 and 8'),
    ('swc-anytime-valid.webp', 23, (0.09, 0.035, 0.91, 0.975), 'Optional-stopping Figures 9 and 10'),
]

records = []
with TemporaryDirectory(prefix='swc-preprint-') as tmp:
    tmp_path = Path(tmp)
    for filename, page, box, description in crops:
        prefix = tmp_path / f'page-{page}'
        subprocess.run([
            'pdftoppm', '-f', str(page), '-l', str(page), '-singlefile',
            '-png', '-r', '180', str(SOURCE), str(prefix)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        image = Image.open(prefix.with_suffix('.png')).convert('RGB')
        width, height = image.size
        left, top, right, bottom = box
        crop = image.crop((round(width * left), round(height * top), round(width * right), round(height * bottom)))
        target = OUT / filename
        crop.save(target, 'WEBP', quality=92, method=6)
        records.append({
            'filename': filename,
            'sourcePage': page,
            'description': description,
            'width': crop.width,
            'height': crop.height,
            'sha256': sha256(target.read_bytes()).hexdigest(),
        })

manifest = {
    'schemaVersion': 1,
    'status': 'public-preprint-assets',
    'source': {
        'filename': SOURCE.name,
        'pages': 34,
        'sha256': EXPECTED,
    },
    'publishedPdf': {
        'filename': pdf_target.name,
        'sha256': sha256(pdf_target.read_bytes()).hexdigest(),
    },
    'figureCrops': records,
    'notice': 'The PDF is the canonical v3 preprint. Crops reproduce manuscript figures without changing their data.',
}
(OUT / 'swc-v3-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'staged SWC v3 preprint · {len(records)} figure assets · {EXPECTED}')
