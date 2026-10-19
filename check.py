#!/usr/bin/env python3
"""Check the built site in docs/: broken links, house-style words, leftover notes. Exits 1 on any problem.

    python3 check.py
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, 'docs')
ACRONYMS = {'ASCAP', 'BAFTA', 'NYU', 'IMGN', 'LLC', 'SVG', 'EPS', 'PNG', 'PDF', 'TCL', 'LOOK', 'BAM', 'SCL', 'HTML',
            'VIII', 'SDDS'}  # a Roman numeral and a sound format, as Red Mask's posters print them (D, Oct. 14)
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
    # Dalton's name appears only in a project's credits, as "Dalton Corr, Opmet Osserpse", or "Dalton Corr" alone where D
    # asked for it (Sunny's Bookshop, Oct. 13); anywhere else it's a problem
    t2 = re.sub(r'<dl class="cr">[\s\S]*?</dl>', lambda m: m.group(0).replace('Dalton Corr, Opmet Osserpse', 'Opmet Osserpse').replace('<dd>Dalton Corr</dd>', '<dd></dd>'), t)
    strip = lambda h: re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', h))
    text = strip(t2)
    # "AI" and all caps are allowed in editorial writing: the body of a Journal article is left out of those two checks,
    # and only that. Everywhere else on the site (work pages, home, the Journal's own chrome) they still fail.
    # The body runs to the end of its article (it holds paragraphs, notes and rows of pictures, so it can't end at a </div>)
    # A type specimen's boards (Opmet Serif's "The whole font") set the alphabet in capitals: left out of the all-caps check
    plain = strip(re.sub(r'<div class="article-body"[^>]*>[\s\S]*?</article>|<div class="os-work os-boards"[^>]*>[\s\S]*?</section>', ' ', t2))
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

# Project pages (v02): alt text, no looping video (but two), notes and chapters within limits, media order, project order
LOOPS = ('sb-signature-script', 'hollyshorts-comedy-10-poster-popcorn')
import html as H, json
ROOT = os.path.dirname(os.path.abspath(__file__))
for f in glob.glob(D + '/**/*.html', recursive=True):
    t = open(f, encoding='utf-8').read(); rel = os.path.relpath(f, D)
    for tag in re.findall(r'<img\b[^>]*>', t):
        if not re.search(r'\salt="', tag): problems.append('%s: an <img> without alt' % rel)
    for tag, inner in re.findall(r'(<video\b[^>]*>)([\s\S]*?)</video>', t):
        if not re.search(r'\saria-label="[^"]+"', tag): problems.append('%s: a <video> without aria-label' % rel)
        # Films never loop, except the two D chose (Oct. 10, 2026): Sunny's signature film and Comedy 10's animated poster
        srcs = re.findall(r'src="([^"]+)"', inner)
        if re.search(r'\sloop(?=[\s>=])', tag) and not (srcs and all(re.search(r'/(%s)\.(webm|mp4)$' % '|'.join(LOOPS), x) for x in srcs)):
            problems.append('%s: a <video> that loops (only %s may)' % (rel, ' and '.join(LOOPS)))
order = json.load(open(os.path.join(ROOT, 'content', 'index.json'), encoding='utf-8')).get('project_order', [])
# The finished pages (content/pages/<slug>.json): project pages D designed whole, built as they are. They keep the checks
# every page has (links, words, alt text, the data); the template's own (the lightbox, the masthead, project_order) skip them
finished = {os.path.basename(f)[:-5]: json.load(open(f, encoding='utf-8')) for f in glob.glob(os.path.join(ROOT, 'content', 'pages', '*.json'))}
# The frame every project page has: the masthead (the Journal's component), linking home, with Work and Home under it;
# at the end Work, Home and Back to top; no Back, no Home or Back to top without their hooks
def frame(rel, t):
    mast = re.search(r'<header class="mast"><a class="mast-name[^"]*" href="/" data-cover>([\s\S]*?)</header>', t)
    if not mast: problems.append('%s: no masthead linking home' % rel)
    elif not re.search(r'<a class="ctl" href="/#work" data-all-work>', mast.group(1)): problems.append('%s: no Work under the masthead' % rel)
    elif not re.search(r'<a class="ctl" href="/" data-cover>', mast.group(1)): problems.append('%s: no Home beside Work under the masthead' % rel)
    if not re.search(r'class="g pfoot"[^>]*><a class="ctl" href="/#work" data-all-work>', t): problems.append('%s: no Work at the end' % rel)
    foot = t.split('class="g pfoot"', 1)[-1].split('</nav>', 1)[0]
    if 'data-top>' not in foot: problems.append('%s: no Back to top at the end' % rel)
    if 'href="/" data-cover>' not in foot: problems.append('%s: no Home at the end' % rel)
    for m in re.finditer(r'<(a|button)\b[^>]*>([\s\S]*?)</\1>', t):
        words = ' '.join(re.sub(r'<span class="ctl-w"[^>]*>[^<]*</span>', ' ', m.group(2)).split())
        words = ' '.join(re.sub(r'<[^>]+>', ' ', words).split())
        if words == 'Back' or (words == 'Home' and 'data-cover' not in m.group(0)) or (words == 'Back to top' and 'data-top' not in m.group(0)): problems.append('%s: a "%s" control (project pages have the masthead, All work and, at the end, Back to top)' % (rel, words))
for s in finished:
    f = os.path.join(D, 'projects', s + '.html')
    if not os.path.exists(f): problems.append('projects/%s: a finished page that was not built' % s); continue
    t = open(f, encoding='utf-8').read(); rel = 'projects/%s.html' % s
    frame(rel, t)
    if 'data-page-only' in t: problems.append('%s: a finished page slides down from home like the rest (no data-page-only)' % rel)
    if not re.search(r'<div class="os" data-page="%s" data-page-js="/js/pages/%s\.js\?v=\w+">' % (s, s), t): problems.append('%s: no part for its script (data-page)' % rel)
# The order of each project's daltoncorr.com page, as recorded on Oct. 8, 2026 (v02), with the pages D changed on purpose
# at their new orders (v03, Oct. 10, 2026; the lists in their notes files; v04, Oct. 14: Sunny's studies last; v05, Oct. 15:
# v04 plus five new pages at their daltoncorr.com orders; v06, Oct. 15: Chop Suey Club's logo, D's; v07, Oct. 19: Sunny's
# Journal & Press marks in Vellum, for its Ink Navy panel, D's): the pages must show it, item for item
record = json.load(open(os.path.join(ROOT, '_review', '2026-10-19_media-order-record_v07.json'), encoding='utf-8'))
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
    # up to four chapter labels; Sunny's Bookshop, built after its Brand Bible, one per section, up to ten (D, Oct. 10)
    if t.count('class="chap"') > (10 if slug == 'sunnys-bookshop' else 4): problems.append('%s: too many chapter labels' % rel)
    # media order: the record, with only Sunny's repeats left out
    hide = notes.get('hide', [])
    if hide and slug != 'sunnys-bookshop': problems.append('%s: only Sunny\'s Bookshop hides items' % rel)
    pj = json.load(open(os.path.join(ROOT, 'content', 'projects', slug + '.json'), encoding='utf-8'))
    stem = lambda p: re.sub(r'-(600|720|800|1100|1200|1600|2200|2400|sm|lg|xl)$', '', re.sub(r'\.(webp|jpe?g|png|gif|mp4|webm|mov)$', '', os.path.basename(p), flags=re.I))
    hidden = {stem(m['src']) for m in pj['media'] if m['alt'] in hide}
    want = [k for k in record.get(slug, []) if k not in hidden]
    body = re.split(r'class="pp[ "]', t, 1)[-1].split('class="g pfoot"', 1)[0]
    got = [H.unescape(k) for k in re.findall(r'data-i="([^"]+)"', body)]
    if got != want: problems.append('%s: media order differs from daltoncorr.com (%d items, expected %d)' % (rel, len(got), len(want)))
    if 'Next project' in t: problems.append('%s: a "Next project" (pages end on Work)' % rel)
    frame(rel, t)
# Whole pictures: nothing styles a project page's picture (or the lightbox's) to crop. In site.css, no rule for .pp or
# .lightbox uses object-fit other than contain, clip-path or object-view-box, and no picture's frame (.m, .row, .cut,
# .cuts, a block .b) hides what spills over; on the pages, no inline style does either.
from html.parser import HTMLParser
css = open(os.path.join(D, 'css', 'site.css'), encoding='utf-8').read() if os.path.exists(os.path.join(D, 'css', 'site.css')) else ''
CROP = r'object-fit:\s*(?:cover|fill|none|scale-down)|clip-path|object-view-box'
FRAME = r'(?:^|[\s>+~,])(?:img|video|\.m|\.row|\.cuts?|\.b)(?![\w-])'
for sel, body in re.findall(r'([^{}]+)\{([^{}]*)\}', re.sub(r'/\*[\s\S]*?\*/', '', css)):
    sel = ' '.join(sel.split())
    if not re.search(r'\.(?:pp|lightbox)(?![\w-])', sel): continue
    if re.search(CROP, body): problems.append('site.css: %s crops a picture (%s)' % (sel, re.search(CROP, body).group(0)))
    if re.search(r'overflow:\s*(?:hidden|clip)', body) and re.search(FRAME, sel): problems.append('site.css: %s hides what spills over a picture' % sel)
# Every picture on a project page opens in the lightbox: it sits inside the page's data-lightbox (.pp), with no
# data-lightbox-skip on it or around it, and not in a link. Only the 3D and interactive pieces (.piece) stay out, and
# every picture in one does.
class LB(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack, self.out = [], []
    def handle_starttag(self, tag, a):
        a = dict(a); cls = (a.get('class') or '').split()
        st = dict(lb='data-lightbox' in a, skip='data-lightbox-skip' in a, piece='piece' in cls, pp='pp' in cls, a=tag == 'a')
        if tag == 'img':
            up = self.stack + [st]
            if any(x['pp'] for x in up):
                self.out.append((a.get('src', ''), any(x['piece'] for x in up), any(x['lb'] for x in up) and not any(x['skip'] or x['a'] for x in up)))
            return
        if tag not in ('br', 'hr', 'source', 'meta', 'link', 'input', 'wbr', 'path', 'use', 'circle', 'rect', 'line', 'polyline', 'ellipse', 'stop'):
            self.stack.append(st)
    def handle_startendtag(self, tag, a):
        if tag == 'img': self.handle_starttag(tag, a)
    def handle_endtag(self, tag):
        if tag not in ('img', 'br', 'hr', 'source', 'meta', 'link', 'input', 'wbr', 'path', 'use', 'circle', 'rect', 'line', 'polyline', 'ellipse', 'stop') and self.stack: self.stack.pop()
for f in glob.glob(D + '/projects/*.html'):
    if f.endswith('index.html'): continue
    t = open(f, encoding='utf-8').read(); rel = os.path.relpath(f, D)
    if not re.search(r'<div class="pp(?: [\w-]+)*" data-lightbox[\s>]', t): problems.append('%s: the page is not marked data-lightbox' % rel)
    body = re.split(r'class="pp[ "]', t, 1)[-1].split('class="g pfoot"', 1)[0]
    for st in re.findall(r'\sstyle="([^"]*)"', re.sub(r'<div class="m piece"[\s\S]*?(?=<div class="m|</figure>)', '', body)):
        if re.search(CROP + r'|overflow|aspect-ratio|(?<![-\w])height', st): problems.append('%s: an inline style that can crop a picture (%s)' % (rel, st))
    lb = LB(); lb.feed(t)
    for src, piece, opens in lb.out:
        if piece and opens: problems.append('%s: a picture in a 3D or interactive piece opens in the lightbox (%s)' % (rel, src))
        if not piece and not opens: problems.append('%s: a picture that does not open in the lightbox (%s)' % (rel, src))
# Sunny's Bookshop's panels and plates (D, Oct. 19) are its alone: a panel sits on one of its Brand Bible's grounds
# (Vellum, Linen, and Ink Navy for Journal & Press only) and holds cut-outs only (no film, photograph or row of pictures),
# and the lightbox opens a panel's picture on that panel's ground (site.js), or its Vellum marks would vanish
for f in glob.glob(D + '/projects/*.html'):
    t = open(f, encoding='utf-8').read(); rel = os.path.relpath(f, D)
    tones = re.findall(r'<div class="pnl pnl-([\w-]+)">', t)
    if rel != os.path.join('projects', 'sunnys-bookshop.html'):
        if tones or re.search(r'<div class="pp(?: [\w-]+)* pp-plates[ "]', t): problems.append('%s: panels and plates are Sunny\'s Bookshop\'s alone' % rel)
        continue
    for tone in tones:
        if tone not in ('vellum', 'linen', 'navy'): problems.append('%s: a panel on a ground that is not the Bible\'s (%s)' % (rel, tone))
    for label, inner in re.findall(r'<section class="ch[^"]*" aria-label="([^"]*)">([\s\S]*?)</section>', t):
        if '<div class="pnl ' not in inner: continue
        if 'pnl-navy' in inner and label != 'Journal &amp; Press': problems.append('%s: Ink Navy is for Journal & Press only (%s)' % (rel, label))
        if re.search(r'<video|<div class="row[ "]|<figure class="b(?: g)? b-(?:single|tall|full|row)\b', inner): problems.append('%s: a panel holds cut-outs only (%s)' % (rel, label))
    if tones and "closest('.pnl')" not in open(os.path.join(D, 'js', 'site.js'), encoding='utf-8').read():
        problems.append('%s: the lightbox does not take a panel\'s ground (site.js)' % rel)
# Work resolves to the work list: /#work lands on it on home (/#archive opens the full list)
home_t = open(os.path.join(D, 'index.html'), encoding='utf-8').read()
if not ('id="work"' in home_t and 'id="works"' in home_t and 'class="ctl archive-toggle"' in home_t): problems.append('index.html: no work list for Work (/#work) to land on')
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
    got = [x for x in got if x not in finished]
    if got != order: problems.append('%s: the project list does not follow project_order' % page_)
# Samples rows (work.json "samples": true, D, Oct. 15): no page and no link; on home "Samples available upon request" sits
# in place of their tags, set like a tag. Every other project has a page (build.py stops otherwise).
_w = json.load(open(os.path.join(ROOT, 'content', 'work.json'), encoding='utf-8'))['projects']
_samples = json.load(open(os.path.join(ROOT, 'content', 'site.json'), encoding='utf-8'))['home']['work']['samples']
_sm = open(os.path.join(D, 'sitemap.xml'), encoding='utf-8').read() if os.path.exists(os.path.join(D, 'sitemap.xml')) else ''
_proj = open(os.path.join(D, 'projects', 'index.html'), encoding='utf-8').read()
for e in _w:
    s_ = e['slug']; row = re.search(r'<li class="work-row[^"]*" data-project="%s"[^>]*>([\s\S]*?)</li>' % re.escape(s_), home_t)
    li = re.search(r'<li id="%s"[^>]*>([\s\S]*?)</li>' % re.escape(s_), _proj)
    if not e.get('samples'):
        if row and '<span class="tag samples">' in row.group(1): problems.append('index.html: %s reads "%s" but is not a samples row' % (s_, _samples))
        continue
    if s_ in order or s_ in finished or os.path.exists(os.path.join(D, 'projects', s_ + '.html')): problems.append('projects/%s: a samples row has a page' % s_)
    if '/projects/%s<' % s_ in _sm: problems.append('sitemap.xml: lists %s, a samples row' % s_)
    if not row: problems.append('index.html: no row for %s' % s_)
    else:
        if '<a ' in row.group(1): problems.append('index.html: the samples row %s links' % s_)
        if '<span class="tags"><span class="tag samples">%s</span></span>' % _samples not in row.group(1): problems.append('index.html: %s does not read "%s" in place of its tags' % (s_, _samples))
    if not li: problems.append('projects/index.html: no row for %s' % s_)
    elif '<a ' in li.group(1): problems.append('projects/index.html: the samples row %s links' % s_)
# The Journal: every published post has its page and is in the sitemap; a draft has neither (in a drafts build its
# page is a preview, never shipped); /journal/ is in the sitemap once a post is published; /blog/ sends to /journal/
journal = json.load(open(os.path.join(ROOT, 'content', 'journal.json'), encoding='utf-8'))
sitemap = open(os.path.join(D, 'sitemap.xml'), encoding='utf-8').read() if os.path.exists(os.path.join(D, 'sitemap.xml')) else ''
loc = lambda u: '<loc>https://opmetosserpse.com%s</loc>' % u in sitemap
live = [e for e in journal['posts'] if not e.get('draft')]
# A hidden section (site.json "hidden"): not in the cover menu; the hidden Journal is out of the sitemap and every page of
# it is noindex
hidden = json.load(open(os.path.join(ROOT, 'content', 'site.json'), encoding='utf-8')).get('hidden', [])
home_html = open(os.path.join(D, 'index.html'), encoding='utf-8').read()
nav_html = (re.search(r'<nav class="cover-nav"[\s\S]*?</nav>', home_html) or [''])[0]
for sec, href in (('foundry', 'href="#foundry"'), ('journal', 'href="/journal/"')):
    if sec in hidden and href in nav_html: problems.append('index.html: %s is hidden but in the menu' % sec)
if 'journal' in hidden:
    if '/journal/' in sitemap: problems.append('sitemap.xml: the Journal is hidden but listed')
    problems += ['docs/journal/%s: the Journal is hidden but this page is indexable' % os.path.basename(f)
                 for f in glob.glob(D + '/journal/*.html') if '<meta name="robots" content="noindex">' not in open(f, encoding='utf-8').read()]
    live = []  # the checks below expect nothing in the sitemap
for e in journal['posts']:
    built = os.path.exists(os.path.join(D, 'journal', e['slug'] + '.html'))
    if not e.get('draft') and not built and 'journal' not in hidden: problems.append('journal.json: %s has no page in docs/journal/' % e['slug'])
    if e.get('draft') and built and not drafts: problems.append('docs/journal/%s.html: a draft was built' % e['slug'])
    if e.get('draft') and loc('/journal/' + e['slug']): problems.append('sitemap.xml: the draft %s is listed' % e['slug'])
for e in live:
    if not loc('/journal/' + e['slug']): problems.append('sitemap.xml: /journal/%s is missing' % e['slug'])
if live != [] and not loc('/journal/'): problems.append('sitemap.xml: /journal/ is missing')
if not live and loc('/journal/'): problems.append('sitemap.xml: /journal/ is listed with nothing published')
if 'journal' not in hidden and not os.path.exists(os.path.join(D, 'journal', 'index.html')): problems.append('docs/journal/index.html is missing')
stub = os.path.join(D, 'blog', 'index.html')
to = '/' if 'journal' in hidden else '/journal/'  # while the Journal is hidden, the old address goes home
if not (os.path.exists(stub) and 'url=%s"' % to in open(stub, encoding='utf-8').read()): problems.append('docs/blog/index.html does not send to %s' % to)
problems += ['docs/blog/: an old page is still there (%s)' % os.path.basename(f) for f in glob.glob(D + '/blog/*.html') if not f.endswith('index.html')]
problems += ['sitemap.xml: an old /blog/ address' for _ in [0] if '/blog/' in sitemap]
# Cloudflare Pages: every redirect stays on the site, and the Content-Security-Policy covers every inline script and
# allows nothing outside the site but the payment processor's card frame
import base64, hashlib
rd = os.path.join(D, '_redirects')
if not os.path.exists(rd): problems.append('docs/_redirects is missing')
else:
    for line in open(rd, encoding='utf-8').read().splitlines():
        if not line.strip() or line.startswith('#'): continue
        parts = line.split()
        if len(parts) != 3 or not parts[1].startswith('/') or parts[1].startswith('//') or parts[2] not in ('301', '302', '303', '307', '308'):
            problems.append('docs/_redirects: not an on-site redirect (%s)' % line)
hd = os.path.join(D, '_headers')
if not os.path.exists(hd): problems.append('docs/_headers is missing')
else:
    ht = open(hd, encoding='utf-8').read()
    csp = (re.findall(r'Content-Security-Policy: (.+)', ht) or [''])[0]
    if not csp: problems.append('docs/_headers: no Content-Security-Policy')
    hosts = set(re.findall(r'https://[^\s;]+', csp))
    extra = hosts - {'https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com', 'https://api.stripe.com'}
    if extra: problems.append('docs/_headers: the policy allows an outside host (%s)' % ', '.join(sorted(extra)))
    for f in glob.glob(D + '/**/*.html', recursive=True):  # JSON-LD is a data block, never run: the policy leaves it out
        for body in re.findall(r'<script(?![^>]*\bsrc=)(?![^>]*\btype="application/ld\+json")[^>]*>([\s\S]*?)</script>', open(f, encoding='utf-8').read()):
            if "'sha256-%s'" % base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode() not in csp:
                problems.append('%s: an inline script the policy would block' % os.path.relpath(f, D))
    for line in ht.splitlines():
        if len(line) > 2000: problems.append('docs/_headers: a line over 2,000 characters')
if not os.path.exists(os.path.join(ROOT, 'functions', 'api', 'health.js')): problems.append('functions/api/health.js is missing')

# The machine-readable site (W1): one JSON-LD block on every page, its facts matching content/; /data/, /llms.txt,
# robots.txt and the sitemap's dates. The house-style words cover their human-readable text (not keys, @type, @context,
# addresses, emails, dates or media types). Dalton's name is in the data only with site.json's founder_in_data on, and
# then only as the studio's founder. Hidden sections stay out of every list, feed and file.
BASE = 'https://opmetosserpse.com'
site_j = json.load(open(os.path.join(ROOT, 'content', 'site.json'), encoding='utf-8'))
ent = json.load(open(os.path.join(ROOT, 'content', 'entity.json'), encoding='utf-8'))
founder_on = site_j.get('founder_in_data') is True
FOUNDER = {'@type': 'Person', 'name': 'Dalton Corr'}
CRAWLERS = ('GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended')
FORBIDDEN = {'challenge', 'work', 'system', 'deliverables', 'press', 'credits'}  # a project's fields that stay in content/
STUBS = {'blog/index.html'}  # the old address: a redirect to /journal/, not a page
LITERAL = re.compile(r'(?:https?://|mailto:|/)\S*|[^@\s]+@[^@\s]+\.[a-z]+|\d{4}(?:-\d{2}){0,2}|[a-z]+/[\w.+-]+|[a-z]{2}')
projects_c = {os.path.basename(f)[:-5]: json.load(open(f, encoding='utf-8')) for f in glob.glob(os.path.join(ROOT, 'content', 'projects', '*.json'))}
projects_c.update(finished)  # a finished page's facts are held to its data like any project's
notes_c = {os.path.basename(f)[:-5]: json.load(open(f, encoding='utf-8')) for f in glob.glob(os.path.join(ROOT, 'content', 'notes', '*.json'))}
wjs = {e['slug']: e for e in json.load(open(os.path.join(ROOT, 'content', 'work.json'), encoding='utf-8'))['projects']}
lede = lambda s: notes_c.get(s, {}).get('lede') or projects_c[s]['lede']  # the paragraph the page shows
in_docs = lambda path: any(os.path.exists(D + x) for x in (path, path + '.html', path.rstrip('/') + '/index.html'))
gone = [x for x, sec in (('/journal', 'journal'), ('/foundry', 'foundry'), ('#foundry', 'foundry')) if sec in hidden]  # addresses never in a list, feed or file

def style(where, v, key=''):
    """The house-style words, on every string value but the literal ones; the name as one word only as the alternate name."""
    if isinstance(v, dict):
        for k, x in v.items():
            if k not in ('@context', '@type', '@id'): style(where, x, k)
    elif isinstance(v, list):
        for x in v: style(where, x, key)
    elif isinstance(v, str) and not LITERAL.fullmatch(v):
        for pat, why in CHECKS + [(BRACKETS, 'a bracketed placeholder')]:
            if why == "Dalton's name outside the credits" or (why == 'the name written as one word' and key in ('alternateName', 'alternate_name')): continue
            for m in re.finditer(pat, v):
                if why == 'a word in all caps' and m.group(0) in ACRONYMS: continue
                problems.append('%s: %s (%s) in %s' % (where, why, m.group(0), key or 'the text'))

def no_name(where, raw):
    if re.search(r'dalton\W*corr', raw, re.I): problems.append("%s: Dalton's name in the data" % where)

def no_hidden(where, raw):
    problems.extend('%s: a hidden section (%s)' % (where, x) for x in gone if x in raw)

class Pics(LB):  # a project page's pictures with their alt text, outside its 3D and interactive pieces
    def handle_starttag(self, tag, a):
        n = len(self.out); super().handle_starttag(tag, a)
        if len(self.out) > n: self.out[-1] += (dict(a).get('alt') or '',)

for f in sorted(glob.glob(D + '/**/*.html', recursive=True)):
    rel = os.path.relpath(f, D); t = open(f, encoding='utf-8').read()
    if rel in STUBS: continue
    for href in ('/data/studio.json', '/data/work.json'):
        if '<link rel="alternate" type="application/json" href="%s"' % href not in t: problems.append('%s: no link to %s' % (rel, href))
    blocks = re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>', t)
    if len(blocks) != 1: problems.append('%s: %d JSON-LD blocks (one a page)' % (rel, len(blocks))); continue
    try: ld = json.loads(blocks[0])
    except ValueError as x: problems.append('%s: JSON-LD that does not parse (%s)' % (rel, x)); continue
    g = ld.get('@graph') or []
    if ld.get('@context') != 'https://schema.org': problems.append('%s: JSON-LD without the schema.org context' % rel)
    slug = rel[len('projects/'):-5] if rel.startswith('projects/') and rel != 'projects/index.html' else None
    kind = 'project' if slug else 'projects' if rel == 'projects/index.html' else 'hidden' if (rel.startswith('journal/') and 'journal' in hidden) or (rel == 'foundry.html' and 'foundry' in hidden) else 'page'
    types = [n.get('@type') for n in g]
    want = ['Organization', 'WebSite'] + {'project': ['CreativeWork', 'BreadcrumbList'], 'projects': ['CollectionPage']}.get(kind, [])
    if types != want: problems.append('%s: JSON-LD types %s, expected %s' % (rel, ', '.join(map(str, types)), ', '.join(want))); continue
    org, web = g[0], g[1]
    style(rel + ' JSON-LD', g); no_hidden(rel + ' JSON-LD', json.dumps(g[2:]))
    if founder_on and org.get('founder') == FOUNDER: org = dict(org); del org['founder']  # the one place it may be
    elif founder_on: problems.append('%s: the founder switch is on but the studio has no founder' % rel)
    no_name(rel + ' JSON-LD', json.dumps([org, web] + g[2:], ensure_ascii=False))
    # the studio: one, with its stable @id and content/entity.json's facts
    if org.get('@id') != ent['id']: problems.append('%s: the Organization @id is not %s' % (rel, ent['id']))
    for k in ('name', 'alternateName', 'url', 'description', 'email', 'sameAs', 'knowsAbout'):
        if org.get(k) != ent[k]: problems.append('%s: the Organization %s differs from content/entity.json' % (rel, k))
    if (org.get('logo') or {}).get('contentUrl') != BASE + ent['logo'] or not in_docs(ent['logo']): problems.append('%s: the Organization logo' % rel)
    addr = (org.get('foundingLocation') or {}).get('address') or {}
    if {k: addr.get(k) for k in ent['foundingLocation']} != ent['foundingLocation']: problems.append('%s: the founding location differs from content/entity.json' % rel)
    if web.get('publisher') != {'@id': ent['id']} or web.get('description') != site_j['home']['og_description'] or web.get('url') != ent['url']:
        problems.append('%s: the WebSite is not the studio\'s, or its description differs from site.json' % rel)
    if kind == 'project':
        p, cw, bc = projects_c[slug], g[2], g[3]; url = '%s/projects/%s' % (BASE, slug)
        facts = {'@id': url + '#work', 'url': url, 'name': p['title'], 'dateCreated': p['year'][-4:], 'description': lede(slug),
                 'sourceOrganization': {'@type': 'Organization', 'name': p['client']}, 'creator': {'@id': ent['id']},
                 'publisher': {'@id': ent['id']}, 'keywords': wjs[slug]['tags']}
        problems += ['%s: the CreativeWork %s differs from content/' % (rel, k) for k, v in facts.items() if cw.get(k) != v]
        if (cw.get('isPartOf') or {}).get('@id') != BASE + '/projects/': problems.append('%s: the CreativeWork is not part of /projects/' % rel)
        pics = Pics(); pics.feed(t)
        shown = {(BASE + src, alt) for src, piece, _, alt in pics.out if not piece}
        listed = {(x.get('contentUrl'), x.get('description', '')) for x in cw.get('image') or []}
        if shown != listed: problems.append('%s: the CreativeWork pictures differ from the page (%d listed, %d shown)' % (rel, len(listed), len(shown)))
        problems += ['%s: a CreativeWork picture that is not in docs/ (%s)' % (rel, u) for u, _ in listed if not in_docs((u or '')[len(BASE):])]
        trail = [(1, site_j['back'], BASE + '/'), (2, site_j['home']['work']['label'], BASE + '/projects/'), (3, p['title'], url)]
        if [(x.get('position'), x.get('name'), x.get('item')) for x in bc.get('itemListElement', [])] != trail: problems.append('%s: the breadcrumb is not Home, Work, the project' % rel)
    if kind == 'projects':
        il = (g[2].get('mainEntity') or {}).get('itemListElement') or []
        got = [(x.get('position'), (x.get('item') or {}).get('@id'), (x.get('item') or {}).get('url'), (x.get('item') or {}).get('name')) for x in il]
        on_list = re.findall(r'<li id="([^"]+)"><a href="/projects/', t)
        if got != [(n, '%s/projects/%s#work' % (BASE, s), '%s/projects/%s' % (BASE, s), projects_c[s]['title']) for n, s in enumerate(on_list, 1)]:
            problems.append('%s: the CollectionPage does not list every project page, in the list\'s order' % rel)
# the feeds: public fields only, every project on /projects/ in its order, nothing hidden
dd = os.path.join(D, 'data')
extra_files = sorted(set(os.listdir(dd) if os.path.isdir(dd) else []) - {'studio.json', 'work.json'})
problems += ['docs/data/%s: a feed that is not built yet, or a hidden one' % x for x in extra_files]
if 'journal' in hidden and os.path.exists(os.path.join(D, 'journal', 'feed.xml')): problems.append('docs/journal/feed.xml: the Journal is hidden')
feeds = {}
for name in ('studio', 'work'):
    fp = os.path.join(dd, name + '.json')
    if not os.path.exists(fp): problems.append('docs/data/%s.json is missing' % name); continue
    raw = open(fp, encoding='utf-8').read()
    try: feeds[name] = json.loads(raw)
    except ValueError as x: problems.append('docs/data/%s.json does not parse (%s)' % (name, x)); continue
    keys = set()
    walk = lambda v: [keys.add(k) or walk(x) for k, x in v.items()] if isinstance(v, dict) else [walk(x) for x in v] if isinstance(v, list) else None
    walk(feeds[name])
    problems += ['docs/data/%s.json: a field that stays in content/ (%s)' % (name, k) for k in sorted(keys & FORBIDDEN)]
    style('docs/data/%s.json' % name, feeds[name]); no_name('docs/data/%s.json' % name, raw); no_hidden('docs/data/%s.json' % name, raw)
if 'studio' in feeds:
    sj = feeds['studio']
    want = {'id': ent['id'], 'name': ent['name'], 'alternate_name': ent['alternateName'], 'description': ent['description'],
            'long_description': site_j['home']['og_description'], 'url': ent['url'], 'email': ent['email'], 'same_as': ent['sameAs'], 'knows_about': ent['knowsAbout']}
    problems += ['docs/data/studio.json: %s differs from content/' % k for k, v in want.items() if sj.get(k) != v]
if 'work' in feeds:
    rows = re.findall(r'<li id="([^"]+)"', open(os.path.join(D, 'projects', 'index.html'), encoding='utf-8').read())
    wp = feeds['work'].get('projects') or []
    if [x.get('slug') for x in wp] != rows: problems.append('docs/data/work.json: not every project on /projects/, in its order')
    for x in wp:
        s = x.get('slug'); w = wjs.get(s, {})
        if (x.get('title'), x.get('year'), x.get('tags')) != (w.get('title'), w.get('year'), w.get('tags')): problems.append('docs/data/work.json: %s differs from work.json' % s)
        if s in projects_c:
            if (x.get('client'), x.get('lede'), x.get('url')) != (projects_c[s]['client'], lede(s), '%s/projects/%s' % (BASE, s)): problems.append('docs/data/work.json: %s differs from its page' % s)
            if not x.get('image') or not in_docs(x['image'].get('url', '')[len(BASE):]): problems.append('docs/data/work.json: %s has no lead picture in docs/' % s)
        elif any(x.get(k) is not None for k in ('client', 'lede', 'url', 'image')): problems.append('docs/data/work.json: %s has no page but page fields' % s)
        if bool(x.get('samples')) != bool(w.get('samples')): problems.append('docs/data/work.json: %s is %sa samples row in work.json' % (s, '' if w.get('samples') else 'not '))
# /llms.txt: the name, the one line, every project page, the address; nothing hidden
lp = os.path.join(D, 'llms.txt')
if not os.path.exists(lp): problems.append('docs/llms.txt is missing')
else:
    lt = open(lp, encoding='utf-8').read()
    if not lt.startswith('# %s\n\n> %s\n' % (ent['name'], ent['description'])): problems.append('docs/llms.txt: not the name, then the one line')
    problems += ['docs/llms.txt: %s is missing' % s for s in order + sorted(finished) if '](%s/projects/%s)' % (BASE, s) not in lt]
    if '](mailto:%s)' % ent['email'] not in lt: problems.append('docs/llms.txt: no contact address')
    problems += ['docs/llms.txt: a link to nowhere (%s)' % u for u in re.findall(r'\]\((%s[^)]*)\)' % BASE, lt) if not in_docs(u[len(BASE):] or '/')]
    for line in lt.splitlines(): style('docs/llms.txt', re.sub(r'\]\([^)]*\)', ']', line).lstrip('#>- ').replace('[', '').replace(']', ''))
    no_name('docs/llms.txt', lt); no_hidden('docs/llms.txt', lt)
# robots.txt: everyone allowed, and each named crawler in a group of its own with everyone's rules (or none, if switched off)
rp = os.path.join(D, 'robots.txt'); rt = open(rp, encoding='utf-8').read() if os.path.exists(rp) else ''
groups, cur, ua = {}, None, False
for line in rt.splitlines():
    k, _, v = line.split('#', 1)[0].partition(':'); k, v = k.strip().lower(), v.strip()
    if k == 'user-agent':
        if not ua: cur = []
        groups[v] = cur; ua = True
    elif k in ('allow', 'disallow') and cur is not None: cur.append('%s: %s' % (k.capitalize(), v)); ua = False
    elif k: ua = False
allow = {c['name']: c['allow'] is True for c in ent.get('crawlers', [])}
if 'Allow: /' not in groups.get('*', []): problems.append('robots.txt: everyone is not allowed')
if set(allow) != set(CRAWLERS): problems.append('content/entity.json: the crawlers are not the nine named')
for c in CRAWLERS:
    if c not in groups: problems.append('robots.txt: no group for %s' % c)
    elif groups[c] != (groups.get('*') if allow.get(c) else ['Disallow: /']): problems.append('robots.txt: %s does not carry the rules entity.json gives it' % c)
if 'Sitemap: %s/sitemap.xml' % BASE not in rt: problems.append('robots.txt: no Sitemap line')
no_name('docs/robots.txt', rt)
# the sitemap: every address is a page in docs/, with a date
locs = re.findall(r'<loc>([^<]*)</loc>', sitemap)
dated = re.findall(r'<url><loc>([^<]*)</loc><lastmod>(\d{4}-\d{2}-\d{2})</lastmod></url>', sitemap)
if len(dated) != len(locs): problems.append('sitemap.xml: an address without a date (lastmod)')
problems += ['sitemap.xml: %s is not a page in docs/' % u for u in locs if not (u.startswith(BASE) and in_docs(u[len(BASE):]))]
no_name('docs/sitemap.xml', sitemap); no_hidden('docs/sitemap.xml', sitemap)

# Hidden sections ship nothing (site.json "hidden", D, Oct. 13): no file of theirs in docs/, none of their markup or
# words on any page, and no link or redirect into one. Taken off the list, the build brings all of it back.
def section_of(u):  # as build.py's: the section an on-site address leads into, by its first word
    u = re.sub(r'^https://opmetosserpse\.com(?=/|$)', '', u) or '/'
    m = re.match(r'/?#?([a-z]+)', u) if u[0] in '/#' else None
    return m.group(1) if m else None
SECTION = {'foundry': 'Foundry', 'journal': 'Journal'}
# Words of a hidden section a page may carry: Opmet Serif's "In use" caption names the Foundry's book, unlinked (D, Oct. 14)
HIDDEN_OK = {('projects/opmet-serif.html', 'Season One')}
FILES = {'foundry': ('foundry.html', 'foundry', 'media/foundry-*'), 'journal': ('journal', 'media/journal-*')}
MARKUP = {  # what build.py writes for each one: its panel on home, its pages and its name among the panels in the early script
    'foundry': r'\bid="foundry(?:-title)?"|\bfoundry-panel\b|\bdata-foundry\b|\bdata-fd-|\bclass="(?:[^"]*\s)?fd-|\bdata-go="foundry"'
               r'|<script>(?:(?!</script>)[\s\S])*\bfoundry\b',
    'journal': r'\bid="(?:blog|blog-title|articles)"|\b(?:blog-panel|blog-list|blog-topics|blog-article|journal-line|journal-empty|journal-page|'
               r'journal-main|journal-all|article-body)\b|\bdata-journal\b|\bdata-article\b|\bdata-go="blog"|<script>(?:(?!</script>)[\s\S])*\b(?:blog|journal)\b'}
norm = lambda s: ' '.join(H.unescape(s).translate({0x2018: "'", 0x2019: "'", 0x201c: '"', 0x201d: '"', 0xa0: ' '}).split())
def strings(v):
    return [y for x in v.values() for y in strings(x)] if isinstance(v, dict) else [y for x in v for y in strings(x)] if isinstance(v, list) else [v] if isinstance(v, str) else []
# Each one's own words, as its panel and pages would show them: the Foundry's products and holding page (its labels are
# the shared controls' words, and the 3D pieces say "Drag to rotate" too); the Journal's line, titles, the start of each
# paragraph and its pictures' alt text and captions
fdj = json.load(open(os.path.join(ROOT, 'content', 'foundry.json'), encoding='utf-8'))
said = {'foundry': [site_j['foundry']['og_title'], site_j['foundry']['og_description']] + [x for p in fdj['products'] for x in
                    [p['name'], p['type'], p['line'], p['meta']] + [l for l, _ in p['images']] + [t for t, _ in p['actions']]],
        'journal': [site_j['journal'][k] for k in ('line', 'description')] + site_j['journal']['lines'] + [x for e in journal['posts'] for x in (e['title'], e.get('full_title', ''))]}
whole = {'foundry': strings([site_j['foundry'], fdj]), 'journal': strings([site_j['journal'], journal])}  # all of each one's text
for e in journal['posts']:
    fp = os.path.join(ROOT, 'content', 'journal', e['slug'] + '.txt')
    for b in re.split(r'\n\s*\n', open(fp, encoding='utf-8').read() if os.path.exists(fp) else ''):
        b = ' '.join(b.split()); m = re.fullmatch(r'(?:image|note):\s*(.+)', b); whole['journal'].append(b)
        said['journal'] += [x.strip() for k, x in enumerate(m.group(1).split('|')) if k in (1, 3)] if m else [' '.join(b.split()[:6])] if len(b.split()) >= 6 else []
# Only the words that are theirs alone: two words or more, or a figure ($45), and in no shown section's content
seen_src = '\n'.join(norm(x) for x in strings([{k: v for k, v in site_j.items() if k not in ('foundry', 'journal')}, projects_c, notes_c, wjs, ent,
                                                json.load(open(os.path.join(ROOT, 'content', 'press.json'), encoding='utf-8'))]
                                               + [v for k, v in whole.items() if k not in hidden]))
said = {k: sorted({norm(x) for x in v if (len(x.split()) > 1 or re.search(r'\d', x)) and norm(x) not in seen_src}) for k, v in said.items()}
for sec in hidden:
    for pat in FILES.get(sec, ()):
        problems += ['docs/%s: the %s is hidden but this ships' % (os.path.relpath(f, D), SECTION[sec]) for f in glob.glob(os.path.join(D, pat))]
for f in sorted(glob.glob(D + '/**/*.html', recursive=True)):
    rel = os.path.relpath(f, D); t = open(f, encoding='utf-8').read()
    shown = norm(re.sub(r'<[^>]+>', ' ', re.sub(r'<sup class="ord">([^<]*)</sup>', r'\1', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', t))) + ' ' +
                 ' '.join(re.findall(r'\s(?:content|alt|aria-label|title|data-title)="([^"]*)"', t)))
    targets = re.findall(r'\s(?:href|src|poster|action|content)="([^"]*)"', t) + re.findall(r'url=([^"\s;>]+)', t) + re.findall(r'location\.replace\("([^"]*)"\)', t)
    for sec in hidden:
        if sec not in SECTION: continue
        problems += ['%s: the %s is hidden but the page carries its markup (%s)' % (rel, SECTION[sec], m.group(0)[:40]) for m in re.finditer(MARKUP[sec], t)]
        problems += ['%s: the %s is hidden but the page carries its words (%s)' % (rel, SECTION[sec], s) for s in said[sec] if re.search(r'(?<!\w)%s(?!\w)' % re.escape(s), shown)
                     and (rel, s) not in HIDDEN_OK]
        problems += ['%s: a link into the hidden %s (%s)' % (rel, SECTION[sec], u) for u in targets if u and section_of(u) == sec]
if os.path.exists(rd):
    for line in open(rd, encoding='utf-8').read().splitlines():
        parts = line.split()
        if parts and not line.startswith('#') and len(parts) == 3 and section_of(parts[1]) in hidden:
            problems.append('docs/_redirects: a redirect into the hidden %s (%s)' % (SECTION.get(section_of(parts[1]), section_of(parts[1])), line))

print('\n'.join(sorted(set(problems))) or 'All clear: no broken links and no house-style problems%s.' % (' (a drafts build: placeholders let through)' if drafts else ''))
sys.exit(1 if problems else 0)
