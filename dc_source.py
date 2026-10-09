"""Read a project's page on daltoncorr.com (the read-only clone in _sources/) for its media, in order.

The project pages here mirror the daltoncorr.com pages: every image, film, 3D model and interactive piece, in the order
they appear there. This module reads them; build.py draws them. Nothing in the clone is ever written.

    items(site_root, slug)  -> list of dicts, in page order:
        kind 'img'    src (relative to site/), alt, w, h, gallery (index of its gallery), wide (True in a wide gallery)
        kind 'video'  src, alt, w, h, gallery, wide
        kind 'widget' name, label, html (the piece's own markup, paths rewritten to /dc/), assets, scripts
    port_scripts / port_css / copy_assets  bring the 3D and interactive pieces' code and files across.
"""
import os, re, shutil
from html.parser import HTMLParser
from urllib.parse import unquote

# Project slugs whose daltoncorr.com page has another name
PAGES = {'hollyshorts-dubai-2025': 'hollyshorts-dubai', 'hollyshorts-london-2024': 'hollyshorts-london',
         'weissman-character-edition': 'weissman'}

# The 3D and interactive pieces: the class (or id) that marks one, a plain name, and the scripts it needs, in order.
WIDGETS = {
    'logo-switch':           ('logo switch', ['logo-switch.js']),
    'badge3d':               ('3D badges', ['three-common.js', 'badge-3d.js']),
    'wine-stage':            ('3D wine bottle', ['three-common.js', 'wine-bottle.js']),
    'phones-stage':          ('3D phone', ['three-common.js', 'phones-3d.js']),
    'weissman-hero-catalog': ('3D catalog', ['vendor/three.min.js', 'catalog-viewer.js']),
    'badge-float':           ('floating badges', ['badge-float.js']),
    'badge-carousel':        ('badge carousel', ['carousel.js']),
    'sb-viewer':             ('page viewer', ['sunnys-bookshop.js']),
}
VOID = {'img', 'source', 'br', 'hr', 'input', 'meta', 'link', 'wbr', 'path', 'col', 'area', 'base', 'embed', 'track'}
PATH = re.compile(r'\.\./((?:images|media)/[^"\'\s,)]+)')

def rel(u):
    return unquote(re.sub(r'^\.\./', '', u or ''))

class _Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.text, self.items, self.on, self.depth, self.w = text, [], False, 0, None
        self.gallery, self.gidx, self.gstack = None, 0, []
        self.lines = [0]
        for line in text.splitlines(keepends=True): self.lines.append(self.lines[-1] + len(line))
    def off(self):
        ln, col = self.getpos(); return self.lines[ln - 1] + col
    def handle_startendtag(self, tag, a):
        self.handle_starttag(tag, a, void=True)
    def handle_starttag(self, tag, a, void=False):
        a = dict(a); cls = (a.get('class') or '').split()
        if not self.on:
            if 'wc-body' in cls: self.on, self.depth = True, 1
            return
        void = void or tag in VOID
        if not void: self.depth += 1
        if self.w is not None: return
        key = next((c for c in cls if c in WIDGETS), None) or ('badge-carousel' if a.get('id') == 'badge-carousel' else None)
        if key:
            self.w = dict(kind='widget', name=key, label=WIDGETS[key][0], scripts=WIDGETS[key][1], start=self.off(),
                          depth=self.depth, tag=tag, gallery=self.gallery, wide=False)
            if void: self.end = self.off() + len(self.get_starttag_text()); self._close_widget()
            return
        if not void and any(c.startswith('project-gallery') for c in cls):
            self.gidx += 1; self.gallery = (self.gidx, 'project-gallery-wide' in cls); self.gstack.append(self.depth)
        g = self.gallery or (0, False)
        if tag == 'img':
            self.items.append(dict(kind='img', src=rel(a.get('src')), alt=a.get('alt') or '', w=int(a.get('width') or 0),
                                   h=int(a.get('height') or 0), gallery=g[0], wide=g[1]))
        elif tag == 'video':
            self.items.append(dict(kind='video', src=rel(a.get('src')), alt=a.get('aria-label') or '', w=int(a.get('width') or 0),
                                   h=int(a.get('height') or 0), gallery=g[0], wide=g[1]))
        elif tag == 'source' and self.items and self.items[-1]['kind'] == 'video' and not self.items[-1]['src']:
            self.items[-1]['src'] = rel(a.get('src') or a.get('data-src'))
    def _close_widget(self):
        w = self.w; self.w = None
        raw = self.text[w.pop('start'):self.end]
        w['assets'] = sorted(set(unquote(x) for x in PATH.findall(raw)))
        w['html'] = PATH.sub(lambda m: '/dc/' + m.group(1), raw)
        self.items.append(w)
    def handle_endtag(self, tag):
        if not self.on or tag in VOID: return
        if self.w is not None and self.depth == self.w['depth']:
            self.end = self.off() + len('</%s>' % tag); self.depth -= 1; self._close_widget(); return
        if self.gstack and self.depth == self.gstack[-1]:
            self.gstack.pop(); self.gallery = None
        self.depth -= 1
        if self.depth == 0: self.on = False

