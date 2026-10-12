/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * haze.js - the fog layer, and the clear patches you make by playing
 */

///////////////////////////////////////////////////////////////////
// HazeLayer Object
// A layer of 3D Perlin noise drawn over the boids. Its thickness comes
// from the PSI, and it drifts with the real wind.
// It is worked out on a small grid (one pixel per cell) and stretched
// up to the full canvas, which blurs it for free and keeps it fast.
//
// Every pluck opens a clear patch that slowly fills back in.
///////////////////////////////////////////////////////////////////

function HazeLayer() {
  this.cellSize = 10; // *** bigger = blurrier and faster
  this.col = [196, 206, 218]; // *** haze colour (cool, pale smoke)
  this.maxAlpha = 120; // *** how thick the fog gets at PSI 300

  this.clearings = [];
  this.maxClearings = 30;
  this.offset = createVector(0, 0); // how far the wind has pushed the fog

  this.makeBuffer();
}

// Makes the small grid. Called again if the window changes size.
HazeLayer.prototype.makeBuffer = function () {
  // at least 1, a 0 size buffer crashes if the window starts hidden
  this.cols = max(1, ceil(width / this.cellSize));
  this.rows = max(1, ceil(height / this.cellSize));
  this.buffer = createGraphics(this.cols, this.rows);
  this.buffer.pixelDensity(1);
};

HazeLayer.prototype.addClearing = function (x, y) {
  this.clearings.push({ x: x, y: y, r: 0, maxR: random(60, 110), life: 1 }); // *** patch size
  if (this.clearings.length > this.maxClearings) this.clearings.shift();
};

// amount: 0 (clear) to 1 (PSI 300 and up).
// drift: the wind vector from sketch.js.
HazeLayer.prototype.update = function (amount, drift) {
  // grow the clear patches, then let the haze fill them back in
  for (let i = this.clearings.length - 1; i >= 0; i--) {
    let c = this.clearings[i];
    c.r = lerp(c.r, c.maxR, 0.08);
    c.life -= 0.004; // *** how fast patches fill in (0.004 = about 4 seconds)
    if (c.life <= 0) this.clearings.splice(i, 1);
  }

  // subtracting the offset moves the fog the same way the wind blows
  this.offset.add(p5.Vector.mult(drift, 0.01));

  // half the frames is smooth enough for something this soft
  if (frameCount % 2 !== 0) return;

  let b = this.buffer;
  let t = frameCount * 0.002;
  b.loadPixels();

  for (let y = 0; y < this.rows; y++) {
    for (let x = 0; x < this.cols; x++) {
      // big slow clouds + smaller wisps on top
      let n = noise(x * 0.03 - this.offset.x, y * 0.03 - this.offset.y, t);
      n += 0.5 * noise(x * 0.09 - this.offset.x * 2, y * 0.09 - this.offset.y * 2, t * 2);
      let density = amount * constrain(map(n, 0.4, 1.1, 0.25, 1), 0, 1);

      // thin out the fog inside any clear patch
      let px = x * this.cellSize;
      let py = y * this.cellSize;
      for (let c of this.clearings) {
        let d = dist(px, py, c.x, c.y);
        if (d < c.r) density *= lerp(1, d / c.r, c.life);
      }

      let i = (y * this.cols + x) * 4;
      b.pixels[i] = this.col[0];
      b.pixels[i + 1] = this.col[1];
      b.pixels[i + 2] = this.col[2];
      b.pixels[i + 3] = density * this.maxAlpha;
    }
  }

  b.updatePixels();
};

HazeLayer.prototype.render = function () {
  image(this.buffer, 0, 0, width, height);
};
