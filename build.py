#!/usr/bin/env python3
"""Build opmetosserpse.com into ./docs from ./content, ./static and the daltoncorr.com image library.

    python3 build.py --daltoncorr ../daltoncorr-porfolio      # path to a clone of daltoncorr-sudo/daltoncorr-porfolio
    python3 serve.py                                          # preview at http://127.0.0.1:8080/

Needs Python 3.9+, Pillow (pip install Pillow) and, for video only, ffmpeg (brew install ffmpeg). No framework.
"""
import argparse, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile, urllib.parse, zipfile
import moves, dc_source
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
    s = s.replace(' | ', '\u00a0| ')  # a bar in a title stays at the end of its line
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
        self.src_root, self.out_root, self.cache, self.log, self.made = src_root, out_root, {}, [], set()

    def assets(self, paths):
        """Files the 3D and interactive pieces read, copied as they are into docs/dc/."""
        dc_source.copy_assets(self.src_root, paths, os.path.dirname(self.out_root))

    def has_audio(self, rel):
        src = os.path.join(self.src_root, rel)
        if not rel.lower().endswith(('.mp4', '.mov', '.webm')) or not os.path.exists(src): return False
        r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', src],
                           capture_output=True, text=True)
        return bool(r.stdout.strip())

    def tidy(self, slugs):
        """Remove files in each project's media folder that this build didn't write (an earlier order's leftovers)."""
        gone = 0
        for s in slugs:
            d = os.path.join(self.out_root, s)
            for f in os.listdir(d) if os.path.isdir(d) else []:
                full = os.path.join(d, f)
                if full not in self.made and os.path.isfile(full): os.remove(full); gone += 1
        if gone: print('Removed %d media files no page uses any more.' % gone)

    def image(self, rel, slug, name, max_w=2400):
        """Resize one source image into WebP at up to three widths. Returns (src, srcset, w, h)."""
        key = (rel, max_w)
        if key in self.cache: return self.cache[key]
        src = os.path.join(self.src_root, rel)
        if not os.path.exists(src):
            self.log.append('missing: ' + rel); return None
        out_dir = os.path.join(self.out_root, slug); os.makedirs(out_dir, exist_ok=True)
        if rel.lower().endswith('.webp') and getattr(Image.open(src), 'is_animated', False):
            dst = os.path.join(out_dir, name + '.webp'); shutil.copyfile(src, dst); self.made.add(dst)
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
            parts.append(('/media/%s/%s' % (slug, fn), w)); self.made.add(dst)
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
        self.made |= {mp4, webm, os.path.join(out_dir, name + '-poster.webp')}
        if rel.lower().endswith(('.webp', '.gif')):  # an animated picture: its frames become a film, so it can play once and rest
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
        im.save(os.path.join(out_dir, 'og.jpg'), 'JPEG', quality=85); self.made.add(os.path.join(out_dir, 'og.jpg'))
        return '/media/%s/og.jpg' % slug

# How wide each block draws, for srcset
# How wide each block draws, for srcset
SIZES = {'single': '(max-width:640px) 100vw, 62vw', 'row': '(max-width:640px) 50vw, 31vw', 'full': '100vw',
         'tall': '(max-width:640px) 100vw, 46vw'}

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

