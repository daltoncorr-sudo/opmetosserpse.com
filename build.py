#!/usr/bin/env python3
"""Build opmetosserpse.com into ./docs from ./content, ./static and the daltoncorr.com image library.

    python3 build.py --daltoncorr ../daltoncorr-porfolio      # path to a clone of daltoncorr-sudo/daltoncorr-porfolio
    python3 serve.py                                          # preview at http://127.0.0.1:8080/

Needs Python 3.9+ and Pillow (pip install Pillow). No other dependencies, no build tools, no framework.
"""
import argparse, html, json, os, re, shutil, sys, zipfile
import moves
from datetime import date

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is missing: run  python3 -m pip install Pillow  and try again.")

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, 'content')
DIST = os.path.join(ROOT, 'docs')  # GitHub Pages publishes this folder from main
WIDTHS = (800, 1600, 2400)
QUALITY = 82
esc = lambda s: html.escape(s or '', quote=True)

def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)

def typo(s):
    """Straight quotes to curly, for any copy that arrives with straight ones."""
    s = esc(s)
    s = re.sub(r'(^|[\s(\[\u2014])&#x27;', '\\1\u2018', s).replace('&#x27;', '\u2019')
    s = re.sub(r'(^|[\s(\[\u2014])&quot;', '\\1\u201c', s).replace('&quot;', '\u201d')
    return s

class Media:
    def __init__(self, src_root, out_root):
        self.src_root, self.out_root, self.cache, self.log = src_root, out_root, {}, []

    def image(self, rel, slug, name, max_w=2400):
        """Resize one source image into WebP at up to three widths. Returns (src, srcset, w, h)."""
        key = (rel, max_w)
        if key in self.cache: return self.cache[key]
        src = os.path.join(self.src_root, rel)
        if not os.path.exists(src):
            self.log.append('missing: ' + rel); return None
        out_dir = os.path.join(self.out_root, slug); os.makedirs(out_dir, exist_ok=True)
        if rel.lower().endswith('.webp') and getattr(Image.open(src), 'is_animated', False):
            dst = os.path.join(out_dir, name + '.webp'); shutil.copyfile(src, dst)
            im = Image.open(src); r = ('/media/%s/%s.webp' % (slug, name), '', im.width, im.height)
            self.cache[key] = r; return r
        im = ImageOps.exif_transpose(Image.open(src))
        if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        widths = [w for w in WIDTHS if w < im.width and w <= max_w] + [min(im.width, max_w)]
        widths = sorted(set(widths)); parts = []
        for w in widths:
            h = round(im.height * w / im.width)
            fn = '%s-%d.webp' % (name, w); dst = os.path.join(out_dir, fn)
            if not os.path.exists(dst):
                (im if w == im.width else im.resize((w, h), Image.LANCZOS)).save(dst, 'WEBP', quality=QUALITY, method=4)
            parts.append(('/media/%s/%s' % (slug, fn), w))
        big = parts[-1]; w = big[1]; h = round(im.height * w / im.width)
        r = (big[0], ', '.join('%s %dw' % p for p in parts), w, h)
        self.cache[key] = r; return r

    def copy(self, rel, slug, name):
        src = os.path.join(self.src_root, rel)
        if not os.path.exists(src):
            self.log.append('missing: ' + rel); return None
        out_dir = os.path.join(self.out_root, slug); os.makedirs(out_dir, exist_ok=True)
        ext = os.path.splitext(rel)[1].lower(); dst = os.path.join(out_dir, name + ext)
        shutil.copyfile(src, dst); return '/media/%s/%s%s' % (slug, name, ext)

    def og(self, rel, slug):
        src = os.path.join(self.src_root, rel)
        if not rel or not os.path.exists(src): return None
        im = ImageOps.fit(ImageOps.exif_transpose(Image.open(src)).convert('RGB'), (1200, 630), Image.LANCZOS)
        out_dir = os.path.join(self.out_root, slug); os.makedirs(out_dir, exist_ok=True)
        im.save(os.path.join(out_dir, 'og.jpg'), 'JPEG', quality=85)
        return '/media/%s/og.jpg' % slug

SIZES = {'H': '100vw', 'F': '100vw', 'W': '(max-width:720px) 100vw, 88vw', 'V': '(max-width:720px) 100vw, 88vw',
         'P': '(max-width:720px) 100vw, 44vw', 'S': '(max-width:720px) 100vw, 56vw'}

