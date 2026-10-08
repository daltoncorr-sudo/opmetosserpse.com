#!/usr/bin/env python3
"""The hand's moves on the cover: load, check and assemble them from moves/.

Each move is a folder, moves/<name>/, holding:
  move.json  {"name", "label", "duration_ms", "enabled", "requires": [files that must exist in the folder]}
  move.css   the rule .mark.m-<name>{animation:<name> ...} plus its @keyframes (every keyframe name starts with <name>)
  *.svg      optional layers on the hand's canvas (viewBox 0 0 901 1861): a pose that replaces the hand, or an
             overlay drawn on top of it. Each is inlined inside the mark as <svg class="pose pose-<file stem>">.
moves/moves.json holds the timing for the whole set: the first move, its delay, and the interval.
moves/_rig/hand-rig.svg, if present, replaces static/brand/hand.svg on the cover: the same drawing cut into parts
(<g class="part part-palm">, part-thumb, part-index, part-middle, part-ring, part-pinky ...), each pivoting at its
joint, so moves can bend fingers. Same canvas. moves/_rig/rig.css (pivots for the parts) goes first in moves.css. The favicon and everything else keep using hand.svg.

build.py and moves_lab.py both use load(); nothing else needs to change to add, remove or edit a move.
"""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
MOVES = os.path.join(ROOT, 'moves')
CANVAS = '0 0 901 1861'


def _svg(path, cls):
    with open(path, encoding='utf-8') as f:
        s = f.read().strip()
    s = re.sub(r'<\?xml[^>]*>\s*', '', s)
    return s.replace('<svg ', '<svg class="%s" aria-hidden="true" focusable="false" ' % cls, 1)


def hand_svg():
    """The hand for the cover: the rig if there is one, otherwise D's drawing."""
    rig = os.path.join(MOVES, '_rig', 'hand-rig.svg')
    path = rig if os.path.exists(rig) else os.path.join(ROOT, 'static', 'brand', 'hand.svg')
    return _svg(path, 'hand')


def load():
    """Return dict(moves=[...], skipped=[(name, why)], css, layers, settings, problems)."""
    with open(os.path.join(MOVES, 'moves.json'), encoding='utf-8') as f:
        settings = json.load(f)
    moves, skipped, css, layers, problems, stems = [], [], [], [], [], set()
    for name in sorted(os.listdir(MOVES)):
        d = os.path.join(MOVES, name)
        if not os.path.isdir(d) or name.startswith(('_', '.')):
            continue
        try:
            with open(os.path.join(d, 'move.json'), encoding='utf-8') as f:
                meta = json.load(f)
            with open(os.path.join(d, 'move.css'), encoding='utf-8') as f:
                rules = f.read()
        except FileNotFoundError as e:
            problems.append('%s: missing %s' % (name, os.path.basename(e.filename)))
            continue
        if meta.get('name') != name:
            problems.append('%s: move.json "name" must match the folder name' % name)
        if '.m-%s' % name not in rules:
            problems.append('%s: move.css needs a .mark.m-%s rule' % (name, name))
        for k in re.findall(r'@keyframes\s+([\w-]+)', rules):
            if not (k == name or k.startswith(name + '-')):
                problems.append('%s: keyframes "%s" must start with "%s"' % (name, k, name))
        svgs = sorted(x for x in os.listdir(d) if x.endswith('.svg'))
        for x in svgs:
            stem = x[:-4]
            if stem in stems:
                problems.append('%s: a layer named %s already exists in another move' % (name, x))
            stems.add(stem)
            with open(os.path.join(d, x), encoding='utf-8') as f:
                head = f.read(400)
            if 'viewBox="%s"' % CANVAS not in head:
                problems.append('%s/%s: draw it on the hand canvas, viewBox="%s"' % (name, x, CANVAS))
        if not meta.get('enabled', True):
            skipped.append((name, 'turned off in move.json'))
            continue
        missing = [r for r in meta.get('requires', []) if not os.path.exists(os.path.join(d, r))]
        if missing:
            skipped.append((name, 'waiting for ' + ', '.join(missing)))
            continue
        moves.append(dict(meta, folder=d))
        css.append('/* moves/%s */\n%s' % (name, rules.strip()))
        layers += [_svg(os.path.join(d, x), 'pose pose-' + x[:-4]) for x in svgs]
    rig_css = os.path.join(MOVES, '_rig', 'rig.css')
    if os.path.exists(rig_css):
        with open(rig_css, encoding='utf-8') as f:
            css.insert(0, '/* moves/_rig */\n' + f.read().strip())
    rig = os.path.join(MOVES, '_rig', 'hand-rig.svg')
    if os.path.exists(rig):
        with open(rig, encoding='utf-8') as f:
            r = f.read()
        if 'viewBox="%s"' % CANVAS not in r[:400]:
            problems.append('_rig/hand-rig.svg: use the hand canvas, viewBox="%s"' % CANVAS)
        if 'part-palm' not in r:
            problems.append('_rig/hand-rig.svg: needs at least a part-palm group')
    if settings.get('first') and settings['first'] not in [m['name'] for m in moves]:
        problems.append('moves.json: first move "%s" is not an enabled move' % settings['first'])
    return dict(moves=moves, skipped=skipped, css='\n'.join(css) + '\n', layers=''.join(layers),
                settings=settings, problems=problems)


def mark_attrs(m):
    """data-* attributes for <span class="mark">, read by site.js."""
    s = m['settings']
    return 'data-moves="%s" data-first="%s" data-delay="%d" data-interval="%d"' % (
        ' '.join('%s:%d' % (x['name'], x['duration_ms']) for x in m['moves']),
        s.get('first', ''), s.get('first_delay_ms', 3200), s.get('interval_ms', 10000))


if __name__ == '__main__':
    m = load()
    print('hand: %s' % ('rig (moves/_rig/hand-rig.svg)' if os.path.exists(os.path.join(MOVES, '_rig', 'hand-rig.svg')) else 'static/brand/hand.svg'))
    for x in m['moves']:
        print('on   %-8s %5d ms  %s' % (x['name'], x['duration_ms'], x['label']))
    for n, why in m['skipped']:
        print('off  %-8s %s' % (n, why))
    print('\n'.join('problem: ' + p for p in m['problems']) or 'No problems.')
