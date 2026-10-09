#!/usr/bin/env python3
"""Build opmetosserpse.com into ./docs from ./content, ./static and the daltoncorr.com image library.

    python3 build.py --daltoncorr ../daltoncorr-porfolio      # path to a clone of daltoncorr-sudo/daltoncorr-porfolio
    python3 serve.py                                          # preview at http://127.0.0.1:8080/

Needs Python 3.9+, Pillow (pip install Pillow) and, for video only, ffmpeg (brew install ffmpeg). No framework.
"""
import argparse, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile, zipfile
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
    return s.replace('Venice, California', 'Venice,\u00a0California')  # keep the place on one line

def ff(*args):
    """ffmpeg, for video only."""
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], capture_output=True, text=True)
    if r.returncode: sys.exit('ffmpeg failed: %s\n%s' % (' '.join(args), r.stderr[-800:]))

def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration',
                        '-of', 'json', path], capture_output=True, text=True)
    j = json.loads(r.stdout); st = j['streams'][0]
    return st['width'], st['height'], float(j['format']['duration'])

def frames_to_mp4(src, dst):
    """An animated WebP to H.264, frame by frame with its own timings (Pillow reads it; ffmpeg encodes it)."""
    im = Image.open(src)
    with tempfile.TemporaryDirectory() as tmp:
        lines = []
        for n in range(im.n_frames):
            im.seek(n); fn = os.path.join(tmp, '%04d.png' % n)
            im.convert('RGB').save(fn)
            lines += ["file '%s'" % fn, 'duration %.3f' % ((im.info.get('duration') or 40) / 1000)]
        lines.append("file '%s'" % fn)
        lst = os.path.join(tmp, 'list.txt'); open(lst, 'w').write('\n'.join(lines) + '\n')
        ff('-f', 'concat', '-safe', '0', '-i', lst, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-fps_mode', 'vfr',
           '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst)

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
            if not os.path.exists(dst) or not os.path.getsize(dst):  # re-encode an empty file too
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

    def video(self, rel, slug, name, rest='end', sound=False, first=False):
        """One film: a WebM (VP9, Opus when it has sound), the MP4 as fallback, and a WebP poster frame under 200 KB:
        the first frame for an animated poster, otherwise the frame it rests on. Returns a dict, or None."""
        src = os.path.join(self.src_root, rel)
        if not os.path.exists(src):
            self.log.append('missing: ' + rel); return None
        out_dir = os.path.join(self.out_root, slug); os.makedirs(out_dir, exist_ok=True)
        mp4, webm = os.path.join(out_dir, name + '.mp4'), os.path.join(out_dir, name + '.webm')
        if rel.lower().endswith('.webp'):  # an animated WebP: its frames become a film, so it can play once and rest
            if not os.path.exists(mp4): frames_to_mp4(src, mp4)
        elif not os.path.exists(mp4) or os.path.getsize(mp4) != os.path.getsize(src):
            shutil.copyfile(src, mp4)
        if not os.path.exists(webm):
            ff('-i', mp4, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
               *(['-c:a', 'libopus', '-b:a', '96k'] if sound else ['-an']), webm)
        w, h, dur = probe(mp4)
        t = 0 if first else (max(0, dur - 0.05) if rest == 'end' else float(rest))
        png = os.path.join(out_dir, name + '-frame.png')
        ff('-ss', '%.3f' % t, '-i', mp4, '-frames:v', '1', '-update', '1', png)
        im = Image.open(png).convert('RGB'); os.remove(png)
        if im.width > 1600: im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        poster = os.path.join(out_dir, name + '-poster.webp')
        for q in (82, 72, 62, 50, 40):
            im.save(poster, 'WEBP', quality=q, method=4)
            if os.path.getsize(poster) < 200_000: break
        u = '/media/%s/%s' % (slug, name)
        return dict(webm=u + '.webm', mp4=u + '.mp4', poster=u + '-poster.webp', w=w, h=h,
                    bytes={k: os.path.getsize(os.path.join(out_dir, name + x)) for k, x in (('webm', '.webm'), ('mp4', '.mp4'), ('poster', '-poster.webp'))})

    def og(self, rel, slug):
        src = os.path.join(self.src_root, rel)
        if not rel or not os.path.exists(src): return None
        im = ImageOps.fit(ImageOps.exif_transpose(Image.open(src)).convert('RGB'), (1200, 630), Image.LANCZOS)
        out_dir = os.path.join(self.out_root, slug); os.makedirs(out_dir, exist_ok=True)
        im.save(os.path.join(out_dir, 'og.jpg'), 'JPEG', quality=85)
        return '/media/%s/og.jpg' % slug

# How wide each block draws, for srcset
SIZES = {'plate': '(max-width:640px) 100vw, 45vw', 'field': '(max-width:640px) 100vw, 60vw', 'wide': '(max-width:640px) 100vw, 76vw',
         'pair': '(max-width:640px) 50vw, 30vw', 'full': '100vw', 'tall': '(max-width:640px) 100vw, 30vw'}

def img_tag(m, sizes, alt, eager=False, extra=''):
    src, srcset, w, h = m
    lazy = ' fetchpriority="high"' if eager else ' loading="lazy" decoding="async"'
    ss = ' srcset="%s" sizes="%s"' % (srcset, sizes) if srcset else ''
    return '<img src="%s"%s width="%d" height="%d" alt="%s"%s%s>' % (src, ss, w, h, esc(alt), lazy, extra)

def video_tag(v, vid, alt, rest, sound, eager=False):
    """Shows its poster frame, plays once (muted, on screen) and rests; a film with sound waits for a click. Never loops."""
    once = '' if sound else ' data-once'
    return ('<video id="%s" poster="%s" width="%d" height="%d" playsinline muted preload="%s" data-rest="%s"%s aria-label="%s">'
            '<source src="%s" type="video/webm"><source src="%s" type="video/mp4"></video>') % (
        vid, v['poster'], v['w'], v['h'], 'auto' if eager else 'metadata', rest, once, esc(alt), v['webm'], v['mp4'])

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
                                     % (brand_svg('hand-mark.svg', 'lockup-hand'), brand_svg('wordmark.svg', 'wordmark ink')))
    # Which way the page flips: forward onto a project, back onto home
    page_cls = ' class="page-home"' if path == '/' else ' class="page-project"' if path.startswith('/projects/') and path != '/projects/' else ''
    nav = header
    return '''<!doctype html>
<html lang="en" data-ink="medium"%(page_cls)s>
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
           v=site['_v'], extra=extra_head, ink=ink_filters(), page_cls=page_cls, main_cls=' class="%s"' % main_cls if main_cls else '')

def write(path, text):
    full = os.path.join(DIST, path.lstrip('/'))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f: f.write(text)

# The HollyShorts pages open on the festival's official poster (notes: "opener")
HOLLYSHORTS = {'hollyshorts-18', 'hollyshorts-19', 'hollyshorts-20', 'hollyshorts-21', 'hollyshorts-22', 'hollyshorts-comedy-2025',
               'hollyshorts-comedy-2026', 'hollyshorts-dubai-2025', 'hollyshorts-london-2024', 'hollyshorts-london-2025'}

def load_notes(p):
    """content/notes/<slug>.json: the opener, the Work line, chapter labels, margin notes, video rest frames and hidden items.
    Indexes are 1-based positions in the project's media list. Fails on anything that doesn't fit."""
    fn = os.path.join(CONTENT, 'notes', p['slug'] + '.json')
    n = load(fn) if os.path.exists(fn) else {}
    n.setdefault('opener', 1); n.setdefault('chapters', []); n.setdefault('notes', {}); n.setdefault('video', {}); n.setdefault('hide', [])
    s, count, errs = p['slug'], len(p['media']), []
    alts = [m['alt'] for m in p['media']]
    if not 1 <= n['opener'] <= count: errs.append('opener %s is not in media' % n['opener'])
    if n['opener'] != 1 and s not in HOLLYSHORTS: errs.append('only the HollyShorts pages open on a poster out of order')
    n['_hide'] = set()
    for alt in n['hide']:
        if alt not in alts: errs.append('hide: no item with the alt text "%s"' % alt)
        else: n['_hide'].add(alts.index(alt) + 1)
    if n['_hide'] and s != 'sunnys-bookshop': errs.append('hide is only for sunnys-bookshop')
    for k in list(n['notes']) + list(n['video']):
        if not k.isdigit() or not 1 <= int(k) <= count: errs.append('index %s is not in media' % k)
    for k in n['video']:
        if k.isdigit() and int(k) <= count and p['media'][int(k) - 1]['slot'] != 'V': errs.append('video %s is not a V item' % k)
    for k, x in n['notes'].items():
        if len(x['text'].split()) > 25: errs.append('note %s runs over 25 words' % k)
    if len(n['chapters']) > 4: errs.append('more than four chapter labels')
    for c in n['chapters']:
        if not 2 <= len(c['label'].split()) <= 5: errs.append('chapter "%s" should be 2 to 5 words' % c['label'])
    if errs: sys.exit('Fix content/notes/%s.json first:\n  %s' % (s, '\n  '.join(errs)))
    return n

def cap(x):
    return x[:1].upper() + x[1:]

def credit_rows(p):
    """End credits: role, then names. The studio speaks for itself: "Dalton Corr: roles" is credited to Opmet Osserpse.
    Returns the rows and whether there is a photo credit."""
    rows, photo = [], False
    for label, names in p['credits']:
        photo = photo or 'photo' in label.lower() or any('photo' in x.lower() for x in names)
        if label == 'Fonts': rows.append(('Typefaces', names)); continue
        if label == 'Client': rows.append(('Client', names)); continue
        plain = []
        for x in names:
            if x.startswith('Dalton Corr: '): rows.append((cap(x[len('Dalton Corr: '):]), ['Opmet Osserpse']))
            elif ': ' in x: who, role = x.split(': ', 1); rows.append((cap(role), [who]))
            else: plain.append(x)
        if plain: rows.append((label, plain))
    if not photo: rows.append(('Photography', None))
    return rows, photo

def make_blocks(items, notes, opener_alone):
    """Group the items, in order, into blocks. Pairs form from consecutive P images, as before."""
    out, i = [], 0
    while i < len(items):
        it = items[i]
        nxt = items[i + 1] if i + 1 < len(items) else None
        if (it['slot'] == 'P' and it['kind'] == 'img' and nxt and nxt['slot'] == 'P' and nxt['kind'] == 'img'
                and not (opener_alone and i == 0)):
            grp = [it, nxt]; i += 2
        else:
            grp = [it]; i += 1
        note = next((notes[str(x['n'])]['text'] for x in grp if str(x['n']) in notes), None)
        if len(grp) == 2: kind = 'pair'
        elif it['kind'] == 'video':
            r = it['w'] / it['h']
            kind = ('field' if note else 'wide') if r > 1.2 else 'tall' if r < 0.83 else 'plate'
        elif it['slot'] in ('H', 'F'): kind = 'full'
        elif it['slot'] == 'W' and it['h'] <= it['w']: kind = 'field' if note else 'wide'
        else: kind = 'plate'
        out.append(dict(kind=kind, items=grp, note=note))
    return out

def block_html(b, slug):
    kind = b['kind']
    ms = []
    for k, it in enumerate(b['items'], 1):
        cls = 'm m%d' % k if kind == 'pair' else 'm'
        ms.append('<div class="%s" data-i="%d">%s</div>' % (cls, it['n'], it['html'](SIZES[kind])))
    cap_ = typo(b['note']) if b['note'] else ''
    for it in b['items']:
        if it['kind'] == 'video':
            if it['sound']: cap_ += ' <a href="#" class="again" data-sound="%s">Play with sound</a>' % it['id']
            cap_ += ' <a href="#" class="again" data-again="%s" hidden>Play again</a>' % it['id']
    cap_ = cap_.strip()
    if kind == 'full':
        fc = '<figcaption class="g fcap"><span class="note">%s</span></figcaption>' % cap_ if cap_ else ''
        return '<figure class="b b-full"%s>%s%s</figure>' % (' data-read' if cap_ else '', ''.join(ms), fc)
    fc = '<figcaption class="note">%s</figcaption>' % cap_ if cap_ else ''
    return '<figure class="b g b-%s"%s>%s%s</figure>' % (kind, ' data-read' if cap_ else '', ''.join(ms), fc)

def project_body(p, blocks, chapters, nxt, notes, back='Back'):
    """The opening (title, paragraph, facts), the work in up to four chapters with notes in the margin, the credits, and
    the next project. One link back to the list for the panel on home."""
    facts = [('Client', typo(p['client'])), ('Year', esc(p['year']))]
    if notes.get('work'): facts.append(('Work', typo(notes['work'])))
    facts.append(('Role', typo(p['role'])))
    if p['links']:
        t, u = p['links'][0]; facts.append(('Link', '<a href="%s" rel="noopener">%s</a>' % (esc(u), typo(t))))
    out = ['<div class="pp">',
           '<section class="open g"><p class="pback"><a href="/#work" data-back>%s</a></p><div class="oi"><h1>%s</h1><p class="lede">%s</p></div>'
           '<dl class="facts">%s</dl></section>' % (esc(back), typo(p['title']), typo(notes.get('lede') or p['lede']),
                                                    ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % x for x in facts))]
    starts = {c['starts_at']: c for c in chapters}
    open_ch, n = False, 0
    for b in blocks:
        c = starts.get(b['items'][0]['n'])
        if c:
            if open_ch: out.append('</section>')
            n += 1; open_ch = True
            out.append('<section class="ch" aria-label="%s"><div class="chl"><h2 class="chap"><span class="n">%d</span>%s</h2></div>'
                       % (esc(c['label']), n, typo(c['label'])))
        out.append(block_html(b, p['slug']))
    if open_ch: out.append('</section>')
    rows, _ = credit_rows(p)
    out.append('<section class="g end" aria-label="Credits"><h2 class="lab">Credits</h2><dl class="cr">%s</dl></section>' % ''.join(
        '<div><dt>%s</dt><dd>%s</dd></div>' % (typo(r), '<br>'.join(typo(x) for x in names) if names else '<span class="ph">[To come]</span>')
        for r, names in rows))
    out.append('<nav class="g nx" aria-label="Next project"><a class="next" href="/projects/%s"><span class="lab">Next project</span>'
               '<span class="nt">%s</span><span class="ni">%s</span></a></nav>' % (nxt['slug'], typo(nxt['title']), nxt['_thumb']))
    out.append('</div>')
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
            '<button type="button" class="archive-toggle" aria-expanded="false" aria-controls="works" data-open-label="%s" data-close-label="%s">%s</button>'
            '<a class="work-back" href="#" data-top>%s</a></div>'
            '<ul class="works" id="works">%s</ul></section>') % (
        esc(w['label']), esc(w['selected']), esc(w['all']), esc(w['selected']), esc(w['more']), esc(w['less']), esc(w['more']), esc(w['back']), ''.join(rows))

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

    site = load(os.path.join(CONTENT, 'site.json'))
    # Cache-busting: a fingerprint of the stylesheet and script, so every change loads fresh
    h = hashlib.sha1()
    for f in ('static/css/site.css', 'static/js/site.js'):
        with open(os.path.join(ROOT, f), 'rb') as fh: h.update(fh.read())
    site['_v'] = h.hexdigest()[:10]
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

    # One list decides the order of the projects everywhere: content/index.json, project_order
    order = index.get('project_order') or sys.exit('content/index.json needs project_order: every project slug, in order.')
    errs = ['%s: in project_order but there is no content/projects/%s.json' % (x, x) for x in order if x not in projects]
    errs += ['%s: has a project file but is missing from project_order' % x for x in projects if x not in order]
    errs += ['%s: listed twice in project_order' % x for x in set(order) if order.count(x) > 1]
    if errs: sys.exit('Fix project_order in content/index.json first:\n  ' + '\n  '.join(sorted(errs)))
    ordered = [projects[x] for x in order]

    # site OG image: the first project's card
    first = ordered[0]
    os.makedirs(os.path.join(DIST, 'media', 'site'), exist_ok=True)
    so = media.og(first['og'] or first['card']['src'], 'site')

    # project pages, first pass: every item, in its media order (the opener first on HollyShorts pages, hidden items left out)
    stats = {}
    for p in ordered:
        s = p['slug']; notes = p['_notes'] = load_notes(p); items = []
        seq = [notes['opener']] + [n for n in range(1, len(p['media']) + 1) if n != notes['opener']]
        for n in seq:
            if n in notes['_hide']: continue
            m = p['media'][n - 1]; name = '%02d' % n; eager = not items
            if m['slot'] == 'V':
                vn = notes['video'].get(str(n), {}); rest, sound = str(vn.get('rest', 'end')), bool(vn.get('sound'))
                animated_poster = s in HOLLYSHORTS and n == notes['opener']
                v = media.video(m['src'], s, name, rest, sound, first=animated_poster)
                if not v: continue
                vid = 'v-%s-%d' % (s, n)
                items.append(dict(n=n, slot='V', kind='video', w=v['w'], h=v['h'], id=vid, sound=sound, v=v, rest=rest,
                                  html=lambda sz, v=v, vid=vid, alt=m['alt'], rest=rest, sound=sound, e=eager: video_tag(v, vid, alt, rest, sound, e)))
                p.setdefault('_bigs', []).append(v['mp4'])
            else:
                r = media.image(m['src'], s, name)
                if not r: continue
                items.append(dict(n=n, slot=m['slot'], kind='img', w=r[2], h=r[3], r=r,
                                  html=lambda sz, r=r, alt=m['alt'], e=eager: img_tag(r, sz, alt, e)))
                p.setdefault('_bigs', []).append(r[0])
        blocks = make_blocks(items, notes['notes'], s in HOLLYSHORTS and notes['opener'] != 1)
        chapters = notes['chapters'] if len(items) >= 8 else []
        starts = {b['items'][0]['n'] for b in blocks}
        bad = [c['label'] for c in chapters if c['starts_at'] not in starts]
        if bad: sys.exit('Fix content/notes/%s.json first:\n  chapter %s must start on the first item of a block' % (s, ', '.join(bad)))
        p['_blocks'], p['_chapters'] = blocks, chapters
        o = items[0]
        p['_thumb'] = ('<img src="%s" alt="%s" loading="lazy" decoding="async" width="%d" height="%d">' % (o['v']['poster'], esc(p['media'][o['n'] - 1]['alt']), o['w'], o['h'])
                       if o['kind'] == 'video' else img_tag(o['r'], '(max-width:640px) 100vw, 60vw', p['media'][o['n'] - 1]['alt']))
        kinds = [b['kind'] for b in blocks]
        runs = [kinds[k] for k in range(2, len(kinds)) if kinds[k] == kinds[k - 1] == kinds[k - 2]]
        stats[s] = dict(order=[x['n'] for x in items], blocks=kinds, full=kinds.count('full'), runs=sorted(set(runs)),
                        lede_words=len((p['_notes'].get('lede') or p['lede']).split()), photo=credit_rows(p)[1],
                        videos=[dict(n=x['n'], block=next(b['kind'] for b in blocks if x in b['items']), rest=x['rest'], sound=x['sound'], bytes=x['v']['bytes'])
                                for x in items if x['kind'] == 'video'])

    # second pass: write each page, with the next project after it in project_order (the last wraps to the first)
    for i, p in enumerate(ordered):
        s = p['slug']
        card = media.image(p['card']['src'], s, 'card', max_w=800) if p['card']['src'] else None
        p['preview'] = card[0] if card else None
        og = media.og(p['og'] or p['card']['src'], s)
        bigs = [b for b in p.get('_bigs', [])]
        if a.zip and bigs:
            zp = os.path.join(DIST, 'media', s, '%s-images.zip' % s)
            with zipfile.ZipFile(zp, 'w', zipfile.ZIP_STORED) as z:
                for n, rel in enumerate(bigs, 1):
                    full = os.path.join(DIST, rel.lstrip('/'))
                    z.write(full, '%s-%02d%s' % (s, n, os.path.splitext(full)[1]))
        nxt = ordered[(i + 1) % len(ordered)]
        stats[s]['next'] = nxt['slug']
        body = project_body(p, p['_blocks'], p['_chapters'], nxt, p['_notes'], site['project_back'])
        write('/projects/%s.html' % s, page(site, p['seo']['title'], p['seo']['description'], '/projects/%s' % s, body, og, '/projects'))
    os.makedirs(os.path.join(ROOT, '_review'), exist_ok=True)
    with open(os.path.join(ROOT, '_review', 'build-stats.json'), 'w', encoding='utf-8') as fh:
        json.dump(stats, fh, indent=1)

    # projects list: pages and rows, newest first
    items, vocab = load_work(projects)  # vocab: the tag list, checked inside load_work
    # The rows with a page take the order of project_order, in the places pages hold in work.json
    pages = iter(order); slots = {e['slug']: e for e in items}
    items = [slots[next(pages)] if e['page'] else e for e in items]
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
               '<h2 class="vh" id="foundry-title">%s</h2><div class="foundry-body">%s</div>%s</div></section>') % (esc(fd['title']), fd_body, back)
    ap = site['about']
    press = load(os.path.join(CONTENT, 'press.json'))['press']
    about_panel = ('<section class="panel side about-panel" id="about" aria-labelledby="about-title">'
                   '<div class="about-grid"><div class="title-row">'
                   '<h2 class="vh" id="about-title">%s</h2><p class="home-big"><a href="#" data-studio>%s</a></p></div>'
                   '<div class="about-main"><div class="about-body">%s</div></div>'
                   '<div class="about-press"><h3 class="press-title">%s</h3>%s</div></div></section>') % (
        ' '.join('<span>%s</span>' % esc(x) for x in ap['title'].split()), esc(site['back']), ''.join('<p>%s</p>' % link(typo(x)) for x in ap['lines']) + ''.join('<p class="contact">%s</p>' % link(typo(x)) for x in ap['contact']), esc(ap['press_title']), press_list(press))
    # The blog sits one screen above home. Posts can go in content/blog.html later; until then, the lines from site.json.
    bl = site['blog']; bl_file = os.path.join(CONTENT, 'blog.html')
    bl_body = open(bl_file, encoding='utf-8').read() if os.path.exists(bl_file) else ''.join('<p>%s</p>' % typo(x) for x in bl['lines'])
    blog = ('<section class="blog-panel" id="blog" aria-labelledby="blog-title"><div class="blog-inner"><div class="title-row">'
            '<h2 class="vh" id="blog-title">%s</h2><p class="home-big"><a href="#" data-studio>%s</a></p></div>'
            '<div class="blog-body">%s</div></div></section>') % (esc(bl['title']), esc(site['back']), bl_body)
    cover = ('<section class="cover"><div class="cover-inner"><h1><span class="mark" %s>%s</span><span class="name ink">%s<span class="name-text">Opmet Osserpse</span></span></h1>'
             '<nav class="cover-nav" aria-label="Site">%s</nav></div></section>') % (
        moves.mark_attrs(mv), hand + mv['layers'], brand_svg('wordmark.svg', 'wordmark'), nav)
    body = ('<div class="stage-clip"><div class="stage" data-stage>%s<div class="panel home-panel">%s<div data-home>%s%s</div></div>%s</div></div>'
            '<section class="project-panel" id="project" aria-label="Project"><div class="project-inner"></div></section>') % (
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
