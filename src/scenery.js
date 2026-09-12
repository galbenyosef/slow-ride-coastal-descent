// Scenery & prop placement
// Deterministic prop spread over the course (Se cache, we/Te/Ee/De/Oe), section metadata ke (names/notes per section) and the tree/rock band generator (X/je/Ne/Pe).
var ye = (e) => l(F(o).z, F(o).z + 180, e),
  be = P.filter((e, t) => t % 12 == 0),
  xe = new Map();
function Se(e, t) {
  let n = `${e},${t}`,
    r = xe.get(n);
  if (r !== void 0) return r;
  let i = e * 12,
    a = t * 12,
    o = 0,
    s = 0;
  for (let e of be) {
    let t = (e.x - i) ** 2 + (e.z - a) ** 2 + 144,
      n = 1 / (t * t);
    ((o += (e.y + (e.x - i) * 0.32) * n), (s += n));
  }
  let c = o / s;
  return (xe.set(n, c), c);
}
function Ce(e, t) {
  let n = Math.floor(e / 12),
    r = Math.floor(t / 12),
    i = e / 12 - n,
    a = t / 12 - r,
    o = Se(n, r),
    s = Se(n + 1, r),
    c = Se(n, r + 1),
    l = Se(n + 1, r + 1);
  return (o + (s - o) * i) * (1 - a) + (c + (l - c) * i) * a;
}
function we(t, n) {
  let r = le(t, n),
    i = I(r.distance),
    a = r.separation,
    s =
      Math.sin(t * 0.052 + n * 0.027) * Math.sin(n * 0.073) * 2.8 +
      Math.sin(t * 0.014 - n * 0.012) * 8,
    c = i.y + (i.x - t) * 0.32 * l(7, 60, a) + s * l(10, 65, a),
    u = ye(n),
    d = u * l(15, 36, a);
  d > 0 && (c += (Ce(t, n) + s - c) * d);
  let f = 1 - l(e + 2700, o, r.distance),
    p = F(o).x + 90 + (f + (1 - f) * u) * (18 * Math.sin(n / 130));
  c = c * (1 - l(p - 35, p + 25, t)) - 8 * l(p - 35, p + 25, t);
  let m = W(n),
    h = t - m.roadX,
    g = pe(n) * l(9, 16, h);
  if (g > 0) {
    let e = Y(t, n),
      r = l(m.bankStartX, m.beachStartX, t),
      i = (m.roadY - 0.4) * (1 - r) + e * r;
    c += (i - c) * g;
  }
  let v = _(r.distance),
    y = x(r.distance, r.lateral);
  if (y !== null) return i.y + y;
  if (a < v - 0.05) return i.y - 0.32;
  if (a < 15) {
    let e = i.y + b(r.distance, a);
    c = e + (c - e) * l(10, 15, a);
  }
  let S = l(180, 420, z(n));
  return S > 0 ? c + (ve(t, n) - c) * S : c;
}
function Te(e, t) {
  let n = L(e, t),
    r = x(e, t);
  return r === null
    ? Math.abs(t) < _(e)
      ? n.y - 0.035
      : we(n.x, n.z)
    : n.y + r;
}
function Ee(e, t) {
  let n = Te(e, t);
  return Math.abs(t) <= _(e) ? Math.max(F(e).y, n) : n;
}
function De(t) {
  return l(920, 1130, t - e) * (1 - l(2300, 2510, t - e));
}
function Oe(t) {
  return 1 - l(2640, 3140, t - e);
}
function ke(e) {
  return e < 1200
    ? {
        index: `01`,
        name: `Wild Pass`,
        note: `Narrow roads, flowing turns and mountain air`,
      }
    : e < 2400
      ? {
          index: `02`,
          name: `Forest Descent`,
          note: `Find your rhythm on the winding descent`,
        }
      : e < 3450
        ? {
            index: `03`,
            name: `Deep in the Forest`,
            note: `Quiet mountains and the scent of pine`,
          }
        : e < 4850
          ? {
              index: `04`,
              name: `Golden Switchbacks`,
              note: `Slow down before the hairpin`,
            }
          : e < o
            ? {
                index: `05`,
                name: `A Glimpse of the Sea`,
                note: `The forest opens up`,
              }
            : {
                index: `06`,
                name: `Toward the Horizon`,
                note: `A fast descent beside the sea`,
              };
}
function Ae(e) {
  return p.find((t) => t.end > e + 10);
}
var X = 0.425,
  je = m.flatMap((e) => {
    let t = [];
    for (let n = e.from; n < e.to; n += 1.5) {
      let r = Math.min(e.to, n + 1.5),
        i = L(n, e.side * (v(n) + S(n, e.from, e.to))),
        a = L(r, e.side * (v(r) + S(r, e.from, e.to)));
      t.push({ ax: i.x, az: i.z, bx: a.x, bz: a.z, from: n, to: r });
    }
    return t;
  }),
  Me = new Map();