def img_tag(m, slot, alt, eager=False):
    src, srcset, w, h = m
    lazy = '' if eager else ' loading="lazy" decoding="async"'
    ss = ' srcset="%s" sizes="%s"' % (srcset, SIZES.get(slot, '100vw')) if srcset else ''
    return '<img src="%s"%s width="%d" height="%d" alt="%s"%s>' % (src, ss, w, h, esc(alt), lazy)

def video_tag(src, alt, poster=None):
    pa = ' poster="%s"' % poster if poster else ''
    return '<video data-loop muted playsinline loop preload="none"%s aria-label="%s" src="%s"></video>' % (pa, esc(alt), src)

def brand_svg(name, cls, label=None):
    """Inline one of static/brand/*.svg in ink (currentColor), sized by CSS."""
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'brand', name), encoding='utf-8') as f:
        s = f.read().strip()
    s = re.sub(r'\s(width|height)="[^"]*"', '', s, count=2)
    s = re.sub(r'fill="#[0-9A-Fa-f]{3,6}"', 'fill="currentColor"', s)
    a11y = 'role="img" aria-label="%s"' % label if label else 'aria-hidden="true"'
    return s.replace('<svg ', '<svg class="%s" %s focusable="false" ' % (cls, a11y), 1)


# The stamped ink on the hand and the name: a static SVG filter applied at render time, never to the masters.
# Edge wobble (turbulence into displacement), a light blur re-sharpened into bleed, and a second, low-frequency
# turbulence that varies the density. Three presets; <html data-ink> picks one (medium by default).
INK = {  # displacement px, blur px, alpha slope, alpha intercept, density variation
    'light':  (1.5, 0.4, 2.2, -0.45, 0.25),
    'medium': (2.2, 0.6, 1.8, -0.25, 0.45),
    'heavy':  (3.0, 0.8, 1.6, -0.12, 0.7),
}
def ink_filters():
    f = ''.join(
        '<filter id="ink-%s" x="-10%%" y="-10%%" width="120%%" height="120%%" color-interpolation-filters="sRGB">'
        '<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="edge"/>'
        '<feDisplacementMap in="SourceGraphic" in2="edge" scale="%s" xChannelSelector="R" yChannelSelector="G" result="wobble"/>'
        '<feGaussianBlur in="wobble" stdDeviation="%s" result="soft"/>'
        '<feComponentTransfer in="soft" result="bleed"><feFuncA type="linear" slope="%s" intercept="%s"/></feComponentTransfer>'
        '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="11" result="low"/>'
        '<feColorMatrix in="low" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  %s 0 0 0 %s" result="density"/>'
        '<feComposite in="bleed" in2="density" operator="in"/></filter>' % (n, d, b, sl, ic, round(-2 * k, 3), round(1 + k, 3))
        for n, (d, b, sl, ic, k) in INK.items())
    return '<svg class="ink-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>%s</defs></svg>' % f

def page(site, title, desc, path, body, og_image=None, current=None, extra_head='', main_cls=''):
    url = 'https://%s%s' % (site['domain'], path)
    og = og_image or '/media/site/og.jpg'
    # No menu bar. Inner pages carry only the hand and the name, centered, back to the cover.
    header = '' if path == '/' else ('<header class="site-header"><a class="lockup" href="/" aria-label="Opmet Osserpse">%s%s</a></header>'
                                     % (brand_svg('hand-mark.svg', 'lockup-hand ink'), brand_svg('wordmark.svg', 'wordmark ink')))
    nav = header
    return '''<!doctype html>
<html lang="en" data-ink="medium">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(url)s">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Opmet Osserpse">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(url)s">
<meta property="og:image" content="https://%(domain)s%(og)s">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F7F6F2">
<link rel="icon" href="/brand/hand-mark.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/libre-caslon-text/libre-caslon-text-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/instrument-sans/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=%(v)s">
%(extra)s</head>
<body>
%(ink)s
<a class="skip" href="#main">Skip to content</a>
%(nav)s
<main id="main"%(main_cls)s>
%(body)s
</main>
<script src="/js/site.js?v=%(v)s" defer></script>
</body>
</html>
''' % dict(title=esc(title), desc=esc(desc), url=url, domain=site['domain'], og=og, nav=nav, tz=site['clock_timezone'],
           place=esc(site['clock_place']), body=body, name=esc(site['name']), descr=esc(site['description'].rstrip('.')),
           email=site['email'], line=esc(site['line']), copy=esc(site['copyright']), privacy=esc(site['privacy_line']),
           v=site['_v'], extra=extra_head, ink=ink_filters(), main_cls=' class="%s"' % main_cls if main_cls else '')

