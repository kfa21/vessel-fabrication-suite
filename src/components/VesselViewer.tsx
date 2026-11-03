import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { VesselGeo } from '../lib/engine';

type ViewOpts = { cutaway: boolean; welds: boolean; internals: boolean; transport: boolean };

const COL = {
  shell: 0x8e99a6,
  shell2: 0x82909e,
  head: 0x9fa9b5,
  nozzle: 0xa98a5f,
  manway: 0xc08f45,
  internals: 0x8fa2b6,
  tray: 0x7f8fa3,
  support: 0x5c6673,
  shipping: 0xb0763a,
  weld: 0xf0a638,
  bed: 0x5ec88a,
  liner: 0x7fb4a8,
};

function steel(color: number, clip?: THREE.Plane, ghost = false) {
  return new THREE.MeshStandardMaterial({
    color, metalness: 0.82, roughness: 0.36,
    side: ghost ? THREE.FrontSide : THREE.DoubleSide,
    clippingPlanes: clip ? [clip] : [], clipShadows: true,
    transparent: ghost, opacity: ghost ? 0.12 : 1, depthWrite: !ghost,
  });
}

function cylinder(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 72) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, true), mat);
}

function ring(r: number, tube: number, mat: THREE.Material, seg = 96) {
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg), mat);
}

/** A saddle: curved top plate under the shell, two webs, base plate and gussets.
 *  Built in world coordinates with the vessel axis on +X and the shell centre at y = 0. */
function makeSaddle(R: number, w: number, h: number, wall: number, mat: THREE.Material, bandMat: THREE.Material) {
  const g = new THREE.Group();
  const t = 0.014;
  const rOut = R + wall;

  // top plate curved to the shell (open cylinder segment, axis on X)
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(rOut + 0.006, rOut + 0.006, w, 40, 1, true, Math.PI * 1.5 - 0.62, 1.24),
    bandMat,
  );
  band.rotation.z = Math.PI / 2;
  g.add(band);

  // webs (perpendicular to the axis) run from the base plate up to the shell
  [-1, 1].forEach((s) => {
    const web = new THREE.Mesh(new THREE.BoxGeometry(t, h + 0.02, 0.34), mat);
    web.position.set(s * (w / 2 - t / 2), -(rOut + h) / 2, 0);
    g.add(web);
    const gusset = new THREE.Mesh(new THREE.BoxGeometry(t, h * 0.5, 0.18), mat);
    gusset.position.set(s * (w / 2 - t / 2 - 0.02), -(rOut + h * 0.62), 0);
    g.add(gusset);
  });

  // base plate
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.022, 0.46), mat);
  base.position.set(0, -(rOut + h), 0);
  g.add(base);

  // anchor bolts
  [-1, 1].forEach((s) => {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.10, 10), mat);
    bolt.position.set(s * (w / 2 - 0.02), -(rOut + h) + 0.05, 0.17);
    g.add(bolt);
  });
  return g;
}

/** Transportation cradle used when a vertical vessel travels lying down. */
function makeShippingSaddle(R: number, w: number, h: number, wall: number, mat: THREE.Material, padMat: THREE.Material) {
  const g = makeSaddle(R, w, h, wall, mat, mat);
  // timber cribbing between the steel cradle and the trailer deck
  const crib = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.22, 0.52), padMat);
  crib.position.set(0, -(R + wall + h) - 0.12, 0);
  g.add(crib);
  // tie-down strap over the shell
  const strap = new THREE.Mesh(
    new THREE.TorusGeometry(R + wall + 0.02, 0.012, 6, 40, Math.PI),
    padMat,
  );
  strap.rotation.y = Math.PI / 2;
  strap.rotation.z = Math.PI;
  g.add(strap);
  return g;
}

