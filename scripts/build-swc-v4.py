#!/usr/bin/env python3
"""Build SWC v4 by preserving v3 and inserting a formal revision chapter."""

from io import BytesIO
from pathlib import Path
from hashlib import sha256
from tempfile import TemporaryDirectory
import json

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/kt/Downloads/stochastic_witness_calculus_arxiv_v3.pdf')
OUTPUT = ROOT / 'output' / 'pdf' / 'stochastic_witness_calculus_v4.pdf'
WEB_OUTPUT = ROOT / 'assets' / 'research' / 'stochastic-witness-calculus-v4.pdf'
EXPECTED_V3 = '17ff47c284b79207e2365d286c18aaa19915c63bf0af655a587066a5647b462a'

if not SOURCE.is_file() or sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED_V3:
    raise SystemExit('Audited SWC v3 source is missing or has changed')

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
WEB_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

font_dir = Path('/System/Library/Fonts/Supplemental')
pdfmetrics.registerFont(TTFont('V4Serif', str(font_dir / 'Times New Roman.ttf')))
pdfmetrics.registerFont(TTFont('V4SerifBold', str(font_dir / 'Times New Roman Bold.ttf')))
pdfmetrics.registerFont(TTFont('V4SerifItalic', str(font_dir / 'Times New Roman Italic.ttf')))
pdfmetrics.registerFont(TTFont('V4Sans', str(font_dir / 'Arial.ttf')))
pdfmetrics.registerFont(TTFont('V4SansBold', str(font_dir / 'Arial Bold.ttf')))

INK = colors.HexColor('#101a32')
BLUE = colors.HexColor('#2d5bd1')
CORAL = colors.HexColor('#b74838')
MUTED = colors.HexColor('#5b6472')
PAPER = colors.HexColor('#f7f3ea')
PALE_BLUE = colors.HexColor('#eef2fb')
RULE = colors.HexColor('#cfc7b8')


class InvariantCanvas(Canvas):
    def __init__(self, *args, **kwargs):
        kwargs['invariant'] = 1
        super().__init__(*args, **kwargs)

styles = getSampleStyleSheet()
body = ParagraphStyle('BodyV4', parent=styles['BodyText'], fontName='V4Serif', fontSize=10.3, leading=14.3, textColor=INK, spaceAfter=9)
small = ParagraphStyle('SmallV4', parent=body, fontName='V4Sans', fontSize=7.5, leading=10.5, textColor=MUTED)
label = ParagraphStyle('LabelV4', parent=small, fontName='V4SansBold', fontSize=6.6, leading=8.5, textColor=BLUE, tracking=1.1, uppercase=True)
h1 = ParagraphStyle('H1V4', parent=body, fontName='V4Serif', fontSize=29, leading=29.5, textColor=INK, spaceAfter=14)
h2 = ParagraphStyle('H2V4', parent=body, fontName='V4Serif', fontSize=18, leading=20, textColor=INK, spaceBefore=7, spaceAfter=10)
theorem_title = ParagraphStyle('TheoremTitleV4', parent=body, fontName='V4SansBold', fontSize=8, leading=10, textColor=BLUE, spaceAfter=5)
equation = ParagraphStyle('EquationV4', parent=body, fontName='V4Serif', fontSize=13.2, leading=17, alignment=TA_CENTER, textColor=INK, spaceBefore=9, spaceAfter=10)
quote = ParagraphStyle('QuoteV4', parent=body, fontName='V4SerifItalic', fontSize=11.2, leading=15.2, textColor=INK, leftIndent=15, rightIndent=15)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(0.72 * inch, 0.54 * inch, 7.78 * inch, 0.54 * inch)
    canvas.setFont('V4Sans', 6.6)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.72 * inch, 0.35 * inch, 'STOCHASTIC WITNESS CALCULUS · VERSION 4 REVISION CHAPTER')
    canvas.drawRightString(7.78 * inch, 0.35 * inch, f'V4-R{doc.page}')
    canvas.restoreState()


