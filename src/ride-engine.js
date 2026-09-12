// RideEngine
// Camera presets (nm) and the engine class (rm): scene/camera/renderer setup, terrain + sky wiring, rider state machine (ready/finished), HUD visibility, dispose. Exported as `RideEngine`.
  nm = [
    { label: `Classic`, behind: 5.6, clearance: 2.65, fovExtra: 0 },
    { label: `Close`, behind: 3.8, clearance: 2.1, fovExtra: 0 },
    { label: `Low`, behind: 3.8, clearance: 1, fovExtra: 0 },
    { label: `Low · wide angle`, behind: 3.8, clearance: 1, fovExtra: 9 },
    { label: `Cinematic`, behind: 7.8, clearance: 3.15, fovExtra: 0 },
  ],
  rm = class {
    constructor(t, n) {
      ((this.host = t),
        (this.onUpdate = n),
        (this.scene = new Sr()),
        (this.camera = new zs(64, 1, 0.1, 15e3)),
        (this.state = k()),
        (this.startDistance = 0),
        (this.mode = `ready`),
        (this.input = { steer: 0, tuck: !1, brake: !1, slide: !1 }),
        (this.keys = new Set()),
        (this.forest = null),
        (this.riderPose = null),
        (this.raf = 0),
        (this.last = 0),
        (this.elapsed = 0),
        (this.updateTime = 0),
        (this.accumulator = 0),
        (this.cameraPreset = 3),
        (this.hudHidden = !1),
        (this.disposed = !1),
        (this.cameraForward = new q(0, 0, -1)),
        (this.cameraAnchor = new q()),
        (this.slowFrames = 0),
        (this.resize = () => {
          let e = this.host.clientWidth,
            t = Math.max(1, this.host.clientHeight);
          (this.renderer.setSize(e, t),
            this.composer.setSize(e, t),
            (this.camera.aspect = e / t),
            this.camera.updateProjectionMatrix());
        }),
        (this.keydown = (e) => {
          e.metaKey ||
            e.ctrlKey ||
            e.altKey ||
            e.target?.closest(`input,[role="dialog"]`) ||
            (e.target?.closest(`button,[role="button"],[role="switch"]`) &&
              (e.code === `Enter` || e.code === `Space`)) ||
            ([
              `ArrowLeft`,
              `ArrowRight`,
              `ArrowUp`,
              `ArrowDown`,
              `Space`,
            ].includes(e.code) && e.preventDefault(),
            this.keys.add(e.code),
            !e.repeat &&
              ((e.code === `Escape` || e.code === `KeyP`) && this.togglePause(),
              e.code === `Enter` &&
                (this.mode === `ready` || this.mode === `finished`) &&
                this.start(),
              e.code === `KeyR` && this.mode !== `ready` && this.start(),
              e.code === `KeyM` &&
                (this.mode === `riding` || this.mode === `paused`) &&
                this.resetToRoad(),
              e.code === `KeyV` && this.cycleCamera(),
              e.code === `KeyH` && this.toggleHud()));
        }),
        (this.keyup = (e) => {
          this.keys.delete(e.code);
        }),
        (this.blur = () => {
          (this.audio.setFocused(!1),
            this.clearInput(),
            this.mode === `riding` &&
              ((this.mode = `paused`),
              this.audio.setMode(this.mode),
              this.onUpdate(this.state, this.mode)));
        }),
        (this.focus = () => {
          this.audio.setFocused(!document.hidden);
        }),
        (this.visibility = () => {
          document.hidden ? this.blur() : this.focus();
        }),
        (this.tick = (t) => {
          let n = Math.min((t - (this.last || t)) / 1e3, 0.08);
          ((this.last = t), (this.elapsed += n));
          let r = this.getControls();
          if (this.mode === `riding`) {
            for (this.accumulator += n; this.accumulator >= 1 / 120;)
              ((this.state = M(this.state, r, 1 / 120)),
                (this.accumulator -= 1 / 120));
            this.state.finished &&
              ((this.mode = `finished`),
              this.audio.setMode(this.mode),
              this.onUpdate(this.state, this.mode));
          }
          if (this.mode === `riding` && !this.state.recovering)
            for (let e of this.rider.wheels)
              e.rotateY((this.state.speed * n) / this.rider.wheelRadius);
          if (
            (this.audio.update(
              this.state.speed,
              this.mode === `riding`,
              !!r.slide || r.brake,
            ),
            this.mode !== `paused`)
          ) {
            let t = e(this.state.distance);
            this.riderPose = this.rider.animate(
              {
                bank: this.state.bank,
                deckRoll: this.state.deckRoll,
                tuck: Number(r.tuck),
                slide: this.state.slide,
                slipAngle: ne(
                  this.state.heading,
                  Math.atan2(this.state.vx, -this.state.vz),
                ),
                steer: r.steer,
                pushPhase: this.state.pushPhase,
                pushPreparation: this.state.pushPreparation,
                pushSpeed: this.state.pushSpeed,
                brake: Number(r.brake),
                speed: this.state.speed,
                time: this.state.time,
                impact: this.state.impact,
                roadGrade: t.grade,
                roadHeadingDelta: ne(t.heading, this.state.heading),
              },
              n,
            );
          }
          ((this.water.uniforms.time.value = this.elapsed),
            this.positionCamera(
              this.mode === `ready` ? 1 : 1 - Math.exp(-n * 6),
            ),
            this.mode !== `paused` &&
              this.sparks.update(
                n,
                this.state,
                this.rider.root,
                this.riderPose,
                this.mode === `riding`,
              ));
          let a = E(this.state.distance);
          ((this.renderer.toneMappingExposure = G.damp(
            this.renderer.toneMappingExposure,
            0.96 - a * 0.08 - 0.08 * i(b + 2940, D, this.state.distance),
            0.5,
            n,
          )),
            this.atmosphere.update(
              this.elapsed,
              this.camera,
              a,
              this.state.distance,
            ),
            this.lensFlare.update(
              this.camera,
              this.atmosphere.flare.position,
              this.atmosphere.flare.scale.x,
              this.atmosphere.sunVisibility.value,
              Rp.value,
            ),
            this.forest?.update(
              this.elapsed,
              this.camera,
              this.atmosphere.sun.shadow.getFrustum(),
            ),
            this.leaves.update(n, this.state, this.mode === `riding`),
            this.elapsed - this.updateTime > 0.1 &&
              ((this.updateTime = this.elapsed),
              this.onUpdate(this.state, this.mode)),
            n > 0.034 && this.forest
              ? this.slowFrames++
              : (this.slowFrames = Math.max(0, this.slowFrames - 1)),
            this.slowFrames > 120 &&
              this.renderer.getPixelRatio() > 1 &&
              (this.renderer.setPixelRatio(
                Math.max(1, this.renderer.getPixelRatio() - 0.2),
              ),
              this.composer.setPixelRatio(this.renderer.getPixelRatio()),
              this.resize(),
              (this.slowFrames = 0)),
            this.composer.render(),
            (this.raf = requestAnimationFrame(this.tick)));
        }),
        (this.renderer = new Dd({
          antialias: !0,
          powerPreference: `high-performance`,
        })),
        this.renderer.setPixelRatio(
          Math.min(
            window.devicePixelRatio,
            matchMedia(`(pointer:coarse)`).matches ? 1.1 : 1.4,
          ),
        ),
        (this.renderer.shadowMap.enabled = !0),
        (this.renderer.shadowMap.type = 1),
        (this.renderer.toneMapping = 4),
        (this.renderer.toneMappingExposure = 0.88),
        this.renderer.setClearColor(`#81919b`),
        t.appendChild(this.renderer.domElement),
        (this.scene.fog = new xr(`#889797`, 0.0014)),
        (this.atmosphere = Gp(this.scene)),
        (this.water = qp(this.scene)));
      let r = vp(this.scene),
        a = Ep(this.scene);
      (xp(this.scene),
        (this.leaves = new Yp(this.scene)),
        (this.rider = tp(this.scene)),
        (this.sparks = new em(this.scene)),
        this.atmosphere.softenShadows());
      let o = new In(1, 1, {
        type: ve,
        samples: Math.min(4, this.renderer.capabilities.maxSamples),
        depthTexture: new oa(1, 1, ge),
      });
      ((this.composer = new Id(this.renderer, o)),
        this.composer.addPass(new Ld(this.scene, this.camera)),
        (this.lensFlare = new Jp()),
        this.composer.addPass(this.lensFlare),
        (this.bloom = new zd(new K(1, 1), 0.1, 0.35, 1.3)),
        this.composer.addPass(this.bloom),
        this.composer.addPass(new Vd()),
        (this.observer = new ResizeObserver(this.resize)),
        this.observer.observe(t),
        this.resize(),
        (this.audio = new tm()),
        window.addEventListener(`keydown`, this.keydown),
        window.addEventListener(`keyup`, this.keyup),
        window.addEventListener(`blur`, this.blur),
        window.addEventListener(`focus`, this.focus),
        document.addEventListener(`visibilitychange`, this.visibility),
        (this.unregisterTools = Hd(this)),
        (this.assetsReady = Promise.all([
          Mp(this.scene),
          Dp(a.material),
          gp(r.roadMaterial),
          this.rider.clothing.loadTextures(),
        ]).then(([e]) => {
          ((this.forest = e),
            this.atmosphere.softenShadows(),
            this.disposed
              ? this.releaseScene()
              : e.update(
                  0,
                  this.camera,
                  this.atmosphere.sun.shadow.getFrustum(),
                ));
        })),
        this.positionCamera(1),
        (this.raf = requestAnimationFrame(this.tick)));
    }
    get cinematic() {
      return this.cameraPreset === nm.length - 1;
    }
    get hudVisible() {
      return (
        !this.hudHidden || this.mode === `ready` || this.mode === `finished`
      );
    }
    get cameraLabel() {
      return `${this.cameraPreset + 1}/${nm.length} · ${nm[this.cameraPreset].label}`;
    }
    cycleCamera() {
      ((this.cameraPreset = (this.cameraPreset + 1) % nm.length),
        this.onUpdate(this.state, this.mode));
    }
    setHudHidden(e) {
      (this.mode !== `riding` && this.mode !== `paused`) ||
        this.hudHidden === e ||
        ((this.hudHidden = e),
        e &&
          (this.input = { steer: 0, tuck: !1, brake: !1, slide: !1, push: !1 }),
        this.onUpdate(this.state, this.mode));
    }
    toggleHud() {
      this.setHudHidden(!this.hudHidden);
    }
    clearInput() {
      (this.keys.clear(),
        (this.input = { steer: 0, tuck: !1, brake: !1, slide: !1, push: !1 }));
    }
    start() {
      this.resetRide(k(this.startDistance), !0);
    }
    selectStart(e) {
      this.mode !== `ready` ||
        !g.some((t) => t.distance === e) ||
        ((this.startDistance = e),
        (this.state = k(e)),
        this.clearInput(),
        (this.accumulator = 0),
        this.rider.resetPose(),
        this.sparks.reset(),
        (this.riderPose = null),
        this.positionCamera(1),
        this.onUpdate(this.state, this.mode));
    }
    returnToMenu() {
      ((this.mode = `ready`),
        this.audio.setMode(this.mode),
        this.leaves.reset(),
        this.selectStart(this.startDistance));
    }
    resetToRoad() {
      let e = this.state;
      this.resetRide(
        {
          ...k(e.distance),
          time: e.time,
          topSpeed: e.topSpeed,
          flow: e.flow,
          recoveries: e.recoveries + 1,
        },
        !1,
      );
    }
    resetRide(e, t) {
      this.forest &&
        ((this.state = e),
        this.clearInput(),
        (this.mode = `riding`),
        this.audio.setMode(this.mode, t),
        this.audio.start(),
        (this.accumulator = 0),
        t && this.leaves.reset(),
        this.rider.resetPose(),
        this.sparks.reset(),
        (this.riderPose = null),
        this.positionCamera(1),
        this.onUpdate(this.state, this.mode));
    }
    togglePause() {
      (this.mode === `riding`
        ? (this.mode = `paused`)
        : this.mode === `paused` && (this.mode = `riding`),
        this.audio.setMode(this.mode),
        this.mode === `riding` && this.audio.start(),
        this.clearInput(),
        this.onUpdate(this.state, this.mode));
    }
    getControls() {
      return {
        steer:
          this.input.steer +
          Number(this.keys.has(`KeyD`) || this.keys.has(`ArrowRight`)) -
          Number(this.keys.has(`KeyA`) || this.keys.has(`ArrowLeft`)),
        tuck:
          this.input.tuck ||
          this.input.push ||
          this.keys.has(`KeyW`) ||
          this.keys.has(`ArrowUp`),
        brake:
          this.input.brake ||
          this.keys.has(`KeyS`) ||
          this.keys.has(`ArrowDown`),
        slide: this.input.slide || this.keys.has(`Space`),
        push:
          this.input.push ||
          this.keys.has(`ShiftLeft`) ||
          this.keys.has(`ShiftRight`),
      };
    }
    positionCamera(t) {
      let n = this.state,
        r = e(n.finished ? a(n.x, n.z, n.distance).distance : n.distance),
        i = this.getControls(),
        s =
          (n.distance < 2400
            ? o(n.distance, n.lateral)
            : Math.abs(n.lateral) < re(n.distance) + 1.2
              ? r.y
              : T(n.x, n.z)) + 0.035,
        c = nm[this.cameraPreset],
        l = this.cameraPreset !== 0 && !this.cinematic;
      (l &&
        t !== 1 &&
        ((this.camera.position.x += n.x - this.cameraAnchor.x),
        (this.camera.position.y += s - this.cameraAnchor.y),
        (this.camera.position.z += n.z - this.cameraAnchor.z)),
        this.cameraAnchor.set(n.x, s, n.z),
        this.rider.root.position.set(n.x, s, n.z),
        this.rider.root.rotation.set(-Math.atan(r.grade), -n.heading, 0, `YXZ`),
        (this.rider.trucks[0].rotation.y = -Math.atan(Math.sin(n.deckRoll))),
        (this.rider.trucks[1].rotation.y = Math.atan(
          Math.tan(Math.PI / 6) * Math.sin(n.deckRoll),
        )));
      let u = new q(
        n.speed > 1 ? n.vx / n.speed : Math.sin(n.heading),
        0,
        n.speed > 1 ? n.vz / n.speed : -Math.cos(n.heading),
      );
      (this.cameraForward.lerp(u, t * 0.6).normalize(),
        t === 1 && this.cameraForward.copy(u));
      let d = c.behind,
        f = this.cinematic ? -1.6 : 0,
        p = l
          ? r.grade *
            (this.cameraForward.x * r.tx + this.cameraForward.z * r.tz)
          : r.grade,
        m = new q(n.x, s + c.clearance + (l ? p * d : 0), n.z).addScaledVector(
          this.cameraForward,
          -d,
        );
      ((m.x += -this.cameraForward.z * f),
        (m.z += this.cameraForward.x * f),
        (m.y = Math.max(m.y, this.cameraFloor(m.x, m.z, l))),
        this.camera.position.lerp(m, t),
        (this.camera.position.y = Math.max(
          this.camera.position.y,
          this.cameraFloor(this.camera.position.x, this.camera.position.z, l),
        )));
      let h = this.cinematic ? 12 : 9,
        g = new q(n.x, s + 1.1 - p * h, n.z).addScaledVector(
          this.cameraForward,
          h,
        );
      if ((this.camera.up.set(n.bank * 0.022, 1, 0), n.impact > 0.3)) {
        let e = Math.min(0.13, n.impact * 0.012);
        ((this.camera.position.x += Math.sin(this.elapsed * 73) * e),
          (this.camera.position.y += Math.sin(this.elapsed * 91) * e * 0.5));
      }
      (l &&
        (this.camera.position.y = Math.max(
          this.camera.position.y,
          this.cameraFloor(this.camera.position.x, this.camera.position.z, !0),
        )),
        this.camera.lookAt(g),
        (this.camera.fov = G.lerp(
          this.camera.fov,
          60 + n.speed * 0.36 + (i.tuck ? 1.5 : 0) + (l ? c.fovExtra : 0),
          l ? 1 - (1 - t) ** 0.36 : 0.035,
        )),
        this.camera.updateProjectionMatrix());
    }
    cameraFloor(t, n, r) {
      if (!r) return T(t, n) + 1.35;
      let i = a(t, n);
      return (
        Math.max(
          o(i.distance, i.lateral),
          i.separation <= re(i.distance)
            ? e(i.distance).y + 0.025
            : sp(t, n).height,
        ) + 0.6
      );
    }
    releaseScene() {
      this.scene.traverse((e) => {
        if (e instanceof Hi) {
          e.geometry.dispose();
          for (let t of Array.isArray(e.material) ? e.material : [e.material]) {
            for (let e of Object.values(t)) e instanceof Nn && e.dispose();
            t.dispose();
          }
          e.customDepthMaterial?.dispose();
        }
      });
    }
    dispose() {
      ((this.disposed = !0),
        this.unregisterTools(),
        this.audio.dispose(),
        cancelAnimationFrame(this.raf),
        this.observer.disconnect(),
        window.removeEventListener(`keydown`, this.keydown),
        window.removeEventListener(`keyup`, this.keyup),
        window.removeEventListener(`blur`, this.blur),
        window.removeEventListener(`focus`, this.focus),
        document.removeEventListener(`visibilitychange`, this.visibility),
        this.atmosphere.dispose(),
        this.sparks.dispose(),
        this.releaseScene(),
        this.bloom.dispose(),
        this.lensFlare.dispose(),
        this.composer.dispose(),
        this.renderer.dispose(),
        this.renderer.domElement.remove());
    }
  };
export { rm as RideEngine };
