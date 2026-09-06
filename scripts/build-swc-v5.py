#!/usr/bin/env python3
"""Deterministic v5 research revision, preserving the complete v3 PDF."""
from pathlib import Path
from hashlib import sha256
from io import BytesIO
import json
import re
from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.pagesizes import letter

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'research/stochastic-witness-calculus/revision-v5.json'
SOURCE=ROOT/'assets/research/stochastic-witness-calculus-v3.pdf'
OUT=ROOT/'output/pdf/stochastic-witness-calculus-v5.pdf'
WEB=ROOT/'assets/research/stochastic-witness-calculus-v5.pdf'
EXPECTED='17ff47c284b79207e2365d286c18aaa19915c63bf0af655a587066a5647b462a'
require=lambda ok,message: None if ok else (_ for _ in ()).throw(ValueError(message))
require(sha256(SOURCE.read_bytes()).hexdigest()==EXPECTED,'source v3 hash mismatch')
data=json.loads(DATA.read_text())
fonts=Path('/System/Library/Fonts/Supplemental')
for name,file in [('Text','Times New Roman.ttf'),('TextBold','Times New Roman Bold.ttf'),
                  ('TextItalic','Times New Roman Italic.ttf'),('Sans','Arial.ttf'),('SansBold','Arial Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
pdfmetrics.registerFontFamily('Text',normal='Text',bold='TextBold',italic='TextItalic',boldItalic='TextBold')
pdfmetrics.registerFontFamily('Sans',normal='Sans',bold='SansBold',italic='Sans',boldItalic='SansBold')
INK=colors.HexColor('#172139');BLUE=colors.HexColor('#2854aa');GRAY=colors.HexColor('#596272')
styles={
 'p':ParagraphStyle('body',fontName='Text',fontSize=10.2,leading=13.5,textColor=INK,spaceAfter=9),
 'h':ParagraphStyle('heading',fontName='SansBold',fontSize=10.2,leading=13,textColor=BLUE,spaceBefore=8,spaceAfter=7),
 'eq':ParagraphStyle('equation',fontName='Text',fontSize=11,leading=15,textColor=INK,spaceBefore=4,spaceAfter=10),
 'small':ParagraphStyle('note',fontName='Sans',fontSize=8,leading=10.5,textColor=GRAY,spaceAfter=8),
 'title':ParagraphStyle('title',fontName='Text',fontSize=25,leading=28,textColor=INK,spaceAfter=17),
 'label':ParagraphStyle('label',fontName='SansBold',fontSize=7.7,leading=10,textColor=BLUE,spaceAfter=10),
 'cell':ParagraphStyle('cell',fontName='Sans',fontSize=8.4,leading=11,textColor=INK)}
# ReportLab's subscript Unicode glyphs are not guaranteed in these fonts.
SUBS=str.maketrans({'ᵢ':'i','₁':'1','₂':'2'})
def clean(text):
    text=re.sub('[⁰¹²³⁴⁵⁶⁷⁸⁹]+',lambda m:'<super>'+m.group().translate(str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹','0123456789'))+'</super>',text)
    return text.translate(SUBS).replace('–','-').replace('—','-').replace('−','-').replace('↦','→')
class Invariant(Canvas):
    def __init__(self,*a,**kw):kw['invariant']=1;super().__init__(*a,**kw)
def footer(c,doc):
    c.saveState();c.setStrokeColor(colors.HexColor('#ccd0d6'));c.setLineWidth(.5)
    c.line(50,43,562,43);c.setFillColor(GRAY);c.setFont('Sans',7)
    c.drawString(50,29,'STOCHASTIC WITNESS CALCULUS / v5 RESEARCH REVISION')
    c.drawRightString(562,29,f'R{doc.page}');c.restoreState()
buffer=BytesIO()
doc=SimpleDocTemplate(buffer,pagesize=letter,leftMargin=50,rightMargin=50,topMargin=42,bottomMargin=58,
                      title=data['title']+' - v5 research revision',author='Kenju Tomita')
story=[]
for index,page in enumerate(data['pages']):
    if index:story.append(PageBreak())
    story.extend([Paragraph(clean(page['label']).upper(),styles['label']),Paragraph(clean(data['title'] if index==0 else page['title']),styles['title'])])
    if index==0:story.extend([Paragraph(clean(data['subtitle']),styles['small']),Paragraph(clean(page['title']),styles['h'])])
    for kind,content in page['blocks']:
        if kind=='table':
            rows=[[Paragraph(clean(cell),styles['cell']) for cell in row] for row in content]
            widths=[doc.width/len(rows[0])]*len(rows[0])
            if len(rows[0])==2:widths=[doc.width*.57,doc.width*.43]
            table=Table(rows,colWidths=widths,hAlign='LEFT')
            table.setStyle(TableStyle([('LINEABOVE',(0,0),(-1,0),.8,BLUE),('LINEBELOW',(0,0),(-1,0),.5,BLUE),
                                      ('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#d6d8dd')),
                                      ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),
                                      ('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),
                                      ('BOTTOMPADDING',(0,0),(-1,-1),6)]))
            story.extend([table,Spacer(1,10)])
        else:story.append(Paragraph(clean(content),styles[kind]))
doc.build(story,onFirstPage=footer,onLaterPages=footer,canvasmaker=Invariant)
revision=PdfReader(BytesIO(buffer.getvalue()))
require(len(revision.pages)==len(data['pages']),'revision overflow: adjust layout before publishing')
original=PdfReader(SOURCE);require(len(original.pages)==34,'unexpected original page count')
writer=PdfWriter()
for p in revision.pages:writer.add_page(p)
for p in original.pages:writer.add_page(p)
writer.add_metadata({'/Title':data['title']+' - Version 5 research revision','/Author':'Kenju Tomita',
                     '/Subject':'Corrected constructions and SWC certificates; universal existence remains open'})
writer.add_outline_item('v5 research revision',0)
writer.add_outline_item('Retained v3 manuscript',len(revision.pages))
OUT.parent.mkdir(parents=True,exist_ok=True)
with OUT.open('wb') as f:writer.write(f)
WEB.write_bytes(OUT.read_bytes())
latest=PdfReader(OUT)
for i,p in enumerate(original.pages):
    require(latest.pages[len(revision.pages)+i].extract_text()==p.extract_text(),'retained source text changed')
manifest=dict(schemaVersion=1,version='5',status='public-reconstructed-preprint',filename=WEB.name,
              pages=len(latest.pages),sha256=sha256(WEB.read_bytes()).hexdigest(),
              revisionPages=len(revision.pages),
              parentVersion=json.loads((ROOT/'assets/research/swc-v4-1-manifest.json').read_text())|{},
              constructionBase=dict(filename=SOURCE.name,pages=34,sha256=EXPECTED),
              revisionSource=dict(filename=str(DATA.relative_to(ROOT)),sha256=sha256(DATA.read_bytes()).hexdigest()),
              construction='Nine new revision pages followed by the complete unmodified v3 manuscript.',
              sourceStatus='Artifact received; source/build and original checksum reconciliation pending.',
              universalExistenceStatus='unproved',dateModified=data['date'])
manifest['parentVersion']={k:manifest['parentVersion'][k] for k in ['filename','pages','sha256']}
(ROOT/'assets/research/swc-v5-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['filename','pages','revisionPages','sha256']},indent=2))
