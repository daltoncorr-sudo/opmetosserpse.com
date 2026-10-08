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

def page(site, title, desc, path, body, og_image=None, current=None, extra_head=''):
    url = 'https://%s%s' % (site['domain'], path)
    og = og_image or '/media/site/og.jpg'
    # No menu bar. Inner pages carry only the name, centered, back to the cover.
    header = '' if path == '/' else '<header class="site-header"><a class="wordmark" href="/">Opmet Osserpse</a></header>'
    nav = header
    return '''<!doctype html>
<html lang="en">
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
<meta name="theme-color" content="#FBFBF8">
<link rel="icon" href="/brand/hand.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/libre-caslon-text/libre-caslon-text-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/instrument-sans/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=%(v)s">
%(extra)s</head>
<body>
<a class="skip" href="#main">Skip to content</a>
%(nav)s
<main id="main">
%(body)s
</main>
<footer class="site-footer">
<a href="mailto:%(email)s">%(email)s</a>
<span class="clock" data-clock data-tz="%(tz)s" data-place="%(place)s">%(place)s</span>
<span>%(copy)s &nbsp; <a href="/privacy">Privacy</a></span>
</footer>
<script src="/js/site.js?v=%(v)s" defer></script>
</body>
</html>
''' % dict(title=esc(title), desc=esc(desc), url=url, domain=site['domain'], og=og, nav=nav, tz=site['clock_timezone'],
           place=esc(site['clock_place']), body=body, name=esc(site['name']), descr=esc(site['description'].rstrip('.')),
           email=site['email'], line=esc(site['line']), copy=esc(site['copyright']), privacy=esc(site['privacy_line']),
           v=site['_v'], extra=extra_head)

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
    out.append('<footer class="project-foot"><p>%s</p><p><a href="/projects/%s">%s</a></p><p><a href="/#index">Index</a></p></footer>' % (
        '<br>'.join(x if x.startswith('<a') else typo(x) for x in lines), nxt['slug'], typo(nxt['title'])))
    return '\n'.join(out)

def list_rows(entries):
    """A plain list of names. No years, numbers or rules."""
    li = []
    for e in entries:
        if e.get('slug'):
            li.append('<li data-sector="%s" id="%s"><a href="/projects/%s"%s>%s</a></li>'
                      % (esc(e['sector']), e['slug'], e['slug'], ' data-preview="%s"' % e['preview'] if e.get('preview') else '', typo(e['title'])))
        else:
            t = e['title'] or e['line'].rstrip('.')
            li.append('<li data-sector="%s" id="%s" class="plain">%s</li>' % (esc(e['sector']), e['id'], typo(t)))
    return '<ul class="list">%s</ul>' % ''.join(li)

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
    entries = [dict(slug=p['slug'], title=p['title'], deck=p['deck'], sector=p['sector'], year=p['year'][-4:], preview=p.get('preview')) for p in ordered]
    for r in index['rows']: entries.append(r)
    entries.sort(key=lambda e: -int(e['year']))
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
    about = ''.join('<p>%s</p>' % link(typo(x)) for x in h['about'])
    home_entries = [dict(slug=p['slug'], title=p['title'], deck=p['deck'], sector=p['sector'], year=p['year'][-4:], preview=p.get('preview')) for p in ordered]
    body = ('<section class="cover"><h1><span class="mark" %s>%s</span><span class="name">Opmet Osserpse</span></h1></section>'
            '<section class="about">%s</section>'
            '<section class="index" id="index" aria-label="Index">%s<p class="archive"><a href="/projects/">%s</a></p></section>'
            '<div class="preview" aria-hidden="true"><img alt=""></div>') % (moves.mark_attrs(mv), hand + mv['layers'], about, list_rows(home_entries), esc(h['all_link']))
    write('/index.html', page(site, 'Opmet Osserpse', h['og_description'], '/', body, so, '/',
                              extra_head='<link rel="stylesheet" href="/css/moves.css?v=%s">\n' % site['_v']))

    # foundry (a holding page until the shop opens), privacy, 404
    fd = site['foundry']
    mail = lambda s: s.replace(site['email'], '<a href="mailto:%s">%s</a>' % (site['email'], site['email']))
    body = '<section class="single">%s</section>' % ''.join('<p>%s</p>' % mail(typo(x)) for x in fd['lines'])
    write('/foundry.html', page(site, fd['og_title'], fd['og_description'], '/foundry', body, so))
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
    urls = ['/', '/projects/', '/foundry', '/privacy'] + ['/projects/%s' % p['slug'] for p in ordered]
    write('/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % ''.join(
        '  <url><loc>https://%s%s</loc></url>\n' % (site['domain'], u) for u in urls))

    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DIST) for f in fs)
    print('Built %d project pages, %d list rows, into %s (%.0f MB).' % (len(ordered), len(entries), DIST, size / 1e6))
    if media.log: print('\n'.join(media.log))

if __name__ == '__main__':
    main()
