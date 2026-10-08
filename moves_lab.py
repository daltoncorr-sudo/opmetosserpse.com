#!/usr/bin/env python3
"""Write _lab/hand.html: a workbench for the hand's moves. It's not part of the site and never published.

    python3 moves_lab.py          # then open _lab/hand.html in a browser (double-click works)

It uses the same moves/ folder, stylesheet and markup as the cover, so what plays here plays on the site.
Controls: play any move, loop it, slow it down, scrub frame by frame, zoom the hand, or run the site's
own shuffle. Doesn't need the daltoncorr.com image library.
"""
import json, os, re
import moves

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '_lab')


def main():
    mv = moves.load()
    with open(os.path.join(ROOT, 'static', 'css', 'site.css'), encoding='utf-8') as f:
        site_css = f.read().replace('url(../fonts/', 'url(../static/fonts/')
    hand = moves.hand_svg()  # the rig in moves/_rig/ if there is one, else static/brand/hand.svg
    with open(os.path.join(ROOT, 'static', 'js', 'site.js'), encoding='utf-8') as f:
        site_js = f.read()
    shuffle_js = site_js[site_js.index('// The hand on the cover.'):]
    buttons = ''.join('<button data-move="%s">%s</button>' % (m['name'], m['label']) for m in mv['moves'])
    buttons += ''.join('<button disabled title="%s">%s</button>' % (why, n) for n, why in mv['skipped'])
    problems = ''.join('<p class="problem">%s</p>' % p for p in mv['problems'])
    page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Hand moves | workbench</title>
<style>%(site_css)s
%(moves_css)s
.lab{position:fixed;left:0;right:0;bottom:0;padding:14px 18px;font:13px/1.4 var(--sans);color:var(--graphite);
 display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;background:var(--paper);border-top:1px solid var(--paper-deep)}
.lab button{font:inherit;color:var(--ink);background:none;border:1px solid var(--paper-deep);padding:4px 10px;cursor:pointer}
.lab button[disabled]{color:var(--graphite);opacity:.5;cursor:default}
.lab button.on{border-color:var(--ink)}
.lab label{display:flex;gap:6px;align-items:center}
.lab input[type=range]{width:220px}
.lab .t{min-width:9ch;font-variant-numeric:tabular-nums}
.problem{position:fixed;top:12px;left:18px;color:#a40000;font:13px var(--sans)}
body.zoom .cover .mark{width:clamp(160px,22vw,300px)}
</style></head>
<body><main><section class="cover"><h1><span class="mark" %(attrs)s>%(hand)s%(layers)s</span><span class="name">Opmet Osserpse</span></h1></section></main>
%(problems)s
<div class="lab">
 <span>%(buttons)s</span>
 <label><input type="checkbox" id="loop"> Loop</label>
 <label>Speed <select id="speed"><option>1</option><option>0.5</option><option>0.25</option><option>0.1</option></select></label>
 <label>Scrub <input type="range" id="scrub" min="0" max="1000" value="0"></label><span class="t" id="t">0 ms</span>
 <label><input type="checkbox" id="zoom"> Zoom</label>
 <button id="shuffle">Site shuffle</button>
</div>
<script>
var mark = document.querySelector('.mark'), current = null, dur = {};
(mark.getAttribute('data-moves') || '').split(' ').forEach(function (x) { var p = x.split(':'); dur[p[0]] = +p[1]; });
function anims() { return document.getAnimations().filter(function (a) { return a.effect && mark.contains(a.effect.target); }); }
function reset() { Object.keys(dur).forEach(function (m) { mark.classList.remove('m-' + m); }); void mark.offsetWidth; }
function play(m) {
  reset(); current = m; mark.classList.add('m-' + m);
  var r = +document.getElementById('speed').value;
  anims().forEach(function (a) { a.playbackRate = r; });
  document.querySelectorAll('[data-move]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-move') === m); });
}
document.querySelectorAll('[data-move]').forEach(function (b) { b.onclick = function () { play(b.getAttribute('data-move')); }; });
mark.addEventListener('animationend', function (e) {
  if (e.target !== mark || !current) return;
  if (document.getElementById('loop').checked) setTimeout(function () { play(current); }, 400); else reset();
});
document.getElementById('speed').onchange = function () { var r = +this.value; anims().forEach(function (a) { a.playbackRate = r; }); };
document.getElementById('scrub').oninput = function () {
  if (!current) return;
  if (!anims().length) { mark.classList.add('m-' + current); }
  var t = this.value / 1000 * dur[current];
  anims().forEach(function (a) { a.pause(); a.currentTime = t; });
  document.getElementById('t').textContent = Math.round(t) + ' ms';
};
document.getElementById('zoom').onchange = function () { document.body.classList.toggle('zoom', this.checked); };
document.getElementById('shuffle').onclick = function () {
  this.disabled = true; this.textContent = 'Site shuffle running (reload to stop)';
%(shuffle_js)s
};
</script></body></html>
''' % dict(site_css=site_css, moves_css=mv['css'], attrs=moves.mark_attrs(mv), hand=hand, layers=mv['layers'],
           problems=problems, buttons=buttons, shuffle_js=shuffle_js.replace('</script>', '<\\/script>'))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'hand.html'), 'w', encoding='utf-8') as f:
        f.write(page)
    print('Wrote _lab/hand.html: %d moves on%s.' % (len(mv['moves']), ''.join('; %s off (%s)' % s for s in mv['skipped'])))
    for p in mv['problems']:
        print('problem: ' + p)


if __name__ == '__main__':
    main()
