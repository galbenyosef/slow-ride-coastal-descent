// Course layout & sections
// Course constants (mountain 2400 m, valley 4200 m, sprint 3260 m), the section list (Wild Pass, Forest Descent, Deep in the Forest, Golden Switchbacks, ...), feature bands (m: curve/lean gates), noise helpers and the smoothing spline (w/T/E).
var e = 2400,
  t = 4200,
  n = 3260,
  r = e + t,
  i = r + 150,
  a = 4.8,
  o = e + n,
  s = [
    {
      distance: 0,
      label: `Wild Pass`,
      caption: `A narrow road through mountain pines`,
      index: `01`,
    },
    {
      distance: 1200,
      label: `Forest Descent`,
      caption: `Fast linked turns and sweeping bends`,
      index: `02`,
    },
    {
      distance: e,
      label: `Mountain Forest`,
      caption: `The quiet of the pine forest`,
      index: `03`,
    },
    {
      distance: e + 1050,
      label: `Autumn Switchbacks`,
      caption: `Golden leaves and hairpin turns`,
      index: `04`,
    },
    {
      distance: e + 2450,
      label: `Sea View`,
      caption: `The first glimpses of the ocean`,
      index: `05`,
    },
    {
      distance: o,
      label: `Coast`,
      caption: `Palms, sand and sunset`,
      index: `06`,
    },
  ],
  c = (e, t, n) => Math.max(t, Math.min(n, e)),
  l = (e, t, n) => {
    let r = c((n - e) / (t - e), 0, 1);
    return r * r * (3 - 2 * r);
  },
  u = (e, t) => Math.atan2(Math.sin(e - t), Math.cos(e - t)),
  d = [
    { start: 500, end: 680, direction: 1, degrees: 126 },
    { start: 1500, end: 1680, direction: -1, degrees: 126 },
  ],
  f = [
    { start: 560, end: 750, direction: 1, degrees: 180 },
    { start: 1270, end: 1460, direction: -1, degrees: 180 },
    { start: 1980, end: 2170, direction: 1, degrees: 180 },
  ],
  p = [...d, ...f.map((t) => ({ ...t, start: t.start + e, end: t.end + e }))],
  m = [
    ...p.map((e) => ({
      from: e.start - 65,
      to: e.end + 50,
      side: -e.direction,
    })),
    { from: e + 2860, to: r + 100, side: 1 },
  ],
  h = 5.75,
  g = (t) => l(e - 230, e, t);
function _(e) {
  let t = 0;
  for (let n of d)
    t = Math.max(
      t,
      l(n.start - 85, n.start - 10, e) * (1 - l(n.end + 10, n.end + 95, e)),
    );
  let n = 2.4 + 1.35 * t;
  return n + (a - n) * g(e);
}
var v = (e) => _(e) + h - a;
function y(e, t) {
  let n = 1 - g(e),
    r =
      0.5 +
      (Math.sin(e * 0.37 + t * 1.7) +
        0.45 * Math.sin(e * 0.91 - t * 2.3) +
        0.3 * Math.sin(e * 0.073 + t * 4.1)) /
        3.5,
    i = 0.5 + 0.5 * Math.sin(e * 0.16 + t * 2.4);
  return {
    strength: n,
    intrusion: 0.04 + r * 0.18,
    crest: 0.55 + i * 0.4,
    outer: 2.3 + 0.8 * (0.5 + 0.5 * Math.sin(e * 0.11 - t)),
    height: 0.12 + r * 0.18,
  };
}
function b(e, t) {
  let n = Math.max(0, Math.abs(t) - _(e));
  return (
    -0.04 -
    n * 0.055 +
    (Math.sin(e * 0.43 + Math.abs(t) * 1.7) * 0.09 +
      Math.sin(e * 0.13 - Math.abs(t) * 2.6) * 0.075) *
      l(0, 1.4, n)
  );
}
function x(e, t) {
  let n = Math.abs(t) - _(e);
  if (e >= 2400 || n < -0.35 || n > 3.1) return null;
  let r = y(e, Math.sign(t));
  if (n < -r.intrusion - 0.12 || n > r.outer) return null;
  let i = n < 0 ? -0.035 : b(e, t),
    a;
  return (
    (a =
      n < -r.intrusion
        ? -0.065 + 0.07 * l(-r.intrusion - 0.12, -r.intrusion, n)
        : n <= r.crest
          ? 0.005 + r.height * l(-r.intrusion, r.crest, n)
          : 0.005 + r.height + (i - 0.005 - r.height) * l(r.crest, r.outer, n)),
    i + (a - i) * r.strength
  );
}
function S(e, t, n) {
  return 0.45 * (1 - l(0, 6, Math.min(e - t, n - e)));
}
function C(e) {
  let r = 0.16 * Math.sin(e / 110) * (1 - l(310, 490, e));
  for (let t of f) r += Math.PI * t.direction * l(t.start, t.end, e);
  ((r -= (Math.PI / 2) * l(2460, 2690, e)),
    (r -= (Math.PI / 2) * l(3040, n, e)));
  let i = c((e - n) / (t - 150 - n), 0, 1);
  return (
    (r -= 0.1 * Math.sin(2 * Math.PI * i) * Math.sin(Math.PI * i) ** 2),
    r
  );
}
