

const UTSettings = (function () {
  const STORAGE_KEY = "universalTravelSettings";

  // these are the settings someone gets the first time they visit
  const defaults = {
    textSize: "medium",   // small | medium | large | xlarge
    lineSpacing: 1.5,     // 1.2 (tight) to 2.2 (wide)
    vibration: 50,        // 0 (off) to 100 (strong)
    listening: false,     // microphone listening on/off
    useLocation: true,    // true = find station from location; false = choose manually
    station: "",          // chosen station id
    contrast: false,      // true = high contrast mode
    colourVision: "off"   // off | red-green | blue-yellow | mono
  };

  // this gets the saved settings. if there's nothing saved yet (or it
  // breaks) it just uses the defaults above
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...defaults, ...saved };
    } catch (error) {
      return { ...defaults };
    }
  }

  // this saves the settings in the browser so they stay after a refresh
  function save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn("Could not save settings:", error);
    }
  }

  // this puts the settings onto the page. style.css then changes
  // the look depending on what's set here
  function apply(settings) {
    const html = document.documentElement;
    html.dataset.textSize = settings.textSize;
    html.dataset.contrast = settings.contrast ? "high" : "normal";
    html.dataset.colourVision = settings.colourVision;
    html.style.setProperty("--line-height", settings.lineSpacing);
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    return { ...defaults };
  }

  // runs straight away when any page opens
  apply(load());

  return { defaults, load, save, apply, reset };
})();
