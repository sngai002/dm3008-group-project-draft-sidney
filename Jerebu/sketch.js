/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * sketch.js - setup, draw and mouse/keyboard input
 *
 * Jerebu is Malay for haze. Today's PSI decides how many particles
 * drift onto the screen, and today's wind decides where they come
 * from. Draw strings through the haze and the particles play them.
 * Where you play, the haze thins for a moment.
 */

let flock;
let grid;
let sound;
let hazeData;
let hazeLayer;
let hand;
let strings = [];

let started = false;
let showDebug = false;

// the string being drawn with the mouse right now
let liveString = null;
let drawStart;

// noise field
let noiseScale = 0.003; // *** smaller = bigger, smoother swirls
let zoff = 0; // moves the noise field over time

// haze
let smoothPsi = 0; // starts clear, so the haze rolls in when the data loads
let haze = 0; // smoothPsi as 0 (clear) to 1 (PSI 300+), used everywhere
let windDrift; // the wind as a vector on screen
let reading = null;

let maxStrings = 8; // *** oldest string is removed after this many
let minStringLength = 40; // *** shorter lines than this are ignored
let bounceChance = 0.5; // *** chance a boid bounces off a string instead of going through

// replay data is saved in data/ so it works offline
let replayPsi;
let replayWind;

function preload() {
  replayPsi = loadJSON("data/replay-2019-09-19-psi.json");
  replayWind = loadJSON("data/replay-2019-09-19-wind.json");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(10, 10, 20);

  grid = new Grid(50); // same as the neighbour distance in boid.js
  sound = new SoundEngine();
  hazeLayer = new HazeLayer();
  hand = new HandInput();
  windDrift = createVector(0, 0);

  hazeData = new HazeData(replayPsi, replayWind);
  hazeData.loadLive();

  // a few particles to begin with, the rest drift in with the data
  flock = new Flock();
  for (let i = 0; i < 20; i++) {
    flock.addBoid(new Boid(random(width), random(height), i % speciesSettings.length));
  }
}

function draw() {
  hazeData.update();
  reading = hazeData.current();

  // ease towards the new PSI so changes roll in instead of jumping
  if (reading !== null) smoothPsi = lerp(smoothPsi, reading.psi, 0.01);
  haze = constrain(smoothPsi / 300, 0, 1);
  updateWind();
  updateScale(smoothPsi);

  // the night sky goes from deep blue to a flat grey-blue as the haze builds
  let clearSky = color(10, 10, 20);
  let hazySky = color(32, 36, 46);
  let sky = lerpColor(clearSky, hazySky, haze);
  background(red(sky), green(sky), blue(sky), 70); // low alpha leaves short trails

  // when the music is busy the noise field also churns faster
  zoff += 0.002 + sound.energy * 0.0004;

  // save every string's ends before anything moves this frame
  for (let s of strings) {
    s.update();
  }
  if (liveString !== null) {
    liveString.update();
    liveString.setEnds(drawStart.x, drawStart.y, mouseX, mouseY);
  }
  hand.update();

  if (reading !== null) flock.adjust(targetCounts());
  flock.run(grid, sound.energy);

  if (started) {
    sound.update();
    sound.setHaze(haze);
    checkPlucks();
  }

  // haze goes over the particles but under the strings,
  // so the strings are always the clearest thing on screen
  hazeLayer.update(haze, windDrift);
  hazeLayer.render();

  for (let s of strings) {
    s.render();
  }
  if (liveString !== null) {
    liveString.render();
  }
  for (let s of hand.heldStrings()) {
    s.render();
  }
  hand.render();

  if (!started) {
    drawStartScreen();
  } else {
    drawReading();
    drawInstructions();
  }

  if (showDebug) drawDebug();
}

///////////////////////////////////////////////////////////////////
// Haze -> particles
///////////////////////////////////////////////////////////////////

// How many of each species should be on screen.
// The total comes from the PSI, then it is split by how much each
// pollutant is contributing (its sub-index).
function targetCounts() {
  let total = map(smoothPsi, 0, 300, 30, 400); // *** boids at PSI 0 and PSI 300
  total = constrain(total, 30, 450);

  // same order as speciesSettings: PM2.5, O3, PM10
  let parts = [reading.pm25, reading.o3, reading.pm10];
  let sum = parts[0] + parts[1] + parts[2];

  let targets = [];
  for (let i = 0; i < parts.length; i++) {
    targets.push(max(2, round(total * parts[i] / sum)));
  }
  return targets;
}

// Turns the wind reading into a vector on screen (north = up).
// Wind direction is where it comes FROM, so the haze moves the other way.
function updateWind() {
  let w = hazeData.wind;
  let towards = radians(w.direction + 180 - 90); // -90 because p5's angle 0 points right, not up
  let strength = constrain(map(w.speed, 0, 25, 0, 1.2), 0, 1.2); // *** how much the wind pushes

  // ease it as well, so switching modes doesn't jerk the flock around
  let target = p5.Vector.fromAngle(towards);
  target.mult(strength);
  windDrift.lerp(target, 0.02);
}

// A spot just off the edge the wind is blowing from,
// so new particles arrive the way the haze does.
function upwindSpot() {
  let from = p5.Vector.fromAngle(radians(hazeData.wind.direction - 90));
  let side = createVector(-from.y, from.x);
  let reach = dist(0, 0, width, height) / 2;

  let spot = createVector(width / 2, height / 2);
  spot.add(p5.Vector.mult(from, reach));
  spot.add(p5.Vector.mult(side, random(-reach, reach)));

  spot.x = constrain(spot.x, -5, width + 5);
  spot.y = constrain(spot.y, -5, height + 5);
  return spot;
}

