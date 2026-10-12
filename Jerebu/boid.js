/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * boid.js - a single agent
 */

///////////////////////////////////////////////////////////////////
// Species
// Each species is one of the pollutants in the PSI reading. How many
// there are comes from that pollutant's sub-index (see sketch.js).
// They flock a little differently and play their own synth (sound.js).
// Boids only align and group with their own species, but keep their
// distance from everyone.
///////////////////////////////////////////////////////////////////

// Motif: ash and embers. The haze is smoke from burning forest and
// peat, so the particles are drawn as ash. When one plucks a string
// it flares up like an ember for a moment, then cools back to grey.

// *** change how each species looks and behaves here
let speciesSettings = [
  // PM2.5 - fine ash dust, most of the haze. tiny, many, tight groups - pluck synth
  { name: "PM2.5", col: [200, 204, 212], r: 2.0, maxSpeed: 2.6, sep: 1.5, ali: 1.0, coh: 1.3 },
  // Ozone - rare, fast sparks - bell synth
  { name: "O3", col: [255, 196, 110], r: 3.0, maxSpeed: 3.5, sep: 1.2, ali: 1.5, coh: 0.5 },
  // PM10 - coarse ash flakes, bigger and slower - low buzz synth
  { name: "PM10", col: [140, 144, 152], r: 4.5, maxSpeed: 2.0, sep: 2.2, ali: 0.7, coh: 0.8 }
];

let emberCol = [255, 130, 50]; // *** colour when glowing

///////////////////////////////////////////////////////////////////
// Boid Class
// Manages all methods and properties of the boids.
// Adapted from the Week 6 boids template (Ashley Hi), which is based
// on Daniel Shiffman's Flocking example for p5.js.
// Our changes: species, grid neighbours, noise field + wind steering,
// energy feedback, haze slowing them down and bouncing off strings.
///////////////////////////////////////////////////////////////////

// Create main properties of boid.
function Boid(x, y, species) {
  this.species = species;
  this.settings = speciesSettings[species];

  this.acceleration = createVector(0, 0);
  this.velocity = p5.Vector.random2D();
  this.position = createVector(x, y);
  // needed to tell if the boid crossed a string since last frame
  this.prevPosition = this.position.copy();
  this.wrapped = false;

  this.r = this.settings.r;
  this.maxSpeed = this.settings.maxSpeed;
  this.maxForce = 0.08;

  this.velocity.mult(this.maxSpeed);

  // ash
  this.glow = 0; // 1 = just plucked a string, fades back to 0
  this.angle = random(TWO_PI);
  this.spin = random(-0.05, 0.05); // flakes tumble as they drift
  // every flake gets its own uneven 5 sided shape
  this.shape = [];
  for (let i = 0; i < 5; i++) {
    let a = (i / 5) * TWO_PI;
    let d = random(0.6, 1.2);
    this.shape.push(createVector(cos(a) * d, sin(a) * d));
  }
}

// Called when this boid plucks a string.
Boid.prototype.ignite = function () {
  this.glow = 1;
};

// Run all other boid methods.
Boid.prototype.run = function (neighbours, energy) {
  this.prevPosition.set(this.position);
  this.wrapped = false;

  // thick haze, heavy air: everything moves slower
  this.maxSpeed = this.settings.maxSpeed * lerp(1, 0.6, haze); // *** 0.6 = speed at PSI 300

  this.flock(neighbours, energy);
  this.update();
  this.borders();
  this.render();
};

Boid.prototype.applyForce = function (force) {
  this.acceleration.add(force);
};

// Accumulates a new acceleration each time based on 4 rules.
Boid.prototype.flock = function (neighbours, energy) {
  let sep = this.separate(neighbours); // Separation
  let ali = this.align(neighbours); // Alignment
  let coh = this.cohesion(neighbours); // Cohesion
  let flo = this.flow(); // Noise field

  // Feedback loop: the busier the music gets, the less the boids care
  // about staying together, so the flock breaks up and the music
  // thins out. Once it is quiet again, they regroup.
  // *** 12 = how much energy it takes for the flock to fully scatter
  let calm = constrain(map(energy, 0, 12, 1, 0), 0, 1);

  sep.mult(this.settings.sep);
  ali.mult(this.settings.ali * calm);
  coh.mult(this.settings.coh * calm);
  flo.mult(lerp(1.2, 0.3, calm));

  this.applyForce(sep);
  this.applyForce(ali);
  this.applyForce(coh);
  this.applyForce(flo);
};

// Update location.
Boid.prototype.update = function () {
  this.velocity.add(this.acceleration);
  this.velocity.limit(this.maxSpeed);
  this.position.add(this.velocity);

  // Reset acceleration to 0 each cycle.
  this.acceleration.mult(0);
};

// Calculates and applies a steering force towards a target.
Boid.prototype.seek = function (target) {
  // A vector pointing from the location to the target.
  let desired = p5.Vector.sub(target, this.position);

  // Normalize desired and scale to maximum speed.
  desired.normalize();
  desired.mult(this.maxSpeed);

  // Steering = Desired minus Velocity.
  let steer = p5.Vector.sub(desired, this.velocity);
  steer.limit(this.maxForce);
  return steer;
};

// Bounces the boid back off a string it just went through.
Boid.prototype.bounce = function (normal) {
  // reflect the velocity across the string: v - 2(v . n)n
  let push = p5.Vector.mult(normal, 2 * this.velocity.dot(normal));
  this.velocity.sub(push);

  // put it back on the side it came from
  this.position.set(this.prevPosition);
};

