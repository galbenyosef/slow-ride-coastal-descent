// Terrain sampling
// Section-aware falloff (_), easings, centreline rebuild into P[] (heading te, grade ne, perpendiculars), point lookup F, feature solvers (le) and the ridge shaping used by the road.
var w = (e, t, n) => {
    let r = c((n - e) / (t - e), 0, 1);
    return r * r * r * (10 + r * (-15 + 6 * r));
  },
  T = (e, t, n, r, i) => w(t, n, e) * (1 - w(r, i, e)),
  E = [
    [0, -13],
    [75, 13],
    [150, -13],
    [225, 13],
    [300, -13],
    [375, 13],
    [450, -13],
    [500, 0],
    [680, 0],
    [730, 13],
    [810, -13],
    [890, 13],
    [970, -13],
    [1050, 13],
    [1130, -13],
    [1210, 13],
    [1290, -13],
    [1370, 13],
    [1450, -13],
    [1500, 0],
    [1680, 0],
    [1730, 13],
    [1805, -13],
    [1880, 13],
    [1955, -13],
    [2030, 13],
    [2105, -13],
    [2170, 0],
  ];
function ee(e) {
  if (e >= 2170) return 0;
  let t = 0,
    n = E.length - 1;
  for (; n - t > 1;) {
    let r = (t + n) >> 1;
    E[r][0] <= e ? (t = r) : (n = r);
  }
  let [r, i] = E[t],
    [a, o] = E[n];
  return ((i + (o - i) * w(r, a, e)) * Math.PI) / 180;
}
function te(t) {
  t = c(t, 0, e);
  let n = -Math.PI / 3 + ee(t);
  for (let e of d)
    n += ((e.direction * e.degrees * Math.PI) / 180) * w(e.start, e.end, t);
  return (
    (n += (Math.PI / 3) * w(2170, e, t)),
    (n += (0.16 / 110) * (t - e) * w(e - 140, e, t)),
    n
  );
}
function ne(t) {
  t = c(t, 0, e);
  let n =
    0.205 +
    0.026 * Math.sin(t / 83) +
    0.017 * Math.sin(t / 37) +
    0.018 * w(1100, 1280, t);
  ((n += 0.042 * T(t, 180, 250, 330, 405)),
    (n += 0.042 * T(t, 1e3, 1060, 1210, 1290)),
    (n += 0.04 * T(t, 1790, 1860, 1910, 2e3)));
  for (let e of d) {
    let r = T(t, e.start - 130, e.start - 20, e.end + 15, e.end + 95);
    n += (0.085 + 0.01 * w(e.start, e.end, t) - n) * r;
  }
  return n + (0.18 - n) * w(2220, e, t);
}
var D = (t) => (t < 2400 ? te(t) : C(t - e)),
  O = (e, t, n, r, i) => l(t, n, e) * (1 - l(r, i, e)),
  k = r - 60,
  re = r + 60,
  ie = 5.6875,
  ae = (e) => {
    let t = c((e - k) / (re - k), 0, 1);
    return t * t * t * (10 + t * (-15 + 6 * t));
  };
function A(e) {
  let t = re - k,
    n = c((e - k) / t, 0, 1),
    r = n - 2.5 * n ** 4 + 3 * n ** 5 - n ** 6;
  return ie + 0.14 * t * (0.5 - r);
}
var j = (t) => {
    let r =
        0.035 +
        (0.145 + 0.04 * l(0, 70, t)) * (1 - l(330, 440, t)) +
        0.205 * O(t, 790, 850, 1050, 1140) +
        0.225 * O(t, 1500, 1570, 1750, 1840) +
        0.175 * O(t, 2210, 2270, 2310, 2390) +
        0.145 * O(t, 2730, 2790, 2870, 2940),
      i = l(3120, n, t),
      a = 0.18 - 0.04 * l(n, n + 200, t);
    return (r * (1 - i) + a * i) * (1 - ae(t + e));
  },
  oe = (t) => (t < 2400 ? ne(t) : j(t - e)),
  M = 2,
  N = [{ x: -1200, y: 0, z: 0 }];