def theorem_block(number, title, statement, proof):
    content = [
        Paragraph(f'{number} · {title}', theorem_title),
        Paragraph(statement, body),
        Paragraph(f'<b>Proof.</b> {proof}', body),
    ]
    table = Table([[content]], colWidths=[6.85 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PALE_BLUE),
        ('BOX', (0, 0), (-1, -1), 0.7, BLUE),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 13),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether(table)


def status_table():
    rows = [
        [Paragraph('PROOF OBJECT', label), Paragraph('STATUS', label), Paragraph('WHAT IS ESTABLISHED', label)],
        [Paragraph('SWC exact mode', small), Paragraph('<b>Exact proof calculus</b>', body), Paragraph('Positive accepted mass plus sound verification yields a deterministic existence theorem.', small)],
        [Paragraph('Erdős–Straus computation', small), Paragraph('<b>Finite-domain theorem</b>', body), Paragraph('All 82,887 declared primes are proved by exact reconstructed witnesses.', small)],
        [Paragraph('Universal conjecture', small), Paragraph('<b>Universal lift open</b>', body), Paragraph('An exact premise covering every remaining integer is still required.', small)],
    ]
    table = Table(rows, colWidths=[1.55 * inch, 1.65 * inch, 3.65 * inch], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), INK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.4, RULE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    return table


