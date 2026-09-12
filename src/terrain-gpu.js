// Terrain GLSL & surface details
// Ridge drop-off (B), height field H/V, coast-continuation GLSL chunk (fe), beach/sand blend he (K/q/J), and the detail-sampling helpers (ye/be/xe/Se).
function B(e) {
  let t = Math.max(0, z(e) - 180);
  return -4e-4 * t * t;
}
var V = [
    [27, 0.009, 0],
    [14, 0.021, 1.3],
    [3, 0.063, 0],
  ],
  H = (e) =>
    ue + B(e) + V.reduce((t, [n, r, i]) => t + n * Math.sin(e * r + i), 0),
  fe = `
float coastContinuationOffset(float z) {
  float d=max(0.,${R.toFixed(12)}-z-180.);
  return -.0004*d*d;
}
float shorelineX(float z) {
  return shoreX ${V.map(([e, t, n]) => `+ ${e.toFixed(1)} * sin(z * ${t.toFixed(3)} + ${n.toFixed(1)})`).join(` `)} + coastContinuationOffset(z);
}`,
  pe = (e) => 1 - l(F(o).z - 20, F(o).z + 135, e),
  U = {
    minX: -1790,
    maxX: F(o).x + 254,
    minZ: F(o).z - (r - o) - 450,
    maxZ: Math.max(...N.map((e) => e.z)) + 450,
  },
  me = { ...U, maxZ: Math.max(...P.map((e) => e.z)) + 450 };
function W(e) {
  let t = Math.round(o / M),
    n = P.length - 1,
    i = t,
    a = n;
  for (; a - i > 1;) {
    let t = (i + a) >> 1;
    P[t].z >= e ? (i = t) : (a = t);
  }
  let s = P[i],
    l = P[a],
    u = c((s.z - e) / (s.z - l.z), 0, 1),
    d = s.x + (l.x - s.x) * u + B(e),
    f = e < P[n].z ? F(r + P[n].z - e).y : s.y + (l.y - s.y) * u;
  return {
    roadX: d,
    roadY: f,
    bankStartX: d + 18,
    beachStartX: d + 31 + c((f - 7) * 0.5, 0, 70),
  };
}
function G(e, t) {
  let n = W(t);
  return (
    pe(t) *
    l(n.roadX + 14, n.roadX + 26, e) *
    (1 - l(n.beachStartX - 10, n.beachStartX + 2, e))
  );
}
function he(e, t) {
  return l(180, 420, z(t)) * l(0, 24, W(t).beachStartX - e);
}
var K = 58,
  q = F(o).z + 80,
  J = (e) => {
    let t = Math.sin(e * 127.1 + 311.7) * 43758.5453;
    return t - Math.floor(t);
  },
  ge = Array.from({ length: Math.ceil((q - de + 250) / K) }, (e, t) =>
    [0, 1].map((e) => {
      let n = t * 2 + e,
        r = q - t * K - e * 21 + J(n + 9) * 12,
        i = F(o).x + 48 + B(r);
      return {
        x: i + (H(r) - 26 - i) * (0.18 + e * 0.48 + J(n + 2) * 0.13),
        z: r,
        width: 12 + J(n + 21) * 10,
        length: 19 + J(n + 43) * 12,
        height: 0.65 + J(n + 65) * 0.8,
        bend: 0.28 + J(n + 87) * 0.28,
      };
    }),
  );
function _e(e, t) {
  let n = W(t),
    r = l(n.beachStartX + 1, n.beachStartX + 21, e) * l(18, 40, H(t) - e);
  if (r === 0) return 0;
  let i = Math.floor((q - t) / K),
    a = 0;
  for (let n = Math.max(0, i - 2); n <= Math.min(ge.length - 1, i + 2); n++)
    for (let r of ge[n]) {
      let n = (e - r.x) / r.width,
        i = (t - r.z) / r.length,
        o = Math.hypot(n, i);
      if (o >= 2.2) continue;
      let s = n + r.bend * i * i;
      a +=
        r.height * Math.exp(-s * s * 2 - i * i * 1.25) * (1 - l(1.65, 2.2, o));
    }
  return a * r;
}
function Y(e, t) {
  let n = H(t) - e;
  return (
    (n >= 0 ? 3.3 * (1 - Math.exp(-n / 52)) : Math.max(-8, n * 0.055)) +
    (Math.sin(t * 0.071 + e * 0.12) * 0.1 +
      Math.sin(t * 0.025 - e * 0.09) * 0.16) *
      l(0, 22, n) +
    _e(e, t)
  );
}
function ve(e, t) {
  let n = H(t),
    r = n - W(t).beachStartX,
    i = l(r, r + 160, n - e);
  return (
    Y(e, t) +
    i *
      (10 +
        3 * Math.sin(e * 0.007 + t * 0.006) +
        2 * Math.sin(t * 0.011 - e * 0.003))
  );
}