function buildModel(geo: VesselGeo, opts: ViewOpts) {
  const horiz = geo.orientation === 'H' || opts.transport;
  const R = geo.di / 2000;
  const Rtop = geo.diTop / 2000;
  const H = geo.tt / 1000;
  const skirtH = geo.support === 'Skirt' ? geo.skirtH / 1000 : 0;
  const legH = geo.support === 'Legs' ? geo.skirtH / 1000 : 0;
  const headDepthBot = geo.headBot === 'SE' ? R / 2 : 0.03;
  const headDepthTop = geo.headTop === 'SE' ? Rtop / 2 : 0.06;

  const ghost = opts.internals && !opts.cutaway && !opts.transport;
  // a quarter section reads far better than a half cut: remove the near quadrant
  // (along the axis the vessel is cut on z; the second plane takes the near top / near side)
  const clipSet = opts.cutaway
    ? [
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.002),
      horiz ? new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.002) : new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.002),
    ]
    : undefined;
  const clip = clipSet?.[0];
  const shellMat = steel(COL.shell, clip, ghost);
  const shellMat2 = steel(COL.shell2, clip, ghost);
  const headMat = steel(COL.head, clip, ghost);
  const nozMat = steel(COL.nozzle, clip, ghost);
  const mwMat = steel(COL.manway, clip, ghost);
  const intMat = steel(COL.internals, clip);
  const trayMat = steel(COL.tray, clip);
  const supMat = steel(COL.support, clip);
  const shipMat = steel(COL.shipping, clip);
  const cribMat = new THREE.MeshStandardMaterial({ color: 0x9c7648, roughness: 0.95, metalness: 0.05 });
  const weldMat = new THREE.MeshStandardMaterial({
    color: COL.weld, emissive: COL.weld, emissiveIntensity: 0.6, metalness: 0.55, roughness: 0.42,
    clippingPlanes: clipSet ?? [],
  });
  if (clipSet) {
    [shellMat, shellMat2, headMat, nozMat, mwMat, intMat, trayMat, supMat].forEach((m) => {
      m.clippingPlanes = clipSet;
      m.clipShadows = true;
      m.needsUpdate = true;
    });
  }

  /* ───────────────────────── upright vessel, bottom T/L at y = 0 ───────────────────────── */
  const vessel = new THREE.Group();

  const coneH = geo.hasCone ? Math.min(0.3, H * 0.02) : 0;
  const lower = geo.courses.filter((c) => !c.upper);
  const upper = geo.courses.filter((c) => c.upper);
  const lowerSum = lower.reduce((a, c) => a + c.h, 0) / 1000;
  const upperTarget = geo.hasCone ? Math.max(0.5, H - lowerSum - coneH) : H - lowerSum;
  const upperSum = upper.reduce((a, c) => a + c.h, 0) / 1000 || 1;
  const upperScale = upperTarget / upperSum;

  let y = 0;
  const girthYs: { y: number; r: number; t: number }[] = [];
  lower.forEach((c, i) => {
    const h = c.h / 1000;
    const mesh = cylinder(R, R, h * 0.998, i % 2 ? shellMat2 : shellMat);
    mesh.position.y = y + h / 2;
    vessel.add(mesh);
    y += h;
    girthYs.push({ y, r: R, t: c.t });
  });
  const coneBase = y;
  if (geo.hasCone) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(Rtop, R, coneH, 72, 1, true), shellMat);
    cone.position.y = coneBase + coneH / 2;
    vessel.add(cone);
    y = coneBase + coneH;
    girthYs.push({ y: coneBase, r: R, t: geo.tShell }, { y, r: Rtop, t: geo.tShellTop });
  }
  upper.forEach((c, i) => {
    const h = (c.h / 1000) * upperScale;
    const mesh = cylinder(Rtop, Rtop, h * 0.998, i % 2 ? shellMat2 : shellMat);
    mesh.position.y = y + h / 2;
    vessel.add(mesh);
    y += h;
    girthYs.push({ y, r: Rtop, t: c.t });
  });
  const topY = y;                              // top tangent line

  /* ───────────────────────── heads ───────────────────────── */
  const dishedHead = (r: number, depth: number, up: boolean) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), headMat);
    m.scale.set(1, (depth * 1.6) / r, 1);
    if (!up) m.rotation.x = Math.PI;
    return m;
  };

  if (geo.headTop === 'SE') {
    const top = dishedHead(Rtop, headDepthTop, true);
    top.position.y = topY;
    vessel.add(top);
    const sf = cylinder(Rtop, Rtop, 0.09, headMat); sf.position.y = topY - 0.045; vessel.add(sf);
  } else {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(Rtop * 1.05, Rtop * 1.05, 0.06, 72), headMat);
    cover.position.y = topY + 0.03; vessel.add(cover);
    const ringFl = ring(Rtop * 1.09, 0.028, mwMat);
    ringFl.rotation.x = Math.PI / 2; ringFl.position.y = topY; vessel.add(ringFl);
    for (let i = 0; i < 16; i++) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 8), nozMat);
      const a = (i / 16) * Math.PI * 2;
      bolt.position.set(Math.sin(a) * Rtop * 1.09, topY + 0.05, Math.cos(a) * Rtop * 1.09);
      vessel.add(bolt);
    }
  }

  if (geo.headBot === 'SE') {
    const bot = dishedHead(R, headDepthBot, false);
    bot.position.y = 0;
    vessel.add(bot);
  } else {
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.05, 72), headMat);
    bot.position.y = -0.025; vessel.add(bot);
  }

  /* ───────────────────────── nozzles ───────────────────────── */
  const radiusAt = (yy: number) => (geo.hasCone && yy > coneBase ? Rtop : R);

  geo.nozzles.forEach((nz) => {
    const rAtY = radiusAt(nz.y / 1000);
    const dir = new THREE.Vector3(Math.sin(nz.angle), 0, Math.cos(nz.angle));
    const grp = new THREE.Group();
    grp.position.set(dir.x * rAtY, nz.y / 1000, dir.z * rAtY);
    grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    const nr = nz.od / 2;
    const protrude = nz.manway ? 0.30 : 0.19;
    const neck = cylinder(nr, nr, protrude, nz.manway ? mwMat : nozMat, 28);
    neck.position.y = protrude / 2 - 0.03;
    grp.add(neck);

    const flR = nr * (nz.manway ? 1.34 : 1.62);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(flR, flR, nz.manway ? 0.075 : 0.045, 32), nz.manway ? mwMat : nozMat);
    fl.position.y = protrude - 0.05;
    grp.add(fl);

    if (nz.manway) {
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(flR * 0.92, flR * 0.92, 0.03, 32), mwMat);
      cover.position.y = protrude + 0.005; grp.add(cover);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 8), nozMat);
        bolt.position.set(Math.sin(a) * flR * 0.95, protrude + 0.02, Math.cos(a) * flR * 0.95);
        grp.add(bolt);
      }
    }
    const pad = ring(nr + 0.035, 0.008, nz.manway ? mwMat : nozMat, 32);
    pad.rotation.x = Math.PI / 2;
    pad.position.y = 0.004;
    grp.add(pad);
    // Category D weld collar at the shell junction
    if (opts.welds) {
      const collar = ring(nr + 0.004, 0.007, weldMat, 28);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.008;
      grp.add(collar);
    }
    vessel.add(grp);
  });

  /* ───────────────────────── internals ───────────────────────── */
  if (opts.internals) {
    const internalTop = topY - 0.12;
    if (geo.trayCount > 0) {
      const n = geo.trayCount;
      const show = Math.min(n, 34);
      const step = (internalTop - 0.25) / n;
      const every = Math.ceil(n / show);
      for (let i = 0; i < n; i += every) {
        const ty = 0.18 + i * step;
        const rt = radiusAt(ty) - 0.035;
        if (rt < 0.1) continue;
        // support ring welded to the shell
        const sRing = ring(rt + 0.02, 0.009, supMat, 64);
        sRing.rotation.x = Math.PI / 2; sRing.position.y = ty;
        vessel.add(sRing);
        // tray deck with a downcomer segment cut out
        const cut = 1.15;
        const deck = new THREE.Mesh(
          new THREE.CylinderGeometry(rt, rt, 0.01, 60, 1, false, (i % 2 ? 0 : Math.PI), Math.PI * 2 - cut),
          trayMat,
        );
        deck.position.y = ty;
        vessel.add(deck);
        // downcomer on the opposite side, hanging to the tray below
        const dcA = (i % 2 ? 0 : Math.PI) + (Math.PI * 2 - cut) / 2 + cut / 2;
        const dcH = Math.min(step * 0.85, 0.5);
        const dc = new THREE.Mesh(new THREE.BoxGeometry(0.012, dcH, rt * 0.55), intMat);
        dc.position.set(Math.sin(dcA) * (rt - 0.02), ty - dcH / 2, Math.cos(dcA) * (rt - 0.02));
        dc.rotation.y = dcA;
        vessel.add(dc);
        // outlet weir
        const weir = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, rt * 0.7), intMat);
        weir.position.set(Math.sin(dcA + 0.28) * (rt - 0.05), ty + 0.028, Math.cos(dcA + 0.28) * (rt - 0.05));
        weir.rotation.y = dcA + 0.28;
        vessel.add(weir);
      }
    }

    if (geo.packingBeds) {
      const beds = geo.packingBeds;
      const bedH = (topY * 0.82) / beds;
      for (let b = 0; b < beds; b++) {
        const y0 = topY * 0.1 + b * bedH;
        const rt = R - 0.03;
        const packMat = new THREE.MeshStandardMaterial({
          color: COL.bed, transparent: true, opacity: 0.26, roughness: 1,
          clippingPlanes: clipSet ?? [],
        });
        const pack = new THREE.Mesh(new THREE.CylinderGeometry(rt, rt, bedH * 0.72, 44, 1, true), packMat);
        pack.position.y = y0 + bedH / 2;
        vessel.add(pack);
        [y0, y0 + bedH * 0.74].forEach((gy) => {
          const grid = new THREE.Mesh(new THREE.CylinderGeometry(rt + 0.01, rt + 0.01, 0.016, 44), intMat);
          grid.position.y = gy; vessel.add(grid);
        });
      }
    }

    if (geo.bedDepth) {
      const bedH = Math.min(geo.bedDepth / 1000, topY * 0.62);
      const rt = R - 0.04;
      const bedMat = new THREE.MeshStandardMaterial({
        color: COL.bed, transparent: true, opacity: 0.22, roughness: 1,
        clippingPlanes: clipSet ?? [],
      });
      const bed = new THREE.Mesh(new THREE.CylinderGeometry(rt, rt, bedH, 48, 1, true), bedMat);
      bed.position.y = topY * 0.14 + bedH / 2;
      vessel.add(bed);
      // support screen, bed limiter and inert ball layer
      [topY * 0.14, topY * 0.14 + bedH].forEach((gy, i) => {
        const screen = new THREE.Mesh(new THREE.CylinderGeometry(rt + 0.02, rt + 0.02, 0.018, 48), intMat);
        screen.position.y = gy; vessel.add(screen);
        if (i === 0) {
          const balls = new THREE.Mesh(new THREE.CylinderGeometry(rt - 0.01, rt - 0.01, 0.16, 40), new THREE.MeshStandardMaterial({
            color: 0x8d8f7a, roughness: 1, transparent: true, opacity: 0.55, clippingPlanes: clipSet ?? [],
          }));
          balls.position.y = gy + 0.09; vessel.add(balls);
        }
      });
      // distribution header with laterals under the top tangent
      const headerY = topY * 0.9;
      const header = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, (rt - 0.1) * 2, 18), intMat);
      header.rotation.z = Math.PI / 2; header.position.y = headerY; vessel.add(header);
      for (let k = -2; k <= 2; k++) {
        const lat = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, (rt - 0.12) * 2, 12), intMat);
        lat.rotation.x = Math.PI / 2; lat.position.set(k * 0.22, headerY - 0.055, 0);
        vessel.add(lat);
      }
    }

    if (geo.trayCount === 0 && !geo.bedDepth && !geo.packingBeds) {
      // drums / separators: inlet baffle, mist eliminator and vortex breaker
      const baffle = new THREE.Mesh(new THREE.BoxGeometry(0.03, R * 1.25, R * 1.15), intMat);
      baffle.position.set(0, topY * 0.66, 0);
      vessel.add(baffle);
      const mistMat = new THREE.MeshStandardMaterial({
        color: 0x6f8a9e, roughness: 0.9, metalness: 0.2, transparent: true, opacity: 0.55,
        clippingPlanes: clipSet ?? [],
      });
      const mist = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.04, R - 0.04, 0.14, 44), mistMat);
      mist.position.y = topY * 0.9; vessel.add(mist);
      // mist eliminator grid bars
      for (let k = -3; k <= 3; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(R * 1.6, 0.05, 0.02), intMat);
        bar.position.set(0, topY * 0.9, k * (R * 0.28));
        vessel.add(bar);
      }
      const vb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 4), intMat);
      vb.position.y = 0.16; vessel.add(vb);
      // vortex breaker cross plates on the outlet
      const vbPlate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.35), intMat);
      vbPlate.position.y = 0.28; vessel.add(vbPlate);
    }

    if (geo.lined) {
      const rt = R - 0.012;
      const linerMat = steel(COL.liner, clip);
      (linerMat as THREE.MeshStandardMaterial).side = THREE.BackSide;
      const lin = cylinder(rt, rt, H * 0.5, linerMat);
      lin.position.y = H * 0.25;
      vessel.add(lin);
      const linHead = new THREE.Mesh(new THREE.SphereGeometry(rt, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), linerMat);
      linHead.scale.set(1, (headDepthBot * 1.6) / rt, 1);
      linHead.rotation.x = Math.PI;
      vessel.add(linHead);
    }
  }

  /* ───────────────────────── weld seams (ASME joint map) ───────────────────────── */
  if (opts.welds) {
    // Category B girth seams at every course boundary
    girthYs.forEach((g) => {
      const r = ring(g.r + g.t / 1000 + 0.004, 0.0065, weldMat, 90);
      r.rotation.x = Math.PI / 2; r.position.y = g.y;
      vessel.add(r);
    });

    // Category A longitudinal seams — one per plate in the course, staggered per UW-9
    let cy = 0;
    const allCourses = [
      ...lower.map((c) => ({ ...c, h: c.h / 1000, r: R })),
      ...upper.map((c) => ({ ...c, h: (c.h / 1000) * upperScale, r: Rtop })),
    ];
    allCourses.forEach((c, ci) => {
      const pieces = Math.max(1, c.pieces);
      const h = c.h * 0.985;
      const rad = c.r + c.t / 1000 + 0.004;
      for (let k = 0; k < pieces; k++) {
        const a = (k / pieces) * Math.PI * 2 + (ci % 2 ? Math.PI / pieces : 0);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, h, 0.022), weldMat);
        bar.position.set(Math.sin(a) * rad, cy + h / 2 + c.h * 0.008, Math.cos(a) * rad);
        bar.rotation.y = a;
        vessel.add(bar);
      }
      cy += c.h;
      if (ci === lower.length - 1 && geo.hasCone) cy += coneH;
    });

    // Category A/B head-to-shell closures
    [0, topY].forEach((yy, i) => {
      const r = ring((i ? Rtop + geo.tShellTop / 1000 : R + geo.tShell / 1000) + 0.005, 0.0075, weldMat, 90);
      r.rotation.x = Math.PI / 2; r.position.y = yy;
      vessel.add(r);
    });

    // skirt / leg attachment weld
    if (skirtH > 0) {
      const r = ring(R + 0.055, 0.008, weldMat, 80);
      r.rotation.x = Math.PI / 2; r.position.y = -0.03;
      vessel.add(r);
    }
  }

  /* ───────────────────────── permanent supports ───────────────────────── */
  if (geo.support === 'Skirt' && skirtH > 0) {
    const sk = cylinder(R + 0.06, R + 0.06, skirtH, supMat);
    sk.position.y = -skirtH / 2 - (geo.headBot === 'SE' ? 0.02 : 0);
    vessel.add(sk);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.22, R + 0.22, 0.05, 48), supMat);
    base.position.y = -skirtH; vessel.add(base);
    const gussets = 12;
    for (let i = 0; i < gussets; i++) {
      const a = (i / gussets) * Math.PI * 2;
      const gus = new THREE.Mesh(new THREE.BoxGeometry(0.02, skirtH * 0.35, 0.24), supMat);
      gus.position.set(Math.sin(a) * (R + 0.06), -skirtH + skirtH * 0.18, Math.cos(a) * (R + 0.06));
      gus.rotation.y = a;
      vessel.add(gus);
    }
  } else if (geo.support === 'Legs' && legH > 0) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, legH, 16), supMat);
      leg.position.set(Math.sin(a) * R * 0.82, -legH / 2, Math.cos(a) * R * 0.82);
      vessel.add(leg);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.22), supMat);
      pad.position.set(Math.sin(a) * R * 0.82, -legH, Math.cos(a) * R * 0.82);
      vessel.add(pad);
    }
  }

  /* ───────────────────────── vacuum stiffener rings ───────────────────────── */
  geo.stiffenerYs.forEach((sy) => {
    const r = ring(radiusAt(sy / 1000) + 0.02, 0.014, supMat, 72);
    r.rotation.x = Math.PI / 2; r.position.y = sy / 1000; vessel.add(r);
  });

  /* ───────────────────────── drop leg ───────────────────────── */
  if (geo.dropLeg && !horiz) {
    const dr = geo.dropLeg.od / 2000;
    const legH = geo.dropLeg.tt / 1000;
    const leg = new THREE.Group();
    leg.position.set(R * 0.45, -headDepthBot, 0);
    const pipe = cylinder(dr, dr, legH, shellMat, 32);
    pipe.position.y = -legH / 2;
    leg.add(pipe);
    const legHead = dishedHead(dr, dr / 2, false);
    legHead.position.y = -legH;
    leg.add(legHead);
    vessel.add(leg);
  }

  /* ───────────────────────── orient + saddles ───────────────────────── */
  const root = new THREE.Group();
  vessel.rotation.z = horiz ? -Math.PI / 2 : 0;
  root.add(vessel);

  const L = topY;                                  // shell length along the axis
  const wall = geo.tShell / 1000;
  const saddles: number[] = [];
  const active = horiz ? (opts.transport && geo.shipping ? geo.shipping : geo.saddle) : undefined;
  if (active) {
    const w = active.w / 1000;
    const h = active.h / 1000;
    active.positions.forEach((p) => {
      const g = opts.transport && geo.shipping
        ? makeShippingSaddle(R, w, h, wall, shipMat, cribMat)
        : makeSaddle(R, w, h, wall, supMat, supMat);
      g.position.x = p * L;
      root.add(g);
      saddles.push(p * L);
    });
  }



  const saddleH = active ? active.h / 1000 : 0;
  const groundY = horiz ? -(R + wall + saddleH + (opts.transport && geo.shipping ? 0.23 : 0))
    : -(skirtH || legH || headDepthBot);

  return { group: root, groundY, length: L, R: R + wall };
}

