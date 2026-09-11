/* Redline landing page: the flag-to-sentence link. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var stage = document.getElementById('stage');
  var wires = document.getElementById('wires');
  var flags = Array.prototype.slice.call(document.querySelectorAll('.flag'));
  var chips = document.querySelector('.chips');
  if (!stage || !flags.length) return;

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 1101px)');

  function sourceFor(flag) {
    return document.getElementById('src-' + flag.dataset.flag);
  }

  /* One ink line from the open flag's bar to the sentence it quotes. */
  function drawWire(flag) {
    wires.innerHTML = '';
    if (!wide.matches) return;
    var src = sourceFor(flag);
    var bar = flag.querySelector('.flag__bar');
    if (!src || !bar) return;

    var doc = document.querySelector('.doc');
    var base = stage.getBoundingClientRect();
    var b = bar.getBoundingClientRect();
    var s = src.getBoundingClientRect();
    var d = doc.getBoundingClientRect();
    if (!s.height) return;

    /* The line lives in the gutter: it never crosses a word of the document. */
    var x1 = b.left - base.left;
    var y1 = b.top - base.top + b.height / 2;
    var lines = src.getClientRects();
    var far = 0, i;
    for (i = 0; i < lines.length; i++) { if (lines[i].right > far) far = lines[i].right; }
    var x2 = Math.min(far, d.right) - base.left + 8;
    var y2 = s.top - base.top + s.height / 2;
    if (x2 >= x1 - 12) return;
    var mid = x2 + (x1 - x2) / 2;

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' H' + mid + ' V' + y2 + ' H' + x2);
    wires.appendChild(path);
  }

  function open(flag) {
    flags.forEach(function (f) {
      var on = f === flag;
      f.classList.toggle('is-open', on);
      f.querySelector('.flag__bar').setAttribute('aria-expanded', String(on));
      var s = sourceFor(f);
      if (s) s.classList.toggle('is-active', on);
    });
    drawWire(flag);
  }

  flags.forEach(function (flag) {
    flag.querySelector('.flag__bar').addEventListener('click', function () {
      if (flag.classList.contains('is-open')) return;
      open(flag);
    });
  });

  /* Selecting the sentence in the document works the other way round too. */
  flags.forEach(function (flag) {
    var src = sourceFor(flag);
    if (!src) return;
    src.style.cursor = 'pointer';
    src.addEventListener('click', function () {
      open(flag);
      flag.querySelector('.flag__bar').focus();
    });
  });

  var initial = document.querySelector('.flag.is-open') || flags[0];
  open(initial);

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      var cur = document.querySelector('.flag.is-open');
      if (cur) drawWire(cur);
    }, 120);
  });

  /* The one authored moment: the bars and fragments snap onto the page. */
  if (calm.matches) {
    flags.forEach(function (f) { f.classList.add('is-snapped'); });
    if (chips) chips.classList.add('is-snapped');
    return;
  }

  requestAnimationFrame(function () {
    flags.forEach(function (flag, i) {
      flag.querySelector('.flag__bar').style.transitionDelay = (90 + i * 110) + 'ms';
      flag.classList.add('is-snapped');
    });
    if (chips) chips.classList.add('is-snapped');
    setTimeout(function () {
      flags.forEach(function (f) { f.querySelector('.flag__bar').style.transitionDelay = ''; });
      var cur = document.querySelector('.flag.is-open');
      if (cur) drawWire(cur);
    }, 1000);
  });
})();
