/**
 * Pipeline tests against synthetic movements with known ground truth.
 * Run with:  node run-tests.mjs
 */
const core = await import(process.env.MOVEMENT_LAB_CORE ?? './.core.generated.mjs');
const { reconstruct, analyse, LM, N_LM, lowpass, derivative, jointAngle,
        fitQuadratic, fillGaps, longGapMask, unwrapDeg, percentile, longestRun } = core;

/* ---------------- synthetic camera ---------------- */
const W = 1280, H = 720, VIEW_H = 2.6, VIEW_W = VIEW_H * W / H;
const MPP_TRUE = VIEW_H / H;
const toNorm = ([x, y, z]) => [(x + VIEW_W / 2) / VIEW_W, (VIEW_H - y) / VIEW_H, 0];

/* two-link IK: knee position between hip and ankle, bulging toward +z */
function kneePos(hip, ank, L = 0.43) {
  const d = [ank[0]-hip[0], ank[1]-hip[1], ank[2]-hip[2]];
  const len = Math.hypot(...d);
  const mid = [hip[0]+d[0]/2, hip[1]+d[1]/2, hip[2]+d[2]/2];
  const bulge = Math.sqrt(Math.max(0, L*L - (len/2)**2));
  return [mid[0], mid[1], mid[2] + bulge];      // knee travels forward
}

function makePose({ hipY, toeY, pelvisDeg = 0, trunkDeg = 0, armPhi = null, forePhi = null }) {
  const P = Array.from({ length: N_LM }, () => [0, 0, 0]);
  const ankY = toeY + 0.06;
  const pr = pelvisDeg * Math.PI / 180, tr = trunkDeg * Math.PI / 180;
  const shY = hipY + 0.50;

  const put = (i, p) => { P[i] = p; };
  put(LM.hipL,  [-0.11*Math.cos(pr), hipY, -0.11*Math.sin(pr)]);
  put(LM.hipR,  [ 0.11*Math.cos(pr), hipY,  0.11*Math.sin(pr)]);
  put(LM.shoulderL, [-0.19*Math.cos(tr), shY, -0.19*Math.sin(tr)]);
  put(LM.shoulderR, [ 0.19*Math.cos(tr), shY,  0.19*Math.sin(tr)]);
  put(LM.ankleL, [-0.12, ankY, 0]); put(LM.ankleR, [0.12, ankY, 0]);
  put(LM.footL, [-0.12, toeY, 0.14]); put(LM.footR, [0.12, toeY, 0.14]);
  put(LM.heelL, [-0.12, toeY + 0.02, -0.05]); put(LM.heelR, [0.12, toeY + 0.02, -0.05]);
  put(LM.kneeL, kneePos(P[LM.hipL], P[LM.ankleL]));
  put(LM.kneeR, kneePos(P[LM.hipR], P[LM.ankleR]));

  for (const [S, sgn] of [['L', -1], ['R', 1]]) {
    const sh = P[LM['shoulder' + S]];
    const phi = (armPhi ?? 170) * Math.PI / 180;         // from +y, in the y–z plane
    const dirU = [sgn * 0.18, Math.cos(phi), Math.sin(phi)];
    const nU = Math.hypot(...dirU);
    const el = [sh[0] + 0.30*dirU[0]/nU, sh[1] + 0.30*dirU[1]/nU, sh[2] + 0.30*dirU[2]/nU];
    put(LM['elbow' + S], el);
    const psi = (forePhi ?? 170) * Math.PI / 180;
    const dirF = [sgn * 0.10, Math.cos(psi), Math.sin(psi)];
    const nF = Math.hypot(...dirF);
    const wr = [el[0] + 0.27*dirF[0]/nF, el[1] + 0.27*dirF[1]/nF, el[2] + 0.27*dirF[2]/nF];
    put(LM['wrist' + S], wr);
    put(LM['index' + S], [wr[0], wr[1] + 0.06*(dirF[1]/nF), wr[2]]);
    P[S === 'L' ? 17 : 18] = wr; P[S === 'L' ? 21 : 22] = wr;
  }
  const headY = shY + 0.24;
  put(LM.nose, [0, headY, 0.09]);
  put(LM.earL, [-0.08, headY, -0.02]); put(LM.earR, [0.08, headY, -0.02]);
  put(LM.eyeL, [-0.035, headY + 0.03, 0.07]); put(LM.eyeR, [0.035, headY + 0.03, 0.07]);
  P[1]=P[LM.eyeL]; P[3]=P[LM.eyeL]; P[4]=P[LM.eyeR]; P[6]=P[LM.eyeR];
  P[9]=[-0.03, headY-0.06, 0.07]; P[10]=[0.03, headY-0.06, 0.07];
  return P;
}

