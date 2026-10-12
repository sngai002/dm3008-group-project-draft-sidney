/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * flock.js - manages all the boids
 */

///////////////////////////////////////////////////////////////////
// Flock Object
// Manages the array of all the boids.
// Adapted from the Week 6 boids template (Ashley Hi).
// Changed so each boid only gets its neighbours from the grid,
// instead of the whole list.
///////////////////////////////////////////////////////////////////

function Flock() {
  // Initialises an array for all the boids.
  this.boids = [];
}

Flock.prototype.addBoid = function (b) {
  this.boids.push(b);
};

Flock.prototype.count = function (species) {
  let n = 0;
  for (let i = 0; i < this.boids.length; i++) {
    if (this.boids[i].species === species) n++;
  }
  return n;
};

// Moves each species one boid closer to its target count per frame,
// so when the PSI changes the haze drifts in or thins out gradually.
// New boids come in from the edge the wind is blowing from.
Flock.prototype.adjust = function (targets) {
  for (let s = 0; s < targets.length; s++) {
    let n = this.count(s);

    if (n < targets[s]) {
      let spot = upwindSpot();
      this.addBoid(new Boid(spot.x, spot.y, s));
    } else if (n > targets[s]) {
      // remove the oldest one of this species
      for (let i = 0; i < this.boids.length; i++) {
        if (this.boids[i].species === s) {
          this.boids.splice(i, 1);
          break;
        }
      }
    }
  }
};

Flock.prototype.run = function (grid, energy) {
  // rebuild the grid first so every boid sees the same snapshot
  grid.clear();
  for (let i = 0; i < this.boids.length; i++) {
    grid.insert(this.boids[i]);
  }

  for (let i = 0; i < this.boids.length; i++) {
    let neighbours = grid.query(this.boids[i].position);
    this.boids[i].run(neighbours, energy);
  }
};
