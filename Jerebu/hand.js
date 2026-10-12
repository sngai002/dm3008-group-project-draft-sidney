/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * hand.js - hand tracking with the webcam
 *
 * Uses ml5.js handPose (https://ml5js.org, MIT licence), which runs
 * Google's MediaPipe hand model in the browser. The video never
 * leaves the computer.
 */

///////////////////////////////////////////////////////////////////
// HandInput Object
// Each hand holds one string between its thumb and index fingertip.
// Spread your fingers for a long, low string, bring them closer for a
// short, high one. Sweep it through the particles to play them.
// Pinch your fingers shut to let go: the string stays where it was
// just before you pinched.
///////////////////////////////////////////////////////////////////

function HandInput() {
  this.state = "off"; // "off", "loading" or "on"
  this.results = []; // latest hands from ml5
  this.holders = {}; // one per hand, keyed by "Left" / "Right"

  this.minSmoothing = 0.35; // *** how much to ease when the hand is still (lower = less jitter)
  this.fastMove = 30; // *** px jump that counts as "fast", no easing at all past this
  this.stretch = 2.0; // *** the string reaches past your fingers by this much
  this.pinchClose = 0.25; // *** finger gap / palm size that counts as a pinch
  this.pinchOpen = 0.5; // *** has to open past this before holding a new string
  this.lostTime = 400; // *** ms a hand can go missing before its string drops
  this.showVideo = true;
}

// Turns on the camera and loads the model. Only happens when asked
// (the 'h' key), so people using the mouse never get a camera prompt.
HandInput.prototype.start = function () {
  if (this.state !== "off") return;
  this.state = "loading";

  this.video = createCapture(VIDEO);
  this.video.size(640, 480);
  this.video.hide();

  let self = this;
  // flipped so moving your hand right moves the string right, like a mirror
  this.model = ml5.handPose({ maxHands: 2, flipped: true, modelType: "lite" }, function () {
    self.model.detectStart(self.video, function (results) {
      self.results = results;
    });
    self.state = "on";
  });
};

// Called every frame, before the plucks are checked.
HandInput.prototype.update = function () {
  if (this.state !== "on") return;

  for (let hand of this.results) {
    let h = this.holders[hand.handedness];
    let thumb = this.toCanvas(hand.thumb_tip);
    let index = this.toCanvas(hand.index_finger_tip);

    // new hand, starts as pinched so it has to open to pick up a string
    if (h === undefined) {
      h = { thumb: thumb, index: index, str: null, pinched: true, history: [] };
      this.holders[hand.handedness] = h;
    }

    h.thumb = this.follow(h.thumb, thumb);
    h.index = this.follow(h.index, index);
    h.lastSeen = millis();

    // dividing by the palm size means a pinch looks the same
    // whether your hand is near the camera or far away
    let palm = dist(hand.wrist.x, hand.wrist.y, hand.index_finger_mcp.x, hand.index_finger_mcp.y);
    let gap = dist(hand.thumb_tip.x, hand.thumb_tip.y, hand.index_finger_tip.x, hand.index_finger_tip.y);
    let pinch = gap / max(palm, 1);

    if (!h.pinched && pinch < this.pinchClose) {
      this.letGo(h);
      h.pinched = true;
    } else if (h.pinched && pinch > this.pinchOpen) {
      h.pinched = false;
      let ends = this.stringEnds(h);
      h.str = new HarpString(ends[0].x, ends[0].y, ends[1].x, ends[1].y);
      h.str.held = true;
      h.history = [];
    }
  }

  for (let id in this.holders) {
    let h = this.holders[id];

    // hand left the camera, drop whatever it was holding
    if (millis() - h.lastSeen > this.lostTime) {
      delete this.holders[id];
      continue;
    }

    if (h.str !== null) {
      let ends = this.stringEnds(h);
      h.str.update();
      h.str.setEnds(ends[0].x, ends[0].y, ends[1].x, ends[1].y);

      // remember the last few frames, see letGo()
      h.history.push(ends);
      if (h.history.length > 12) h.history.shift();
    }
  }
};

// Places the string. Closing your fingers shrinks the string before
// the pinch is detected, so use the longest one from the last few frames.
HandInput.prototype.letGo = function (h) {
  if (h.str === null) return;

  let best = null;
  let bestLength = 0;
  for (let ends of h.history) {
    let len = p5.Vector.dist(ends[0], ends[1]);
    if (len > bestLength) {
      best = ends;
      bestLength = len;
    }
  }

  if (best !== null && bestLength >= minStringLength) {
    addString(new HarpString(best[0].x, best[0].y, best[1].x, best[1].y));
  }
  h.str = null;
};

// Moves a fingertip towards where the tracking says it is.
// A fixed amount of easing either jitters (too little) or lags (too much).
// So ease a lot when the hand is nearly still, where the jitter shows,
// and barely at all when it moves fast, where the lag shows.
// A simple version of the "1 Euro filter" (Casiez, Roussel & Vogel, 2012).
HandInput.prototype.follow = function (current, target) {
  let moved = p5.Vector.dist(current, target);
  let amount = constrain(map(moved, 0, this.fastMove, this.minSmoothing, 1), this.minSmoothing, 1);
  return p5.Vector.lerp(current, target, amount);
};

// The thumb to index line, stretched out from its middle.
HandInput.prototype.stringEnds = function (h) {
  let mid = p5.Vector.lerp(h.thumb, h.index, 0.5);
  let half = p5.Vector.sub(h.index, mid);
  half.mult(this.stretch);
  return [p5.Vector.sub(mid, half), p5.Vector.add(mid, half)];
};

// The strings the hands are holding right now.
HandInput.prototype.heldStrings = function () {
  let held = [];
  for (let id in this.holders) {
    if (this.holders[id].str !== null) held.push(this.holders[id].str);
  }
  return held;
};

// ml5 gives points in video pixels (640 x 480). The video is stretched
// to cover the whole canvas (cropping the sides or top), same as
// "object-fit: cover" in CSS.
HandInput.prototype.toCanvas = function (point) {
  let s = max(width / 640, height / 480);
  let offX = (width - 640 * s) / 2;
  let offY = (height - 480 * s) / 2;
  return createVector(point.x * s + offX, point.y * s + offY);
};

// Fingertips, and a small mirrored webcam view so you can see if
// your hands are being picked up.
HandInput.prototype.render = function () {
  if (this.state === "off") return;

  push();
  if (this.state === "loading") {
    fill(255, 180);
    noStroke();
    textSize(13);
    text("loading hand tracking... (allow the camera)", 20, height - 92);
    pop();
    return;
  }

  if (this.showVideo) {
    push();
    translate(width - 20, height - 140);
    scale(-1, 1); // mirror, to match the flipped hand points
    tint(255, 90);
    image(this.video, 0, 0, 160, 120);
    pop();
  }

  for (let id in this.holders) {
    let h = this.holders[id];
    noStroke();
    if (h.pinched) {
      fill(255, 220);
      circle(h.thumb.x, h.thumb.y, 14);
      circle(h.index.x, h.index.y, 14);
    } else {
      fill(255, 120);
      circle(h.thumb.x, h.thumb.y, 10);
      circle(h.index.x, h.index.y, 10);
    }
  }
  pop();
};
