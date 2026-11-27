// list of stations and where they are (roughly), used to find the nearest one.
// in sprint 2/3 this list will come from the back-end instead
const STATIONS = [
  { id: "uxbridge",        name: "Uxbridge",                 lat: 51.5463, lon: -0.4786 },
  { id: "west-drayton",    name: "West Drayton",             lat: 51.5100, lon: -0.4722 },
  { id: "hayes",           name: "Hayes & Harlington",       lat: 51.5030, lon: -0.4209 },
  { id: "heathrow-t23",    name: "Heathrow Terminals 2 & 3", lat: 51.4713, lon: -0.4524 },
  { id: "ealing-broadway", name: "Ealing Broadway",          lat: 51.5150, lon: -0.3017 },
  { id: "paddington",      name: "London Paddington",        lat: 51.5154, lon: -0.1755 },
  { id: "euston",          name: "London Euston",            lat: 51.5282, lon: -0.1337 },
  { id: "kings-cross",     name: "London King's Cross",      lat: 51.5308, lon: -0.1238 },
  { id: "victoria",        name: "London Victoria",          lat: 51.4952, lon: -0.1441 },
  { id: "waterloo",        name: "London Waterloo",          lat: 51.5031, lon: -0.1132 },
  { id: "london-bridge",   name: "London Bridge",            lat: 51.5052, lon: -0.0864 },
  { id: "liverpool-st",    name: "London Liverpool Street",  lat: 51.5178, lon: -0.0823 }
];

// the text size slider goes 0 to 3, these are the sizes for each number
const TEXT_SIZES      = ["small", "medium", "large", "xlarge"];
const TEXT_SIZE_NAMES = ["Small", "Medium", "Large", "Extra large"];

// the settings the user has currently
let settings = UTSettings.load();

// these are for the microphone, kept here so it can be switched off again
let micStream = null;
let audioContext = null;
let meterFrame = null;

// getting everything from the page that we need 
const textSizeSlider  = document.getElementById("textSize");
const lineSlider      = document.getElementById("lineSpacing");
const vibrationSlider = document.getElementById("vibration");
const testVibration   = document.getElementById("testVibration");
const vibrationNote   = document.getElementById("vibrationNote");
const listenToggle    = document.getElementById("listenToggle");
const listenText      = document.getElementById("listenText");
const micMeterWrap    = document.getElementById("micMeterWrap");
const micMeter        = document.getElementById("micMeter");
const micMeterFill    = document.getElementById("micMeterFill");
const locationToggle  = document.getElementById("locationToggle");
const locationText    = document.getElementById("locationText");
const stationBox      = document.getElementById("stationBox");
const stationSelect   = document.getElementById("stationSelect");
const locationNote    = document.getElementById("locationNote");
const contrastToggle  = document.getElementById("contrastToggle");
const contrastText    = document.getElementById("contrastText");
const resetBtn        = document.getElementById("resetBtn");
const statusBox       = document.getElementById("status");
const flashOverlay    = document.getElementById("flashOverlay");

// -small functions used a lot -

// saves the setting, changes the page and shows a little message
// (screen readers read the message out too)
function saveAndApply(message) {
  UTSettings.save(settings);
  UTSettings.apply(settings);
  if (message) showStatus(message);
}

// shows the little message pop-up at the bottom for 2.5 seconds
let statusTimer;
function showStatus(message) {
  statusBox.textContent = message;
  statusBox.classList.add("show");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusBox.classList.remove("show"), 2500);
}

// works out the distance between two places in km (haversine formula)
function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// so screen readers say "Large" instead of just reading out "2"
function describeSliders() {
  textSizeSlider.setAttribute("aria-valuetext", TEXT_SIZE_NAMES[textSizeSlider.value]);
  lineSlider.setAttribute("aria-valuetext", `${Number(lineSlider.value).toFixed(1)} line spacing`);
  vibrationSlider.setAttribute("aria-valuetext",
    vibrationSlider.value === "0" ? "Off" : `${vibrationSlider.value} percent`);
}

//  Text size 
// "input" happens while you drag so the text changes as you move it
textSizeSlider.addEventListener("input", () => {
  settings.textSize = TEXT_SIZES[textSizeSlider.value];
  describeSliders();
  UTSettings.apply(settings);
});
// "change" happens when they let go of the slider that's when we save it
textSizeSlider.addEventListener("change", () => {
  saveAndApply(`Text size: ${TEXT_SIZE_NAMES[textSizeSlider.value]}`);
});