export default function VesselViewer({ geo, label }: { geo: VesselGeo; label: { id: string } }) {
  const mount = useRef<HTMLDivElement>(null);
  const [opts, setOpts] = useState<ViewOpts>({ cutaway: false, welds: true, internals: true, transport: false });
  const [focus, setFocus] = useState<'fit' | 'top' | 'mid' | 'base'>('fit');

  // a new vessel resets the transport preview and returns to the whole-vessel view
  useEffect(() => {
    setOpts((o) => ({ ...o, transport: false }));
    setFocus('fit');
  }, [geo]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const width = el.clientWidth || 600;
    const height = el.clientHeight || 440;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const { group, groundY } = buildModel(geo, opts);
    scene.add(group);

    scene.add(new THREE.HemisphereLight(0xa9c4e0, 0x1a2028, 1.2));
    const key = new THREE.DirectionalLight(0xfff0da, 2.0);
    key.position.set(14, 24, 12);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9db8d6, 1.1);
    fill.position.set(-16, 8, -12);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf0a638, 0.7);
    rim.position.set(-6, 10, 16);
    scene.add(rim);

    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());

    // interior lighting so exposed internals stay readable in section / ghost view
    if (opts.cutaway) {
      const radius = Math.max(size.x, size.y, size.z);
      const inner = new THREE.PointLight(0xffe3bd, Math.max(4, radius * 0.35), Math.max(14, radius * 2.5), 1.7);
      inner.position.set(mid.x, mid.y, mid.z);
      scene.add(inner);
      scene.add(new THREE.AmbientLight(0xdce8f5, 0.35));
    } else if (opts.internals) {
      scene.add(new THREE.AmbientLight(0xdce8f5, 0.28));
    }

    const grid = new THREE.GridHelper(Math.max(40, size.x * 1.4, size.y * 1.4), 40, 0x243040, 0x18202b);
    grid.position.y = groundY - 0.02;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);

    const axisX = size.x > size.y;
    const target = mid.clone();
    if (focus === 'top') { if (axisX) target.x = box.max.x - size.x * 0.16; else target.y = box.max.y - size.y * 0.12; }
    if (focus === 'base') { if (axisX) target.x = box.min.x + size.x * 0.16; else target.y = box.min.y + size.y * 0.14; }
    if (focus !== 'fit') target.z = 0;

    const fitH = (size.y / 2) / Math.tan((camera.fov * Math.PI) / 360);
    const fitW = (size.x / 2) / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    const distFit = Math.max(3, Math.max(fitH, fitW) * 1.35);
    const closeUp = Math.max(4, Math.min(distFit, Math.min(size.x, size.y) * 5.5));
    const dist = focus === 'fit' ? distFit : closeUp;
    const dir = new THREE.Vector3(0.55, 0.22, 0.82).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = Math.max(120, distFit * 3);
    controls.maxPolarAngle = Math.PI * 0.94;
    controls.update();

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      el.removeChild(renderer.domElement);
    };
  }, [geo, opts, focus]);

  const horiz = geo.orientation === 'H';

  return (
    <div className="viewer" ref={mount}>
      <div className="viewer-overlay">
        <div className="viewer-top">
          <button className={`btn sm ${opts.cutaway ? 'on' : ''}`} onClick={() => setOpts((o) => ({ ...o, cutaway: !o.cutaway }))}>
            ◐ Cutaway
          </button>
          <button className={`btn sm ${opts.internals ? 'on' : ''}`} onClick={() => setOpts((o) => ({ ...o, internals: !o.internals }))}
            title="Show trays, packing, beds and baffles — the shell turns translucent so internals are visible">
            ▤ Internals
          </button>
          <button className={`btn sm ${opts.welds ? 'on' : ''}`} onClick={() => setOpts((o) => ({ ...o, welds: !o.welds }))}>
            ≡ Weld seams
          </button>
          {geo.shipping && (
            <button className={`btn sm ${opts.transport ? 'on' : ''}`} onClick={() => setOpts((o) => ({ ...o, transport: !o.transport }))}
              title="Lie the vessel down on its two transportation saddles">
              ⛴ Transport saddles
            </button>
          )}
          <span style={{ width: 8 }} />
          {(['fit', 'top', 'mid', 'base'] as const).map((f) => (
            <button key={f} className={`btn sm ${focus === f ? 'on' : ''}`} onClick={() => setFocus(f)}>
              {f === 'fit' ? '⤢ Fit' : f === 'top' ? (horiz ? '→ End' : '↑ Top') : f === 'mid' ? '↕ Mid' : (horiz ? '← End' : '↓ Base')}
            </button>
          ))}
        </div>
        <div className="viewer-legend">
          <span><i style={{ background: '#8e99a6' }} />shell</span>
          <span><i style={{ background: '#a98a5f' }} />nozzles</span>
          <span><i style={{ background: '#c08f45' }} />manways</span>
          <span><i style={{ background: '#f0a638' }} />weld seams</span>
          <span><i style={{ background: '#8fa2b6' }} />internals</span>
          <span><i style={{ background: horiz ? '#5c6673' : '#b0763a' }} />{horiz ? 'saddles' : 'shipping saddles'}</span>
          <span className="viewer-hint">drag orbit · scroll zoom · right-drag pan</span>
        </div>
        <div className="viewer-dims">
          <div><b>{label.id}</b></div>
          <div>{horiz ? 'Horizontal' : 'Vertical'} · {geo.support.toLowerCase()}</div>
          <div>ID {geo.di} mm{geo.hasCone ? ` / ${geo.diTop}` : ''}</div>
          <div>{horiz ? 'T/T length' : 'T/T'} {geo.tt} mm</div>
          <div>shell {geo.tShell} mm · head {geo.tHeadBot} mm</div>
          <div>nozzles {geo.nozzles.length}{horiz ? ` · ${geo.saddle?.count ?? 0} saddles` : ''}</div>
        </div>
      </div>
    </div>
  );
}
