#!/usr/bin/env python3
"""Check the built site in docs/: broken links, house-style words, leftover notes. Exits 1 on any problem.

    python3 check.py
"""
import glob, os, re, sys

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docs')
ACRONYMS = {'ASCAP', 'BAFTA', 'NYU', 'IMGN', 'LLC', 'SVG', 'EPS', 'PNG', 'PDF', 'TCL', 'LOOK', 'BAM', 'SCL', 'HTML'}
CHECKS = [(r'\bAI\b', 'the word "AI"'), (r'\bvibes?\b', '"vibes"'), (r'Opmetosserpse', 'the name written as one word'), (r'Dalton Corr', "Dalton's name (the site doesn't name him)"),
          (r'\[D\?|\[DC|\[DB|TODO|Lorem|ipsum', 'a leftover note or placeholder'), (r'\b[A-Z]{4,}\b', 'a word in all caps')]

problems = []
if not os.path.isdir(D):
    sys.exit('No docs/ folder yet: run build.py first.')
for f in glob.glob(D + '/**/*.html', recursive=True):
    t = open(f, encoding='utf-8').read()
    rel = os.path.relpath(f, D)
    refs = re.findall(r'(?:href|src|poster)="(/[^"#?]*)', t)
    refs += [p.strip().split(' ')[0] for s in re.findall(r'srcset="([^"]+)"', t) for p in s.split(',')]
    for u in refs:
        p = D + u
        if not (os.path.exists(p) or os.path.exists(p + '.html') or os.path.exists(p.rstrip('/') + '/index.html')):
            problems.append('%s: broken link %s' % (rel, u))
    text = re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', t))
    for pat, why in CHECKS:
        for m in re.finditer(pat, text):
            if why == 'a word in all caps' and m.group(0) in ACRONYMS:
                continue
            problems.append('%s: %s (%s)' % (rel, why, m.group(0)))

# Project pages (v02): alt text, no looping video, notes and chapters within limits, media order, project order
import html as H, json
ROOT = os.path.dirname(os.path.abspath(__file__))
HS = {'hollyshorts-18', 'hollyshorts-19', 'hollyshorts-20', 'hollyshorts-21', 'hollyshorts-22', 'hollyshorts-comedy-2025',
      'hollyshorts-comedy-2026', 'hollyshorts-dubai-2025', 'hollyshorts-london-2024', 'hollyshorts-london-2025'}
for f in glob.glob(D + '/**/*.html', recursive=True):
    t = open(f, encoding='utf-8').read(); rel = os.path.relpath(f, D)
    for tag in re.findall(r'<img\b[^>]*>', t):
        if not re.search(r'\salt="', tag): problems.append('%s: an <img> without alt' % rel)
    for tag in re.findall(r'<video\b[^>]*>', t):
        if not re.search(r'\saria-label="[^"]+"', tag): problems.append('%s: a <video> without aria-label' % rel)
        if re.search(r'\sloop(?=[\s>=])', tag): problems.append('%s: a <video> that loops' % rel)
order = json.load(open(os.path.join(ROOT, 'content', 'index.json'), encoding='utf-8')).get('project_order', [])
record = json.load(open(os.path.join(ROOT, '_review', '2026-10-08_media-order-record_v01.json'), encoding='utf-8'))
for i, slug in enumerate(order):
    f = os.path.join(D, 'projects', slug + '.html')
    if not os.path.exists(f): problems.append('projects/%s: in project_order but not built' % slug); continue
    t = open(f, encoding='utf-8').read(); rel = 'projects/%s.html' % slug
    nf = os.path.join(ROOT, 'content', 'notes', slug + '.json')
    notes = json.load(open(nf, encoding='utf-8')) if os.path.exists(nf) else {}
    for k, x in notes.get('notes', {}).items():
        if len(x['text'].split()) > 25: problems.append('%s: note %s runs over 25 words' % (rel, k))
    for cap in re.findall(r'<figcaption[^>]*>([\s\S]*?)</figcaption>', t):
        words = re.sub(r'<a [^>]*>[^<]*</a>', ' ', cap); words = re.sub(r'<[^>]+>', ' ', words)
        if len(words.split()) > 25: problems.append('%s: a note runs over 25 words' % rel)
    if t.count('class="chap"') > 4: problems.append('%s: more than four chapter labels' % rel)
    # media order: the record, with the poster first on HollyShorts pages and only Sunny's hidden items left out
    alts = record.get(slug, []); op = notes.get('opener', 1); hide = notes.get('hide', [])
    if op != 1 and slug not in HS: problems.append('%s: only HollyShorts pages open out of order' % rel)
    if hide and slug != 'sunnys-bookshop': problems.append('%s: only Sunny\'s Bookshop hides items' % rel)
    want = [alts[op - 1]] + [a for n, a in enumerate(alts, 1) if n != op] if alts else []
    want = [a for a in want if a not in hide]
    body = t.split('class="pp"', 1)[-1].split('class="g end"', 1)[0]
    got = [H.unescape(a) for a in re.findall(r'data-i="\d+">\s*<(?:img|video)\b[^>]*?(?:alt|aria-label)="([^"]*)"', body)]
    if got != want: problems.append('%s: media order differs from the record (%d items, expected %d)' % (rel, len(got), len(want)))
    nx = re.search(r'<a class="next" href="/projects/([^"]+)"', t)
    if not nx or nx.group(1) != order[(i + 1) % len(order)]: problems.append('%s: Next project does not follow project_order' % rel)
# the home list and the projects index list the pages in project_order
for page_, pat in (('index.html', r'class="work-row[^"]*" data-project="([^"]+)"><?(?:span class="yr">\d+</span>)?<a href'),
                   ('projects/index.html', r'<li id="([^"]+)"><a href="/projects/')):
    t = open(os.path.join(D, page_), encoding='utf-8').read()
    got = [x for x in re.findall(r'data-project="([^"]+)"[^>]*>(?:<span class="yr">\d+</span>)?<a href', t)] if page_ == 'index.html' else re.findall(pat, t)
    if got != order: problems.append('%s: the project list does not follow project_order' % page_)
print('\n'.join(sorted(set(problems))) or 'All clear: no broken links and no house-style problems.')
sys.exit(1 if problems else 0)
