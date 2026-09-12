// Sky, sun & ocean dressing
// App-side sky rig on three's SkyShader: sunset/mist uniforms (Up), sun disc + glow quads (Wp), sky construction with patched fragment shader (Gp), ocean-swell GLSL (Kp), water surface (qp), sun lens flare (Jp).
function Up(e, t) {
  let n = i(b + 700, b + 3e3, e),
    r = G.lerp(0.0093, 0.0095, i(0.25, 1, n)),
    a = G.lerp(
      Math.atan2(0.65, 0.72),
      G.degToRad(70),
      i(b + 1500, b + 2900, e),
    );
  a = G.lerp(a, G.degToRad(28), i(b + 2940, D, e));
  let o = Math.sin(a),
    s = -Math.cos(a),
    c = Math.max(1e3, Math.min((Hp - t.x) / o, (zp - Bp - t.z) / s)),
    l = Math.atan2(-t.y, c),
    u = G.lerp(Math.atan2(0.43, Math.hypot(0.65, 0.72)), l + r * 1.7, n);
  return {
    sunset: n,
    azimuth: a,
    elevation: u,
    edgeDistance: c,
    horizon: l,
    sunRadius: r,
  };
}
function Wp() {
  let e = new Mo(2, 2),
    t = `varying vec2 vSunUv;
    void main(){vSunUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    n = new qo({
      uniforms: {
        color: { value: new Y(4.5, 3.8, 2.55) },
        softness: { value: 0.015 },
        opacity: { value: 1 },
      },
      vertexShader: t,
      fragmentShader: `uniform vec3 color;uniform float softness;uniform float opacity;varying vec2 vSunUv;
      void main(){float r=length(vSunUv*2.-1.)*1.16;float edge=min(.15,max(fwidth(r),softness));
        float alpha=1.-smoothstep(1.-edge,1.+edge,r);if(alpha<=0.)discard;
        gl_FragColor=vec4(color*mix(.78,1.,clamp(1.-r*r,0.,1.)),alpha*opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      transparent: !0,
      depthTest: !0,
      depthWrite: !1,
      fog: !1,
    }),
    r = new qo({
      uniforms: {
        color: { value: new Y(1.6, 1.15, 0.58) },
        opacity: { value: 0.08 },
      },
      vertexShader: t,
      fragmentShader: `uniform vec3 color;uniform float opacity;varying vec2 vSunUv;
      void main(){float r=length(vSunUv*2.-1.);if(r>=1.)discard;
        float glow=exp(-r*r*7.)*(1.-smoothstep(.55,1.,r));
        gl_FragColor=vec4(color,glow*opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      transparent: !0,
      blending: 2,
      depthTest: !0,
      depthWrite: !1,
      fog: !1,
    }),
    i = new pr();
  i.name = `sun-and-soft-halo`;
  let a = new Hi(e, r);
  ((a.name = `sun-halo`), a.scale.setScalar(5.2), (a.renderOrder = 1));
  let o = new Hi(e, n);
  return (
    (o.name = `sun-disc`),
    o.scale.setScalar(1.16),
    (o.renderOrder = 2),
    (a.frustumCulled = o.frustumCulled = !1),
    i.add(a, o),
    {
      flare: i,
      halo: a,
      discMaterial: n,
      haloMaterial: r,
      dispose() {
        (e.dispose(), n.dispose(), r.dispose(), i.removeFromParent());
      },
    }
  );
}
function Gp(e) {
  let t = new Ip();
  t.scale.setScalar(19e3);
  let n = t.material.uniforms;
  n.rideSunset = Rp;
  let r = new Y(`#d1d0c6`);
  ((n.rideMist = { value: 0 }),
    (n.rideMistColor = { value: r }),
    (t.material.fragmentShader =
      `uniform float rideSunset;
uniform float rideMist;
uniform vec3 rideMistColor;
` +
      t.material.fragmentShader
        .replace(
          `vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );`,
          `vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );
         vec2 horizontalView=direction.xz/max(length(direction.xz),.0001);
         vec2 horizontalSun=vSunDirection.xz/max(length(vSunDirection.xz),.0001);
         float sunward=pow(max(dot(horizontalView,horizontalSun),0.),3.);
         float skyHeight=max(direction.y,0.);
         // Deep orange stays saturated through ACES highlight compression.
         vec3 duskHorizon=mix(vec3(.64,.10,.035),vec3(1.25,.17,.016),sunward*.85);
         vec3 duskRadiance=mix(duskHorizon,mix(vec3(.54,.10,.065),vec3(.78,.135,.014),sunward),smoothstep(0.,.16,skyHeight));
         duskRadiance=mix(duskRadiance,vec3(.24,.105,.12),smoothstep(.08,.46,skyHeight));
         duskRadiance=mix(duskRadiance,vec3(.075,.135,.225),smoothstep(.40,.94,skyHeight));
         texColor=mix(texColor,duskRadiance,rideSunset*.95);`,
        )
        .replace(
          `float dayFactor = smoothstep( -0.08, 0.3, vSunDirection.y );`,
          `float dayFactor = mix(smoothstep(-.08,.3,vSunDirection.y),.82,rideSunset);`,
        )
        .replace(
          `vec3 skyAmbient = Lin * 0.04 + vec3( 0.0, 0.0003, 0.00075 );`,
          `vec3 duskCloudUnderside=mix(vec3(.20,.065,.045),vec3(.62,.12,.018),.35+.5*sunward);
         vec3 skyAmbient=mix(Lin*.04+vec3(0.,.0003,.00075),duskCloudUnderside,rideSunset*.92);
         sunColor=mix(sunColor,vec3(1.10,.20,.025),rideSunset*.9);`,
        )
        .replace(
          `gl_FragColor = vec4( texColor, 1.0 );`,
          `texColor=max(texColor,duskRadiance*rideSunset*.5);
         // Blend after the clouds so the distant sky meets the scene fog.
         float mistSky=rideMist*(1.-.08*smoothstep(.08,.85,skyHeight));
         texColor=mix(texColor,rideMistColor,mistSky);
         gl_FragColor=vec4(texColor,1.);`,
        )),
    (n.showSunDisc.value = 0),
    (n.turbidity.value = 3),
    (n.rayleigh.value = 1.7),
    (n.mieCoefficient.value = 0.0045),
    (n.mieDirectionalG.value = 0.83),
    n.sunPosition.value.copy(Lp),
    n.cloudCoverage &&
      ((n.cloudCoverage.value = 0.48),
      (n.cloudDensity.value = 0.65),
      (n.cloudScale.value = 24e-5),
      (n.cloudSpeed.value = 9e-6),
      (n.cloudElevation.value = 0.34)),
    e.add(t));
  let a = new Hs(`#ffd5ad`, 2.65);
  ((a.castShadow = !0),
    a.shadow.mapSize.set(4096, 4096),
    Object.assign(a.shadow.camera, {
      left: -230,
      right: 230,
      top: 230,
      bottom: -230,
      near: 1,
      far: 1100,
    }),
    a.shadow.camera.updateProjectionMatrix(),
    (a.shadow.normalBias = 0.025),
    (a.shadow.bias = -8e-5),
    e.add(a, a.target));
  let o = new Ds(`#b7c9dc`, `#393b2b`, 0.94);
  e.add(o);
  let s = Wp(),
    c = s.flare;
  e.add(c);
  let l = { value: new q() },
    u = new q(),
    d = new q(),
    f = new q(),
    p = new q(),
    m = new q(),
    h = new q(),
    g = new Y(`#fff0d7`),
    _ = new Y(`#ffae66`),
    v = new Y(`#c2d2dd`),
    y = new Y(`#dda270`),
    x = new Y(`#393b2b`),
    S = new Y(`#756755`),
    C = new Y(`#9eafb3`),
    w = new Y(`#cc824f`),
    T = new WeakSet();
  function E() {
    e.traverse((e) => {
      if (e instanceof Hi)
        for (let t of Array.isArray(e.material) ? e.material : [e.material]) {
          if (!(t instanceof Z) || T.has(t)) continue;
          T.add(t);
          let e = t.onBeforeCompile.bind(t),
            n = t.customProgramCacheKey.bind(t);
          ((t.onBeforeCompile = (n, r) => {
            (e.call(t, n, r),
              (n.uniforms.uRideShadowView = l),
              (n.vertexShader =
                `uniform vec3 uRideShadowView; varying float vRideShadowDistance;
` + n.vertexShader),
              (n.vertexShader = n.vertexShader.replace(
                `#include <project_vertex>`,
                `#include <project_vertex>
            vec4 shadowFadeWorld=vec4(transformed,1.);
            #ifdef USE_INSTANCING
            shadowFadeWorld=instanceMatrix*shadowFadeWorld;
            #endif
            shadowFadeWorld=modelMatrix*shadowFadeWorld;
            vRideShadowDistance=length(shadowFadeWorld.xz-uRideShadowView.xz);`,
              )),
              (n.fragmentShader =
                `varying float vRideShadowDistance;
` + n.fragmentShader));
            let i = Q.shadowmap_pars_fragment.replaceAll(
              `return mix( 1.0, shadow, shadowIntensity );`,
              `float mapEdge=min(min(shadowCoord.x,shadowCoord.y),min(1.-shadowCoord.x,1.-shadowCoord.y));
            float softRange=(1.-smoothstep(200.,280.,vRideShadowDistance))*smoothstep(.02,.12,mapEdge);
            return mix(1.,shadow,shadowIntensity*softRange);`,
            );
            n.fragmentShader = n.fragmentShader.replace(
              `#include <shadowmap_pars_fragment>`,
              i,
            );
          }),
            (t.customProgramCacheKey = () => n() + `-distant-shadow-fade-v1`),
            (t.needsUpdate = !0));
        }
    });
  }
  return {
    sun: a,
    sky: t,
    ambient: o,
    flare: c,
    sunVisibility: s.discMaterial.uniforms.opacity,
    softenShadows: E,
    update(t, T, E, D) {
      n.time && (n.time.value = t);
      let O = T.position,
        k = Up(D, O),
        A = k.sunset,
        j = 1 - i(b - 320, b, D),
        M = (1 - j) ** 2;
      ((n.rideMist.value = j),
        (Rp.value = A),
        Lp.set(
          Math.sin(k.azimuth) * Math.cos(k.elevation),
          Math.sin(k.elevation),
          -Math.cos(k.azimuth) * Math.cos(k.elevation),
        ),
        u.copy(Lp),
        (u.y = Math.max(Math.sin(G.degToRad(2.5)), u.y)),
        u.normalize(),
        n.sunPosition.value.copy(u),
        (n.turbidity.value = G.lerp(3.4, 3.8, A)),
        (n.rayleigh.value = G.lerp(1.6, 1.55, A)),
        (n.mieCoefficient.value = G.lerp(0.0045, 0.0035, A)),
        (n.mieDirectionalG.value = G.lerp(0.83, 0.72, A)),
        (n.showSunDisc.value = 0),
        a.color.copy(g).lerp(_, A),
        (a.intensity = G.lerp(2.75, 1.4, A)),
        o.color.copy(v).lerp(y, A),
        o.groundColor.copy(x).lerp(S, A),
        (o.intensity = G.lerp(0.94, 1, A) + 0.02 * A * (1 - E)),
        e.fog &&
          (e.fog.color.copy(C).lerp(w, A).lerp(r, j),
          e.fog instanceof xr &&
            (e.fog.density = G.lerp(6e-4 + E * 8e-4, 0.012, j))),
        l.value.copy(O),
        d.copy(Lp),
        (d.y = Math.max(0.06, d.y)),
        d.normalize(),
        T.getWorldDirection(f),
        (f.y = 0),
        f.normalize(),
        p.copy(O).addScaledVector(f, 95),
        m.set(-d.z, 0, d.x).normalize(),
        h.crossVectors(d, m).normalize());
      let N = 460 / 4096;
      (p.addScaledVector(m, Math.round(p.dot(m) / N) * N - p.dot(m)),
        p.addScaledVector(h, Math.round(p.dot(h) / N) * N - p.dot(h)),
        a.position.copy(p).addScaledVector(d, 550),
        a.target.position.copy(p),
        a.updateMatrixWorld(),
        a.target.updateMatrixWorld(),
        a.shadow.updateMatrices(a));
      let P = k.edgeDistance / Math.max(0.2, Math.cos(k.elevation));
      (c.position.copy(O).addScaledVector(Lp, P),
        c.quaternion.copy(T.quaternion));
      let F = i(0.25, 1, A);
      (c.scale.setScalar(P * Math.tan(k.sunRadius)),
        s.halo.scale.setScalar(G.lerp(5.2, 5.4, F)),
        s.discMaterial.uniforms.color.value.setRGB(
          G.lerp(4.5, 7, A),
          G.lerp(3.8, 4.4, A),
          G.lerp(2.55, 1.55, A),
        ),
        (s.discMaterial.uniforms.softness.value = G.lerp(0.015, 0.065, A)),
        (s.discMaterial.uniforms.opacity.value = M),
        s.haloMaterial.uniforms.color.value.setRGB(
          G.lerp(1.6, 2.8, A),
          G.lerp(1.15, 0.4, A),
          G.lerp(0.58, 0.045, A),
        ),
        (s.haloMaterial.uniforms.opacity.value = G.lerp(0.055, 0.09, A) * M));
    },
    dispose() {
      s.dispose();
    },
  };
}
var Kp = `
  vec3 oceanSwell(vec2 p) {
    vec2 a=normalize(vec2(.94,.34))*.0074;
    vec2 b=normalize(vec2(.82,.57))*.0048;
    float pa=dot(p,a)-time*.269;
    float pb=dot(p,b)-time*.217+2.1;
    return vec3(.11*sin(pa)+.07*sin(pb),
      .11*cos(pa)*a+.07*cos(pb)*b);
  }
`;
function qp(e) {
  let t = new qo({
      uniforms: {
        time: { value: 0 },
        sunDirection: { value: Lp },
        shoreX: { value: S },
        sunset: Rp,
      },
      vertexShader: `
      uniform float time;
      varying vec3 vWorld;
      ${Kp}
      void main() {
        vec3 p=position;
        p.y+=oceanSwell(p.xz).x;
        vWorld=(modelMatrix*vec4(p,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
      }
    `,
      fragmentShader: `
      uniform float time;
      uniform float sunset;
      uniform vec3 sunDirection;
      uniform float shoreX;
      varying vec3 vWorld;
      ${C}
      ${Kp}

      // A slowly changing phase field breaks up parallel crests. Include its
      // gradient in the normal, so the distortion does not add false highlights.
      vec3 waveWarp(vec2 p) {
        vec2 a=vec2(.017,-.009), b=vec2(.006,.021);
        float pa=dot(p,a)-time*.035, pb=dot(p,b)+time*.029;
        return vec3(.45*sin(pa)+.3*sin(pb),
          .45*cos(pa)*a+.3*cos(pb)*b);
      }
      vec2 waveSlope(vec2 p, vec2 direction, float wavelength,
                     float amplitude, float offset, vec3 warp) {
        float k=6.2831853/wavelength;
        vec2 d=normalize(direction);
        float bend=.65+offset*.09;
        float phase=dot(p,d)*k-sqrt(9.81*k)*time+offset+warp.x*bend;
        // Fade each frequency at the pixel scale, before it can form moire.
        // All derivatives execute unconditionally, including at the horizon.
        float visible=1.-smoothstep(.8,3.,fwidth(phase));
        return amplitude*cos(phase)*visible*(d*k+warp.yz*bend);
      }
      void main() {
        vec2 p=vWorld.xz;
        vec3 warp=waveWarp(p);
        vec2 slope=oceanSwell(p).yz;
        // Unequal wavelengths and phases, travelling around one prevailing
        // wind direction rather than crossing into a regular diamond lattice.
        slope+=waveSlope(p,vec2(.94,.34),48.,.19,.7,warp);
        slope+=waveSlope(p,vec2(.84,.54),31.,.11,2.4,warp);
        slope+=waveSlope(p,vec2(.99,.10),19.,.067,5.1,warp);
        slope+=waveSlope(p,vec2(.87,.49),11.,.035,1.3,warp);
        slope+=waveSlope(p,vec2(.97,-.07),6.2,.014,4.2,warp);
        slope+=waveSlope(p,vec2(.76,.65),3.6,.006,3.6,warp);
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
        vec3 viewDir=normalize(cameraPosition-vWorld);
        float fresnel=.025+.975*pow(clamp(1.-dot(n,viewDir),0.,1.),5.);
        vec3 reflection=reflect(-viewDir,n);
        vec2 reflectionHeading=reflection.xz/max(length(reflection.xz),.0001);
        vec2 sunHeading=sunDirection.xz/max(length(sunDirection.xz),.0001);
        float reflectionSunward=pow(max(dot(reflectionHeading,sunHeading),0.),2.);
        vec3 duskWaterHorizon=mix(vec3(.28,.075,.038),vec3(.78,.13,.018),.20+.80*reflectionSunward);
        vec3 horizon=mix(vec3(.48,.57,.62),duskWaterHorizon,sunset);
        vec3 zenith=mix(vec3(.13,.33,.50),vec3(.105,.155,.235),sunset);
        vec3 sky=mix(horizon,zenith,pow(max(reflection.y,0.),.5));
        float shoreDistance=p.x-shorelineX(p.y);
        float shallow=1.-smoothstep(0.,95.,shoreDistance);
        vec3 deep=mix(vec3(.014,.11,.17),vec3(.03,.105,.13),sunset);
        vec3 shallows=mix(vec3(.025,.32,.29),vec3(.08,.23,.20),sunset);
        vec3 base=mix(deep,shallows,shallow);
        vec3 color=mix(base,sky,fresnel*.88);
        vec3 halfSum=viewDir+sunDirection;
        vec3 halfVector=halfSum/max(length(halfSum),.0001);

        // Keep the orange reflection on a straight axis beneath the sun,
        // with softer, irregular glints instead of equally spaced bright bars.
        vec2 toWater=p-cameraPosition.xz;
        float along=dot(toWater,sunHeading);
        float across=dot(toWater,vec2(-sunHeading.y,sunHeading.x));
        float ribbonWidth=max(2.2,max(along,0.)*.02);
        float ribbonSide=across/ribbonWidth;
        float towardSun=smoothstep(0.,35.,along);
        float path=exp(-ribbonSide*ribbonSide)*towardSun;
        float softPath=exp(-ribbonSide*ribbonSide*.16)*towardSun;
        // Ripple phases remain anchored to the water when the rider moves.
        float bandPhase=dot(p,sunHeading)*.29-time*.8+warp.x*1.7
          +sin(dot(p,vec2(-sunHeading.y,sunHeading.x))*.07-time*.13)*.4;
        float bandFade=1.-smoothstep(.8,3.,fwidth(bandPhase));
        float waveBands=mix(.5,smoothstep(-.5,.7,sin(bandPhase)),bandFade);
        float ribbonRipples=.62+.38*waveBands;
        float sparkle=pow(max(dot(n,halfVector),0.),mix(260.,140.,sunset));
        // Bound HDR energy so ACES retains orange instead of bleaching to gold.
        color+=mix(vec3(1.1,1.,.8),vec3(1.8,.04,.004),sunset)
          *sparkle*mix(1.2,.38,sunset)*mix(1.,path,sunset);
        color+=vec3(1.8,.13,.012)*sunset*(.7*path+.045*softPath)*pow(fresnel,.5)*ribbonRipples;

        float shorePhase=shoreDistance*.62-time*.85+warp.x*.6+sin(p.y*.08)*.5;
        float foamFade=1.-smoothstep(.8,3.,fwidth(shorePhase));
        float foamBreak=.65+.35*sin(p.y*.18+sin(p.y*.37)-time*.6);
        float foam=smoothstep(.7,.98,sin(shorePhase))*foamBreak*foamFade
          *(1.-smoothstep(1.,9.,abs(shoreDistance)));
        color=mix(color,vec3(.68,.77,.70),foam*.55);
        float distanceFog=1.-exp(-length(cameraPosition-vWorld)*.00014);
        color=mix(color,mix(vec3(.40,.48,.54),duskWaterHorizon*.8,sunset),distanceFog);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    }),
    n = new Mo(Hp - Vp, Bp * 2, 160, 80);
  (n.rotateX(-Math.PI / 2), n.translate((Vp + Hp) / 2, 0, zp));
  let r = new Hi(n, t);
  return ((r.name = `ocean-surface`), e.add(r), t);
}
var Jp = class extends Nd {
    constructor() {
      (super({
        name: `SunLensFlare`,
        uniforms: {
          tDiffuse: { value: null },
          tDepth: { value: null },
          sunUv: { value: new K() },
          sunRadius: { value: new K() },
          sunDistance: { value: 1 },
          cameraRange: { value: new K(0.1, 15e3) },
          aspect: { value: 1 },
          strength: { value: 0 },
          sunset: { value: 0 },
        },
        vertexShader: `
        uniform highp sampler2D tDepth;
        uniform vec2 sunUv, sunRadius, cameraRange;
        uniform float sunDistance, strength;
        varying vec2 vUv;
        varying float vVisibility;
        void main() {
          vUv=uv;
          gl_Position=vec4(position.xy,0.,1.);
          float visible=0.;
          // A small disk of samples follows the actual sun size, including
          // FOV changes. Vertex sampling costs 75 taps for the whole frame,
          // rather than 25 taps per pixel. Alpha-tested foliage is in depth.
          for(int i=0;i<25;i++) {
            float f=float(i)+.5;
            float angle=f*2.39996323;
            vec2 offset=vec2(cos(angle),sin(angle))*sqrt(f/25.)*.92;
            vec2 sampleUv=sunUv+offset*sunRadius;
            float depth=texture2D(tDepth,clamp(sampleUv,vec2(0.),vec2(1.))).r;
            float viewDistance=cameraRange.x*cameraRange.y /
              (cameraRange.y-depth*(cameraRange.y-cameraRange.x));
            float inFrame=step(0.,sampleUv.x)*step(sampleUv.x,1.)*
              step(0.,sampleUv.y)*step(sampleUv.y,1.);
            // Leave a small margin for depth quantization at the horizon.
            visible+=inFrame*step(sunDistance*.985,viewDistance);
          }
          vVisibility=smoothstep(.04,.96,visible/25.)*strength;
        }`,
        fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 sunUv;
        uniform float aspect, sunset;
        varying vec2 vUv;
        varying float vVisibility;
        float ghost(vec2 p, vec2 center, float radius) {
          vec2 q=(p-center)/radius;
          float r=length(q);
          // A soft aperture shape, with a faint rim instead of a hard disc.
          float angle=r>.0001 ? atan(q.y,q.x) : 0.;
          float aperture=r*(1.+.025*cos(6.*angle));
          float fill=1.-smoothstep(.55,1.05,aperture);
          float rimDistance=(aperture-.84)*7.;
          float rim=exp(-rimDistance*rimDistance);
          return fill*.48+rim*.3;
        }
        void main() {
          vec4 sceneColor=texture2D(tDiffuse,vUv);
          if(vVisibility<=.0001) { gl_FragColor=sceneColor; return; }
          vec2 p=(vUv-.5)*vec2(aspect,1.);
          vec2 light=(sunUv-.5)*vec2(aspect,1.);
          vec2 d=p-light;
          vec3 warm=mix(vec3(1.,.78,.48),vec3(1.,.51,.22),sunset);
          // Restrained veiling glare and a short, soft horizontal streak.
          float glow=exp(-dot(d,d)/.009)*.08;
          float streak=exp(-abs(d.x)*14.-abs(d.y)*550.)*.09;
          vec3 flare=warm*(glow+streak);
          flare+=warm*ghost(p,light*.32,.024)*.10;
          flare+=vec3(.32,.55,.46)*ghost(p,-light*.24,.038)*.065;
          flare+=warm*ghost(p,-light*.60,.016)*.13;
          flare+=vec3(.40,.51,.60)*ghost(p,-light*1.12,.075)*.055;
          // Ghosts lose contrast when they overlap at the optical center.
          float separation=smoothstep(.015,.22,length(light));
          float veil=exp(-dot(d,d)/.11)*.012;
          flare=mix(warm*(glow+streak),flare,separation)+warm*veil;
          gl_FragColor=vec4(sceneColor.rgb+flare*vVisibility,sceneColor.a);
        }`,
      }),
        (this.sunView = new q()),
        (this.sunNdc = new q()),
        (this.material.depthTest = !1),
        (this.material.depthWrite = !1),
        (this.material.toneMapped = !1),
        (this.enabled = !1));
    }
    update(e, t, n, r, i) {
      (e.updateMatrixWorld(),
        this.sunView.copy(t).applyMatrix4(e.matrixWorldInverse),
        this.sunNdc.copy(this.sunView).applyMatrix4(e.projectionMatrix));
      let a = -this.sunView.z,
        o = Math.max(Math.abs(this.sunNdc.x), Math.abs(this.sunNdc.y)),
        s = 1 - G.smoothstep(o, 0.65, 1.03),
        c = G.clamp(r, 0, 1) * s;
      ((this.enabled = a > e.near && a < e.far && c > 0.001),
        (this.uniforms.strength.value = this.enabled ? c : 0),
        this.enabled &&
          (this.uniforms.sunUv.value.set(
            this.sunNdc.x * 0.5 + 0.5,
            this.sunNdc.y * 0.5 + 0.5,
          ),
          this.uniforms.sunRadius.value.set(
            (n * e.projectionMatrix.elements[0]) / (2 * a),
            (n * e.projectionMatrix.elements[5]) / (2 * a),
          ),
          (this.uniforms.sunDistance.value = a),
          this.uniforms.cameraRange.value.set(e.near, e.far),
          (this.uniforms.sunset.value = G.clamp(i, 0, 1))));
    }
    setSize(e, t) {
      this.uniforms.aspect.value = e / Math.max(1, t);
    }
    render(e, t, n, r = 0, i = !1) {
      ((this.uniforms.tDepth.value = n.depthTexture),
        n.depthTexture || (this.uniforms.strength.value = 0),
        super.render(e, t, n, r, i));
    }
  },
  Yp = class {
    constructor(e) {
      ((this.leaves = []),
        (this.bins = new Map()),
        (this.active = new Set()),
        (this.dummy = new fr()),
        (this.random = np(972)));
      let t = new Ua();
      (t.moveTo(0, 0.16),
        t.bezierCurveTo(0.09, 0.08, 0.09, -0.03, 0, -0.15),
        t.bezierCurveTo(-0.09, -0.03, -0.09, 0.08, 0, 0.16));
      let n = new Po(t, 4);
      n.rotateX(-Math.PI / 2);
      let r = n.getAttribute(`position`);
      for (let e = 0; e < r.count; e++) {
        let t = r.getX(e),
          n = r.getZ(e);
        r.setY(
          e,
          0.024 * (t / 0.09) ** 2 + 0.018 * Math.sin((n / 0.16) * Math.PI) ** 2,
        );
      }
      n.computeVertexNormals();
      for (let e = 0; e < 48e3; e++) {
        let e = b + this.random() * 3160;
        if (this.random() > E(e)) continue;
        let t = re(e),
          n = v(e),
          r = this.random() < 0.12 + 0.5 * n,
          i =
            (this.random() < 0.5 ? -1 : 1) *
            (r
              ? this.random() ** 0.8 * (t - 0.2)
              : t + 0.15 + this.random() ** 1.8 * 8.5),
          a = h(e, i);
        a.y = o(e, i) + 0.026 + this.random() * 0.014;
        let s = {
            s: e,
            x: a.x,
            y: a.y,
            z: a.z,
            baseX: a.x,
            baseZ: a.z,
            baseY: a.y,
            rotation: this.random() * 6.28,
            size: 0.65 + this.random() * 0.85,
            vx: 0,
            vy: 0,
            vz: 0,
            spin: 0,
            life: 0,
            lifted: !1,
            autumn: n,
          },
          c = this.leaves.push(s) - 1,
          l = Math.floor(e / 12);
        (this.bins.has(l) || this.bins.set(l, []), this.bins.get(l).push(c));
      }
      let i = this.leaves.length,
        a = np(77310),
        s = np(77311);
      for (let e = 0; e < 16e3; e++) {
        let e = a() * b;
        if (a() > E(e)) continue;
        let t = v(e),
          n = re(e),
          r = a() < 0.12 + 0.5 * t,
          i =
            (a() < 0.5 ? -1 : 1) *
            (r ? a() ** 0.8 * (n - 0.2) : n + 0.15 + a() ** 1.8 * 7),
          s = h(e, i);
        s.y = o(e, i) + 0.026 + a() * 0.014;
        let c = {
            s: e,
            x: s.x,
            y: s.y,
            z: s.z,
            baseX: s.x,
            baseY: s.y,
            baseZ: s.z,
            rotation: a() * 6.28,
            size: 0.65 + a() * 0.85,
            vx: 0,
            vy: 0,
            vz: 0,
            spin: 0,
            life: 0,
            lifted: !1,
            autumn: t,
          },
          l = this.leaves.push(c) - 1,
          u = Math.floor(e / 12);
        (this.bins.has(u) || this.bins.set(u, []), this.bins.get(u).push(l));
      }
      ((this.mesh = new ea(
        n,
        new Z({ color: `#d3c9ae`, roughness: 0.9, side: 2 }),
        this.leaves.length,
      )),
        this.mesh.instanceMatrix.setUsage(Ot),
        (this.mesh.receiveShadow = !0),
        (this.mesh.frustumCulled = !1),
        e.add(this.mesh),
        this.leaves.forEach((e, t) => {
          this.write(t, e);
          let n = t < i ? this.random : s;
          this.mesh.setColorAt(
            t,
            new Y().setHSL(
              0.045 + n() * 0.085,
              0.23 + e.autumn * 0.32,
              0.24 + n() * 0.2 + e.autumn * 0.06,
            ),
          );
        }));
    }
    write(e, t) {
      (this.dummy.position.set(t.x, t.y, t.z),
        this.dummy.rotation.set(
          t.life > 0 ? Math.sin(t.life * 8 + t.spin) * 0.9 : 0,
          t.rotation + t.life * t.spin,
          t.life > 0 ? Math.cos(t.life * 7) * 0.5 : 0,
        ),
        this.dummy.scale.setScalar(t.size),
        this.dummy.updateMatrix(),
        this.mesh.setMatrixAt(e, this.dummy.matrix));
    }
    update(e, t, n) {
      if (!n || t.recovering) return;
      let r = !1,
        i = Math.floor(t.distance / 12);
      if (t.speed > 3)
        for (let e = i - 1; e <= i + 1; e++)
          for (let n of this.bins.get(e) || []) {
            let e = this.leaves[n];
            if (e.lifted) continue;
            let r = e.x - t.x,
              i = e.z - t.z;
            Math.hypot(r, i) > 2.1 ||
              ((e.lifted = !0),
              (e.life = 0.001),
              (e.vx = r * 1.8 + t.vx * 0.12),
              (e.vz = i * 1.8 + t.vz * 0.12),
              (e.vy = 1.1 + t.speed * 0.12 + this.random()),
              (e.spin = (this.random() - 0.5) * 11),
              this.active.add(n));
          }
      for (let t of this.active) {
        let n = this.leaves[t];
        ((n.life += e),
          (n.vy -= 3.4 * e),
          (n.vx *= Math.exp(-e * 0.8)),
          (n.vz *= Math.exp(-e * 0.8)),
          (n.x += n.vx * e),
          (n.z += n.vz * e),
          (n.y += n.vy * e));
        let i = a(n.x, n.z, n.s),
          s = o(i.distance, i.lateral) + 0.032;
        (n.y < s &&
          n.life > 0.3 &&
          ((n.y = s), (n.life = 0), this.active.delete(t)),
          this.write(t, n),
          (r = !0));
      }
      r && (this.mesh.instanceMatrix.needsUpdate = !0);
    }
    reset() {
      this.active.clear();
      for (let e = 0; e < this.leaves.length; e++) {
        let t = this.leaves[e];
        t.lifted &&
          ((t.lifted = !1),
          (t.life = 0),
          (t.x = t.baseX),
          (t.z = t.baseZ),
          (t.y = t.baseY),
          this.write(e, t));
      }
      this.mesh.instanceMatrix.needsUpdate = !0;
    }
  },
  { clamp: Xp, smoothstep: Zp } = G;
function Qp(e, t) {
  return Zp(e, 3, 30) * Zp(Math.abs(t), 0.025, 0.62);
}
function $p(t, n) {
  let r = a(t.x, t.z, n);
  if (
    r.separation > re(r.distance) - 0.04 ||
    m(r.distance, r.lateral) > r.y + 0.001
  )
    return null;
  let i = e(r.distance),
    o = new q(i.grade * i.tx, 1, i.grade * i.tz).normalize();
  return Math.abs((t.y - r.y) * o.y) > 0.012
    ? null
    : { height: r.y, normal: o };
}