def load_notes(p, keys):
    """content/notes/<slug>.json: the Work line, chapter labels, margin notes, how each film rests and plays, and (Sunny's
    only) the items it hides. Items are named by key: a picture's file name without size or extension ("poster"), or
    "w:" and the piece's name for a 3D or interactive piece ("w:badge3d"). Fails on anything that doesn't fit."""
    fn = os.path.join(CONTENT, 'notes', p['slug'] + '.json')
    n = load(fn) if os.path.exists(fn) else {}
    n.setdefault('chapters', []); n.setdefault('notes', {}); n.setdefault('video', {}); n.setdefault('hide', [])
    s, errs = p['slug'], []
    by_alt = {m['alt']: dc_source.stem(m['src']) for m in p['media']}
    n['_hide'] = set()
    for alt in n['hide']:
        if alt not in by_alt or by_alt[alt] not in keys: errs.append('hide: no item with the alt text "%s"' % alt)
        else: n['_hide'].add(by_alt[alt])
    if n['_hide'] and s != 'sunnys-bookshop': errs.append('hide is only for sunnys-bookshop')
    for k in list(n['notes']) + list(n['video']) + [c['starts_at'] for c in n['chapters']]:
        if k not in keys: errs.append('"%s" is not an item on this page' % k)
    for k, x in n['notes'].items():
        if len(x['text'].split()) > 25: errs.append('note %s runs over 25 words' % k)
    if len(n['chapters']) > 4: errs.append('more than four chapter labels')
    for c in n['chapters']:
        if not 2 <= len(c['label'].split()) <= 5: errs.append('chapter "%s" should be 2 to 5 words' % c['label'])
    if errs: sys.exit('Fix content/notes/%s.json first:\n  %s' % (s, '\n  '.join(errs)))
    return n

def cap(x):
    return x[:1].upper() + x[1:]

def credit_rows(p, notes):
    """Credits, short: our credit as its first role ("Art direction: Dalton Corr, Opmet Osserpse"), each partner as role
    and name, typefaces, then photography. A "credits" list in the notes file replaces the derived rows. Photographers
    come from the notes file ("photography"); until they're known, the row says [To come]. Returns (rows, has photo)."""
    rows, photo = [], False
    if notes.get('credits'):
        rows = [(r, [n]) for r, n in notes['credits']]
    else:
        for label, names in p['credits']:
            photo = photo or 'photo' in label.lower() or any('photo' in x.lower() for x in names)
            if label == 'Client': continue
            if label == 'Fonts': rows.append(('Typefaces', names)); continue
            plain = []
            for x in names:
                if x.startswith('Dalton Corr: '):
                    rows.append((cap(re.split(r', | and ', x[len('Dalton Corr: '):])[0]), ['Dalton Corr, Opmet Osserpse']))
                elif ': ' in x: who, role = x.split(': ', 1); rows.append((cap(role), [who]))
                else: plain.append(x)
            if plain: rows.append((label, plain))
    if notes.get('photography'): rows.append(('Photography', [', '.join(notes['photography'])])); photo = True
    elif not photo: rows.append(('Photography', None))
    return rows, photo

BILLBOARD = re.compile(r'billboard', re.I)

def make_blocks(items, notes):
    """Group the items, in order, into blocks. Pictures from the same gallery on daltoncorr.com sit two to a row, at one
    height, so a gallery reads as a group; outside a gallery, two P pictures in a row pair up, as before. A billboard,
    a full bleed (H, F), a film and a 3D or interactive piece each stand alone."""
    out, i = [], 0
    def alone(x):
        return x['kind'] != 'img' or x['slot'] in ('H', 'F') or BILLBOARD.search(x.get('alt', ''))
    def pairable(x, y):
        if not y or alone(x) or alone(y) or x['gallery'] != y['gallery']: return False
        return bool(x['gallery']) or x['slot'] == y['slot'] == 'P'
    while i < len(items):
        it = items[i]; nxt = items[i + 1] if i + 1 < len(items) else None
        grp = [it, nxt] if pairable(it, nxt) else [it]
        i += len(grp)
        note = next((notes[x['key']]['text'] for x in grp if x['key'] in notes), None)
        if len(grp) == 2: kind = 'row'
        elif it['kind'] == 'img' and it['slot'] in ('H', 'F'): kind = 'full'
        elif it['kind'] == 'video' and it['w'] / it['h'] < 0.83: kind = 'tall'
        else: kind = 'single'
        prev = out[-1] if out else None  # a row that continues its gallery sits closer to the one before it
        cont = kind == 'row' and prev and prev['kind'] == 'row' and it['gallery'] and prev['items'][0]['gallery'] == it['gallery']
        out.append(dict(kind=kind, items=grp, note=note, cont=bool(cont)))
    return out

