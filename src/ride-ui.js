// Ride page UI
// The page component (Go): start menu, section chooser, live HUD (speed/km/altitude), finish summary with km traveled, ride-again and section buttons.
function Go() {
  let e = (0, p.useRef)(null),
    t = (0, p.useRef)(null),
    [n, r] = (0, p.useState)(f),
    [i, a] = (0, p.useState)(`ready`),
    [m, h] = (0, p.useState)(!1),
    [g, _] = (0, p.useState)(``),
    [v, y] = (0, p.useState)(!0),
    [b, x] = (0, p.useState)(!1),
    [C, w] = (0, p.useState)(0),
    [T, E] = (0, p.useState)(`Camera`),
    [D, O] = (0, p.useState)(!1),
    [k, ee] = (0, p.useState)(!0),
    A = u.find((e) => e.distance === C),
    j = ((d - C) / 1e3).toLocaleString(`en-US`, { maximumFractionDigits: 2 }),
    M = c(n.distance),
    N = s(n.distance),
    P = i === `riding` || i === `paused`;
  (0, p.useEffect)(() => {
    let n = !1;
    return (
      o(
        async () => {
          let { RideEngine: e } = await import(`./engine-Bi6T8dqO.js`);
          return { RideEngine: e };
        },
        __vite__mapDeps([0, 1]),
      )
        .then(async ({ RideEngine: i }) => {
          if (!(n || !e.current))
            try {
              ((t.current = new i(e.current, (e, n) => {
                (r(e),
                  a(n),
                  x(!!t.current?.getControls().brake),
                  E(t.current?.cameraLabel ?? `Camera`),
                  O(t.current?.hudHidden ?? !1),
                  ee(t.current?.hudVisible ?? !0));
              })),
                await t.current.assetsReady,
                n || (h(!0), E(t.current.cameraLabel)));
            } catch (e) {
              (console.error(e),
                _(
                  `Unable to start 3D. Try a browser with WebGL 2 support and hardware acceleration enabled.`,
                ));
            }
        })
        .catch(() =>
          _(`Unable to load the game. Refresh the page and try again.`),
        ),
      () => {
        ((n = !0), t.current?.dispose(), (t.current = null));
      }
    );
  }, []);
  let F = () => {
      (t.current?.start(), document.activeElement?.blur());
    },
    I = (e) => {
      t.current && (t.current.selectStart(e), w(t.current.startDistance));
    },
    L = () => {
      (t.current?.returnToMenu(), document.activeElement?.blur());
    },
    R = () => {
      let e = !v;
      (t.current?.audio.setEnabled(e), y(e));
    },
    te = () => {
      (t.current?.resetToRoad(), document.activeElement?.blur());
    },
    z = () => {
      (t.current?.cycleCamera(), document.activeElement?.blur());
    },
    B = () => {
      (t.current?.togglePause(), document.activeElement?.blur());
    },
    V = () => {
      (t.current?.toggleHud(), document.activeElement?.blur());
    },
    ne = () => {
      document.fullscreenElement
        ? document.exitFullscreen?.().catch(() => {})
        : document.documentElement.requestFullscreen?.().catch(() => {});
    },
    H = (e, n, r) => {
      (e.preventDefault(),
        e.currentTarget.setPointerCapture(e.pointerId),
        t.current && Object.assign(t.current.input, { [n]: r }));
    },
    U = (e) => {
      t.current &&
        Object.assign(t.current.input, { [e]: e === `steer` ? 0 : !1 });
    };
  return (0, S.jsxs)(`main`, {
    className: `game ${i}`,
    children: [
      (0, S.jsx)(`div`, {
        ref: e,
        className: `world`,
        "aria-label": `A 3D road winding through green hills to the sea`,
        onPointerDown: (e) => {
          i === `riding` &&
            !k &&
            (e.pointerType === `touch` || e.pointerType === `pen`) &&
            t.current?.togglePause();
        },
      }),
      k && (0, S.jsx)(`div`, { className: `atmosphere` }),
      k &&
        (0, S.jsxs)(`header`, {
          className: `topbar`,
          children: [
            (0, S.jsxs)(`button`, {
              className: `brand`,
              onClick: L,
              "aria-label": `Slow Ride — choose a starting section`,
              children: [
                (0, S.jsx)(Xn, {
                  className: `rider-mark`,
                  src: `/assets/brand/rider-mark.png`,
                  width: 40,
                  height: 40,
                  alt: ``,
                }),
                (0, S.jsxs)(`span`, {
                  children: [
                    `SLOW RIDE`,
                    (0, S.jsx)(`span`, {
                      className: `brand-dot`,
                      children: `®`,
                    }),
                  ],
                }),
              ],
            }),
            (0, S.jsxs)(`div`, {
              className: `top-route`,
              children: [
                (0, S.jsx)(`span`, { className: `live-dot` }),
                ` FREERIDE`,
                ` `,
                (0, S.jsx)(`span`, { className: `divider`, children: `/` }),
                ` ROUTE 01`,
              ],
            }),
            (0, S.jsxs)(`nav`, {
              className: `tools`,
              "aria-label": `Game settings`,
              children: [
                (0, S.jsx)(`button`, {
                  className: `icon-button`,
                  onClick: R,
                  "aria-label": v ? `Mute sound` : `Unmute sound`,
                  title: v ? `Mute sound` : `Unmute sound`,
                  children: v
                    ? (0, S.jsx)(gr, { size: 19 })
                    : (0, S.jsx)(_r, { size: 19 }),
                }),
                (0, S.jsx)(`button`, {
                  className: `icon-button fullscreen`,
                  onClick: ne,
                  "aria-label": `Fullscreen`,
                  title: `Fullscreen`,
                  children: (0, S.jsx)(fr, { size: 18 }),
                }),
              ],
            }),
          ],
        }),
      m &&
        P &&
        k &&
        (0, S.jsxs)(`button`, {
          className: `rescue-button camera-switch`,
          onClick: z,
          title: `Switch camera — V`,
          "aria-label": `Switch camera. Current view: ${T}`,
          "aria-keyshortcuts": `V`,
          children: [
            (0, S.jsx)(ur, { size: 16 }),
            ` `,
            (0, S.jsx)(`span`, { children: T }),
            ` `,
            (0, S.jsx)(`kbd`, { children: `V` }),
          ],
        }),
      i === `ready` &&
        (0, S.jsxs)(S.Fragment, {
          children: [
            (0, S.jsxs)(`section`, {
              className: `start-panel`,
              children: [
                (0, S.jsxs)(`div`, {
                  className: `eyebrow`,
                  children: [
                    (0, S.jsx)(`span`, { className: `tiny-line` }),
                    ` FROM THE DEEP FOREST TO THE OCEAN`,
                  ],
                }),
                (0, S.jsxs)(`h1`, {
                  children: [
                    `Road `,
                    (0, S.jsx)(`em`, { children: `to the sea.` }),
                  ],
                }),
                (0, S.jsx)(`p`, {
                  className: `intro`,
                  children: `Mountain forests. Golden leaves. Feel the speed. Stay in the moment.`,
                }),
                (0, S.jsxs)(`div`, {
                  className: `route-facts`,
                  children: [
                    (0, S.jsxs)(`span`, {
                      children: [
                        (0, S.jsx)(pr, { size: 16 }),
                        ` `,
                        Math.round(l(C).y - l(d).y),
                        ` m drop`,
                      ],
                    }),
                    (0, S.jsx)(`i`, {}),
                    (0, S.jsxs)(`span`, { children: [j, ` km`] }),
                    (0, S.jsx)(`i`, {}),
                    (0, S.jsx)(`span`, { children: `At your own pace` }),
                  ],
                }),
                (0, S.jsxs)(`fieldset`, {
                  className: `start-sections`,
                  children: [
                    (0, S.jsx)(`legend`, { children: `Where shall we start?` }),
                    (0, S.jsx)(`div`, {
                      className: `section-options`,
                      children: u.map((e) =>
                        (0, S.jsxs)(
                          `button`,
                          {
                            type: `button`,
                            "aria-pressed": C === e.distance,
                            disabled: !m,
                            onClick: () => I(e.distance),
                            children: [
                              (0, S.jsx)(`span`, { children: e.index }),
                              e.label,
                            ],
                          },
                          e.distance,
                        ),
                      ),
                    }),
                  ],
                }),
                (0, S.jsxs)(`button`, {
                  className: `start-button`,
                  onClick: F,
                  disabled: !m || !!g,
                  children: [
                    g
                      ? `Game unavailable`
                      : m
                        ? `Start riding`
                        : `Preparing the road…`,
                    (0, S.jsx)(lr, { size: 23 }),
                  ],
                }),
                (0, S.jsxs)(`div`, {
                  className: `enter-hint`,
                  children: [
                    `or press `,
                    (0, S.jsx)(`kbd`, { children: `Enter` }),
                  ],
                }),
                g &&
                  (0, S.jsx)(`p`, {
                    className: `error`,
                    role: `alert`,
                    children: g,
                  }),
              ],
            }),
            (0, S.jsxs)(`aside`, {
              className: `location-caption`,
              children: [
                (0, S.jsxs)(`span`, {
                  children: [A.index, ` — `, A.label.toUpperCase()],
                }),
                (0, S.jsxs)(`p`, { children: [A.caption, `.`] }),
                (0, S.jsx)(`div`, { className: `location-rule` }),
              ],
            }),
            (0, S.jsx)(`footer`, {
              className: `start-footer`,
              children: (0, S.jsxs)(`span`, {
                children: [
                  (0, S.jsx)(`span`, { className: `live-dot` }),
                  ` TAKE YOUR TIME. FEEL THE SPEED.`,
                ],
              }),
            }),
          ],
        }),
      P &&
        k &&
        (0, S.jsxs)(S.Fragment, {
          children: [
            (0, S.jsxs)(
              `div`,
              {
                className: `chapter`,
                children: [
                  (0, S.jsxs)(`span`, {
                    children: [
                      `ROUTE 01 `,
                      (0, S.jsx)(`i`, {}),
                      ` `,
                      N.index,
                      ` /`,
                      ` `,
                      String(u.length).padStart(2, `0`),
                    ],
                  }),
                  (0, S.jsx)(`h2`, { children: N.name }),
                  (0, S.jsx)(`p`, { children: N.note }),
                ],
              },
              N.index,
            ),
            M &&
              M.start - n.distance < 170 &&
              (0, S.jsxs)(`div`, {
                className: `turn-warning`,
                children: [
                  (0, S.jsx)(`span`, { children: M.direction > 0 ? `↱` : `↰` }),
                  (0, S.jsxs)(`div`, {
                    children: [
                      (0, S.jsxs)(`strong`, {
                        children: [M.degrees, `° turn`],
                      }),
                      (0, S.jsxs)(`small`, {
                        children: [
                          Math.max(0, Math.round(M.start - n.distance)),
                          ` m · slide: Space + steer`,
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            n.recovering > 0 &&
              (0, S.jsxs)(`div`, {
                className: `recovery-overlay`,
                children: [
                  (0, S.jsx)(`span`, { children: `Off track` }),
                  (0, S.jsx)(`p`, { children: `Returning to a safe spot` }),
                ],
              }),
            (0, S.jsxs)(`div`, {
              className: `speedometer`,
              children: [
                (0, S.jsxs)(`div`, {
                  className: `speed-number`,
                  children: [
                    Math.round(n.speed * 3.6)
                      .toString()
                      .padStart(2, `0`),
                    (0, S.jsx)(`span`, { children: `km/h` }),
                  ],
                }),
                (0, S.jsx)(`div`, { className: `speed-rule` }),
                (0, S.jsx)(`span`, {
                  className: `ride-feeling`,
                  children: n.recovering
                    ? `Returning to the road`
                    : n.edge
                      ? `Roadside · less grip`
                      : b
                        ? `Footbraking`
                        : n.speed > 16
                          ? `In the flow`
                          : `Find your rhythm`,
                }),
              ],
            }),
            (0, S.jsxs)(`div`, {
              className: `journey`,
              children: [
                (0, S.jsxs)(`div`, {
                  className: `journey-labels`,
                  children: [
                    (0, S.jsxs)(`span`, {
                      children: [
                        (0, S.jsx)(`span`, { className: `live-dot` }),
                        ` `,
                        Uo(n.time),
                      ],
                    }),
                    (0, S.jsxs)(`span`, {
                      children: [
                        (n.distance / 1e3).toFixed(1),
                        ` `,
                        (0, S.jsxs)(`span`, {
                          className: `muted`,
                          children: [
                            `/ `,
                            (d / 1e3).toLocaleString(`en-US`),
                            ` km`,
                          ],
                        }),
                      ],
                    }),
                    (0, S.jsx)(dr, { size: 15 }),
                  ],
                }),
                (0, S.jsx)($a, {
                  value: (n.distance / d) * 100,
                  "aria-label": `Route progress`,
                }),
              ],
            }),
            (0, S.jsxs)(`nav`, {
              className: `ride-controls`,
              "aria-label": `Ride controls`,
              children: [
                Wo.map(({ keys: e, label: t }) =>
                  (0, S.jsxs)(
                    `div`,
                    {
                      className: `control-item movement-control`,
                      children: [
                        (0, S.jsx)(`span`, {
                          className: `control-keys`,
                          children: e.map((e) =>
                            (0, S.jsx)(`kbd`, { children: e }, e),
                          ),
                        }),
                        (0, S.jsx)(`span`, {
                          className: `control-label`,
                          children: t,
                        }),
                      ],
                    },
                    t,
                  ),
                ),
                (0, S.jsxs)(`button`, {
                  className: `control-item`,
                  onClick: te,
                  "aria-keyshortcuts": `M`,
                  title: `Return to the center of the road`,
                  children: [
                    (0, S.jsx)(`span`, {
                      className: `control-keys`,
                      children: (0, S.jsx)(`kbd`, { children: `M` }),
                    }),
                    (0, S.jsx)(`span`, {
                      className: `control-label`,
                      children: `Back to road`,
                    }),
                  ],
                }),
                (0, S.jsxs)(`button`, {
                  className: `control-item`,
                  onClick: F,
                  "aria-keyshortcuts": `R`,
                  children: [
                    (0, S.jsx)(`span`, {
                      className: `control-keys`,
                      children: (0, S.jsx)(`kbd`, { children: `R` }),
                    }),
                    (0, S.jsx)(`span`, {
                      className: `control-label`,
                      children: `Restart`,
                    }),
                  ],
                }),
                (0, S.jsxs)(`button`, {
                  className: `control-item`,
                  onClick: V,
                  "aria-keyshortcuts": `H`,
                  children: [
                    (0, S.jsx)(`span`, {
                      className: `control-keys`,
                      children: (0, S.jsx)(`kbd`, { children: `H` }),
                    }),
                    (0, S.jsx)(`span`, {
                      className: `control-label`,
                      children: `Hide HUD`,
                    }),
                  ],
                }),
                (0, S.jsxs)(`button`, {
                  className: `control-item`,
                  onClick: B,
                  "aria-keyshortcuts": `Escape P`,
                  children: [
                    (0, S.jsx)(`span`, {
                      className: `control-keys`,
                      children: (0, S.jsx)(`kbd`, { children: `Esc / P` }),
                    }),
                    (0, S.jsx)(`span`, {
                      className: `control-label`,
                      children: i === `paused` ? `Resume` : `Pause`,
                    }),
                  ],
                }),
              ],
            }),
            (0, S.jsxs)(`div`, {
              className: `touch-controls`,
              children: [
                (0, S.jsxs)(`div`, {
                  children: [
                    (0, S.jsx)(`button`, {
                      "aria-label": `Steer left`,
                      onPointerDown: (e) => H(e, `steer`, -1),
                      onPointerUp: () => U(`steer`),
                      onPointerCancel: () => U(`steer`),
                      onLostPointerCapture: () => U(`steer`),
                      children: (0, S.jsx)(sr, {}),
                    }),
                    (0, S.jsx)(`button`, {
                      "aria-label": `Steer right`,
                      onPointerDown: (e) => H(e, `steer`, 1),
                      onPointerUp: () => U(`steer`),
                      onPointerCancel: () => U(`steer`),
                      onLostPointerCapture: () => U(`steer`),
                      children: (0, S.jsx)(cr, {}),
                    }),
                  ],
                }),
                (0, S.jsxs)(`div`, {
                  children: [
                    (0, S.jsx)(`button`, {
                      "aria-label": `Push with your foot`,
                      onPointerDown: (e) => H(e, `push`, !0),
                      onPointerUp: () => U(`push`),
                      onPointerCancel: () => U(`push`),
                      onLostPointerCapture: () => U(`push`),
                      children: (0, S.jsx)(lr, {}),
                    }),
                    (0, S.jsx)(`button`, {
                      "aria-label": `Slide`,
                      onPointerDown: (e) => H(e, `slide`, !0),
                      onPointerUp: () => U(`slide`),
                      onPointerCancel: () => U(`slide`),
                      onLostPointerCapture: () => U(`slide`),
                      children: (0, S.jsx)(hr, {}),
                    }),
                    (0, S.jsx)(`button`, {
                      "aria-label": `Brake`,
                      onPointerDown: (e) => H(e, `brake`, !0),
                      onPointerUp: () => U(`brake`),
                      onPointerCancel: () => U(`brake`),
                      onLostPointerCapture: () => U(`brake`),
                      children: (0, S.jsx)(or, {}),
                    }),
                    (0, S.jsx)(`button`, {
                      "aria-label": `Tuck to gain speed`,
                      onPointerDown: (e) => H(e, `tuck`, !0),
                      onPointerUp: () => U(`tuck`),
                      onPointerCancel: () => U(`tuck`),
                      onLostPointerCapture: () => U(`tuck`),
                      children: (0, S.jsx)(vr, {}),
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      i === `paused` &&
        (0, S.jsx)(`section`, {
          className: `game-overlay`,
          "aria-label": `Pause`,
          children: (0, S.jsxs)(`div`, {
            className: `pause-panel`,
            children: [
              (0, S.jsx)(`span`, {
                className: `eyebrow`,
                children: `TAKE YOUR TIME`,
              }),
              (0, S.jsx)(`h2`, { children: `Breathe in. Breathe out.` }),
              (0, S.jsx)(`p`, { children: `The road can wait.` }),
              (0, S.jsxs)(`button`, {
                className: `start-button`,
                onClick: () => {
                  (t.current?.togglePause(), document.activeElement?.blur());
                },
                children: [`Resume `, (0, S.jsx)(mr, { size: 19 })],
              }),
              (0, S.jsx)(`div`, {
                className: `secondary-actions`,
                children: (0, S.jsxs)(`button`, {
                  onClick: L,
                  children: [(0, S.jsx)(sr, { size: 15 }), ` Choose a section`],
                }),
              }),
              (0, S.jsxs)(`div`, {
                className: `hud-setting`,
                children: [
                  (0, S.jsxs)(`label`, {
                    htmlFor: `hud-visible`,
                    children: [
                      `Show HUD `,
                      (0, S.jsx)(`kbd`, { children: `H` }),
                    ],
                  }),
                  (0, S.jsx)(Ho, {
                    id: `hud-visible`,
                    className: `hud-toggle`,
                    checked: !D,
                    onCheckedChange: (e) => t.current?.setHudHidden(!e),
                  }),
                  (0, S.jsx)(`p`, {
                    children: `When hidden, press Esc or tap the scene on a touch screen to pause.`,
                  }),
                ],
              }),
            ],
          }),
        }),
      i === `finished` &&
        (0, S.jsx)(`section`, {
          className: `game-overlay finish`,
          children: (0, S.jsxs)(`div`, {
            className: `pause-panel`,
            children: [
              (0, S.jsx)(Xn, {
                className: `finish-mark`,
                src: `/assets/brand/rider-mark.png`,
                width: 56,
                height: 56,
                alt: ``,
              }),
              (0, S.jsx)(`span`, {
                className: `eyebrow`,
                children: `RIDE COMPLETE`,
              }),
              (0, S.jsx)(`h2`, { children: `You made it to the sea.` }),
              (0, S.jsx)(`p`, {
                children: `Let this moment linger a little longer.`,
              }),
              (0, S.jsxs)(`div`, {
                className: `finish-stats`,
                children: [
                  (0, S.jsxs)(`span`, {
                    children: [
                      (0, S.jsx)(`strong`, { children: Uo(n.time) }),
                      `ride time`,
                    ],
                  }),
                  (0, S.jsxs)(`span`, {
                    children: [
                      (0, S.jsx)(`strong`, {
                        children: Math.round(n.topSpeed * 3.6),
                      }),
                      `top speed · km/h`,
                    ],
                  }),
                  (0, S.jsxs)(`span`, {
                    children: [
                      (0, S.jsx)(`strong`, { children: j }),
                      `km traveled`,
                    ],
                  }),
                ],
              }),
              (0, S.jsxs)(`button`, {
                className: `start-button`,
                onClick: F,
                children: [`Ride again `, (0, S.jsx)(hr, { size: 20 })],
              }),
              (0, S.jsx)(`div`, {
                className: `secondary-actions finish-actions`,
                children: (0, S.jsxs)(`button`, {
                  onClick: L,
                  children: [(0, S.jsx)(sr, { size: 15 }), ` Choose a section`],
                }),
              }),
            ],
          }),
        }),
    ],
  });
}