///////////////////////////////////////////////////////////////////
// Plucking
///////////////////////////////////////////////////////////////////

// Checks every boid against every string. Fine for a handful of strings,
// the expensive part (boid vs boid) is handled by the grid.
function checkPlucks() {
  let all = strings.concat(hand.heldStrings());
  if (liveString !== null) all.push(liveString);

  for (let s of all) {
    for (let boid of flock.boids) {
      let u = s.checkCross(boid);
      if (u < 0) continue;

      let strength = map(boid.velocity.mag(), 0, boid.maxSpeed, 2, 8);
      s.pluck(u, strength, emberCol);
      boid.ignite();

      // only notes that actually played clear the haze,
      // otherwise a crowded string would wipe out the whole fog
      if (sound.play(s, boid, u)) {
        hazeLayer.addClearing(lerp(s.a.x, s.b.x, u), lerp(s.a.y, s.b.y, u));
      }

      // placed strings sometimes knock the boid back, which can trap a
      // group between two strings and make a repeating pattern.
      // a string you are holding never does, so you can sweep through.
      if (!s.held && random() < bounceChance) {
        boid.bounce(s.normal());
      }
    }
  }
}

///////////////////////////////////////////////////////////////////
// Input
///////////////////////////////////////////////////////////////////

function mousePressed() {
  // first click turns the sound on (browsers block audio until a click)
  if (!started) {
    Tone.start();
    sound.init();
    started = true;
    // the low alpha background never fully clears, so wipe the
    // start screen once or a ghost of the title stays behind
    background(10, 10, 20);
    return;
  }

  // don't draw a string while using the slider
  if (hazeData.mode === "manual" && mouseY < 50 && mouseX < 240) return;

  drawStart = createVector(mouseX, mouseY);
  liveString = new HarpString(mouseX, mouseY, mouseX, mouseY);
  liveString.held = true;
}

function mouseReleased() {
  if (liveString === null) return;

  // let go = the string stays where it is
  if (liveString.length() >= minStringLength) {
    liveString.held = false;
    addString(liveString);
  }
  liveString = null;
}

// Places a string on the canvas. Used by the mouse and the hands.
function addString(s) {
  strings.push(s);
  if (strings.length > maxStrings) strings.shift();
}

function keyPressed() {
  if (key === "z") strings.pop(); // undo last string
  if (key === "c") strings = []; // clear all strings
  if (key === "d") showDebug = !showDebug;
  if (key === "h") hand.start(); // hand tracking
  if (key === "v") hand.showVideo = !hand.showVideo; // webcam preview

  if (key === "1") hazeData.setMode("live");
  if (key === "2") hazeData.setMode("replay");
  if (key === "3") hazeData.setMode("manual");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  hazeLayer.makeBuffer();
  background(10, 10, 20);
}

///////////////////////////////////////////////////////////////////
// Text on screen
///////////////////////////////////////////////////////////////////

function drawStartScreen() {
  push();
  fill(10, 10, 20, 150);
  noStroke();
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  fill(255);
  textSize(40);
  text("Jerebu", width / 2, height / 2 - 70);

  fill(255, 190);
  textSize(16);
  text("The haze is made of things too small to see.", width / 2, height / 2 - 15);
  text("You can't clear the air. But you can draw a line through it.", width / 2, height / 2 + 10);

  fill(255, 130);
  textSize(14);
  text("click to begin (turns on sound), then press H to play with your hands", width / 2, height / 2 + 60);
  pop();
}

// The reading, top right.
function drawReading() {
  push();
  textAlign(RIGHT, TOP);
  noStroke();
  let x = width - 20;

  fill(255, 200);
  textSize(13);
  text(hazeData.label(), x, 20);

  if (reading === null) {
    pop();
    return;
  }

  fill(255);
  textSize(22);
  let range = round(reading.psiMin) + "-" + round(reading.psiMax);
  if (reading.psiMin === reading.psiMax) range = round(reading.psi);
  text("PSI " + range, x, 40);

  fill(255, 200);
  textSize(13);
  text(psiBand(reading.psi), x, 68);
  text("wind " + nf(hazeData.wind.speed, 1, 1) + " km/h from " + compassName(hazeData.wind.direction), x, 86);
  if (reading.time !== "") {
    text(reading.time.substring(0, 10) + "  " + reading.time.substring(11, 16), x, 104);
  }
  pop();
}

// *** comment out the call in draw() to remove
function drawInstructions() {
  push();
  fill(255, 140);
  noStroke();
  textSize(13);
  if (hand.state === "on") {
    text("Hold a string between your thumb and index finger. Sweep it through the particles.", 20, height - 70);
    text("Pinch your fingers shut to leave the string behind.", 20, height - 52);
  } else {
    text("Drag to draw a string. Drag through the particles to play them.", 20, height - 70);
    text("Short strings are high, long strings are low.", 20, height - 52);
  }
  text("'h' hands   '1' live   '2' replay a haze day   '3' manual   'z' undo   'c' clear   'd' debug", 20, height - 34);
  pop();
}

function drawDebug() {
  push();
  noStroke();
  // solid box behind the numbers, otherwise the trails smear them
  fill(10, 10, 20);
  rect(10, 64, 170, 96);
  fill(255);
  textSize(13);
  text("fps: " + round(frameRate()), 20, 80);
  text("energy: " + nf(sound.energy, 1, 2), 20, 98);
  text("smooth PSI: " + nf(smoothPsi, 1, 1), 20, 116);
  text("boids: " + flock.count(0) + " / " + flock.count(1) + " / " + flock.count(2), 20, 134);
  text("strings: " + strings.length, 20, 152);
  pop();
}