def block_html(b, slug):
    """A block, with its note (if it has one) in the right margin, beside its top."""
    kind = b['kind']
    ms = []
    for it in b['items']:
        cls = 'm' + (' piece' if it['kind'] == 'widget' else '')
        grow = ' style="flex-grow:%.4f"' % (it['w'] / it['h']) if kind == 'row' else ''
        ms.append('<div class="%s" data-i="%s"%s>%s</div>' % (cls, esc(it['key']), grow, it['html'](SIZES[kind])))
    media = '<div class="row">%s</div>' % ''.join(ms) if kind == 'row' else ''.join(ms)
    cap_ = typo(b['note']) if b['note'] else ''
    for it in b['items']:
        if it['kind'] == 'video':
            if it['sound']: cap_ += ' <a href="#" class="again" data-sound="%s">Play with sound</a>' % it['id']
            cap_ += ' <a href="#" class="again" data-again="%s" hidden>Play again</a>' % it['id']
    cap_ = cap_.strip()
    if kind == 'full':  # a full bleed has no grid of its own: its note sits in one, under it, in the right margin
        fc = '<figcaption class="g fcap"><span class="note">%s</span></figcaption>' % cap_ if cap_ else ''
        return '<figure class="b b-full"%s>%s%s</figure>' % (' data-read' if cap_ else '', media, fc)
    fc = '<figcaption class="note">%s</figcaption>' % cap_ if cap_ else ''
    return '<figure class="b g b-%s%s"%s>%s%s</figure>' % (kind, ' b-cont' if b.get('cont') else '', ' data-read' if cap_ else '', media, fc)