function buildRaw(frames, fps) {
  const n = frames.length;
  const t = new Float64Array(n), ok = new Uint8Array(n).fill(1);
  const normed = [], world = [], vis = [];
  frames.forEach((P, i) => {
    t[i] = i / fps;
    const hip = [(P[LM.hipL][0]+P[LM.hipR][0])/2, (P[LM.hipL][1]+P[LM.hipR][1])/2, (P[LM.hipL][2]+P[LM.hipR][2])/2];
    const nb = new Float32Array(N_LM*3), wb = new Float32Array(N_LM*3), vb = new Float32Array(N_LM).fill(1);
    for (let j = 0; j < N_LM; j++) {
      const [x, y, z] = P[j];
      const [nx, ny, nz] = toNorm([x, y, z]);
      nb[j*3]=nx; nb[j*3+1]=ny; nb[j*3+2]=nz;
      wb[j*3]= x - hip[0]; wb[j*3+1] = -(y - hip[1]); wb[j*3+2] = z - hip[2];
    }
    normed.push(nb); world.push(wb); vis.push(vb);
  });
  return { n, t, ok, normed, world, vis, fps, dt: 1/fps, videoW: W, videoH: H };
}

/* ---------------- test 1: signal primitives ---------------- */
let fails = 0;
const near = (a, b, tol, msg) => {
  const ok = Math.abs(a - b) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}: got ${Number(a).toFixed(4)}, expected ${Number(b).toFixed(4)} ±${tol}`);
};
const assert = (cond, msg) => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); };

console.log('--- primitives ---');
{
  const fs = 200, n = 400;
  const clean = Float64Array.from({length:n}, (_,i) => Math.sin(2*Math.PI*1.5*i/fs));
  const noisy = Float64Array.from(clean, (v,i) => v + 0.05*Math.sin(2*Math.PI*45*i/fs));
  const out = lowpass(noisy, 8, fs);
  let maxErr = 0;
  for (let i = 40; i < n-40; i++) maxErr = Math.max(maxErr, Math.abs(out[i]-clean[i]));
  near(maxErr, 0, 0.02, 'zero-phase low pass removes 45 Hz without lagging 1.5 Hz');

  const d = derivative(clean, 1/fs);
  const expect = 2*Math.PI*1.5;                       // derivative amplitude
  let peak = 0; for (let i = 5; i < n-5; i++) peak = Math.max(peak, d[i]);
  near(peak, expect, 0.02, 'central-difference derivative amplitude');

  near(jointAngle([0,1,0],[0,0,0],[1,0,0]), 90, 1e-9, 'joint angle of a right angle');
  near(jointAngle([0,1,0],[0,0,0],[0,-1,0]), 180, 1e-9, 'joint angle of a straight limb');

  const u = unwrapDeg([170, 179, -179, -170]);
  near(u[3], 190, 1e-9, 'heading unwrap crosses ±180 cleanly');

  // An IIR filter's state is poisoned by one NaN and never recovers; filtfilt
  // then smears it over the whole series in both directions. Caught in the wild
  // on a padel overhead: the racket hand goes behind the head for ~15 frames and
  // every metric in the clip came back empty.
  const holed = Float64Array.from(clean);
  for (let i = 100; i < 130; i++) holed[i] = NaN;
  const filtered = lowpass(holed, 8, fs);
  let finite = 0;
  for (const v of filtered) if (Number.isFinite(v)) finite++;
  near(finite, n, 0, 'a NaN run cannot poison the whole filtered series');

  const mask = longGapMask(holed, 10);
  near(mask[115], 1, 0, 'long gap is flagged');
  near(mask[50], 0, 0, 'good samples are not flagged');
  near(longGapMask(holed, 40)[115], 0, 0, 'a gap within the limit is trusted');

  const g = fillGaps([1, NaN, NaN, 4], 5);
  near(g[1], 2, 1e-9, 'gap fill interpolates');
  near(g[2], 3, 1e-9, 'gap fill interpolates');

  const f = fitQuadratic([0,1,2,3,4], [0,1,4,9,16].map(v => -4.905*v + 2*v));
  assert(f !== null, 'quadratic fit returns a solution');

  near(percentile([1,2,3,4,5,6,7,8,9,10], 0.2), 3, 1, 'percentile');
  const run = longestRun(10, i => i >= 3 && i <= 6);
  assert(run && run[0] === 3 && run[1] === 6, 'longestRun finds the airborne window');
}

/* ---------------- test 2: a jump with known physics ---------------- */
console.log('\n--- synthetic countermovement jump ---');
{
  const fps = 120, dur = 1.7, n = Math.round(dur*fps);
  const V0 = 2.5, G = 9.81;
  const T_TAKEOFF = 0.70, FLIGHT = 2*V0/G, T_LAND = T_TAKEOFF + FLIGHT;
  const STAND_HIP = 0.94, DIP_HIP = 0.66, TOE = 0.02;
  const ease = (a, b, u) => a + (b-a)*(1 - Math.cos(Math.PI*Math.min(1,Math.max(0,u))))/2;

  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = i/fps;
    let hipY, toeY = TOE;
    if (t < 0.30)      hipY = STAND_HIP;
    else if (t < 0.55) hipY = ease(STAND_HIP, DIP_HIP, (t-0.30)/0.25);
    else if (t < T_TAKEOFF) hipY = ease(DIP_HIP, 1.00, (t-0.55)/(T_TAKEOFF-0.55));
    else if (t < T_LAND) {
      const s = V0*(t-T_TAKEOFF) - 0.5*G*(t-T_TAKEOFF)**2;
      toeY = TOE + s; hipY = toeY + 0.88;
    } else {
      const u = (t - T_LAND)/0.25;
      hipY = u < 0.5 ? ease(0.98, 0.72, u*2) : ease(0.72, 0.92, (u-0.5)*2);
    }
    frames.push(makePose({ hipY, toeY }));
  }

  const raw = buildRaw(frames, fps);
  const D = reconstruct(raw, { preset: 'jump', side: 'right', smoothing: 1, heightCm: 0 });
  const R = analyse(D);
  D.events = R.events; D.phases = R.phases;
  const m = (k) => R.metrics.find(x => x.key === k)?.value;

  near(D.mpp, MPP_TRUE, MPP_TRUE*0.05, 'metres-per-pixel recovered from the athlete\'s trunk');
  near(m('flight_time'), FLIGHT*1000, 25, 'flight time (ms)');
  near(m('jump_height_flight'), G*FLIGHT*FLIGHT/8*100, 3.5, 'jump height (cm)');
  near(m('countermovement_depth'), (STAND_HIP-DIP_HIP)*100, 3, 'countermovement depth (cm)');

  const dTrue = DIP_HIP - (TOE + 0.06);
  const kneeTrue = Math.acos((0.43**2 + 0.43**2 - dTrue**2)/(2*0.43*0.43))*180/Math.PI;
  near(m('min_knee_l'), kneeTrue, 4, 'deepest knee angle (L)');
  near(m('min_knee_r'), kneeTrue, 4, 'deepest knee angle (R)');
  near(m('knee_flexion_asymmetry'), 0, 1.5, 'knee asymmetry on a symmetric jump');
  // The cosine-eased extension peaks at (rise)·pi/(2·T), not at the take-off velocity.
  const easePeak = (1.00 - DIP_HIP) * Math.PI / (2 * (T_TAKEOFF - 0.55));
  near(m('peak_hip_vertical_velocity'), easePeak, 0.15, 'peak hip rise speed (m/s)');

  const ev = Object.fromEntries(R.events.map(e => [e.key, D.t[e.i]]));
  near(ev.takeoff, T_TAKEOFF, 0.05, 'take-off frame');
  near(ev.landing, T_LAND, 0.05, 'landing frame');
  assert(R.phases.map(p => p.label).includes('Flight'), 'flight phase labelled');
}

/* ------- test 2b: the same jump with a limb occluded mid-flight ------- */
console.log('\n--- occlusion tolerance (regression) ---');
{
  const fps = 60, dur = 1.7, n = Math.round(dur*fps);
  const V0 = 2.5, G = 9.81;
  const T_TAKEOFF = 0.70, FLIGHT = 2*V0/G, T_LAND = T_TAKEOFF + FLIGHT;
  const STAND_HIP = 0.94, DIP_HIP = 0.66, TOE = 0.02;
  const ease = (a, b, u) => a + (b-a)*(1 - Math.cos(Math.PI*Math.min(1,Math.max(0,u))))/2;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = i/fps;
    let hipY, toeY = TOE;
    if (t < 0.30)      hipY = STAND_HIP;
    else if (t < 0.55) hipY = ease(STAND_HIP, DIP_HIP, (t-0.30)/0.25);
    else if (t < T_TAKEOFF) hipY = ease(DIP_HIP, 1.00, (t-0.55)/(T_TAKEOFF-0.55));
    else if (t < T_LAND) {
      const s2 = V0*(t-T_TAKEOFF) - 0.5*G*(t-T_TAKEOFF)**2;
      toeY = TOE + s2; hipY = toeY + 0.88;
    } else {
      const u = (t - T_LAND)/0.25;
      hipY = u < 0.5 ? ease(0.98, 0.72, u*2) : ease(0.72, 0.92, (u-0.5)*2);
    }
    frames.push(makePose({ hipY, toeY }));
  }
  const raw = buildRaw(frames, fps);
  // hide the right wrist for 18 frames — longer than the old 6-frame bridge
  for (let i = 40; i < 58; i++) {
    raw.vis[i][LM.wristR] = 0.1;
    for (let k = 0; k < 3; k++) { raw.normed[i][LM.wristR*3+k] = NaN; raw.world[i][LM.wristR*3+k] = NaN; }
  }
  const D = reconstruct(raw, { preset: 'jump', side: 'right', smoothing: 1, heightCm: 0 });
  const R = analyse(D);
  D.events = R.events; D.phases = R.phases;
  const m = (k) => R.metrics.find(x => x.key === k)?.value;

  near(m('jump_height_flight'), G*FLIGHT*FLIGHT/8*100, 3.5, 'jump height survives an occluded wrist');
  near(m('countermovement_depth'), (STAND_HIP-DIP_HIP)*100, 3, 'depth survives an occluded wrist');
  let kneeFinite = 0;
  for (const v of D.A.kneeR) if (Number.isFinite(v)) kneeFinite++;
  assert(kneeFinite === D.n, 'an occluded wrist does not blank unrelated joints');
  let wristFinite = 0;
  for (const v of D.V.wristDom) if (Number.isFinite(v)) wristFinite++;
  assert(wristFinite > D.n * 0.6 && wristFinite < D.n,
    `the occluded window is dropped, the rest kept (${wristFinite}/${D.n} samples)`);
  near(D.keyCoverage['hitting hand'], (D.n - 18) / D.n, 0.02, 'occlusion is reported to the user');
}

/* ---------------- test 3: proximal-to-distal sequencing ---------------- */
console.log('\n--- synthetic overhead strike ---');
{
  const fps = 240, dur = 0.9, n = Math.round(dur*fps);
  // Each segment turns fastest at its own designed instant, proximal first.
  const PEAKS = { pelvis: 0.40, trunk: 0.455, arm: 0.505, fore: 0.545 };
  const sig = (t, c, w) => 1/(1 + Math.exp(-(t-c)/w));   // smooth ramp, peak rate at c

  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = i/fps;
    const pelvisDeg = -40 + 80*sig(t, PEAKS.pelvis, 0.045);
    const trunkDeg  = -55 + 110*sig(t, PEAKS.trunk, 0.040);
    const armPhi    = 175 - 145*sig(t, PEAKS.arm,  0.038);   // upper arm sweeps overhead
    const forePhi   = 185 - 175*sig(t, PEAKS.fore, 0.032);   // forearm whips through last
    const hipY = 0.92 - 0.10*Math.exp(-(((t-0.34)/0.13)**2));
    frames.push(makePose({ hipY, toeY: 0.02, pelvisDeg, trunkDeg, armPhi, forePhi }));
  }

  const raw = buildRaw(frames, fps);
  const D = reconstruct(raw, { preset: 'smash', side: 'right', smoothing: 1, heightCm: 0 });
  const R = analyse(D);
  D.events = R.events; D.phases = R.phases;

  const times = Object.fromEntries(R.chainRows.map(r => [r.key, D.t[r.index]]));
  console.log('   peak rotation times:', Object.entries(times).map(([k,v]) => `${k}=${v.toFixed(3)}`).join('  '));
  near(times.pelvis,   PEAKS.pelvis, 0.03, 'pelvis peak timing');
  near(times.trunk,    PEAKS.trunk,  0.03, 'trunk peak timing');
  near(times.upperArm, PEAKS.arm,    0.04, 'upper-arm peak timing');
  near(times.forearm,  PEAKS.fore,   0.04, 'forearm peak timing');
  assert(R.ordered === true, 'sequence read as proximal to distal');

  const contact = D.t[R.events.find(e => e.primary).i];
  console.log(`   detected contact at ${contact.toFixed(3)} s`);
  assert(contact > PEAKS.arm && contact < PEAKS.fore + 0.10, 'contact lands in the acceleration window');

  const m = (k) => R.metrics.find(x => x.key === k)?.value;
  assert(m('peak_hand_speed') > 3 && m('peak_hand_speed') < 40, `peak hand speed is physical (${m('peak_hand_speed').toFixed(1)} m/s)`);
  assert(Number.isFinite(m('max_separation')), 'shoulder–hip separation computed');
}

/* -------- test 4: ambiguous contact, and the coach's override -------- */
console.log('\n--- contact ambiguity and pinning (regression) ---');
{
  // Shape taken from a real padel forehand: the racket drop produces a hand-speed
  // peak of its own, ~180 ms before the strike, and pose alone cannot tell them
  // apart. The app must flag it rather than silently pick the taller one.
  const fps = 60, dur = 1.6, n = Math.round(dur*fps);
  const bump = (t, c, w, h) => h * Math.exp(-(((t - c) / w) ** 2));
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = i/fps;
    // arm sweeps twice: a drop at 0.55 s and the strike at 0.75 s
    const armPhi  = 150 - 55*(1/(1+Math.exp(-(t-0.55)/0.026))) - 58*(1/(1+Math.exp(-(t-0.75)/0.030)));
    const forePhi = 165 - 62*(1/(1+Math.exp(-(t-0.55)/0.025))) - 66*(1/(1+Math.exp(-(t-0.75)/0.028)));
    const hipY = 0.92 - bump(t, 0.6, 0.25, 0.06);
    frames.push(makePose({ hipY, toeY: 0.02, pelvisDeg: -10 + 20*(1/(1+Math.exp(-(t-0.7)/0.05))),
                           trunkDeg: -14 + 28*(1/(1+Math.exp(-(t-0.72)/0.05))), armPhi, forePhi }));
  }
  const raw = buildRaw(frames, fps);
  const base = { preset: 'volley', side: 'right', smoothing: 1, heightCm: 0 };

  const D1 = reconstruct(raw, base);
  const R1 = analyse(D1);
  const pk = [...D1.V.wristDom].map((v,i)=>[D1.t[i],v]).filter(([t])=>t>0.4&&t<0.95);
  const top = Math.max(...pk.map(p=>p[1]));
  console.log('   peak hand speed', top.toFixed(2), 'm/s; trace:',
    pk.filter((_,k)=>k%4===0).map(([t,v])=>`${t.toFixed(2)}:${v.toFixed(1)}`).join(' '));
  console.log('   candidate peaks at:',
    R1.candidates.map(i => (D1.t[i]).toFixed(3) + 's').join(', ') || '(none)');
  assert(R1.candidates.length >= 2, 'a two-peak swing is flagged as ambiguous');
  assert(R1.pinned === false, 'nothing is pinned until the user pins it');

  // the coach scrubs to the real strike and pins it
  const pin = Math.round(0.78 * fps);
  const D2 = reconstruct(raw, { ...base, contactPin: pin });
  const R2 = analyse(D2);
  assert(R2.contact === pin, 'pinned frame becomes contact');
  assert(R2.pinned === true, 'the pin is reported so the UI can say so');
  const at = (R) => R.metrics.find(m => m.key === 'hand_speed_at_contact')?.value;
  assert(Number.isFinite(at(R2)) && at(R2) !== at(R1),
    'contact-relative metrics are recomputed from the pinned frame');
  const ev = R2.events.find(e => e.primary);
  near(D2.t[ev.i], pin / fps, 1e-9, 'the Contact marker moves to the pinned frame');
}

console.log(`\n${fails === 0 ? 'ALL TESTS PASSED' : fails + ' FAILURE(S)'}`);
process.exit(fails ? 1 : 0);