// Displays boids to canvas, as ash.
Boid.prototype.render = function () {
  this.glow *= 0.96; // *** how fast an ember cools
  this.angle += this.spin;

  // grey ash, heating towards ember orange
  let c = this.settings.col;
  let g = this.glow;
  let r = lerp(c[0], emberCol[0], g);
  let gr = lerp(c[1], emberCol[1], g);
  let b = lerp(c[2], emberCol[2], g);

  push();
  noStroke();
  translate(this.position.x, this.position.y);

  // a soft halo while it is hot
  if (g > 0.05) {
    fill(emberCol[0], emberCol[1], emberCol[2], 60 * g);
    circle(0, 0, this.r * 6 * g + this.r);
  }

  if (this.species === 2) {
    // PM10 flake: squashing it on one axis as it spins makes it look
    // like a flat flake tumbling in 3D
    rotate(this.angle);
    scale(1, 0.35 + 0.65 * abs(sin(this.angle * 0.7)));
    fill(r, gr, b, 200 + 55 * g);
    beginShape();
    for (let v of this.shape) {
      vertex(v.x * this.r, v.y * this.r);
    }
    endShape(CLOSE);
  } else if (this.species === 1) {
    // ozone spark: a tiny square that flickers
    rotate(this.angle);
    fill(r, gr, b, random(150, 255));
    square(-this.r / 2, -this.r / 2, this.r * (1 + g));
  } else {
    // PM2.5 dust: just a speck
    fill(r, gr, b, 180 + 75 * g);
    circle(0, 0, this.r * (1.2 + g));
  }
  pop();
};

// Checks borders to exit and continue from opposite side.
Boid.prototype.borders = function () {
  let before = this.position.copy();

  if (this.position.x < -this.r) this.position.x = width + this.r;
  if (this.position.y < -this.r) this.position.y = height + this.r;
  if (this.position.x > width + this.r) this.position.x = -this.r;
  if (this.position.y > height + this.r) this.position.y = -this.r;

  // a jump across the screen is not a real move, so skip string checks
  if (!this.position.equals(before)) this.wrapped = true;
};

///////////////////////////////////////////////////////////////////
// Rules of Flocking
// Same rules as the Week 6 template, but looping over neighbours
// from the grid. Alignment and cohesion only count the same species.
///////////////////////////////////////////////////////////////////

// Separation
// Checks for nearby boids and steers away.
Boid.prototype.separate = function (neighbours) {
  let desiredSeparation = 24; // *** personal space

  let steer = createVector(0, 0);
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    let d = p5.Vector.dist(this.position, other.position);

    if (d > 0 && d < desiredSeparation) {
      // Calculate vector pointing away from neighbour, weighted by distance
      let diff = p5.Vector.sub(this.position, other.position);
      diff.normalize();
      diff.div(d);
      steer.add(diff);
      count++;
    }
  }

  if (count > 0) {
    steer.div(count);
  }

  if (steer.mag() > 0) {
    // Implement Reynolds: Steering = Desired - Velocity
    steer.normalize();
    steer.mult(this.maxSpeed);
    steer.sub(this.velocity);
    steer.limit(this.maxForce);
  }

  return steer;
};

// Alignment
// For every nearby boid of the same species, calculate the average velocity.
Boid.prototype.align = function (neighbours) {
  let neighbourDist = 50; // *** keep this <= the grid cell size

  let sum = createVector(0, 0);
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other.species !== this.species) continue;

    let d = p5.Vector.dist(this.position, other.position);
    if (d > 0 && d < neighbourDist) {
      sum.add(other.velocity);
      count++;
    }
  }

  if (count > 0) {
    sum.div(count);
    sum.normalize();
    sum.mult(this.maxSpeed);
    let steer = p5.Vector.sub(sum, this.velocity);
    steer.limit(this.maxForce);
    return steer;
  } else {
    return createVector(0, 0);
  }
};

// Cohesion
// Steer towards the average location of nearby boids of the same species.
Boid.prototype.cohesion = function (neighbours) {
  let neighbourDist = 50; // *** keep this <= the grid cell size

  let sum = createVector(0, 0);
  let count = 0;

  for (let i = 0; i < neighbours.length; i++) {
    let other = neighbours[i];
    if (other.species !== this.species) continue;

    let d = p5.Vector.dist(this.position, other.position);
    if (d > 0 && d < neighbourDist) {
      sum.add(other.position);
      count++;
    }
  }

  if (count > 0) {
    sum.div(count);
    return this.seek(sum); // Steer towards the location.
  } else {
    return createVector(0, 0);
  }
};

// Noise Field + Wind
// Steer along a Perlin noise flow field, same idea as the Week 5
// flow field demo. zoff moves the field over time (see sketch.js).
// The real wind is added on top, so the swirls drift the way the
// haze is actually being blown.
Boid.prototype.flow = function () {
  let angle = noise(this.position.x * noiseScale, this.position.y * noiseScale, zoff) * TWO_PI * 2;
  let desired = p5.Vector.fromAngle(angle);
  desired.add(windDrift);
  desired.normalize();
  desired.mult(this.maxSpeed);

  let steer = p5.Vector.sub(desired, this.velocity);
  steer.limit(this.maxForce);
  return steer;
};
