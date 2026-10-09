#!/usr/bin/env python3
"""Check the built site in docs/: broken links, house-style words, leftover notes. Exits 1 on any problem.

    python3 check.py
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, 'docs')
ACRONYMS = {'ASCAP', 'BAFTA', 'NYU', 'IMGN', 'LLC', 'SVG', 'EPS', 'PNG', 'PDF', 'TCL', 'LOOK', 'BAM', 'SCL', 'HTML'}
CHECKS = [(r'\bAI\b', 'the word "AI"'), (r'\bvibes?\b', '"vibes"'), (r'Opmetosserpse', 'the name written as one word'), (r'Dalton Corr', "Dalton's name (the site doesn't name him)"),
          (r'\[D\?|\[DC|\[DB|TODO|Lorem|ipsum', 'a leftover note or placeholder'), (r'\b[A-Z]{4,}\b', 'a word in all caps')]

problems = []
if not os.path.isdir(D):
    sys.exit('No docs/ folder yet: run build.py first.')
for f in glob.glob(D + '/**/*.html', recursive=True):
    t = open(f, encoding='utf-8').read()
    rel = os.path.relpath(f, D)
    refs = re.findall(r'(?:href|src|poster)="(/[^"#?]*)', t)
    refs += [p.strip().split(' ')[0] for s in re.findall(r'srcset="([^"]+)"', t) for p in s.split(',')]
    for u in refs:
        p = D + u
        if not (os.path.exists(p) or os.path.exists(p + '.html') or os.path.exists(p.rstrip('/') + '/index.html')):
            problems.append('%s: broken link %s' % (rel, u))
    strip = lambda h: re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', h))
    text = strip(t)
    # All caps is allowed in editorial writing: the paragraphs of an article are left out of that one check
    plain = strip(re.sub(r'<div class="article-body">[\s\S]*?</div>', ' ', t))
    for pat, why in CHECKS:
        for m in re.finditer(pat, plain if why == 'a word in all caps' else text):
            if why == 'a word in all caps' and m.group(0) in ACRONYMS:
                continue
            problems.append('%s: %s (%s)' % (rel, why, m.group(0)))
    # Every blog row links to a page that exists
    for slug in re.findall(r'<li class="work-row[^"]*" data-slug="([^"]+)"', t):
        if not os.path.exists(os.path.join(D, 'blog', slug + '.html')):
            problems.append('%s: the blog row %s has no page' % (rel, slug))
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
print('\n'.join(sorted(set(problems))) or 'All clear: no broken links and no house-style problems.')
sys.exit(1 if problems else 0)
