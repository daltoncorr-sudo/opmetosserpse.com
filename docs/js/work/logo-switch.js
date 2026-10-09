/* logo-switch.js

   The HollyShorts 22 logo in both its colours, one over the other; a press
   (mouse, finger, Enter or Space, since it is a button) crossfades between the
   white-on-black and the black-on-white. The fade is CSS (see .logo-switch in
   style.css), and none under prefers-reduced-motion. */
(function () {
'use strict';
[].forEach.call(document.querySelectorAll('.logo-switch-btn'), function (btn) {
  btn.addEventListener('click', function () {
    var black = btn.classList.toggle('is-black');
    btn.setAttribute('aria-pressed', black ? 'true' : 'false');
    btn.setAttribute('aria-label', black
      ? 'HollyShorts 22 logo, black on white. Press to switch to the white version.'
      : 'HollyShorts 22 logo, white on black. Press to switch to the black version.');
  });
});
})();
