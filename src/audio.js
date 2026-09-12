// Game audio
// Ambient audio engine (tm): menu/soundtrack tracks, wind filter node graph, user-gesture activation, dispose.
  tm = class {
    constructor() {
      ((this.context = null),
        (this.master = null),
        (this.wind = null),
        (this.wheels = null),
        (this.windFilter = null),
        (this.nodes = []),
        (this.tracks = []),
        (this.enabled = !0),
        (this.focused = !0),
        (this.disposed = !1),
        (this.mode = `ready`),
        (this.activate = () => {
          this.enabled &&
            (!this.context ||
              this.context.state !== `running` ||
              this.tracks.some(
                (e) => e.desired && e.element.paused && !e.pending,
              )) &&
            this.start();
        }),
        window.addEventListener(`pointerdown`, this.activate, !0),
        window.addEventListener(`keydown`, this.activate, !0));
    }
    start() {
      if (!(this.disposed || !this.enabled))
        try {
          (this.context || this.initialize(),
            this.context.resume().catch(() => {}),
            this.syncTracks());
        } catch {}
    }
    initialize() {
      let e = new AudioContext();
      ((this.context = e),
        (this.master = e.createGain()),
        (this.master.gain.value = this.enabled && this.focused ? 0.38 : 0),
        this.master.connect(e.destination));
      for (let t of [`/menu.mp3`, `/soundtrack.mp3`]) {
        let n = new Audio(t);
        ((n.loop = !0), (n.preload = `auto`));
        let r = e.createGain(),
          i = e.createMediaElementSource(n);
        ((r.gain.value = 0), i.connect(r), r.connect(this.master));
        let a = {
          element: n,
          gain: r,
          source: i,
          desired: !1,
          pending: !1,
          stopAt: 1 / 0,
        };
        (this.tracks.push(a), this.playTrack(a));
      }
      let t = e.createBuffer(1, e.sampleRate * 4, e.sampleRate),
        n = t.getChannelData(0),
        r = 0;
      for (let e = 0; e < n.length; e++)
        ((r = (r + Math.random() * 0.04 - 0.02) / 1.015), (n[e] = r * 4));
      let i = e.createBufferSource();
      ((i.buffer = t),
        (i.loop = !0),
        (this.windFilter = e.createBiquadFilter()),
        (this.windFilter.type = `lowpass`),
        (this.windFilter.frequency.value = 650),
        (this.wind = e.createGain()),
        (this.wind.gain.value = 0),
        i.connect(this.windFilter),
        this.windFilter.connect(this.wind),
        this.wind.connect(this.master));
      let a = e.createBiquadFilter();
      ((a.type = `bandpass`),
        (a.frequency.value = 230),
        (a.Q.value = 0.8),
        (this.wheels = e.createGain()),
        (this.wheels.gain.value = 0),
        i.connect(a),
        a.connect(this.wheels),
        this.wheels.connect(this.master),
        i.start(),
        this.nodes.push(i, a, this.windFilter, this.wind, this.wheels));
    }
    playTrack(e) {
      this.disposed ||
        e.pending ||
        !e.element.paused ||
        ((e.pending = !0),
        e.element
          .play()
          .then(() => {
            ((e.pending = !1),
              (this.disposed || !e.desired) && e.element.pause());
          })
          .catch(() => {
            e.pending = !1;
          }));
    }
    syncTracks(e = !1) {
      if (!this.context || this.disposed) return;
      let t = this.context.currentTime;
      this.tracks.forEach((n, r) => {
        let i =
          this.enabled &&
          this.focused &&
          (r === 0
            ? this.mode === `ready` ||
              this.mode === `paused` ||
              this.mode === `finished`
            : this.mode === `riding`);
        n.desired = i;
        let a = n.gain.gain;
        if (typeof a.cancelAndHoldAtTime == `function`)
          a.cancelAndHoldAtTime(t);
        else {
          let e = a.value;
          (a.cancelScheduledValues(t), a.setValueAtTime(e, t));
        }
        (n.gain.gain.setTargetAtTime(i ? (r === 0 ? 1.2 : 1.05) : 0, t, 0.3),
          i
            ? ((n.stopAt = 1 / 0), this.playTrack(n))
            : ((n.stopAt = e ? t : t + 1.4), e && n.element.pause()));
      });
    }
    setMode(e, t = !1) {
      ((this.mode = e),
        t && this.tracks[1] && (this.tracks[1].element.currentTime = 0),
        this.syncTracks());
    }
    setFocused(e) {
      ((this.focused = e),
        this.syncTracks(!e),
        this.context &&
          this.master &&
          this.master.gain.setTargetAtTime(
            this.enabled && e ? 0.38 : 0,
            this.context.currentTime,
            0.06,
          ),
        e && this.enabled && this.start());
    }
    setEnabled(e) {
      ((this.enabled = e),
        e && this.start(),
        this.syncTracks(!e),
        this.context &&
          this.master &&
          this.master.gain.setTargetAtTime(
            e && this.focused ? 0.38 : 0,
            this.context.currentTime,
            0.15,
          ));
    }
    update(e, t, n) {
      if (!this.context || !this.wind || !this.wheels || !this.windFilter)
        return;
      let r = this.context.currentTime;
      for (let e of this.tracks)
        !e.desired && r >= e.stopAt && !e.element.paused && e.element.pause();
      (this.wind.gain.setTargetAtTime(t ? 0.055 + e * 0.012 : 0, r, 0.3),
        this.wheels.gain.setTargetAtTime(
          t ? 0.065 + e * 0.01 + (n ? 0.1 : 0) : 0,
          r,
          0.15,
        ),
        this.windFilter.frequency.setTargetAtTime(300 + e * 44, r, 0.3));
    }
    dispose() {
      ((this.disposed = !0),
        window.removeEventListener(`pointerdown`, this.activate, !0),
        window.removeEventListener(`keydown`, this.activate, !0));
      for (let e of this.tracks)
        (e.element.pause(),
          e.element.removeAttribute(`src`),
          e.element.load(),
          e.source.disconnect(),
          e.gain.disconnect());
      (this.nodes.forEach((e) => e.disconnect()),
        this.master?.disconnect(),
        this.context?.close().catch(() => {}));
    }
  },
