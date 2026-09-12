// Rider physics
// Friction constants (Fe), speed integrators (ze/Be/Q/Ve/He/Ue), rider state snapshot (We) and the main step function et: gravity/carve/recovery, off-course handling, section progress, finish.
  Re = 2.15;
function ze(e) {
  return Z + Math.max(0.085, Math.min(Le - Z, 0.9 / (Math.max(4, e) * Fe)));
}
function Be(e, t = 5) {
  let n = ze(t);
  return e <= 0.18 || e >= n ? 0 : Math.sin((Math.PI * (e - Z)) / (n - Z));
}
function Q(e, t, n, r, i, a) {
  let o = i * i,
    s = o * i;
  return (
    (2 * s - 3 * o + 1) * e +
    (s - 2 * o + i) * n * a +
    (-2 * s + 3 * o) * t +
    (s - o) * r * a
  );
}
function Ve(e, t) {
  let n = ze(t),
    r = n + 0.075,
    i = 0.5 / (n - Z),
    a,
    o,
    s;
  if (e < 0.18) {
    let t = e / Z;
    ((a = Q(0.3, 0.086, -1, 0, t, Z)),
      (o = Q(-0.2, -0.28, -0.8, i, t, Z)),
      (s = Q(0.1, 0, -0.2, 0, t, Z)));
  } else if (e < n) ((a = 0.086), (o = -0.28 + (e - Z) * i), (s = 0));
  else if (e < r) {
    let t = (e - n) / (r - n);
    ((a = Q(0.086, 0.22, 0, 1.2, t, r - n)),
      (o = Q(0.22, 0.3, i, 0, t, r - n)),
      (s = Q(0, -0.22, 0, 0, t, r - n)));
  } else {
    let t = (e - r) / (1 - r);
    ((a = Q(0.22, 0.3, 1.2, -1, t, 1 - r)),
      (o = Q(0.3, -0.2, 0, -0.8, t, 1 - r)),
      (s = Q(-0.22, 0.1, 0, -0.2, t, 1 - r)));
  }
  let c = (e) => {
      let t = Math.max(0, Math.min(1, e));
      return t * t * (3 - 2 * t);
    },
    l =
      0.6 *
      c(((e - Z) / (n - Z) - 0.45) / 0.55) *
      (1 - c((e - r) / ((1 - r) * 0.65)));
  return { x: 0.365, y: a, z: o, pitch: s, toeRoll: l };
}
function He(e, t) {
  let n = Math.max(0, Math.min(1, (e - Z) / (ze(t) - Z)));
  return (1 - Math.cos(Math.PI * n)) / 2;
}
function Ue(e, t, n, r, i = 5) {
  if (!r || (e < 0 && !n)) return { phase: -1, impulse: 0 };
  let a = Math.max(0, e),
    o = t / Fe,
    s = 0;
  for (; o > 1e-10;) {
    let e = Math.min(o, 1 - a);
    if (
      ((s += He(a + e, i) - He(a, i)), (a += e), (o -= e), a >= 0.9999999999)
    ) {
      if (!n) return { phase: -1, impulse: s * Re };
      a = 0;
    }
  }
  return { phase: a, impulse: s * Re };
}
var We = (e = 0) => {
    let t = I(e);
    return {
      distance: e,
      speed: 6,
      lateral: 0,
      lateralVelocity: 0,
      lean: 0,
      time: 0,
      topSpeed: 6,
      flow: 0,
      edge: !1,
      finished: !1,
      x: t.x,
      z: t.z,
      vx: t.tx * 6,
      vz: t.tz * 6,
      heading: t.heading,
      yawRate: 0,
      deckRoll: 0,
      bank: 0,
      slip: 0,
      slide: 0,
      recovering: 0,
      safeDistance: e,
      offRoadTime: 0,
      recoveries: 0,
      pushPhase: -1,
      pushPreparation: 0,
      pushSpeed: 6,
      impact: 0,
      barrierContact: !1,
    };
  },
  Ge = 1.25,
  Ke = 85,
  $ = 9.81,
  qe = 0.31,
  Je = 0.41,
  Ye = qe + Je,
  Xe = 6e3,
  Ze = 7800,
  Qe = 10,
  $e = (Ke / Ye) * (Je / Xe - qe / Ze);
