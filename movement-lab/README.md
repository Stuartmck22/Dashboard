# Movement Lab

Upload a video of a movement — a padel smash, a tennis serve, a volley, a jump — and get
the body mapped, tracked and measured: a skeleton overlay with motion trails, joint-angle
charts through the movement, key-event detection, kinetic-chain sequencing, and CSV/JSON
exports that drop straight into the athlete summary sheets this repo's dashboard reads.

It is one HTML file. There is no build step, no server, no account, and **no upload** —
the clip is read from disk by your own browser and never leaves the machine.

---

## Running it

**The easy way** — double-click `index.html`. In Chrome and Edge this usually just works.

**If it doesn't** (Safari and Firefox are stricter about local files), serve the folder:

```bash
cd movement-lab
python3 -m http.server 8000
# then open http://localhost:8000
```

Chrome, Edge or Safari 16.4+. The first analysis downloads the pose model
(~6–26 MB depending on the model you pick) and the browser caches it after that.

### Offline use

Two files are fetched from the internet on first run: the pose library from jsDelivr and
the model from Google's model host. To run with no network at all:

```bash
# the model — pick lite, full or heavy
mkdir -p movement-lab/models
curl -L -o movement-lab/models/pose_landmarker_full.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task

# the library
npm pack @mediapipe/tasks-vision@0.10.14
tar xzf mediapipe-tasks-vision-0.10.14.tgz
mkdir -p movement-lab/vendor
cp package/vision_bundle.mjs movement-lab/vendor/
cp -r package/wasm movement-lab/vendor/wasm
```

`models/` is picked up automatically. For the library, point `VISION_URLS` and `WASM_URL`
at `./vendor/vision_bundle.mjs` and `./vendor/wasm` near the top of the script block.

---

## Filming

The measurement starts at the camera, not at the software.

- **One plane, perpendicular.** Side-on for a serve or a smash; front-on for a jump.
  Angles lying in the camera's plane are the accurate ones.
- **Whole body in frame**, feet included, camera still. A tripod or a wall beats hand-held.
- **Highest frame rate you have.** 120 or 240 fps slow-mo resolves a contact point; 30 fps
  does not.
- **Even light**, no shooting into the sun, no fence right in front of the lens.
- **Same setup every session** if you want to compare an athlete week to week. Camera
  position is part of the measurement.

---

## What it does

| Stage | What happens |
|---|---|
| Extract | The clip is stepped frame by frame (seeking, not playing, so nothing is silently dropped) and MediaPipe Pose Landmarker returns 33 landmarks per frame — image coordinates plus a hip-centred metric skeleton. |
| Reconstruct | Missing landmarks are bridged, image and world coordinates are composed into one Y-up metric frame, and the scale is calibrated from the athlete's own trunk length (anchored to their height if you enter it). |
| Filter | Every channel goes through a zero-phase 2nd-order Butterworth low pass — forwards then backwards, so differentiating twice for velocity doesn't smear the timing. |
| Measure | Joint angles, segment angular speeds, point speeds, shoulder–hip separation, trunk tilt. |
| Detect | Key events (contact, deepest bend, peak separation, take-off, landing) and the phases between them. |
| Report | Stat tiles, small-multiple charts, a sequencing chart, a table view of everything, and exports. |

### Movements

- **Padel smash / overhead** and **tennis serve** — contact is the fastest point of the
  hitting hand while it is above the shoulder, so a big backswing can't masquerade as the
  strike. Reports hand speed at contact, elbow and shoulder angles at contact, peak elbow
  extension speed, max shoulder–hip separation, and the kinetic-chain sequence.
- **Volley / groundstroke** — same, without the overhead constraint.
- **Jump (CMJ, hop, landing)** — flight is found from the toe leaving the floor, then
  *timed by fitting the flight parabola and solving for the two floor crossings*, which
  removes the bias a plain threshold introduces. Reports jump height, flight time,
  countermovement depth, L/R knee flexion asymmetry, peak hip rise speed, landing knee angle.
- **General movement** — every joint charted, no assumptions about phases.

### Kinetic chain sequencing

For strikes, the app finds when each segment — pelvis, trunk, upper arm, forearm — reached
peak rotation, and plots those instants relative to contact. A clean overhead runs
proximal to distal: the pelvis leads, the forearm arrives last. This is the most robust
thing the tool measures, because it depends on *timing* rather than on absolute magnitudes.

---

## Exports

| Button | File | Use |
|---|---|---|
| Angles + speeds CSV | one row per frame, every angle and velocity | plotting elsewhere, or your own stats |
| Raw landmarks CSV | 33 landmarks × (image, metric, visibility) per frame | anything the app doesn't compute |
| Summary row CSV | **one row with a `Name` column** | appends straight into the athlete-summary sheets `main-dashboard.tsx` reads |
| Full session JSON | metrics, events, phases, sequencing and all series | archiving a rep, or feeding another tool |
| Save frame as PNG | the current frame with the overlay burnt in | coaching feedback |

**Save this rep as the reference** stores a rep in the browser. Analyse another clip and
it is drawn against the reference on every chart — time-aligned on the key event, not on
clip start — with a change column in the measurements table. Same athlete over time, or an
athlete against a model you trust.

---

## What it can't tell you

Worth reading once before you make a coaching decision on a number.

- **One camera means one honest plane.** Angles in the camera's plane are trustworthy.
  Anything needing depth — shoulder–hip separation, trunk depth tilt, rotation rates — is
  inferred by the model. Read those as a trend across reps, not as absolutes.
- **Timing beats magnitude.** Sequencing and phase timings are the most robust output.
  Peak speeds and angles carry more error.
- **Frame rate sets the timing floor.** At 30 fps the true contact instant can sit ±17 ms
  from the frame marked. Slow-mo moves that to a few milliseconds.
- **Scale comes from the athlete's body.** Moving toward or away from the camera during a
  rep stretches it, so speeds from a clip with a lot of court coverage are softer numbers
  than from a static side-on clip.
- **Jump height from video is an estimate.** The parabola fit removes the threshold bias,
  but the model still sees the toe, not the force plate. Track change with it; don't
  retire the CMJ rig.
- **The model does not see the racket**, or shoulder internal/external rotation. Hand speed
  is the closest available proxy for racket-head speed.

---

## Keyboard

<kbd>Space</kbd> play / pause · <kbd>←</kbd> <kbd>→</kbd> step a frame
(<kbd>Shift</kbd> for ten) · <kbd>Home</kbd> <kbd>End</kbd> jump to the ends.
Clicking anywhere on a chart scrubs the video to that instant.

---

## Tests

`tests/` holds a Node harness that runs the analysis pipeline against synthetic movements
with known ground truth — a countermovement jump built from real projectile physics, and
an overhead strike whose segments are driven to peak at designed instants.

```bash
cd movement-lab/tests && node run-tests.mjs
```

It checks the filter, the derivatives, the angle maths, the scale recovery, flight timing,
jump height, countermovement depth, knee angles and asymmetry, and the proximal-to-distal
sequencing detection.
