/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * strings.js - the strings the boids pluck
 */

///////////////////////////////////////////////////////////////////
// HarpString Object
// A line segment that plays a note when a boid crosses it, and
// vibrates as a standing wave. Its length sets its pitch, like a
// real string: shorter = higher.
///////////////////////////////////////////////////////////////////

function HarpString(x1, y1, x2, y2) {
  this.a = createVector(x1, y1);
  this.b = createVector(x2, y2);
  // last frame's ends, so a string that is moving (the one being
  // drawn) can still tell when it sweeps through a boid
  this.prevA = this.a.copy();
  this.prevB = this.b.copy();

  this.amp = 0; // how much it is wobbling, in pixels
  this.pluckPos = 0.5; // where along the string it was last hit (0 - 1)
  this.age = 0; // frames since the last pluck
  this.col = [255, 255, 255]; // takes the colour of whoever plucked it
  this.lastNoteTime = -1000; // millis() of the last note, for the cooldown
  this.held = false; // true while the mouse or a hand is holding it

  this.note = rootNote;
  this.updateNote();
}

// Moves the ends of the string. Used while it is being drawn.
HarpString.prototype.setEnds = function (x1, y1, x2, y2) {
  this.a.set(x1, y1);
  this.b.set(x2, y2);
  this.updateNote();
};

HarpString.prototype.length = function () {
  return p5.Vector.dist(this.a, this.b);
};

// Picks the note from the length.
// On a real string, frequency is proportional to 1 / length, so halving
// the length goes up one octave (12 semitones). Then snap to the scale.
HarpString.prototype.updateNote = function () {
  let longest = dist(0, 0, width, height) * 0.5; // *** length that plays the lowest note
  let len = max(this.length(), 1);

  let semitones = 12 * log(longest / len) / log(2);
  semitones = constrain(semitones, 0, 36); // keep it within 3 octaves

  this.note = snapToScale(rootNote + semitones);
};

// Saves this frame's ends and lets the wobble die down.
HarpString.prototype.update = function () {
  this.prevA.set(this.a);
  this.prevB.set(this.b);
  this.updateNote(); // the scale can change with the PSI

  this.amp *= 0.94; // *** how fast the wobble dies down
  this.age++;
};

// Checks if a boid went through this string since the last frame.
// Compares which side of the string the boid was on before and after.
// If the side flipped, it crossed. This works even if the string itself
// moved, because "before" uses last frame's string ends.
// Returns how far along the string it crossed (0 - 1), or -1 if it didn't.
HarpString.prototype.checkCross = function (boid) {
  if (boid.wrapped) return -1;

  let before = sideOf(this.prevA, this.prevB, boid.prevPosition);
  let after = sideOf(this.a, this.b, boid.position);
  if (before * after >= 0) return -1; // same side (or touching), no cross

  // it crossed the infinite line, now check it was between the two ends
  let ab = p5.Vector.sub(this.b, this.a);
  let ap = p5.Vector.sub(boid.position, this.a);
  let u = ap.dot(ab) / ab.magSq();
  if (u < 0 || u > 1) return -1;

  return u;
};

HarpString.prototype.pluck = function (u, strength, col) {
  // short strings wobble less, or they bend into weird shapes
  let maxAmp = min(20, this.length() * 0.06); // *** max wobble in pixels
  this.amp = min(this.amp + strength, maxAmp);
  this.pluckPos = u;
  this.age = 0;
  this.col = col;
};

// Unit vector pointing straight out from the string.
HarpString.prototype.normal = function () {
  let n = createVector(-(this.b.y - this.a.y), this.b.x - this.a.x);
  n.normalize();
  return n;
};

// Draws the string as a standing wave.
// A plucked string's shape is a sum of harmonics, sin(n * PI * s).
// Where it was plucked (u) decides how loud each harmonic is:
// sin(n * PI * u) / n^2. Plucking in the middle gives a smooth bow,
// plucking near the end gives a sharper, kinked shape.
// Each harmonic n also vibrates n times faster than the first.
HarpString.prototype.render = function () {
  let c = this.col;
  let glow = map(this.amp, 0, 20, 70, 255);

  push();
  noFill();
  stroke(lerp(200, c[0], this.amp / 20), lerp(200, c[1], this.amp / 20), lerp(220, c[2], this.amp / 20), glow);
  strokeWeight(1.5 + this.amp * 0.1);

  if (this.amp < 0.1) {
    line(this.a.x, this.a.y, this.b.x, this.b.y);
    pop();
    return;
  }

  let ab = p5.Vector.sub(this.b, this.a);
  let n = this.normal();
  let segments = 40;

  beginShape();
  for (let i = 0; i <= segments; i++) {
    let s = i / segments;
    let offset = 0;

    for (let h = 1; h <= 4; h++) { // *** number of harmonics drawn
      offset += (sin(h * PI * this.pluckPos) / (h * h)) * sin(h * PI * s) * cos(h * this.age * 0.6);
    }
    offset *= this.amp;

    vertex(this.a.x + ab.x * s + n.x * offset, this.a.y + ab.y * s + n.y * offset);
  }
  endShape();

  // small dots on the ends, like tuning pegs
  fill(255, 120);
  noStroke();
  circle(this.a.x, this.a.y, 5);
  circle(this.b.x, this.b.y, 5);
  pop();
};

///////////////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////////////

// 2D cross product of (b - a) and (p - a).
// Positive on one side of the line, negative on the other, 0 on it.
function sideOf(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
