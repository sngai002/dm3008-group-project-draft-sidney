# Jerebu

*DM3008 Generative Art, Final Project (group draft)*

**Live version:** https://sngai002.github.io/dm3008-group-project-draft-sidney/

> Draft. Sections marked **TODO** still need writing by the group.

*Jerebu* is Malay for haze. Every few years, around September, the air in Singapore turns. The skyline fades to a blur, the smell of burning seeps indoors, and the city goes quiet. The haze is made of things too small to see, carried across the sea from fires in Sumatra and Kalimantan.

*Jerebu* gives those particles a body. Today's PSI reading decides how many drift onto the screen, and today's wind decides where they come from. You can't clear the air, but you can draw a line through it. Every line becomes a string, and every particle that crosses it becomes a note.

## How to run it

The easiest way is the live link above. Use Chrome, and allow the camera if you want hand tracking.

To run it on your own computer, it needs a local server. Opening `index.html` directly won't load the data files, and the webcam only works on `localhost` or HTTPS.

```bash
cd Jerebu
python3 -m http.server 8009
```

Then open http://localhost:8009. VS Code's Live Server extension also works.

### Controls

| Input | What it does |
|---|---|
| Click | Start (turns on sound) |
| Drag | Draw a string. Dragging through the particles plays them |
| `h` | Hand tracking: hold a string between your thumb and index finger, pinch shut to leave it behind |
| `v` | Show / hide the webcam preview |
| `1` / `2` / `3` | Live PSI / replay a haze day (19 Sep 2019) / manual PSI slider |
| `z` / `c` | Undo last string / clear all strings |
| `d` | Debug info |

## Creative motivation

**TODO:** Why did we make it? Who is it for? What should the audience experience? Points to cover:

- Finding something beautiful in a hard situation, without pretending the haze is good. Haze changes the *character* of the music (crowded, slow, muffled, minor) rather than making it "better".
- The act of drawing a line through the haze is the beauty. Playing briefly clears the air, but the haze always comes back.

## Implementation

**TODO:** expand each point into a paragraph.

- **Autonomous agents (Week 6):** boids (separation, alignment, cohesion), extended with three species, one for each pollutant (PM2.5, ozone, PM10), with different flocking weights.
- **Randomness and noise (Week 5):** a Perlin noise flow field steers the particles. The real wind direction is added on top. A second layer of 3D noise draws the fog.
- **Cybernetics and emergence:** a feedback loop. Busy music raises an "energy" value, which makes the flock scatter and the music thin out. When it's quiet, they regroup.
- **Waves:** plucked strings are drawn as standing waves (a sum of harmonics weighted by where the string was plucked).
- **Live data:** 24-hr PSI and pollutant sub-indices from data.gov.sg control the particle count, the species mix, the scale (major to minor above PSI 100), the low-pass filter (muffling) and the fog density. Wind from Open-Meteo sets the drift.
- **Hand tracking:** ml5.js handPose. The pinch is measured relative to palm size, and fingertips are smoothed with an adaptive filter (a simplified 1 Euro filter).
- **Performance:** a spatial hash grid so each boid only checks nearby boids instead of all of them.
- **Sound:** Tone.js polyphonic synths, one per species, then filter, delay, reverb and limiter. Pitch comes from string length (f ∝ 1/L), snapped to a pentatonic scale.

## Reflection

**TODO:** What works well? What challenges did we face? What would we change with more time?

## Credits

### Third-party code, libraries and data

- **p5.js** 1.11.11 (LGPL-2.1): https://p5js.org
- **Tone.js** 15.1.22 (MIT): https://tonejs.github.io
- **ml5.js** 1.4.0 handPose (MIT): https://ml5js.org
- **Boids:** `boid.js` and `flock.js` are adapted from the DM3008 Week 6 boids template (Ashley Hi), which is based on Daniel Shiffman's p5.js Flocking example. Craig Reynolds, *Flocks, Herds, and Schools* (1987).
- **Flow field:** based on the DM3008 Week 5 flow field demo.
- **Spatial grid:** our own implementation of bin-lattice spatial subdivision, from Daniel Shiffman, *The Nature of Code*, ch. 5, and Craig Reynolds, *Interaction with Groups of Autonomous Characters* (2000).
- **Smoothing:** a simplified version of the 1 Euro filter. Casiez, Roussel and Vogel, *1€ Filter* (CHI 2012).
- **PSI data:** National Environment Agency via data.gov.sg (Singapore Open Data Licence).
- **Wind data:** Open-Meteo, https://open-meteo.com (CC BY 4.0).

### Related artworks

**TODO:** discuss how our work relates to and differs from these:

- Andrea Polli, *Particle Falls* (2010)
- Stefanie Posavec and Miriam Quick, *Air Transformed* (2014)
- Michael Pinsky, *Pollution Pods* (2017)
- Toshio Iwai, *Electroplankton* (2005)
- Gordon Pask, *Musicolour* (1953)

### Our own work

**TODO:** state clearly which parts each member wrote, and how any AI tools were used.
