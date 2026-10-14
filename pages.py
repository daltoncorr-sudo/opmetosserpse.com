#!/usr/bin/env python3
"""Bring one of D's finished pages into the site: a page D designed whole (Opmet Serif's case study), as a standalone
HTML file, becomes the three parts the build puts inside the studio's project frame.

    python3 pages.py <slug> <D's page.html>

Writes content/pages/<slug>/page.html (the content: no nameplate, no end links; the build adds the site's),
page.css (its styles, every rule held inside .os so nothing reaches the rest of the site) and page.js (its script, as
window.opmetPages[<slug>](root), which site.js runs when the page loads by itself or slides in from home). Every class
and id gets an os- prefix, so none meets the site's own (.panel, .work, .piece, .ctl, .facts...). Embedded pictures
become files beside them, linked as /media/<slug>/<name>. Its @font-face rules go: site.css serves Opmet Serif and
Instrument Sans. The facts file, content/pages/<slug>.json, is written by hand.
"""
import base64, hashlib, os, re, sys

P = 'os-'

def fail(why): sys.exit('pages.py: ' + why)

def pre(names):  # 'a b c' -> 'os-a os-b os-c'
    return ' '.join(P + x for x in names.split())

def css_selector(sel):
    sel = sel.strip()
    if sel in ('html',): return None
    if sel in ('body', '.page', ':root'): return '.os'
    if sel == '*,*::before,*::after': return '.os,.os *,.os *::before,.os *::after'
    out = []
    for s in sel.split(','):
        s = s.strip()
        s = re.sub(r'\.([A-Za-z][\w-]*)', lambda m: '.' + P + m.group(1), s)  # every class, compound ones too (.call.up)
        s = re.sub(r'(?<![\w-])#([A-Za-z][\w-]*)', lambda m: '#' + P + m.group(1), s)
        out.append('.os ' + s)
    return ','.join(out)

def convert_css(css):
    out, depth = [], 0
    for m in re.finditer(r'\s+|/\*[\s\S]*?\*/|@font-face\s*\{[^{}]*\}|@media[^{]+\{|\}|[^{}]+\{[^{}]*\}', css):
        tok = m.group(0)
        if tok.isspace(): out.append(tok); continue
        if tok.startswith('/*') or tok.startswith('@media'): out.append(tok); continue
        if tok.startswith('@font-face'): continue  # site.css serves the faces
        if tok == '}': out.append(tok); continue
        sel, body = tok.split('{', 1)
        lead = sel[:len(sel) - len(sel.lstrip())]
        if sel.strip() == '*':  # inside @media (reduced motion): only the page's own
            new = '.os *'
        else:
            new = css_selector(sel)
        if new is None: continue
        out.append(lead + new + '{' + body)
    css = ''.join(out)
    return re.sub(r'\n{3,}', '\n\n', css).strip() + '\n'

def convert_html(body, slug, outdir):
    # D's own nameplate and end links give way to the site's
    body = re.sub(r'<header class="mast">[\s\S]*?</header>\n*', '', body, count=1)
    body = re.sub(r'<nav class="end"[\s\S]*?</nav>\n*', '', body, count=1)
    body = re.sub(r'^\s*<div class="page"[^>]*>\n*', '', body, count=1)
    body = re.sub(r'\n*</div>\s*$', '\n', body, count=1)
    body = re.sub(r'\sclass="([^"]*)"', lambda m: ' class="%s"' % pre(m.group(1)), body)
    for attr in ('id', 'for', 'aria-labelledby', 'aria-controls', 'aria-describedby'):
        body = re.sub(r'\s%s="([^"]+)"' % attr, lambda m: ' %s="%s"' % (attr, ' '.join(P + x for x in m.group(1).split())), body)
    body = re.sub(r'\shref="#([^"]+)"', lambda m: ' href="#%s%s"' % (P, m.group(1)), body)
    # embedded pictures become files
    def pic(m):
        kind, data = m.group(1), base64.b64decode(m.group(2))
        name = 'p-%s.%s' % (hashlib.sha1(data).hexdigest()[:8], {'jpeg': 'jpg'}.get(kind, kind))
        open(os.path.join(outdir, name), 'wb').write(data)
        return 'src="/media/%s/%s"' % (slug, name)
    body = re.sub(r'src="data:image/(webp|png|jpeg|gif);base64,([A-Za-z0-9+/=]+)"', pic, body)
    return body.strip() + '\n'

def convert_js(js, slug):
    # its ids and classes, as the page's: $ looks inside the page; el() and the swap class carry the prefix
    if 'const $ = id => document.getElementById(id);' not in js: fail('no $ helper where expected; scope the script by hand')
    js = js.replace('const $ = id => document.getElementById(id);\n', '')
    js = js.replace('document.querySelectorAll(".bbody")', 'root.querySelectorAll(".%sbbody")' % P)
    js = js.replace('b.querySelectorAll(".bl")', 'b.querySelectorAll(".%sbl")' % P)
    js = re.sub(r'classList\.(add|remove|toggle)\("([\w-]+)"', lambda m: 'classList.%s("%s%s"' % (m.group(1), P, m.group(2)), js)
    js = js.replace('for (const k in attrs) e.setAttribute(k, attrs[k]);',
                    'for (const k in attrs) e.setAttribute(k, k === "class" ? attrs[k].split(" ").map(c => "%s" + c).join(" ") : attrs[k]);' % P)
    # the top: data and helpers, once; the rest, the pieces, run for each page they're given
    i = js.index('function seg(')
    head, rest = js[:i], js[i:]
    if 'document.getElementById' in rest or re.search(r'document\.querySelector', rest): fail('the script reaches outside its page; scope it by hand')
    return ('/* Built from D\'s page by pages.py: window.opmetPages["%s"](root) sets up the pieces inside root, the page\'s\n'
            '   .os element (site.js calls it on load and whenever the page slides in from home). */\n'
            '(() => {\n%s\nwindow.opmetPages = window.opmetPages || {};\n'
            'window.opmetPages["%s"] = root => {\n  if (root.dataset.ready) return;\n  root.dataset.ready = "1";\n'
            '  const $ = id => root.querySelector("#%s" + id);\n%s\n};\n})();\n') % (slug, head.strip(), slug, P, rest.strip())

def main():
    if len(sys.argv) != 3: fail('usage: python3 pages.py <slug> <D\'s page.html>')
    slug, src = sys.argv[1], sys.argv[2]
    t = open(src, encoding='utf-8').read()
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'content', 'pages', slug)
    os.makedirs(outdir, exist_ok=True)
    styles = ''.join(re.findall(r'<style>([\s\S]*?)</style>', t.split('</head>', 1)[0]))
    body = t.split('<body>', 1)[1].rsplit('</body>', 1)[0]
    scripts = re.findall(r'<script>([\s\S]*?)</script>', body)
    body = re.sub(r'<script>[\s\S]*?</script>\s*', '', body)
    if re.search(r'https?://(?!www\.w3\.org/)', body + styles): fail('the page reaches another host; the site serves everything itself')
    open(os.path.join(outdir, 'page.css'), 'w', encoding='utf-8').write(convert_css(styles))
    open(os.path.join(outdir, 'page.html'), 'w', encoding='utf-8').write(convert_html(body, slug, outdir))
    open(os.path.join(outdir, 'page.js'), 'w', encoding='utf-8').write(convert_js('\n'.join(scripts), slug))
    print('Wrote content/pages/%s/: page.html, page.css, page.js' % slug)

if __name__ == '__main__':
    main()