// Line spacing
lineSlider.addEventListener("input", () => {
  settings.lineSpacing = Number(lineSlider.value);
  describeSliders();
  UTSettings.apply(settings);
});
lineSlider.addEventListener("change", () => saveAndApply("Line spacing saved"));

// Vibration strength 
vibrationSlider.addEventListener("input", () => {
  settings.vibration = Number(vibrationSlider.value);
  describeSliders();
});
vibrationSlider.addEventListener("change", () => {
  saveAndApply(settings.vibration === 0 ? "Vibration off" : "Vibration strength saved");
});

// the "Test vibration" button - lets them feel what it's like
testVibration.addEventListener("click", () => {
  if (settings.vibration === 0) {
    vibrationNote.textContent = "Vibration is off. Move the slider to turn it on.";
    return;
  }
  // phones cannot vibrate harder so stronger just means longer buzzes
  const pulse = 100 + settings.vibration * 5;          // between 150ms and 600ms
  const pattern = [pulse, 150, pulse, 150, pulse];

  if ("vibrate" in navigator && navigator.vibrate(pattern)) {
    vibrationNote.textContent = "Your phone should have vibrated.";
  } else {
    // laptops and iPhones can't vibrate, so the screen flashes instead
    flashOverlay.classList.remove("flash");
    void flashOverlay.offsetWidth;                      // this restarts the flash so it plays again
    flashOverlay.classList.add("flash");
    vibrationNote.textContent = "This device can't vibrate, so the screen flashed instead.";
  }
});

// Listening
function showListening(isOn, text) {
  listenText.textContent = text;
  micMeterWrap.hidden = !isOn;
}

// turns the mic on. this is the part that makes the browser ask for permission
async function startListening() {
  // Browsers only allow the microphone on https:// or localhost
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("unsupported");
  }
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // checks how loud it is so the user can see the mic is working
  audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  audioContext.createMediaStreamSource(micStream).connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  function drawLevel() {
    analyser.getByteFrequencyData(data);
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    const level = Math.min(100, Math.round((average / 128) * 100));
    micMeterFill.style.width = level + "%";
    micMeter.setAttribute("aria-valuenow", level);
    meterFrame = requestAnimationFrame(drawLevel);
  }
  drawLevel();
  showListening(true, "Listening on");
}

// turns the mic off properly so the browser stops using it
function stopListening() {
  if (meterFrame) cancelAnimationFrame(meterFrame);
  if (micStream) micStream.getTracks().forEach((track) => track.stop());
  if (audioContext) audioContext.close();
  micStream = audioContext = meterFrame = null;
  micMeterFill.style.width = "0%";
  showListening(false, "Listening off");
}

// the Listening switch - on = start the mic, off = stop it
listenToggle.addEventListener("change", async () => {
  if (listenToggle.checked) {
    try {
      await startListening();
      settings.listening = true;
      saveAndApply("Listening turned on");
    } catch (error) {
      // this happens if they said no, there's no mic, or the page isn't on localhost
      listenToggle.checked = false;
      settings.listening = false;
      UTSettings.save(settings);
      if (error.message === "unsupported") {
        // the browser only lets the mic work on localhost or https,
        // so we give them a link to the same page on localhost
        const port = location.port ? ":" + location.port : "";
        const safeUrl = "http://localhost" + port + location.pathname;
        listenText.innerHTML = location.protocol === "file:"
          ? "Microphone only works on Live Server or localhost, not a double-clicked file."
          : `Microphone only works on localhost. <a href="${safeUrl}">Open this page on localhost</a>`;
        micMeterWrap.hidden = true;
      } else {
        // they clicked "Block", or there's no microphone
        showListening(false, "Microphone blocked. Click the 🔒 next to the address bar, allow the microphone, then try again.");
      }
      showStatus("Could not turn listening on");
    }
  } else {
    stopListening();
    settings.listening = false;
    saveAndApply("Listening turned off");
  }
});

// Location -
// puts all the stations from the list into the dropdown
STATIONS.forEach((station) => {
  const option = document.createElement("option");
  option.value = station.id;
  option.textContent = station.name;
  stationSelect.appendChild(option);
});

// gives back the station's name from its id (e.g. "uxbridge" to "Uxbridge")
function stationName(id) {
  const station = STATIONS.find((s) => s.id === id);
  return station ? station.name : "";
}

