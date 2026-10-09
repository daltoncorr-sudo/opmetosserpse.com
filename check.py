#!/usr/bin/env python3
"""Check the built site in docs/: broken links, house-style words, leftover notes. Exits 1 on any problem.

    python3 check.py
"""
import glob, os, re, sys

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docs')
ACRONYMS = {'ASCAP', 'BAFTA', 'NYU', 'IMGN', 'LLC', 'SVG', 'EPS', 'PNG', 'PDF', 'TCL', 'LOOK', 'BAM', 'SCL', 'HTML'}
CHECKS = [(r'\bAI\b', 'the word "AI"'), (r'\bvibes?\b', '"vibes"'), (r'Opmetosserpse', 'the name written as one word'), (r'Dalton Corr', "Dalton's name (the site doesn't name him)"),
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
    text = re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', t))
    if not drafts:
        bare = re.sub(r'<[^>]+>', ' ', re.sub(r'<div class="fd-img" data-placeholder[^>]*>[^<]*</div>', ' ', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', t)))
        problems += ['%s: a bracketed placeholder (%s)' % (rel, m.group(0)) for m in re.finditer(BRACKETS, bare) if m.group(0) not in ALLOWED]
    for pat, why in CHECKS:
        for m in re.finditer(pat, text):
            if why == 'a word in all caps' and m.group(0) in ACRONYMS:
                continue
            problems.append('%s: %s (%s)' % (rel, why, m.group(0)))
print('\n'.join(sorted(set(problems))) or 'All clear: no broken links and no house-style problems%s.' % (' (a drafts build: placeholders let through)' if drafts else ''))
sys.exit(1 if problems else 0)