def project_body(p, blocks, chapters, notes, back='Back', home='Home', all_work='All work', top='Back to top'):
    """Back and Home under the name; the title; under it the paragraph, and one list of facts and credits. Then the
    work, centered, with chapter labels in the left margin and notes in the right one. At the end: Back to top and
    All work. No next project."""
    facts = [('Client', typo(p['client'])), ('Year', esc(p['year']))]
    if notes.get('work'): facts.append(('Work', typo(notes['work'])))
    facts.append(('Role', typo(p['role'])))
    if p['links']:
        t, u = p['links'][0]; facts.append(('Link', '<a href="%s" rel="noopener">%s</a>' % (esc(u), typo(t))))
    rows, _ = credit_rows(p, notes)
    credits = [(typo(r), ', '.join(typo(x) for x in names) if names else '<span class="ph">[To come]</span>') for r, names in rows]
    dl = lambda xs, cls: '<dl class="%s">%s</dl>' % (cls, ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % x for x in xs))
    # data-page-only: a page with a 3D or interactive piece opens as its own page from home, so its scripts run
    out = ['<div class="pp"%s>' % (' data-page-only' if p.get('_scripts') else ''),
           '<nav class="pnav" aria-label="Back"><a href="/#work" data-back>%s</a><a href="/">%s</a></nav>' % (esc(back), esc(home)),
           '<section class="open g"><h1>%s</h1><p class="lede">%s</p><div class="info">%s%s</div></section>' % (
               typo(p['title']), typo(notes.get('lede') or p['lede']), dl(facts, 'facts'), dl(credits, 'cr'))]
    starts = {c['starts_at']: c for c in chapters}
    open_ch, n = False, 0
    for b in blocks:
        c = starts.get(b['items'][0]['key'])
        if c:
            if open_ch: out.append('</section>')
            n += 1; open_ch = True
            # the label sits in the left margin beside its first block; above it, on its own line, when that block is a full bleed
            out.append('<section class="ch%s" aria-label="%s"><div class="chl g"><h2 class="chap"><span class="n">%d</span>%s</h2></div>'
                       % (' ch-full' if b['kind'] == 'full' else '', esc(c['label']), n, typo(c['label'])))
        out.append(block_html(b, p['slug']))
    if open_ch: out.append('</section>')
    out.append('<nav class="g pfoot" aria-label="More"><a href="#main" data-totop>%s</a><a href="/#archive">%s</a></nav>' % (esc(top), esc(all_work)))
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

    # project pages, first pass: every item on the project's daltoncorr.com page, in its order (Sunny's repeats left out)
    stats, used_scripts = {}, set()
    for p in ordered:
        s = p['slug']; items = []
        dc = dc_source.items(src_root, s)
        js = {dc_source.stem(m['src']): m for m in p['media']}
        seen = {}
        for x in dc:  # keys: a picture's file name, or w:<piece>; numbered when one repeats
            k = 'w:' + x['name'] if x['kind'] == 'widget' else dc_source.stem(x['src'])
            seen[k] = seen.get(k, 0) + 1; x['key'] = k if seen[k] == 1 else '%s-%d' % (k, seen[k])
        notes = p['_notes'] = load_notes(p, [x['key'] for x in dc])
        p['_record'] = [x['key'] for x in dc]
        for x in dc:
            k = x['key']
            if k in notes['_hide']: continue
            jm = js.get(k); eager = not items
            alt = jm['alt'] if jm else x.get('alt', '')
            name = re.sub(r'[^a-z0-9]+', '-', k.lower()).strip('-')
            if x['kind'] == 'widget':
                items.append(dict(key=k, kind='widget', name=x['name'], slot='X', gallery=0, html=lambda sz, h=x['html']: h, scripts=x['scripts']))
                media.assets(x['assets'])
                continue
            src = x['src'] if os.path.exists(os.path.join(src_root, x['src'])) or not jm else jm['src']
            animated = x['kind'] == 'img' and src.lower().endswith(('.webp', '.gif')) and getattr(Image.open(os.path.join(src_root, src)), 'is_animated', False)
            if x['kind'] == 'video' or animated:  # films, and animated pictures made into films, so nothing loops
                vn = notes['video'].get(k, {})
                has_sound = media.has_audio(src)
                rest, sound = str(vn.get('rest', 'end')), bool(vn.get('sound', has_sound))
                v = media.video(src, s, name, rest, sound, first=vn.get('poster_frame') == 'first')
                if not v: continue
                vid = 'v-%s-%s' % (s, name)
                items.append(dict(key=k, slot='V', kind='video', w=v['w'], h=v['h'], id=vid, sound=sound, v=v, rest=rest, gallery=x['gallery'], alt=alt,
                                  html=lambda sz, v=v, vid=vid, alt=alt, rest=rest, sound=sound, e=eager: video_tag(v, vid, alt, rest, sound, e)))
                p.setdefault('_bigs', []).append(v['mp4'])
                continue
            r = media.image(src, s, name)
            if not r: continue
            # the size: the approved slot when the picture was already on this site; otherwise from daltoncorr.com's layout
            if jm: slot = jm['slot']
            elif x['wide']: slot = 'W'
            else: slot = 'P' if r[3] > r[2] else 'L'
            items.append(dict(key=k, slot=slot, kind='img', w=r[2], h=r[3], r=r, gallery=x['gallery'], alt=alt,
                              html=lambda sz, r=r, alt=alt, e=eager: img_tag(r, sz, alt, e)))
            p.setdefault('_bigs', []).append(r[0])
        blocks = make_blocks(items, notes['notes'])
        chapters = notes['chapters'] if len(items) >= 8 else []
        # a chapter starts at the block that holds its first picture (a picture may sit second in a row)
        first_of = {x['key']: b['items'][0]['key'] for b in blocks for x in b['items']}
        chapters = [dict(c, starts_at=first_of.get(c['starts_at'], c['starts_at'])) for c in chapters]
        p['_blocks'], p['_chapters'], p['_items'] = blocks, chapters, items
        p['_scripts'] = [n for x in items if x['kind'] == 'widget' for n in x['scripts']]
        used_scripts |= set(p['_scripts'])
        kinds = [b['kind'] for b in blocks]
        runs = [kinds[k] for k in range(2, len(kinds)) if kinds[k] == kinds[k - 1] == kinds[k - 2]]
        stats[s] = dict(order=[x['key'] for x in items], blocks=kinds, full=kinds.count('full'), runs=sorted(set(runs)),
                        pieces=[x['key'] for x in items if x['kind'] == 'widget'],
                        lede_words=len((notes.get('lede') or p['lede']).split()), photo=credit_rows(p, notes)[1],
                        videos=[dict(key=x['key'], block=next(b['kind'] for b in blocks if x in b['items']), rest=x['rest'], sound=x['sound'], bytes=x['v']['bytes'])
                                for x in items if x['kind'] == 'video'])

    # the 3D and interactive pieces: their scripts and styles, as on daltoncorr.com, and the files their scripts read
    if used_scripts:
        media.assets(dc_source.port_scripts(src_root, sorted(used_scripts), os.path.join(DIST, 'js', 'work')))
        write('/css/work.css', dc_source.port_css(src_root))
    # the phone reaches its logo from its folder with ../ : bring along what any script names that way
    for p in ordered:
        for x in p['_items']:
            if x['kind'] == 'widget':
                for base in re.findall(r'data-base="/dc/([^"]+)"', x['html']({})):
                    for n in set(x['scripts']):
                        if n.startswith('vendor/'): continue
                        for up in re.findall(r"'\.\./([^'/]+\.(?:webp|png|jpe?g))'", open(os.path.join(src_root, 'js', n), encoding='utf-8').read()):
                            media.assets([os.path.normpath(os.path.join(urllib.parse.unquote(base), '..', up))])

    # second pass: write each page
    for i, p in enumerate(ordered):
        s = p['slug']
        card = media.image(p['card']['src'], s, 'card', max_w=800) if p['card']['src'] else None
        p['preview'] = card[0] if card else None
        og = media.og(p['og'] or p['card']['src'], s)
        bigs = [b for b in p.get('_bigs', [])]
        if a.zip and bigs:
            zp = os.path.join(DIST, 'media', s, '%s-images.zip' % s); media.made.add(zp)
            with zipfile.ZipFile(zp, 'w', zipfile.ZIP_STORED) as z:
                for n, rel in enumerate(bigs, 1):
                    full = os.path.join(DIST, rel.lstrip('/'))
                    z.write(full, '%s-%02d%s' % (s, n, os.path.splitext(full)[1]))
        body = project_body(p, p['_blocks'], p['_chapters'], p['_notes'], site['project_back'], site['back'], site['project_all'], site['project_top'])
        head = ''
        if p['_scripts']:  # a page with a 3D or interactive piece: its styles and scripts, in order
            head = '<link rel="stylesheet" href="/css/work.css?v=%s">\n' % site['_v'] + ''.join(
                '<script src="/js/%s?v=%s" defer></script>\n' % (n if n.startswith('vendor/') else 'work/' + n, site['_v'])
                for n in dict.fromkeys(p['_scripts']))
        write('/projects/%s.html' % s, page(site, p['seo']['title'], p['seo']['description'], '/projects/%s' % s, body, og, '/projects', extra_head=head))
    os.makedirs(os.path.join(ROOT, '_review'), exist_ok=True)
    with open(os.path.join(ROOT, '_review', 'build-stats.json'), 'w', encoding='utf-8') as fh:
        json.dump(stats, fh, indent=1)
    with open(os.path.join(ROOT, '_review', 'media-order-daltoncorr.json'), 'w', encoding='utf-8') as fh:
        json.dump({p['slug']: p['_record'] for p in ordered}, fh, indent=1, ensure_ascii=False)
    media.tidy([p['slug'] for p in ordered])

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
