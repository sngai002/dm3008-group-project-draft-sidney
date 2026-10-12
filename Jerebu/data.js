/* DM3008 Generative Art, Final Project 2026
 * Jerebu
 * data.js - live haze (PSI) and wind data
 *
 * PSI data: data.gov.sg / National Environment Agency (NEA),
 * Singapore Open Data Licence. The same readings as haze.gov.sg.
 * Wind data: Open-Meteo (https://open-meteo.com), CC BY 4.0.
 * Neither needs an API key.
 */

let psiUrl = "https://api-open.data.gov.sg/v2/real-time/api/psi";
let windUrl = "https://api.open-meteo.com/v1/forecast?latitude=1.35&longitude=103.82&current=wind_speed_10m,wind_direction_10m&timezone=Asia%2FSingapore";

let regionNames = ["north", "south", "east", "west", "central"];

///////////////////////////////////////////////////////////////////
// HazeData Object
// Three modes:
// live   - today's reading, refreshed every 10 minutes
// replay - plays back 19 Sep 2019, a real haze day, one hour every few seconds
// manual - a slider, for demos when the air is clear
// If the live data can't load, it falls back to the copy saved in data/.
///////////////////////////////////////////////////////////////////

function HazeData(replayPsi, replayWind) {
  this.mode = "live";
  this.live = null;
  this.liveSource = "loading...";
  this.lastFetch = -Infinity;
  // until the wind loads, assume the south-west monsoon, which brings
  // most of the haze to Singapore
  this.wind = { speed: 8, direction: 225 };
  this.liveWind = this.wind;

  // replay day, loaded in preload()
  this.replayItems = replayPsi.items;
  this.replayWind = replayWind.hourly;
  this.replayIndex = 0;
  this.replayTimer = millis();
  this.replayHourLength = 6000; // *** ms per hour of replay

  this.slider = createSlider(0, 400, 50, 1); // *** manual PSI range
  this.slider.position(20, 20);
  this.slider.style("width", "200px");
  this.slider.hide();
}

// Fetches today's PSI and wind. Uses callbacks so the sketch keeps
// running while it waits.
HazeData.prototype.loadLive = function () {
  let self = this;
  this.lastFetch = millis();

  loadJSON(psiUrl, function (json) {
    let item = json.data.items[0];
    self.live = makeReading(item.readings, item.timestamp);
    self.liveSource = "live from data.gov.sg";
  }, function () {
    // no internet or the API is down
    loadJSON("data/snapshot-psi.json", function (json) {
      let item = json.data.items[0];
      self.live = makeReading(item.readings, item.timestamp);
      self.liveSource = "saved copy (offline)";
    });
  });

  loadJSON(windUrl, function (json) {
    self.liveWind = { speed: json.current.wind_speed_10m, direction: json.current.wind_direction_10m };
  }, function () {
    loadJSON("data/snapshot-wind.json", function (json) {
      self.liveWind = { speed: json.current.wind_speed_10m, direction: json.current.wind_direction_10m };
    });
  });
};

HazeData.prototype.setMode = function (mode) {
  this.mode = mode;
  this.replayTimer = millis();

  if (mode === "manual") this.slider.show();
  else this.slider.hide();
};

// Called every frame. Steps through the replay and refreshes live data.
HazeData.prototype.update = function () {
  if (this.mode === "live" && millis() - this.lastFetch > 10 * 60 * 1000) {
    this.loadLive();
  }

  if (this.mode === "replay" && millis() - this.replayTimer > this.replayHourLength) {
    this.replayIndex = (this.replayIndex + 1) % this.replayItems.length;
    this.replayTimer = millis();
  }
};

// Returns the reading for the current mode, or null if nothing has loaded yet.
HazeData.prototype.current = function () {
  if (this.mode === "live") {
    this.wind = this.liveWind;
    return this.live;
  }

  if (this.mode === "replay") {
    let item = this.replayItems[this.replayIndex];
    let hour = int(item.timestamp.substring(11, 13));
    this.wind = {
      speed: this.replayWind.wind_speed_10m[hour],
      direction: this.replayWind.wind_direction_10m[hour]
    };
    return makeReading(item.readings, item.timestamp);
  }

  // manual: during haze PM2.5 is what pushes the PSI up,
  // so make the other pollutants follow it roughly
  let psi = this.slider.value();
  this.wind = this.liveWind;
  return {
    psi: psi,
    psiMin: psi,
    psiMax: psi,
    pm25: psi,
    pm10: psi * 0.6,
    o3: 20,
    time: ""
  };
};

HazeData.prototype.label = function () {
  if (this.mode === "live") return this.liveSource;
  if (this.mode === "replay") return "replay, 19 Sep 2019";
  return "manual (demo)";
};

///////////////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////////////

// Turns the API's readings into one simple object.
// Uses the average of the 5 regions, and keeps the range for the label.
// The sub-indices are each pollutant on the same 0-500 scale as PSI
// (PSI itself is just the highest one).
function makeReading(readings, timestamp) {
  let psiRegions = readings.psi_twenty_four_hourly;
  let low = Infinity;
  let high = -Infinity;
  for (let name of regionNames) {
    low = min(low, psiRegions[name]);
    high = max(high, psiRegions[name]);
  }

  return {
    psi: averageOf(psiRegions),
    psiMin: low,
    psiMax: high,
    pm25: averageOf(readings.pm25_sub_index),
    pm10: averageOf(readings.pm10_sub_index),
    o3: averageOf(readings.o3_sub_index),
    time: timestamp
  };
}

function averageOf(regions) {
  let total = 0;
  for (let name of regionNames) {
    total += regions[name];
  }
  return total / regionNames.length;
}

// NEA's health bands for the 24-hr PSI.
function psiBand(psi) {
  if (psi <= 50) return "Good";
  if (psi <= 100) return "Moderate";
  if (psi <= 200) return "Unhealthy";
  if (psi <= 300) return "Very unhealthy";
  return "Hazardous";
}

// Wind direction is where the wind comes FROM, in degrees from north.
function compassName(degrees) {
  let names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[round(degrees / 45) % 8];
}