def make_revision(path):
    doc = BaseDocTemplate(str(path), pagesize=letter, leftMargin=0.72 * inch, rightMargin=0.72 * inch, topMargin=0.68 * inch, bottomMargin=0.72 * inch, title='SWC v4 revision chapter', author='Kenju Tomita')
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='main')
    doc.addPageTemplates([PageTemplate(id='revision', frames=[frame], onPage=footer)])
    story = []

    story += [Paragraph('VERSION 4 · FORMAL REVISION CHAPTER', label), Spacer(1, 9), Paragraph('Universal lifting and<br/>exact proof status', h1), Paragraph('Stochastic Witness Calculus', ParagraphStyle('Subtitle', parent=h2, textColor=CORAL, fontSize=15)), Spacer(1, 6)]
    story += [Paragraph('<b>Kenju Tomita</b><br/><font size="8">Rochester Institute of Technology · Ephemerent Research</font>', body)]
    story += [Spacer(1, 12), Paragraph('Version 4 supersedes wording that could be read as denying proof status to the finite computation. SWC is an exact probabilistic proof calculus. Its finite Erdős–Straus computation is a genuine theorem over the declared domain. Universal closure is a separate quantifier.', quote), Spacer(1, 17), status_table(), Spacer(1, 18)]
    story += [Paragraph('How to read the integrated manuscript', h2), Paragraph('The following four revision pages are inserted after the original title page. The complete audited v3 body then follows unchanged. Where the retained body says “not a proof of the open conjecture,” version 4 reads that phrase narrowly: it means “not yet a proof of the universal quantifier.” It does not downgrade the exact finite-domain theorem.', body)]
    story += [Paragraph('This reconstructed revision is necessary because the independently compiling LaTeX source was not supplied with the PDF. The mathematical additions below are authoritative for v4; a future source-complete edition should integrate them into the main numbering and regenerate the full manuscript.', small), PageBreak()]

    story += [Paragraph('V4.1 · EXACT PROOF STATUS', label), Paragraph('Probability can carry a deterministic proof', h1)]
    story += [Paragraph('The logical endpoint of SWC exact mode is theoremhood, not confidence. If a sound verifier accepts a set of witnesses with exactly certified positive mass, then that set is nonempty. The probability calculation is part of the proof object.', body)]
    story += [Paragraph('Pr<sub>w~mu_i</sub>[V_i(w)=1] >= delta_i > 0&nbsp;&nbsp;&nbsp; implies &nbsp;&nbsp;&nbsp;there exists w such that R(i,w).', equation)]
    story += [theorem_block('Theorem V4.1', 'Exact finite-domain closure', 'Let D be finite. For every i in D, let V_i be a sound deterministic verifier and mu_i a witness distribution. If an exact checker certifies mu_i(A_i)>0 for every i in D, then every instance in D has a valid witness.', 'Apply the exact existence rule independently to every i. Because D is finite, the checked certificates form one finite conjunction proving the statement over the whole declared domain.')]
    story += [Spacer(1, 13), Paragraph('Consequence for the reported computation', h2), Paragraph('The 82,887/82,887 Erdős–Straus certificates are therefore not merely evidence. They prove the equation for every prime in the experiment’s declared family. Their limitation is only the domain boundary: primes congruent to 1 modulo 24 below 10^7, with the declared shift search through 127.', body), PageBreak()]

    story += [Paragraph('V4.2 · UNIVERSAL LIFTING', label), Paragraph('An exact zero failure mass closes a countable family', h1)]
    story += [Paragraph('Let I be a countable instance family and let nu assign strictly positive probability to every individual instance. For each i, define A_i as the witnesses accepted by a sound verifier and define the zero-mass set', body), Paragraph('Z = { i in I : mu_i(A_i) = 0 }.', equation)]
    story += [theorem_block('Theorem V4.2', 'Full-support universal lifting', 'If nu(i)>0 for every i in I and an exact certificate proves nu(Z)=0, then every i in I has at least one valid witness.', 'Suppose Z were nonempty and choose i_0 in Z. Full support gives nu(i_0)>0. Since {i_0} is contained in Z, nu(Z)>=nu(i_0)>0, contradicting the certified identity nu(Z)=0. Thus Z is empty; positive accepted mass and verifier soundness yield a witness for every instance.')]
    story += [Spacer(1, 13), Paragraph('Why observed 100% is different', h2), Paragraph('The theorem is probabilistic and exact. Its premise is not an estimated success frequency. Any finite sample can miss an exceptional instance, while an exact proof that the failure set has zero mass under a full-support distribution rules out even one exception.', body)]
    story += [Paragraph('A density-one theorem also does not suffice by itself: a nonempty exceptional set can have natural density zero. Universal closure requires exact zero failure mass, a proved mass gap, a complete cover, or a tail theorem joined to finite verification.', body), PageBreak()]

    story += [Paragraph('V4.3 · GROUND-TRUTH STATISTICS', label), Paragraph('When distributional facts become proof', h1)]
    story += [theorem_block('Theorem V4.3', 'Mass-gap closure', 'Let Z be the failure set under nu. Suppose a structural theorem proves that Z nonempty implies nu(Z)&gt;=eta for some eta&gt;0. If an exact certificate proves nu(Z)&lt;eta, then Z is empty.', 'If Z were nonempty, its certified structural lower bound would contradict the exact upper bound. Therefore Z is empty and the universal statement follows.')]
    story += [Spacer(1, 13), theorem_block('Corollary V4.4', 'Analytic tail plus finite verification', 'If an analytic theorem proves every instance above a bound B and exact verification proves every instance at or below B, then the universal statement holds.', 'The two domains partition the full instance family, and each side is proved without a remaining case.')]
    story += [Spacer(1, 14), Paragraph('Admissible proof inputs', h2)]
    data = [
        ['CAN ENTER AN EXACT PROOF', 'REMAINS EMPIRICAL WITHOUT AN EXTRA THEOREM'],
        ['Complete counts over a certified finite domain', 'A finite sample with zero observed failures'],
        ['Symbolic probability identities and exact recurrences', 'A posterior probability or confidence level below 100%'],
        ['Verified sieve bounds joined to a mass-gap theorem', 'A density-one or “almost all” statement'],
        ['Exhaustive computation plus a proved tail reduction', 'A learned model’s calibrated confidence'],
    ]
    table = Table([[Paragraph(cell, label if row == 0 else small) for cell in line] for row, line in enumerate(data)], colWidths=[3.42 * inch, 3.42 * inch], repeatRows=1)
    table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), INK), ('GRID', (0, 0), (-1, -1), 0.4, RULE), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    story += [table, Spacer(1, 14), Paragraph('Erdős–Straus closure program', h2), Paragraph('SWC can close the conjecture by proving one exact remaining premise: pointwise positive witness mass for every remaining prime; exact zero mass of the zero-witness set under a full-support instance prior; a counterexample mass-gap theorem plus an exact upper bound; an analytic tail theorem plus finite verification; or a symbolic family cover containing every remaining prime.', body)]
    story += [Paragraph('The current finite computation is already a completed proof component. Version 4 strengthens its status while keeping the unproved universal step visible and testable.', body)]
    doc.build(story, canvasmaker=InvariantCanvas)