def page_path(site_root, slug):
    return os.path.join(site_root, 'work', PAGES.get(slug, slug) + '.html')

def items(site_root, slug):
    p = _Page(open(page_path(site_root, slug), encoding='utf-8').read()); p.feed(p.text); p.close()
    return p.items

def stem(path):
    """A file's name without folder, size suffix or extension: how one picture is matched across the two sites."""
    b = re.sub(r'\.(webp|jpe?g|png|gif|mp4|webm|mov)$', '', os.path.basename(path), flags=re.I)
    return re.sub(r'-(600|720|800|1200|1600|2400|sm|lg|xl)$', '', b)

def _scripts_text(site_root, name):
    with open(os.path.join(site_root, 'js', name), encoding='utf-8') as f: return f.read()

def port_scripts(site_root, names, out_dir):
    """Copy the pieces' scripts into the site: three.js from our own copy instead of a CDN, image paths under /dc/,
    and the studio named in place of the person in their header comments. Returns the files each script reads."""
    os.makedirs(out_dir, exist_ok=True); assets = set()
    for n in names:
        if n.startswith('vendor/'): continue  # served from static/js/vendor
        s = _scripts_text(site_root, n)
        assets |= set(unquote(x) for x in PATH.findall(s))
        s = s.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', '/js/vendor/three.min.js')
        s = PATH.sub(lambda m: '/dc/' + m.group(1), s)
        s = s.replace('Dalton Corr — ', '').replace('Dalton Corr, ', '').replace('Dalton Corr', 'Opmet Osserpse')
        with open(os.path.join(out_dir, n), 'w', encoding='utf-8') as f: f.write(s)
    return assets

def copy_assets(site_root, paths, out_root, html=''):
    """Copy the files (and, for a folder a piece names as its base, the whole folder) into out_root/dc/, as they are.
    Files a script reaches from its base with ../ (the phone's logo) come along with that folder's parent."""
    n = 0
    for p in paths:
        src = os.path.join(site_root, p); dst = os.path.join(out_root, 'dc', p)
        if os.path.isdir(src):
            for dp, _, fs in os.walk(src):
                for f in fs:
                    if f.startswith('.'): continue
                    s = os.path.join(dp, f); d = os.path.join(out_root, 'dc', os.path.relpath(s, site_root))
                    if not os.path.exists(d) or os.path.getsize(d) != os.path.getsize(s):
                        os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(s, d); n += 1
        elif os.path.isfile(src):
            if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(src):
                os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(src, dst); n += 1
    return n

KEYS = ('badge3d', 'wine-', 'phones-', 'logo-switch', 'lsh-', 'ls-white', 'ls-black', 'badge-float', '.bf-', 'badge-carousel',
        'sb-viewer', 'catalog-3d', 'weissman-hero')

def _rules(s):
    s = re.sub(r'/\*[\s\S]*?\*/', '', s); out = []; i = 0
    while i < len(s):
        j = s.find('{', i)
        if j < 0: break
        pre = s[i:j].strip(); depth = 1; k = j + 1
        while depth:
            depth += {'{': 1, '}': -1}.get(s[k], 0); k += 1
        body = s[j + 1:k - 1]
        out.append((pre, _rules(body) if pre.startswith(('@media', '@supports')) else body)); i = k
    return out

def _keep(items):
    out = []
    for pre, body in items:
        if isinstance(body, list):
            inner = _keep(body)
            if inner: out.append('%s{%s}' % (pre, ''.join(inner)))
        elif pre.startswith('@keyframes'):
            if any(k in pre for k in ('bf-', 'car-', 'cue-', 'ls', 'badge', 'wine', 'phone')): out.append('%s{%s}' % (pre, body))
        elif any(k in pre for k in KEYS):
            out.append('%s{%s}' % (pre, body.strip()))
    return out

def port_css(site_root):
    """The pieces' own rules from daltoncorr.com's stylesheets, with its few shared colors mapped to this site's."""
    css = ''.join(open(os.path.join(site_root, 'css', f), encoding='utf-8').read()
                  for f in ('style.css', 'work-cards.css', 'sunnys-bookshop.css'))
    head = ('/* The 3D and interactive pieces, as on daltoncorr.com (their rules copied at build time from its stylesheets). */\n'
            '.pp{--bg:var(--paper);--text:var(--ink);--accent:var(--ink)}\n'
            '.pp .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\n')
    return head + '\n'.join(_keep(_rules(css))) + '\n'
