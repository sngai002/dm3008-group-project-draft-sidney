/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * sound.js - synths, effects and the scale
 *
 * Uses Tone.js (https://tonejs.github.io, MIT licence) for the synths
 * and effects. The p5.sound addon is not loaded, so the two don't
 * fight over the audio context.
 */

///////////////////////////////////////////////////////////////////
// Scale
// Pentatonic has no clashing notes, so whatever the flock plays
// together still sounds fine. Clear air plays the major pentatonic,
// once the PSI goes past 100 (unhealthy) it turns minor.
///////////////////////////////////////////////////////////////////

let majorSteps = [0, 2, 4, 7, 9]; // *** clear air scale
let minorSteps = [0, 3, 5, 7, 10]; // *** hazy air scale
let scaleSteps = majorSteps;
let rootNote = 48; // *** lowest note, as a midi number (48 = C3)

function updateScale(psi) {
  if (psi > 100) scaleSteps = minorSteps;
  else scaleSteps = majorSteps;
}

// Rounds any midi number to the closest note in the scale.
function snapToScale(midi) {
  let octave = floor((midi - rootNote) / 12);
  let within = midi - rootNote - octave * 12;

  // also try the root of the next octave up, so 11.9 rounds to 12 not 9
  let best = 0;
  let steps = scaleSteps.concat([12]);
  for (let i = 0; i < steps.length; i++) {
    if (abs(steps[i] - within) < abs(best - within)) best = steps[i];
  }

  return rootNote + octave * 12 + best;
}

// Same formula p5.sound uses, so we don't need the addon for one function.
function midiToFreq(midi) {
  return 440 * pow(2, (midi - 69) / 12);
}

///////////////////////////////////////////////////////////////////
// SoundEngine Object
// One synth per species, all going through
// filter -> delay -> reverb -> limiter.
// Also keeps track of "energy", how busy the music has been lately,
// which feeds back into how the boids flock (see boid.js).
///////////////////////////////////////////////////////////////////

function SoundEngine() {
  this.ready = false;
  this.energy = 0;
  this.notesThisFrame = 0;

  this.maxNotesPerFrame = 2; // *** stops a whole flock from flooding the synths
  this.cooldown = 120; // *** ms before the same string can play again
}

// Builds the synths. Has to happen after Tone.start(), which has to
// happen after a click, because browsers block sound until then.
SoundEngine.prototype.init = function () {
  this.limiter = new Tone.Limiter(-3).toDestination();
  this.reverb = new Tone.Reverb({ decay: 5, wet: 0.4 }); // *** reverb
  this.delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.2 }); // *** echo
  this.delay.connect(this.reverb);
  this.reverb.connect(this.limiter);

  // the haze closes this filter, so the music gets muffled,
  // like hearing it through a shut window
  this.filter = new Tone.Filter(9000, "lowpass");
  this.filter.connect(this.delay);

  // *** change the sound of each species here (same order as speciesSettings)
  this.synths = [
    // PM2.5 - pluck
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.4 }
    }),
    // O3 - bell
    new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 10,
      envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 }
    }),
    // PM10 - low buzz
    new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.3 }
    })
  ];

  for (let i = 0; i < this.synths.length; i++) {
    this.synths[i].maxPolyphony = 16; // notes past this get dropped (with a console warning)
    this.synths[i].volume.value = -14;
    this.synths[i].connect(this.filter);
  }

  this.ready = true;
};

// haze: 0 (clear) to 1 (PSI 300 and up).
SoundEngine.prototype.setHaze = function (haze) {
  if (!this.ready) return;
  if (frameCount % 30 !== 0) return; // twice a second is plenty

  // exponential, because we hear pitch on a log scale:
  // 9000 Hz when clear, down to 700 Hz at PSI 300
  let cutoff = 9000 * pow(700 / 9000, haze); // *** muffle range
  this.filter.frequency.rampTo(cutoff, 1);
  this.reverb.wet.rampTo(lerp(0.3, 0.6, haze), 1);
};

// Called once a frame, before checking plucks.
SoundEngine.prototype.update = function () {
  this.notesThisFrame = 0;
  this.energy *= 0.97; // *** how fast the music "calms down"
};

// Tries to play the note for a string that a boid just crossed.
// Returns false if the note was skipped (too many notes, or cooldown).
SoundEngine.prototype.play = function (str, boid, u) {
  if (!this.ready) return false;
  if (this.notesThisFrame >= this.maxNotesPerFrame) return false;
  if (millis() - str.lastNoteTime < this.cooldown) return false;

  str.lastNoteTime = millis();
  this.notesThisFrame++;
  this.energy += 1;

  let midi = str.note;
  if (boid.species === 1) midi += 12; // ozone bells sit an octave up
  if (boid.species === 2) midi -= 12; // PM10 dust sits an octave down

  // a real string sounds brighter when plucked near the end,
  // we push that further and jump up an octave
  if (u < 0.12 || u > 0.88) midi += 12;

  // faster boids hit harder
  let velocity = constrain(map(boid.velocity.mag(), 0, boid.maxSpeed, 0.2, 0.9), 0.2, 0.9);

  this.synths[boid.species].triggerAttackRelease(midiToFreq(midi), "8n", Tone.now(), velocity);
  return true;
};