def write(path, text):
    full = os.path.join(DIST, path.lstrip('/'))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f: f.write(text)

def project_body(p, media, prev, nxt, zip_href):
    """Image first. A title, one line, the images, then a few plain lines. No headers."""
    out = ['<header class="project-head"><h1>%s</h1><p>%s</p></header>' % (typo(p['title']), typo(p['deck']))]
    items, html_, i = media[:], [], 0
    while i < len(items):
        m = items[i]
        if m['slot'] == 'P' and i + 1 < len(items) and items[i + 1]['slot'] == 'P':
            html_.append('<div class="pair"><figure class="fade">%s</figure><figure class="fade">%s</figure></div>' % (m['html'] if i else m['html_eager'], items[i + 1]['html'])); i += 2; continue
        cls = {'H': 'full', 'F': 'full', 'P': 'narrow', 'S': 'narrow'}.get(m['slot'], 'wide')
        html_.append('<figure class="%s fade">%s</figure>' % (cls, m['html_eager'] if i == 0 else m['html'])); i += 1
    out.append('<div class="media">%s</div>' % ''.join(html_))
    lines = [p['client'] + ', ' + p['year'], p['role']]
    lines += ['<a href="%s" rel="noopener">%s</a>' % (esc(u), typo(t)) for t, u in p['links']]
    out.append('<footer class="project-foot"><p>%s</p><p><a href="/projects/%s">%s</a></p><p><a href="/#work">Index</a></p></footer>' % (
        '<br>'.join(x if x.startswith('<a') else typo(x) for x in lines), nxt['slug'], typo(nxt['title'])))
    return '\n'.join(out)

def list_rows(entries):
    """A plain list of names. No years, numbers or rules."""
    li = []
    for e in entries:
        if e.get('page'):
            li.append('<li id="%s"><a href="/projects/%s"%s>%s</a></li>'
                      % (e['slug'], e['slug'], ' data-preview="%s"' % e['preview'] if e.get('preview') else '', typo(e['title'])))
        else:
            li.append('<li id="%s" class="plain">%s</li>' % (e['slug'], typo(e['title'])))
    return '<ul class="list">%s</ul>' % ''.join(li)

def load_work(projects):
    """content/work.json: every project, newest first, with its tags and whether it is Selected. Fails on drift."""
    w = load(os.path.join(CONTENT, 'work.json')); vocab = w['tags']; seen = set(); errs = []
    for e in w['projects']:
        s = e['slug']
        if s in seen: errs.append('%s: listed twice' % s)
        seen.add(s)
        if not re.fullmatch(r'\d{4}', e.get('year', '')): errs.append('%s: year must be four digits' % s)
        if not 1 <= len(e['tags']) <= 2: errs.append('%s: needs one or two tags' % s)
        errs += ['%s: "%s" is not in the tag list' % (s, t) for t in e['tags'] if t not in vocab]
        p = projects.get(s); e['page'] = bool(p)
        if p and p['year'][-4:] != e['year']: errs.append('%s: year %s here, %s on its page' % (s, e['year'], p['year']))
        if e['selected'] and not p: errs.append('%s: Selected needs a project page' % s)
    errs += ['%s: has a page but is missing from work.json' % s for s in projects if s not in seen]
    if errs: sys.exit('Fix content/work.json first:\n  ' + '\n  '.join(errs))
    items = sorted(w['projects'], key=lambda e: -int(e['year']))  # stable: file order within a year
    return items, vocab

def tag_list(tags):
    return '<span class="tags">%s</span>' % ''.join('<span class="tag">%s</span>' % esc(x) for x in tags)

def work_title(e):
    return '<a href="/projects/%s">%s</a>' % (e['slug'], typo(e['title'])) if e['page'] else '<span class="plain">%s</span>' % typo(e['title'])

