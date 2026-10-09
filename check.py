#!/usr/bin/env python3
"""Check the built site in docs/: broken links, house-style words, leftover notes. Exits 1 on any problem.

    python3 check.py
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, 'docs')
ACRONYMS = {'ASCAP', 'BAFTA', 'NYU', 'IMGN', 'LLC', 'SVG', 'EPS', 'PNG', 'PDF', 'TCL', 'LOOK', 'BAM', 'SCL', 'HTML'}
CHECKS = [(r'\bAI\b', 'the word "AI"'), (r'\bvibes?\b', '"vibes"'), (r'Opmetosserpse', 'the name written as one word'), (r'Dalton Corr', "Dalton's name outside the credits"),
          (r'\[D\?|\[DC|\[DB|TODO|Lorem|ipsum', 'a leftover note or placeholder'), (r'\b[A-Z]{4,}\b', 'a word in all caps')]

# Bracketed placeholders, like "[Name to come]": flagged in a normal build, let through in a drafts build
# (build.py --drafts marks the home page with <meta name="drafts">). Image panels marked data-placeholder are
# placeholders by design until the photographs exist.
BRACKETS = r'\[[A-Z][^\]<>\n]{0,60}\]'
ALLOWED = set()

problems = []
if not os.path.isdir(D):
    sys.exit('No docs/ folder yet: run build.py first.')
home = os.path.join(D, 'index.html')
drafts = os.path.exists(home) and '<meta name="drafts"' in open(home, encoding='utf-8').read()
for f in glob.glob(D + '/**/*.html', recursive=True):
    t = open(f, encoding='utf-8').read()
    rel = os.path.relpath(f, D)
    refs = re.findall(r'(?:href|src|poster)="(/[^"#?]*)', t)
    refs += [p.strip().split(' ')[0] for s in re.findall(r'srcset="([^"]+)"', t) for p in s.split(',')]
    for u in refs:
        p = D + u
        if not (os.path.exists(p) or os.path.exists(p + '.html') or os.path.exists(p.rstrip('/') + '/index.html')):
            problems.append('%s: broken link %s' % (rel, u))
    # Dalton's name appears only in a project's credits, as "Dalton Corr, Opmet Osserpse"; anywhere else it's a problem
    t2 = re.sub(r'<dl class="cr">[\s\S]*?</dl>', lambda m: m.group(0).replace('Dalton Corr, Opmet Osserpse', 'Opmet Osserpse'), t)
    strip = lambda h: re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', h))
    text = strip(t2)
    # All caps is allowed in editorial writing: the paragraphs of an article are left out of that one check
    plain = strip(re.sub(r'<div class="article-body">[\s\S]*?</div>', ' ', t2))
    if not drafts:
        bare = strip(re.sub(r'<div class="fd-img" data-placeholder[^>]*>[^<]*</div>', ' ', t))
        problems += ['%s: a bracketed placeholder (%s)' % (rel, m.group(0)) for m in re.finditer(BRACKETS, bare) if m.group(0) not in ALLOWED]
    for pat, why in CHECKS:
        for m in re.finditer(pat, plain if why == 'a word in all caps' else text):
            if why == 'a word in all caps' and m.group(0) in ACRONYMS:
                continue
            problems.append('%s: %s (%s)' % (rel, why, m.group(0)))
    # Every blog row links to a page that exists
    for slug in re.findall(r'<li class="work-row[^"]*" data-slug="([^"]+)"', t):
        if not os.path.exists(os.path.join(D, 'blog', slug + '.html')):
            problems.append('%s: the blog row %s has no page' % (rel, slug))

# Project pages (v02): alt text, no looping video, notes and chapters within limits, media order, project order
import html as H, json
ROOT = os.path.dirname(os.path.abspath(__file__))
for f in glob.glob(D + '/**/*.html', recursive=True):
    t = open(f, encoding='utf-8').read(); rel = os.path.relpath(f, D)
    for tag in re.findall(r'<img\b[^>]*>', t):
        if not re.search(r'\salt="', tag): problems.append('%s: an <img> without alt' % rel)
    for tag in re.findall(r'<video\b[^>]*>', t):
        if not re.search(r'\saria-label="[^"]+"', tag): problems.append('%s: a <video> without aria-label' % rel)
        if re.search(r'\sloop(?=[\s>=])', tag): problems.append('%s: a <video> that loops' % rel)
order = json.load(open(os.path.join(ROOT, 'content', 'index.json'), encoding='utf-8')).get('project_order', [])
# The order of each project's daltoncorr.com page, as recorded on Oct. 8, 2026: the pages must show it, item for item
record = json.load(open(os.path.join(ROOT, '_review', '2026-10-08_media-order-record_v02.json'), encoding='utf-8'))
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
    # media order: the record, with only Sunny's repeats left out
    hide = notes.get('hide', [])
    if hide and slug != 'sunnys-bookshop': problems.append('%s: only Sunny\'s Bookshop hides items' % rel)
    pj = json.load(open(os.path.join(ROOT, 'content', 'projects', slug + '.json'), encoding='utf-8'))
    stem = lambda p: re.sub(r'-(600|720|800|1200|1600|2400|sm|lg|xl)$', '', re.sub(r'\.(webp|jpe?g|png|gif|mp4|webm|mov)$', '', os.path.basename(p), flags=re.I))
    hidden = {stem(m['src']) for m in pj['media'] if m['alt'] in hide}
    want = [k for k in record.get(slug, []) if k not in hidden]
    body = t.split('class="pp"', 1)[-1].split('class="g pfoot"', 1)[0]
    got = [H.unescape(k) for k in re.findall(r'data-i="([^"]+)"', body)]
    if got != want: problems.append('%s: media order differs from daltoncorr.com (%d items, expected %d)' % (rel, len(got), len(want)))
    if 'Next project' in t: problems.append('%s: a "Next project" (pages end on Back to top and All work)' % rel)
    if 'data-totop' not in t or 'href="/#archive"' not in t: problems.append('%s: no Back to top or All work at the end' % rel)
# the home list and the projects index list the pages in project_order
for page_, pat in (('index.html', r'class="work-row[^"]*" data-project="([^"]+)"><?(?:span class="yr">\d+</span>)?<a href'),
                   ('projects/index.html', r'<li id="([^"]+)"><a href="/projects/')):
    t = open(os.path.join(D, page_), encoding='utf-8').read()
    got = [x for x in re.findall(r'data-project="([^"]+)"[^>]*>(?:<span class="yr">\d+</span>)?<a href', t)] if page_ == 'index.html' else re.findall(pat, t)
    if got != order: problems.append('%s: the project list does not follow project_order' % page_)
# The blog: every post in blog.json has its page, and every article page is in the sitemap
blog = os.path.join(ROOT, 'content', 'blog.json')
sitemap = open(os.path.join(D, 'sitemap.xml'), encoding='utf-8').read() if os.path.exists(os.path.join(D, 'sitemap.xml')) else ''
if os.path.exists(blog):
    for e in json.load(open(blog, encoding='utf-8'))['posts']:
        if not os.path.exists(os.path.join(D, 'blog', e['slug'] + '.html')):
            problems.append('blog.json: %s has no page in docs/blog/' % e['slug'])
for f in glob.glob(D + '/blog/*.html'):
    u = '/blog/' + os.path.basename(f)[:-5]
    if '<loc>https://opmetosserpse.com%s</loc>' % u not in sitemap:
        problems.append('sitemap.xml: %s is missing' % u)
print('\n'.join(sorted(set(problems))) or 'All clear: no broken links and no house-style problems%s.' % (' (a drafts build: placeholders let through)' if drafts else ''))
sys.exit(1 if problems else 0)