for (let e = M; e <= t; e += M) {
  let t = N[N.length - 1],
    n = C(e - M / 2);
  N.push({
    x: t.x + Math.sin(n) * M,
    y: t.y - j(e - M / 2) * M,
    z: t.z - Math.cos(n) * M,
  });
}
var se = A(k) - N[(k - e) / M].y;
for (let t = 0; t < N.length; t++)
  N[t].y = t * M + 2400 >= k ? A(t * M + e) : N[t].y + se;
var P = Array.from({ length: e / M }, () => ({ x: 0, y: 0, z: 0 }));
for (let e = P.length - 1; e >= 0; e--) {
  let t = e === P.length - 1 ? N[0] : P[e + 1],
    n = e * M + M / 2,
    r = te(n);
  P[e] = {
    x: t.x - Math.sin(r) * M,
    y: t.y + ne(n) * M,
    z: t.z + Math.cos(r) * M,
  };
}
(P.push(...N), Math.round(P[0].y - A(r)));
function F(e) {
  if (e < 0) {
    let t = P[0],
      n = D(0);
    return {
      x: t.x + e * Math.sin(n),
      y: t.y - e * oe(0),
      z: t.z - e * Math.cos(n),
    };
  }
  if (e >= r) {
    let t = P[P.length - 1];
    return { x: t.x, y: A(e), z: t.z - (e - r) };
  }
  let t = Math.floor(e / M),
    n = e / M - t,
    i = P[t],
    a = P[t + 1];
  return {
    x: i.x + (a.x - i.x) * n,
    y: e >= k ? A(e) : i.y + (a.y - i.y) * n,
    z: i.z + (a.z - i.z) * n,
  };
}
function I(e) {
  let t = F(e),
    n = D(e);
  return {
    ...t,
    heading: n,
    yaw: -n,
    nx: Math.cos(n),
    nz: Math.sin(n),
    tx: Math.sin(n),
    tz: -Math.cos(n),
    grade: oe(e),
    halfWidth: _(e),
    curvature: u(D(e + 0.5), D(e - 0.5)),
  };
}
function L(e, t, n = 0) {
  let r = I(e);
  return { x: r.x + r.nx * t, y: r.y + n, z: r.z + r.nz * t };
}
function ce(e, t) {
  let n = F(o),
    i = n.x - e,
    a = n.z - t,
    s = r - o;
  return (
    l(18, 45, i) *
    (1 - l(400, 540, i)) *
    l(-180, 30, a) *
    (1 - l(s + 120, s + 340, a))
  );
}
function le(e, t, n) {
  let a = 1 / 0,
    o = 0,
    s = n !== void 0,
    l = s ? Math.max(0, Math.floor((n - 70) / M)) : 0,
    u = s ? Math.min(P.length - 2, Math.ceil((n + 70) / M)) : P.length - 2,
    d = s ? 1 : 8;
  for (let n = l; n <= u; n += d) {
    let r = P[n],
      i = (r.x - e) ** 2 + (r.z - t) ** 2;
    i < a && ((a = i), (o = n));
  }
  let f = o * M,
    p = P[o].x,
    m = P[o].z;
  a = 1 / 0;
  for (let n = Math.max(0, o - d); n <= Math.min(P.length - 2, o + d); n++) {
    let r = P[n],
      i = P[n + 1],
      o = i.x - r.x,
      s = i.z - r.z,
      l = c(((e - r.x) * o + (t - r.z) * s) / (o * o + s * s), 0, 1),
      u = r.x + o * l,
      d = r.z + s * l,
      h = (e - u) ** 2 + (t - d) ** 2;
    h < a && ((a = h), (f = (n + l) * M), (p = u), (m = d));
  }
  let h = P[P.length - 1];
  if (t < h.z) {
    let n = c(h.z - t, 0, i - r),
      o = h.z - n,
      s = (e - h.x) ** 2 + (t - o) ** 2;
    s < a && ((a = s), (f = r + n), (p = h.x), (m = o));
  }
  let g = I(f);
  return {
    distance: f,
    lateral: (e - p) * g.nx + (t - m) * g.nz,
    separation: Math.sqrt(a),
    x: p,
    z: m,
    y: g.y,
  };
}
var ue = F(o).x + 165,
  R = F(r).z,
  de = R - 2600,
  z = (e) => R - e;