function et(e, t, n) {
  if (e.finished) return e;
  if (e.recovering > 0) {
    let t = Math.max(0, e.recovering - n);
    return t > 0
      ? {
          ...e,
          recovering: t,
          time: e.time + n,
          impact: e.impact * Math.exp(-n * 8),
          barrierContact: !1,
        }
      : {
          ...We(Math.max(0, e.safeDistance - 7)),
          time: e.time + n,
          topSpeed: e.topSpeed,
          flow: e.flow,
          recoveries: e.recoveries,
        };
  }
  let i = I(e.distance),
    a = c(t.steer, -1, 1),
    o = a * 0.62 * (t.tuck && !t.slide ? 0.82 : 1),
    s = e.bank + (o - e.bank) * (1 - Math.exp(-n / (t.slide ? 0.13 : 0.2))),
    l = ($ * Math.tan(s)) / (e.speed ** 2 + 4),
    d = Math.asin(
      c(
        (l * (Ye + $e * e.speed ** 2)) / (1 + Math.tan(Math.PI / 6)),
        -0.3,
        0.3,
      ),
    ),
    f = e.deckRoll + (d - e.deckRoll) * (1 - Math.exp(-n / 0.12)),
    p = Math.sin(e.heading),
    m = -Math.cos(e.heading),
    h = Math.cos(e.heading),
    g = Math.sin(e.heading),
    v = t.slide && e.speed > 4 ? 1 : 0,
    y = e.slide + (v - e.slide) * (1 - Math.exp(-n / (v ? 0.06 : 0.28))),
    b = Math.abs(e.lateral) > _(e.distance),
    x = t.tuck && !t.brake && !t.slide && !b && e.speed < 14,
    S = e.pushPhase < 0 ? e.speed : e.pushSpeed,
    C = x ? (e.pushPhase < 0 && t.push ? Ie : e.pushPreparation) : 0,
    w = Math.min(n, C),
    T = Math.max(0, C - n),
    E = Ue(w > 0 ? 0 : e.pushPhase, n - w, !!t.push, x, S),
    ee = E.phase,
    te = ee >= 0,
    ne = b ? 0.4 : 0.8,
    D = (($ * i.grade) / (1 + i.grade ** 2)) * i.tx,
    O = (($ * i.grade) / (1 + i.grade ** 2)) * i.tz,
    k = 0,
    re = 0,
    ie = 0,
    ae = 0,
    A = (t, n, r, i, a) => {
      let o = Math.sin(e.heading + n),
        s = -Math.cos(e.heading + n),
        l = Math.cos(e.heading + n),
        u = Math.sin(e.heading + n),
        d = e.vx + t * e.yawRate * h,
        f = e.vz + t * e.yawRate * g,
        p = d * l + f * u,
        m = d * o + f * s,
        _ = Math.atan2(p, Math.max(Math.abs(m), 2)),
        v = c(-r * _, -a * i, a * i);
      ((k += (v * l) / Ke),
        (re += (v * u) / Ke),
        (ie += t * v * (l * h + u * g)),
        (ae = Math.max(ae, Math.abs(_))));
    };
  (A(qe, Math.atan(Math.sin(f)), Xe, (Ke * $ * Je) / Ye, ne),
    A(
      -Je,
      -Math.atan(Math.tan(Math.PI / 6) * Math.sin(f)),
      Ze,
      (Ke * $ * qe) / Ye,
      ne - y * 0.24,
    ));
  let j = e.speed,
    oe = j > 0.02 ? e.vx / j : p,
    M = j > 0.02 ? e.vz / j : m,
    N = -M,
    se = oe,
    P = k * N + re * se,
    F = b ? 0 : y,
    L = P + (1.6 * $ * Math.tan(s) - P) * F,
    ce = !b && (t.slide || e.slide > 0.01),
    ue = Math.min(0, k * oe + re * M) * +!ce;
  if (j > 0.02) {
    let r =
        (t.tuck && !te ? 0.00175 : 0.0035) * j * j +
        0.095 +
        (t.brake ? 2.6 : 0) +
        (b ? 1.7 : 0),
      i = Math.min(r, j / n);
    ((D -= (i * e.vx) / j), (O -= (i * e.vz) / j));
  }
  if (E.impulse > 0) {
    let e = (E.impulse * c((14 - j) / 9, 0, 1)) / n;
    ((D += p * e), (O += m * e));
  }
  let R = u(e.heading, Math.atan2(e.vx, -e.vz)),
    de = Math.max(y, c((Math.abs(R) - 0.06) / 0.24, 0, 1));
  if (e.speed > 3 && de > 0.001) {
    let n = t.slide ? a * 0.7 : 0,
      r = c(
        (Qe *
          ((e.vx * O - e.vz * D) / Math.max(9, e.speed ** 2) +
            L / Math.max(3, j) +
            c((n - R) * (t.slide ? 10 : 5), -3.8, 3.8) -
            e.yawRate)) /
          (t.slide ? 0.065 : 0.11),
        -210,
        210,
      );
    ie += (r - ie) * de;
  }
  let z = e.vx + D * n,
    B = e.vz + O * n,
    V = Math.hypot(z, B);
  if (V > 1e-5) {
    let e = (L * n) / Math.max(2, V),
      t = Math.cos(e),
      r = Math.sin(e),
      i = Math.max(0, V + ue * n) / V,
      a = z;
    ((z = (t * z - r * B) * i), (B = (r * a + t * B) * i));
  }
  t.brake && j < 0.18 && ((z = 0), (B = 0));
  let H = Math.hypot(z, B);
  H > 32 && ((z *= 32 / H), (B *= 32 / H));
  let fe = c((e.yawRate + (ie / Qe) * n) * Math.exp(-0.32 * n), -3.6, 3.6),
    pe = e.heading + fe * n,
    U = Pe(e.distance, e.x, e.z, z, B, n * Ge),
    { x: me, z: W } = U;
  ((z = U.vx), (B = U.vz), U.impact > 0.1 && (fe *= 0.65));
  let G = le(me, W, e.distance),
    he = I(G.distance),
    K = G.lateral,
    q = _(G.distance),
    J = Math.abs(K) > q - 0.3,
    ge = !U.contact && Math.abs(K) > q + 1 ? e.offRoadTime + n : 0,
    _e =
      Math.abs(K) < Math.min(3, q * 0.625) && Math.abs(u(pe, he.heading)) < 0.3
        ? G.distance
        : e.safeDistance,
    Y = U.impact > 5.5 || Math.abs(K) > q + 5.7 || ge > 2.6,
    ve = I(r),
    ye = (me - ve.x) * ve.tx + (W - ve.z) * ve.tz >= 0;
  return {
    ...e,
    x: me,
    z: W,
    vx: z,
    vz: B,
    heading: pe,
    yawRate: fe,
    deckRoll: f,
    bank: s,
    slide: y,
    slip: ae,
    distance: Math.min(r, G.distance),
    speed: Math.hypot(z, B),
    lateral: K,
    lateralVelocity: z * he.nx + B * he.nz,
    lean: s / 0.62,
    time: e.time + n,
    topSpeed: Math.max(e.topSpeed, Math.hypot(z, B)),
    flow: e.flow + (!J && ae < 0.1 && j > 9 ? n : 0),
    edge: J,
    finished: G.distance > r - 0.5 && ye && Math.abs(K) < q,
    safeDistance: Math.min(r, _e),
    offRoadTime: ge,
    recovering: Y ? 1.35 : 0,
    recoveries: e.recoveries + Number(Y),
    pushPhase: Y ? -1 : ee,
    pushPreparation: Y ? 0 : T,
    pushSpeed: ee < e.pushPhase ? j : S,
    impact: Math.max(U.impact, e.impact * Math.exp(-n * 8)),
    barrierContact: U.contact,
  };
}