def overlay_notice(page, message):
    stream = BytesIO()
    c = Canvas(stream, pagesize=letter, invariant=1)
    c.setFillColor(PAPER)
    c.rect(49, 758, 514, 19, fill=1, stroke=0)
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.8)
    c.line(49, 758, 563, 758)
    c.setFillColor(BLUE)
    c.setFont('V4SansBold', 6.2)
    c.drawString(52, 765, message)
    c.saveState()
    c.setFillColor(colors.HexColor('#f7f3ea'))
    c.rect(45, 16, 180, 15, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.setFont('V4Sans', 5.9)
    c.drawString(49, 21, 'V4: FINITE-DOMAIN PROOF; UNIVERSAL LIFTING SEPARATE')
    c.restoreState()
    c.save()
    stream.seek(0)
    overlay = PdfReader(stream).pages[0]
    page.merge_page(overlay, over=True)


with TemporaryDirectory(prefix='swc-v4-') as tmp:
    revision_path = Path(tmp) / 'revision.pdf'
    make_revision(revision_path)
    base = PdfReader(str(SOURCE))
    revision = PdfReader(str(revision_path))
    writer = PdfWriter()

    title_page = base.pages[0]
    overlay_notice(title_page, 'VERSION 4 · EXACT PROOF-STATUS CLARIFICATION AND UNIVERSAL-LIFTING THEOREMS')
    writer.add_page(title_page)
    for page in revision.pages:
        writer.add_page(page)
    for index, page in enumerate(base.pages[1:], start=2):
        if index in {24, 27, 30}:
            overlay_notice(page, 'VERSION 4 · “NOT UNIVERSAL” DOES NOT DENY THE EXACT FINITE-DOMAIN THEOREM')
        writer.add_page(page)

    writer.add_metadata({
        '/Title': 'Stochastic Witness Calculus: Exact Measure Certificates for Mathematical Existence, Learned Proof Search, and Anytime-Valid Empirical Claims — Version 4',
        '/Author': 'Kenju Tomita',
        '/Subject': 'Version 4 revision with exact proof-status, universal-lifting, and mass-gap theorems',
        '/Keywords': 'probabilistic method, formal verification, witness certificates, universal lifting, Erdős–Straus',
    })
    writer.add_outline_item('Version 4 revision chapter', 1)
    writer.add_outline_item('Integrated manuscript', 5)
    with OUTPUT.open('wb') as handle:
        writer.write(handle)

WEB_OUTPUT.write_bytes(OUTPUT.read_bytes())
output_hash = sha256(OUTPUT.read_bytes()).hexdigest()
revision_source = ROOT / 'research' / 'stochastic-witness-calculus' / 'v4-revision.md'
manifest = {
    'schemaVersion': 1,
    'version': 4,
    'status': 'public-reconstructed-preprint',
    'filename': WEB_OUTPUT.name,
    'pages': len(PdfReader(str(OUTPUT)).pages),
    'sha256': output_hash,
    'derivedFrom': {
        'filename': SOURCE.name,
        'pages': 34,
        'sha256': EXPECTED_V3,
    },
    'revisionSource': {
        'filename': str(revision_source.relative_to(ROOT)),
        'sha256': sha256(revision_source.read_bytes()).hexdigest(),
    },
    'construction': 'The complete audited v3 PDF is preserved, with a four-page v4 revision chapter inserted after the title page and visible superseding notices on affected pages.',
    'sourceStatus': 'The original independently compiling LaTeX source has not been supplied; a source-complete v4 recompilation remains required for the accepted journal version.',
}
(WEB_OUTPUT.parent / 'swc-v4-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'built {OUTPUT} · {manifest["pages"]} pages · sha256 {output_hash}')