def work_section(items, w):
    """One list, newest first. Collapsed: the Selected titles only. See more opens the rest in place, with tags beside
    each name and the year in the left margin, once per year."""
    rows, seen, i = [], set(), 0
    for e in items:
        yr = '' if e['year'] in seen else '<span class="yr">%s</span>' % e['year']
        seen.add(e['year'])
        extra = not e['selected']
        rows.append('<li class="work-row%s" data-project="%s"%s>%s%s%s</li>' % (
            ' extra' if extra else '', e['slug'], ' style="--i:%d"' % i if extra else '', yr, work_title(e), tag_list(e['tags'])))
        if extra: i += 1
    return ('<section class="work" id="work" tabindex="-1" aria-label="%s"><div class="work-head">'
            '<h2 class="work-label" data-closed="%s" data-open="%s">%s</h2>'
            '<button type="button" class="archive-toggle" aria-expanded="false" aria-controls="works" data-open-label="%s" data-close-label="%s">%s</button></div>'
            '<ul class="works" id="works">%s</ul></section>') % (
        esc(w['label']), esc(w['selected']), esc(w['all']), esc(w['selected']), esc(w['more']), esc(w['less']), esc(w['more']), ''.join(rows))

def press_list(press):
    """Press, by year, newest first. Plain lines: the outlet, then the headline."""
    out, year = [], None
    for x in press:
        if x['year'] != year:
            if year: out.append('</ul>')
            year = x['year']; out.append('<h4 class="press-year">%s</h4><ul class="press">' % year)
        line = '<span class="outlet">%s</span> <span class="headline">%s</span>' % (typo(x['outlet']), typo(x['title']))
        out.append('<li>%s</li>' % ('<a href="%s" rel="noopener">%s</a>' % (esc(x['url']), line) if x['url'] else line))
    return ''.join(out) + '</ul>'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--daltoncorr', required=True, help='path to a clone of daltoncorr-sudo/daltoncorr-porfolio')
    ap.add_argument('--zip', action='store_true', help='also write a zip of each project images, for press')
    a = ap.parse_args()
    src_root = os.path.join(os.path.abspath(a.daltoncorr), 'site')
    if not os.path.isdir(src_root): sys.exit('Not found: %s (expected the repo with a site/ folder)' % src_root)

    site = load(os.path.join(CONTENT, 'site.json')); site['_v'] = date.today().strftime('%Y%m%d')
    index = load(os.path.join(CONTENT, 'index.json'))
    projects = {}
    for fn in sorted(os.listdir(os.path.join(CONTENT, 'projects'))):
        if fn.endswith('.json'): p = load(os.path.join(CONTENT, 'projects', fn)); projects[p['slug']] = p

    # fresh dist, keeping already-encoded media to save time on rebuilds
    os.makedirs(DIST, exist_ok=True)
    for name in os.listdir(DIST):
        if name != 'media':
            full = os.path.join(DIST, name); shutil.rmtree(full) if os.path.isdir(full) else os.remove(full)
    for d in ('css', 'js', 'fonts', 'brand'):
        shutil.copytree(os.path.join(ROOT, 'static', d), os.path.join(DIST, d))
    media = Media(src_root, os.path.join(DIST, 'media'))

    # newest first; ties keep the home order, then title
    ho = index['home_order']
    rank = lambda s: (ho.index(s) if s in ho else 99)
    ordered = sorted(projects.values(), key=lambda p: (-int(p['year'][-4:]), rank(p['slug']), p['title']))

    # site OG image: the first home project's card
    first = projects[ho[0]]
    os.makedirs(os.path.join(DIST, 'media', 'site'), exist_ok=True)
    so = media.og(first['og'] or first['card']['src'], 'site')

    # project pages
    for i, p in enumerate(ordered):
        s = p['slug']; built = []
        for n, m in enumerate(p['media'], 1):
            name = '%02d' % n
            if m['slot'] == 'V' and m['src'].endswith('.mp4'):
                src = media.copy(m['src'], s, name)
                if src: h = video_tag(src, m['alt'], (media.image(p['card']['src'], s, 'card', max_w=800) or [None])[0] if p['card']['src'] else None); built.append(dict(slot='V', html=h, html_eager=h)); p.setdefault('_bigs', []).append(src)
            else:
                r = media.image(m['src'], s, name)
                if r: built.append(dict(slot=m['slot'], html=img_tag(r, m['slot'], m['alt']), html_eager=img_tag(r, m['slot'], m['alt'], True))); p.setdefault('_bigs', []).append(r[0])
        card = media.image(p['card']['src'], s, 'card', max_w=800) if p['card']['src'] else None
        p['preview'] = card[0] if card else None
        og = media.og(p['og'] or p['card']['src'], s)
        zip_href = None
        bigs = [b for b in p.get('_bigs', [])]
        if a.zip and bigs:
            zp = os.path.join(DIST, 'media', s, '%s-images.zip' % s)
            with zipfile.ZipFile(zp, 'w', zipfile.ZIP_STORED) as z:
                for n, rel in enumerate(bigs, 1):
                    full = os.path.join(DIST, rel.lstrip('/'))
                    z.write(full, '%s-%02d%s' % (s, n, os.path.splitext(full)[1]))
            zip_href = '/media/%s/%s-images.zip' % (s, s)
        prev, nxt = ordered[i - 1], ordered[(i + 1) % len(ordered)]
        body = project_body(p, built, prev, nxt, zip_href)
        write('/projects/%s.html' % s, page(site, p['seo']['title'], p['seo']['description'], '/projects/%s' % s, body, og, '/projects'))

    # projects list: pages and rows, newest first
    items, vocab = load_work(projects)  # vocab: the tag list, checked inside load_work
    for e in items:
        if e['page']: e['preview'] = projects[e['slug']].get('preview')
    entries = items
    pr = site['projects']
    body = '<section class="index">%s</section><div class="preview" aria-hidden="true"><img alt=""></div>' % list_rows(entries)
    write('/projects/index.html', page(site, pr['og_title'], pr['og_description'], '/projects/', body, so, '/projects'))

    # home: the hand and the name, alone on the first screen. Scroll for the studio, then the index.
    h = site['home']
    hand = moves.hand_svg()  # the rig in moves/_rig/ if there is one, else static/brand/hand.svg
    # The hand's moves: one folder each in moves/ (see moves.py and moves/README.md).
    mv = moves.load()
    if mv['problems']:
        sys.exit('Fix the hand moves first:\n  ' + '\n  '.join(mv['problems']))
    write('/css/moves.css', mv['css'])
    print('Hand moves: %s%s' % (', '.join(x['name'] for x in mv['moves']),
          ''.join('; %s off (%s)' % s for s in mv['skipped'])))
    links = h['links']
    pat = re.compile('|'.join(re.escape(k) for k in sorted(links, key=len, reverse=True)))
    def link(s, used=None):
        used = set()
        def sub(m):
            k = m.group(0)
            if k in used: return k
            used.add(k)
            ext = links[k].startswith('http')
            return '<a href="%s"%s>%s</a>' % (links[k], ' rel="noopener"' if ext else '', k)
        return pat.sub(sub, s).replace('\n', '<br>')
    nav = ''.join('<a href="%s"%s>%s</a>' % (esc(u), ' rel="noopener"' if u.startswith('http') else ' data-go="%s"' % u[1:], esc(t)) for t, u in h['nav'])
    # Side panels: the foundry one screen to the left of home, About one screen to the right. The foundry is a
    # placeholder: put real HTML in content/foundry.html and it replaces the lines from site.json.
    fd = site['foundry']; fd_file = os.path.join(CONTENT, 'foundry.html')
    fd_body = open(fd_file, encoding='utf-8').read() if os.path.exists(fd_file) else ''.join('<p>%s</p>' % typo(x) for x in fd['lines'])
    back = '<p class="studio-link"><a href="#" data-studio>%s</a></p>' % esc(site['back'])
    foundry = ('<section class="panel side foundry-panel" id="foundry" aria-labelledby="foundry-title"><div class="side-inner">'
               '<h2 class="side-title" id="foundry-title" tabindex="-1">%s</h2><div class="foundry-body">%s</div>%s</div></section>') % (esc(fd['title']), fd_body, back)
    ap = site['about']
    press = load(os.path.join(CONTENT, 'press.json'))['press']
    about_panel = ('<section class="panel side about-panel" id="about" aria-labelledby="about-title">'
                   '<div class="about-grid"><div class="title-row">'
                   '<h2 class="about-title" id="about-title" tabindex="-1">%s</h2><p class="home-big"><a href="#" data-studio>%s</a></p></div>'
                   '<div class="about-main"><div class="about-body">%s</div></div>'
                   '<div class="about-press"><h3 class="press-title">%s</h3>%s</div></div></section>') % (
        ' '.join('<span>%s</span>' % esc(x) for x in ap['title'].split()), esc(site['back']), ''.join('<p>%s</p>' % link(typo(x)) for x in ap['lines']) + ''.join('<p class="contact">%s</p>' % link(typo(x)) for x in ap['contact']), esc(ap['press_title']), press_list(press))
    # The blog sits one screen above home. Posts can go in content/blog.html later; until then, the lines from site.json.
    bl = site['blog']; bl_file = os.path.join(CONTENT, 'blog.html')
    bl_body = open(bl_file, encoding='utf-8').read() if os.path.exists(bl_file) else ''.join('<p>%s</p>' % typo(x) for x in bl['lines'])
    blog = ('<section class="blog-panel" id="blog" aria-labelledby="blog-title"><div class="blog-inner"><div class="title-row">'
            '<h2 class="about-title" id="blog-title" tabindex="-1">%s</h2><p class="home-big"><a href="#" data-studio>%s</a></p></div>'
            '<div class="blog-body">%s</div></div></section>') % (esc(bl['title']), esc(site['back']), bl_body)
    cover = ('<section class="cover"><div class="cover-inner"><h1><span class="mark ink" %s>%s</span><span class="name ink">%s<span class="name-text">Opmet Osserpse</span></span></h1>'
             '<nav class="cover-nav" aria-label="Site">%s</nav></div></section>') % (
        moves.mark_attrs(mv), hand + mv['layers'], brand_svg('wordmark.svg', 'wordmark'), nav)
    body = ('<div class="stage-clip"><div class="stage" data-stage>%s<div class="panel home-panel">%s<div data-home>%s%s</div></div>%s</div></div>') % (
        foundry, blog, cover, work_section(items, h['work']), about_panel)
    early = '<script>if(/^#(foundry|about|blog)$/.test(location.hash))document.documentElement.classList.add("at-"+location.hash.slice(1))</script>\n'
    write('/index.html', page(site, 'Opmet Osserpse', h['og_description'], '/', body, so, '/', main_cls='home-main',
                              extra_head=early + '<link rel="stylesheet" href="/css/moves.css?v=%s">\n' % site['_v']))

    # foundry (a holding page until the shop opens), privacy, 404
    # /foundry is now a panel on the home page: send the old address there, inside this site
    body = '<section class="single"><p><a href="/#foundry">%s</a></p></section>' % esc(fd['title'])
    write('/foundry.html', page(site, fd['og_title'], fd['og_description'], '/foundry', body, so,
                                extra_head='<meta http-equiv="refresh" content="0; url=/#foundry">\n<meta name="robots" content="noindex">\n'
                                           '<script>location.replace("/#foundry")</script>\n'))
    pv = site['privacy']
    body = '<article class="page">%s</article>' % ''.join('<p>%s</p>' % typo(x) for x in pv['lines'])
    write('/privacy.html', page(site, pv['og_title'], pv['og_description'], '/privacy', body, so))
    nf = site['notfound']
    body = '<section class="notfound"><p>%s</p><p><a href="/">%s</a></p></section>' % (typo(nf['line']), esc(nf['link']))
    write('/404.html', page(site, nf['og_title'], nf['line'], '/404', body, so, extra_head='<meta name="robots" content="noindex">\n'))

    # hosting files
    write('/CNAME', site['domain'] + '\n')
    write('/.nojekyll', '')
    write('/robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://%s/sitemap.xml\n' % site['domain'])
    urls = ['/', '/projects/', '/privacy'] + ['/projects/%s' % p['slug'] for p in ordered]
    write('/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % ''.join(
        '  <url><loc>https://%s%s</loc></url>\n' % (site['domain'], u) for u in urls))

    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DIST) for f in fs)
    print('Built %d project pages, %d list rows, into %s (%.0f MB).' % (len(ordered), len(entries), DIST, size / 1e6))
    if media.log: print('\n'.join(media.log))

if __name__ == '__main__':
    main()