// switch on = use my location, switch off = choose my station myself
function showLocationMode() {
  locationToggle.checked = settings.useLocation;
  stationBox.hidden = settings.useLocation;
  locationText.textContent = settings.useLocation ? "Using my location" : "Choosing my station";
}

// uses the phone/laptop location to find the closest station in the list
function findNearestStation() {
  if (!("geolocation" in navigator)) {
    locationNote.textContent = "Location isn't available here. Please choose your station.";
    return;
  }
  locationNote.textContent = "Finding your nearest station…";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      let nearest = STATIONS[0];
      let nearestDistance = Infinity;
      STATIONS.forEach((station) => {
        const d = distanceKm(latitude, longitude, station.lat, station.lon);
        if (d < nearestDistance) { nearest = station; nearestDistance = d; }
      });
      settings.station = nearest.id;
      stationSelect.value = nearest.id;
      saveAndApply(`Nearest station: ${nearest.name}`);
      locationNote.textContent = `Nearest station: ${nearest.name} (${nearestDistance.toFixed(1)} km away)`;
    },
    () => {
      // if location does not workb it switches to choosing the station instead
      settings.useLocation = false;
      UTSettings.save(settings);
      showLocationMode();
      locationNote.textContent = "We couldn't get your location, so please choose your station.";
    },
    { timeout: 10000 }
  );
}

// the Location switch
locationToggle.addEventListener("change", () => {
  settings.useLocation = locationToggle.checked;
  showLocationMode();
  locationNote.textContent = "";
  saveAndApply(settings.useLocation ? "Using your location" : "Choose your station below");
  if (settings.useLocation) findNearestStation();
});

// when they pick a station from the dropdown, save it
stationSelect.addEventListener("change", () => {
  settings.station = stationSelect.value;
  locationNote.textContent = "";
  saveAndApply(settings.station ? `Station set to ${stationName(settings.station)}` : "Station cleared");
});

// Contrast
contrastToggle.addEventListener("change", () => {
  settings.contrast = contrastToggle.checked;
  contrastText.textContent = settings.contrast ? "On" : "Off";
  saveAndApply(settings.contrast ? "High contrast on" : "High contrast off");
});

//Colour-blind mode 
const colourSelect = document.getElementById("colourVision");
const COLOUR_NAMES = {
  "off": "Colour-blind mode off",
  "red-green": "Red-green colour-blind mode on",
  "blue-yellow": "Blue-yellow colour-blind mode on",
  "mono": "Greyscale mode on"
};
colourSelect.addEventListener("change", () => {
  settings.colourVision = colourSelect.value;
  saveAndApply(COLOUR_NAMES[colourSelect.value]);
});

//  Reset 
resetBtn.addEventListener("click", () => {
  stopListening();
  settings = UTSettings.reset();
  UTSettings.apply(settings);
  fillForm();
  locationNote.textContent = "";
  vibrationNote.textContent = "";
  showStatus("Settings reset to defaults");
});

// when the page opens show what was saved last time 
function fillForm() {
  textSizeSlider.value  = TEXT_SIZES.indexOf(settings.textSize);
  lineSlider.value      = settings.lineSpacing;
  vibrationSlider.value = settings.vibration;
  contrastToggle.checked = settings.contrast;
  contrastText.textContent = settings.contrast ? "On" : "Off";
  colourSelect.value = settings.colourVision;
  stationSelect.value = settings.station;
  showLocationMode();
  if (settings.useLocation && settings.station) {
    locationNote.textContent = `Last station found: ${stationName(settings.station)}`;
  }
  describeSliders();

  // the browser will not turn the mic back on by itself after a refresh
  // so the switch starts off and we remind them it was on
  listenToggle.checked = false;
  showListening(false, settings.listening ? "Listening was on – switch on to resume" : "Listening off");
}

fillForm();

// each icon and the panel it opens
const sideButtons = [
  { button: document.getElementById("btnAccount"), panel: document.getElementById("panelAccount") },
  { button: document.getElementById("btnMenu"),    panel: document.getElementById("panelMenu") }
];

// opens the panel you clicked and closes the others.
// clicking the same icon again closes it
function togglePanel(chosen) {
  sideButtons.forEach(({ button, panel }) => {
    const open = button === chosen && button.getAttribute("aria-expanded") === "false";
    button.setAttribute("aria-expanded", open);
    panel.hidden = !open;
    if (open) {
      // moves the keyboard into the panel for people not using a mouse
      const first = panel.querySelector("input, a, button");
      if (first) first.focus();
    }
  });
}
sideButtons.forEach(({ button }) => button.addEventListener("click", () => togglePanel(button)));

