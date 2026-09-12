// Spark trail particles
// GPU spark-trail emitter (em): ring buffers of head/tail/fade/width attributes and the glow shader, with per-frame update().
var em = class {
    constructor(e, t = Math.random) {
      ((this.random = t),
        (this.emittedCount = 0),
        (this.cursor = 0),
        (this.carry = [0, 0]),
        (this.hadContact = [!1, !1]),
        (this.origins = [new q(), new q()]),
        (this.point = new q()),
        (this.faceNormal = new q()),
        (this.rootNormal = new J()),
        (this.spawnPoint = new q()),
        (this.direction = new q()),
        (this.sideways = new q()),
        (this.delta = new q()),
        (this.heads = new Float32Array(256 * 3)),
        (this.tails = new Float32Array(256 * 3)),
        (this.fades = new Float32Array(256)),
        (this.widths = new Float32Array(256)),
        (this.particles = Array.from({ length: 256 }, () => ({
          position: new q(),
          velocity: new q(),
          normal: new q(),
          floor: new q(),
          age: 0,
          life: 0,
          width: 0,
          strength: 0,
          bounces: 0,
        }))));
      let n = new Mo(1, 1),
        r = new Us();
      (r.setIndex(n.index),
        r.setAttribute(`position`, n.attributes.position),
        r.setAttribute(`uv`, n.attributes.uv));
      for (let [e, t, n] of [
        [`sparkHead`, this.heads, 3],
        [`sparkTail`, this.tails, 3],
        [`sparkFade`, this.fades, 1],
        [`sparkWidth`, this.widths, 1],
      ])
        r.setAttribute(e, new Ki(t, n).setUsage(Ot));
      ((r.instanceCount = 0), n.dispose());
      let i = new qo({
        transparent: !0,
        blending: 2,
        depthWrite: !1,
        depthTest: !0,
        side: 2,
        vertexShader: `
        attribute vec3 sparkHead, sparkTail;
        attribute float sparkFade, sparkWidth;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vec4 head = modelViewMatrix * vec4(sparkHead, 1.);
          vec4 tail = modelViewMatrix * vec4(sparkTail, 1.);
          vec2 d = head.xy - tail.xy;
          vec2 side = length(d) > .0001 ? normalize(vec2(-d.y, d.x)) : vec2(1., 0.);
          vec4 p = mix(tail, head, uv.y);
          p.xy += side * position.x * sparkWidth;
          gl_Position = projectionMatrix * p;
          vUv = uv;
          vFade = sparkFade;
        }`,
        fragmentShader: `
        varying vec2 vUv;
        varying float vFade;
        void main() {
          float across = abs(vUv.x - .5) * 2.;
          float core = pow(max(0., 1. - across), 5.);
          float glow = exp(-across * across * 5.) * (1. - smoothstep(.7, 1., across));
          float ends = smoothstep(0., .16, vUv.y) * (1. - smoothstep(.8, 1., vUv.y));
          float alpha = glow * ends * pow(vFade, 1.4);
          if (alpha < .003) discard;
          vec3 color = mix(vec3(2.2, .28, .015), vec3(6., 4.4, 1.8), core * vFade);
          gl_FragColor = vec4(color, alpha);
        }`,
      });
      ((this.mesh = new Hi(r, i)),
        (this.mesh.name = `palm-contact-sparks`),
        (this.mesh.frustumCulled = !1),
        (this.mesh.visible = !1),
        e.add(this.mesh));
    }
    update(e, t, n, r, i) {
      if (t.recovering) {
        this.reset();
        return;
      }
      if (e <= 0) return;
      e = Math.min(e, 0.08);
      for (let t of this.particles) {
        if (t.life <= 0) continue;
        if (((t.age += e), t.age >= t.life)) {
          t.life = 0;
          continue;
        }
        ((t.velocity.y -= 9.81 * e),
          t.velocity.multiplyScalar(Math.exp(-e * 2)),
          t.position.addScaledVector(t.velocity, e));
        let n = this.delta.subVectors(t.position, t.floor).dot(t.normal);
        if (n < 0) {
          t.position.addScaledVector(t.normal, -n + 0.003);
          let e = t.velocity.dot(t.normal);
          (e < 0 && t.velocity.addScaledVector(t.normal, -e * 1.22),
            ++t.bounces > 1 && (t.life = 0));
        }
      }
      let a = i ? Qp(t.speed, t.bank) : 0;
      (n.updateWorldMatrix(!0, !1),
        this.rootNormal.getNormalMatrix(n.matrixWorld),
        this.direction.set(t.vx, 0, t.vz).normalize(),
        this.sideways.set(-this.direction.z, 0, this.direction.x));
      for (let i = 0; i < 2; i++) {
        let o = null;
        if (
          (a > 0 &&
            r &&
            r.handContacts[i] >= 0.95 &&
            (this.point
              .copy(Lf)
              .applyQuaternion(r.handQuaternions[i])
              .add(r.hands[i])
              .applyMatrix4(n.matrixWorld),
            (o = $p(this.point, t.distance)),
            this.faceNormal
              .set(0, 0, 1)
              .applyQuaternion(r.handQuaternions[i])
              .applyNormalMatrix(this.rootNormal),
            o && this.faceNormal.dot(o.normal) > -0.85 && (o = null)),
          !o)
        ) {
          ((this.carry[i] = 0), (this.hadContact[i] = !1));
          continue;
        }
        this.carry[i] += (30 + 250 * a) * e;
        let s = Math.floor(this.carry[i]);
        this.carry[i] -= s;
        for (let e = 0; e < s; e++) {
          (this.spawnPoint.copy(this.point),
            this.hadContact[i] &&
              this.spawnPoint.lerp(this.origins[i], 1 - (e + 1) / s));
          let n = $p(this.spawnPoint, t.distance);
          if (!n) continue;
          let r = this.particles[this.cursor];
          ((this.cursor = (this.cursor + 1) % 256),
            r.floor.set(this.spawnPoint.x, n.height, this.spawnPoint.z),
            r.position.copy(r.floor).addScaledVector(n.normal, 0.009),
            r.normal.copy(n.normal),
            r.velocity
              .set(t.vx, 0, t.vz)
              .multiplyScalar(P * 0.14)
              .addScaledVector(this.direction, -this.random() * (1 + a * 2))
              .addScaledVector(
                this.sideways,
                (this.random() - 0.5) * (1 + a * 3),
              )
              .addScaledVector(n.normal, 0.7 + this.random() * (1 + a * 1.5)),
            (r.age = 0),
            (r.life = 0.1 + a * 0.16 + this.random() * 0.12),
            (r.width = (0.025 + a * 0.025) * (0.7 + this.random() * 0.6)),
            (r.strength = a),
            (r.bounces = 0),
            this.emittedCount++);
        }
        (this.origins[i].copy(this.point), (this.hadContact[i] = !0));
      }
      let o = 0;
      for (let e of this.particles) {
        if (e.life <= 0) continue;
        let t = Xp(1 - e.age / e.life, 0, 1);
        (e.position.toArray(this.heads, o * 3),
          this.delta
            .copy(e.position)
            .addScaledVector(e.velocity, -(0.015 + e.strength * 0.017)),
          this.delta.toArray(this.tails, o * 3),
          (this.fades[o] = t),
          (this.widths[o] = e.width * (0.5 + t * 0.5)),
          o++);
      }
      if (
        ((this.mesh.geometry.instanceCount = o), (this.mesh.visible = o > 0), o)
      )
        for (let e of [`sparkHead`, `sparkTail`, `sparkFade`, `sparkWidth`])
          this.mesh.geometry.attributes[e].needsUpdate = !0;
    }
    reset() {
      for (let e of this.particles) e.life = 0;
      (this.carry.fill(0),
        this.hadContact.fill(!1),
        (this.cursor = this.emittedCount = 0),
        (this.mesh.geometry.instanceCount = 0),
        (this.mesh.visible = !1));
    }
    dispose() {
      (this.reset(),
        this.mesh.removeFromParent(),
        this.mesh.geometry.dispose(),
        this.mesh.material.dispose());
    }
  },