for (let e of je)
  for (let t = Math.floor(e.from / 12); t <= Math.floor(e.to / 12); t++)
    (Me.has(t) || Me.set(t, []), Me.get(t).push(e));
function Ne(e, t, n, r, i) {
  let { ax: a, az: o, bx: s, bz: c } = i,
    l = s - a,
    u = c - o,
    d = Math.hypot(l, u),
    f = l / d,
    p = u / d,
    m = -p,
    h = f,
    g = (e - a) * f + (t - o) * p,
    _ = (e - a) * m + (t - o) * h,
    v = n * f + r * p,
    y = n * m + r * h,
    b = null,
    x = (e, t, n, r = 0) => {
      e >= -1e-8 &&
        e <= 1 &&
        (!b || e < b.time) &&
        (b = { time: Math.max(0, e), nx: t, nz: n, penetration: r });
    },
    S = Math.max(0, Math.min(d, g)),
    C = e - a - S * f,
    w = t - o - S * p,
    T = Math.hypot(C, w);
  if (T < X - 1e-6) {
    let e = y > 0 ? -1 : 1;
    x(0, T > 1e-7 ? C / T : m * e, T > 1e-7 ? w / T : h * e, X - T);
  }
  if (Math.abs(y) > 1e-12)
    for (let e of [-1, 1]) {
      let t = (e * X - _) / y,
        n = g + v * t;
      n >= 0 && n <= d && y * e < 0 && x(t, m * e, h * e);
    }
  let E = n * n + r * r;
  if (E > 1e-14)
    for (let [i, l] of [
      [a, o],
      [s, c],
    ]) {
      let a = e - i,
        o = t - l,
        s = a * n + o * r,
        c = a * a + o * o - X * X,
        u = s * s - E * c;
      if (u < 0) continue;
      let d = (-s - Math.sqrt(u)) / E,
        f = a + n * d,
        p = o + r * d,
        m = Math.hypot(f, p);
      m > 1e-8 && n * f + r * p < 0 && x(d, f / m, p / m);
    }
  return b;
}
function Pe(e, t, n, i, a, o) {
  let s = o,
    c = 0,
    l = !1,
    u = 0,
    d = 0,
    f = new Set(),
    p = 5 + Math.hypot(i, a) * o;
  if (e >= r - 2) {
    let i = I(r);
    e = Math.max(e, r + (t - i.x) * i.tx + (n - i.z) * i.tz);
  }
  for (let t = Math.floor((e - p) / 12); t <= Math.floor((e + p) / 12); t++)
    for (let e of Me.get(t) || []) f.add(e);
  for (let e = 0; e < 5 && s > 1e-7; e++) {
    let e = i * s,
      r = a * s,
      o = null;
    for (let i of f) {
      if (
        Math.max(t, t + e) + X < Math.min(i.ax, i.bx) ||
        Math.min(t, t + e) - X > Math.max(i.ax, i.bx) ||
        Math.max(n, n + r) + X < Math.min(i.az, i.bz) ||
        Math.min(n, n + r) - X > Math.max(i.az, i.bz)
      )
        continue;
      let a = Ne(t, n, e, r, i);
      a && (!o || a.time < o.time) && (o = a);
    }
    if (!o) {
      ((t += e), (n += r));
      break;
    }
    ((l = !0),
      (u = o.nx),
      (d = o.nz),
      (t += e * o.time + u * (o.penetration + 5e-4)),
      (n += r * o.time + d * (o.penetration + 5e-4)));
    let p = i * u + a * d;
    if (p < 0) {
      c = Math.max(c, -p);
      let e = -1.05 * p,
        t = -d,
        n = u,
        r = i * t + a * n,
        o = -Math.sign(r) * Math.min(Math.abs(r), 0.18 * e);
      ((i += e * u + o * t), (a += e * d + o * n));
    }
    s *= 1 - o.time;
  }
  return { x: t, z: n, vx: i, vz: a, impact: c, contact: l, nx: u, nz: d };
}
var Fe = 0.82,
  Ie = 0.26,
  Z = 0.18,
  Le = 0.38,