// pressing Esc closes the panel
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  sideButtons.forEach(({ button, panel }) => {
    if (!panel.hidden) {
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.focus();
    }
  });
});

// clicking anywhere outside the icons and panels closes them
document.addEventListener("click", (event) => {
  if (event.target.closest(".sidebar")) return;
  sideButtons.forEach(({ button, panel }) => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
});

// change password
const passwordForm = document.getElementById("passwordForm");
const currentPw    = document.getElementById("currentPw");
const newPw        = document.getElementById("newPw");
const confirmPw    = document.getElementById("confirmPw");
const showPw       = document.getElementById("showPw");
const pwMessage    = document.getElementById("pwMessage");
const strengthFill = document.getElementById("strengthFill");
const strengthText = document.getElementById("strengthText");

// the rules a new password has to pass. each one gives back true or false
const PW_RULES = {
  length: (pw) => pw.length >= 8,
  upper:  (pw) => /[A-Z]/.test(pw),
  number: (pw) => /[0-9]/.test(pw),
  symbol: (pw) => /[^A-Za-z0-9]/.test(pw)
};
// what the strength bar says and its colour, from 0 rules passed up to 4
const STRENGTH = [
  { label: "Too weak",    colour: "var(--bad)" },
  { label: "Weak",        colour: "var(--bad)" },
  { label: "Fair",        colour: "var(--warn)" },
  { label: "Good",        colour: "var(--header)" },
  { label: "Strong",      colour: "var(--ok)" }
];

// ticks off each rule and fills the strength bar while they type
newPw.addEventListener("input", () => {
  const pw = newPw.value;
  let passed = 0;
  document.querySelectorAll("#pwRules li").forEach((item) => {
    const ok = PW_RULES[item.dataset.rule](pw);
    item.classList.toggle("ok", ok);
    if (ok) passed++;
  });
  const level = pw ? passed : 0;
  strengthFill.style.width = pw ? Math.max(level, 0.5) / 4 * 100 + "%" : "0%";
  strengthFill.style.background = STRENGTH[level].colour;
  strengthText.textContent = pw ? `Strength: ${STRENGTH[level].label}` : "";
});

// clears the old message as soon as they start typing again
[currentPw, newPw, confirmPw].forEach((input) =>
  input.addEventListener("input", () => {
    pwMessage.textContent = "";
    pwMessage.className = "form-msg";
    input.removeAttribute("aria-invalid");
  })
);

// "Show passwords" tick box - switches the boxes between dots and normal text
showPw.addEventListener("change", () => {
  const type = showPw.checked ? "text" : "password";
  [currentPw, newPw, confirmPw].forEach((input) => (input.type = type));
});

// shows a message under the form and puts a red outline on the box that's wrong
function showPwMessage(text, type, field) {
  pwMessage.textContent = text;
  pwMessage.className = "form-msg " + type;
  [currentPw, newPw, confirmPw].forEach((input) => input.removeAttribute("aria-invalid"));
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

// when they press "Update password" - checks everything in order
passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();                       // stops the page from reloading
  const pw = newPw.value;

  if (!currentPw.value) {
    return showPwMessage("Please enter your current password.", "error", currentPw);
  }
  const allRulesMet = Object.values(PW_RULES).every((rule) => rule(pw));
  if (!allRulesMet) {
    return showPwMessage("Your new password doesn't meet all the rules.", "error", newPw);
  }
  if (pw === currentPw.value) {
    return showPwMessage("Your new password must be different from the current one.", "error", newPw);
  }
  if (pw !== confirmPw.value) {
    return showPwMessage("The new passwords don't match.", "error", confirmPw);
  }

  // this is only the front-end for now. in sprint 2/3 the new password gets
  // sent to the back-end here. we don't save passwords in the browser
  passwordForm.reset();
  newPw.dispatchEvent(new Event("input"));      // empties the strength bar again
  showPwMessage("Password updated.", "success");  // (this has to come after, or it gets cleared)
  showStatus("Password updated");
});
//menu log out:
document.getElementById("logoutBtn").addEventListener("click", () => {
  showStatus("You have been logged out");
  // goes to the login page after the message shows
  setTimeout(() => (window.location.href = SITE_LINKS.login || "login.html"), 1200);
});
