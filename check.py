#!/usr/bin/env python3
"""Check the built site in docs/: broken links, house-style words, leftover notes. Exits 1 on any problem.

    python3 check.py
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, 'docs')
ACRONYMS = {'ASCAP', 'BAFTA', 'NYU', 'IMGN', 'LLC', 'SVG', 'EPS', 'PNG', 'PDF', 'TCL', 'LOOK', 'BAM', 'SCL', 'HTML'}
CHECKS = [(r'\bAI\b', 'the word "AI"'), (r'\bBlog\b', 'the word "Blog" (it is the Journal)'), (r'\bvibes?\b', '"vibes"'), (r'Opmetosserpse', 'the name written as one word'), (r'Dalton Corr', "Dalton's name outside the credits"),
          (r'\[D\?|\[DC|\[DB|TODO|Lorem|ipsum', 'a leftover note or placeholder'), (r'\b[A-Z]{4,}\b', 'a word in all caps')]

# Bracketed placeholders, like "[Name to come]": flagged in a normal build, let through in a drafts build
# (build.py --drafts marks the home page with <meta name="drafts">). Image panels marked data-placeholder are
# placeholders by design until the photographs exist.
BRACKETS = r'\[[A-Z][^\]<>\n]{0,60}\]'
ALLOWED = set()

# The 14 posts imported from daltoncorr.com: removed on Oct. 10, 2026, and never to come back
OLD_POSTS = ['sigils-in-the-grid', 'venice-food-tramps', 'venice-as-sacred-ground', 'line-and-gesture', 'dada-as-spell-casting',
             'color-as-landscape', 'color-theory-as-divination', 'folk-magic-and-textile-art', 'a-conversation-with-light',
             'rooftop-color', 'the-alchemy-of-printmaking', 'the-death-of-touch', 'this-was-the-dream', 'dreams-as-design-briefs']

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
    # "AI" and all caps are allowed in editorial writing: the body of a Journal article is left out of those two checks,
    # and only that. Everywhere else on the site (work pages, home, the Journal's own chrome) they still fail.
    # The body runs to the end of its article (it holds paragraphs, notes and rows of pictures, so it can't end at a </div>)
    plain = strip(re.sub(r'<div class="article-body"[^>]*>[\s\S]*?</article>', ' ', t2))
    if not drafts:
        bare = strip(re.sub(r'<div class="fd-img" data-placeholder[^>]*>[^<]*</div>', ' ', t))
        problems += ['%s: a bracketed placeholder (%s)' % (rel, m.group(0)) for m in re.finditer(BRACKETS, bare) if m.group(0) not in ALLOWED]
    for pat, why in CHECKS:
        for m in re.finditer(pat, plain if why in ('a word in all caps', 'the word "AI"') else text):
            if why == 'a word in all caps' and m.group(0) in ACRONYMS:
                continue
            problems.append('%s: %s (%s)' % (rel, why, m.group(0)))
    # Every Journal row links to a page that exists; the old imported posts are gone for good
    for slug in re.findall(r'<li class="work-row[^"]*" data-slug="([^"]+)"', t):
        if not os.path.exists(os.path.join(D, 'journal', slug + '.html')):
            problems.append('%s: the Journal row %s has no page' % (rel, slug))
    problems += ['%s: an old imported post (%s)' % (rel, x) for x in OLD_POSTS if x in t]

# Ordinals are superscripted everywhere they show (build.py typo() writes 22<sup class="ord">nd</sup>): in the visible
# text of every page, a number run straight into st, nd, rd or th is one that was missed
for f in glob.glob(D + '/**/*.html', recursive=True):
    t = open(f, encoding='utf-8').read(); rel = os.path.relpath(f, D)
    body = t.split('<body', 1)[-1]
    text = re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', body))
    problems += ['%s: an ordinal that is not superscripted (%s)' % (rel, m.group(0)) for m in re.finditer(r'\b\d+(?:st|nd|rd|th)\b', text)]

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
    if 'Next project' in t: problems.append('%s: a "Next project" (pages end on All work)' % rel)
    # The masthead (the Journal's component), linking home, with All work under it; All work at the end; no Back or Home
    mast = re.search(r'<header class="mast"><a class="mast-name[^"]*" href="/" data-cover>([\s\S]*?)</header>', t)
    if not mast: problems.append('%s: no masthead linking home' % rel)
    elif not re.search(r'<a class="ctl" href="/#archive" data-all-work>', mast.group(1)): problems.append('%s: no All work under the masthead' % rel)
    if not re.search(r'class="g pfoot"[^>]*><a class="ctl" href="/#archive" data-all-work>', t): problems.append('%s: no All work at the end' % rel)
    for m in re.finditer(r'<(a|button)\b[^>]*>([\s\S]*?)</\1>', t):
        words = ' '.join(re.sub(r'<span class="ctl-w"[^>]*>[^<]*</span>', ' ', m.group(2)).split())
        words = ' '.join(re.sub(r'<[^>]+>', ' ', words).split())
        if words in ('Back', 'Home', 'Back to top'): problems.append('%s: a "%s" control (project pages have the masthead and All work)' % (rel, words))
# All work resolves to the work list: /#archive opens the full list on home
home_t = open(os.path.join(D, 'index.html'), encoding='utf-8').read()
if not ('id="work"' in home_t and 'id="works"' in home_t and 'class="ctl archive-toggle"' in home_t): problems.append('index.html: no work list for All work (/#archive) to open')
# the home list and the projects index list the pages in project_order
for page_, pat in (('index.html', r'class="work-row[^"]*" data-project="([^"]+)"><?(?:span class="yr">\d+</span>)?<a href'),
                   ('projects/index.html', r'<li id="([^"]+)"><a href="/projects/')):
    t = open(os.path.join(D, page_), encoding='utf-8').read()
    if page_ == 'index.html':  # the rows come in the Selected order; data-n is each row's place in the full list
        rows = re.findall(r'data-project="([^"]+)" data-n="(\d+)"[^>]*>(?:<span class="yr">\d+</span>)?(<a href|<span class="plain")', t)
        got = [x for x, n, kind in sorted(rows, key=lambda r: int(r[1])) if kind == '<a href']
        sel = json.load(open(os.path.join(ROOT, 'content', 'work.json'), encoding='utf-8'))['selected']
        shown = re.findall(r'class="work-row" data-project="([^"]+)"', t)  # Selected rows (no "extra"), in page order
        if shown != sel: problems.append('index.html: Selected work is not in the order of work.json "selected"')
        if [x for x, _, _ in rows][:len(sel)] != sel: problems.append('index.html: the Selected rows do not come first')
    else: got = re.findall(pat, t)
    if got != order: problems.append('%s: the project list does not follow project_order' % page_)
# The Journal: every published post has its page and is in the sitemap; a draft has neither (in a drafts build its
# page is a preview, never shipped); /journal/ is in the sitemap once a post is published; /blog/ sends to /journal/
journal = json.load(open(os.path.join(ROOT, 'content', 'journal.json'), encoding='utf-8'))
sitemap = open(os.path.join(D, 'sitemap.xml'), encoding='utf-8').read() if os.path.exists(os.path.join(D, 'sitemap.xml')) else ''
loc = lambda u: '<loc>https://opmetosserpse.com%s</loc>' % u in sitemap
live = [e for e in journal['posts'] if not e.get('draft')]
for e in journal['posts']:
    built = os.path.exists(os.path.join(D, 'journal', e['slug'] + '.html'))
    if not e.get('draft') and not built: problems.append('journal.json: %s has no page in docs/journal/' % e['slug'])
    if e.get('draft') and built and not drafts: problems.append('docs/journal/%s.html: a draft was built' % e['slug'])
    if e.get('draft') and loc('/journal/' + e['slug']): problems.append('sitemap.xml: the draft %s is listed' % e['slug'])
for e in live:
    if not loc('/journal/' + e['slug']): problems.append('sitemap.xml: /journal/%s is missing' % e['slug'])
if live != [] and not loc('/journal/'): problems.append('sitemap.xml: /journal/ is missing')
if not live and loc('/journal/'): problems.append('sitemap.xml: /journal/ is listed with nothing published')
if not os.path.exists(os.path.join(D, 'journal', 'index.html')): problems.append('docs/journal/index.html is missing')
stub = os.path.join(D, 'blog', 'index.html')
if not (os.path.exists(stub) and 'url=/journal/' in open(stub, encoding='utf-8').read()): problems.append('docs/blog/index.html does not send to /journal/')
problems += ['docs/blog/: an old page is still there (%s)' % os.path.basename(f) for f in glob.glob(D + '/blog/*.html') if not f.endswith('index.html')]
problems += ['sitemap.xml: an old /blog/ address' for _ in [0] if '/blog/' in sitemap]
print('\n'.join(sorted(set(problems))) or 'All clear: no broken links and no house-style problems%s.' % (' (a drafts build: placeholders let through)' if drafts else ''))
sys.exit(1 if problems else 0)
