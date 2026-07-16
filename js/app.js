/* ============================================
   Weather — app logic
   Two views: a starfield home page (search or
   "use my location") and a live-updating
   weather page whose background matches the
   current conditions.

   APIs (all free, no key needed):
   - Forecast:  https://open-meteo.com/en/docs
   - Geocoding: https://open-meteo.com/en/docs/geocoding-api
   - Reverse geocoding: https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api
   - IP location fallback: https://ipwho.is
   ============================================ */

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const IP_LOCATE_URL = "https://ipwho.is/";
const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"; // United States
const EC_ALERTS_URL = "https://api.weather.gc.ca/collections/alerts/items"; // Canada

// How often the weather view re-fetches fresh data.
const REFRESH_INTERVAL_MS = 7 * 1000;

// Alerts change rarely — no need to hit the alert APIs on every refresh.
const ALERTS_REFRESH_MS = 60 * 1000;

// How often the homepage city ticker refreshes.
const TICKER_REFRESH_MS = 5 * 60 * 1000;

// Major cities shown in the homepage ticker.
const TICKER_CITIES = [
  { name: "New York", country: "United States", latitude: 40.71, longitude: -74.01 },
  { name: "London", country: "United Kingdom", latitude: 51.51, longitude: -0.13 },
  { name: "Tokyo", country: "Japan", latitude: 35.68, longitude: 139.69 },
  { name: "Paris", country: "France", latitude: 48.85, longitude: 2.35 },
  { name: "Sydney", country: "Australia", latitude: -33.87, longitude: 151.21 },
  { name: "Toronto", country: "Canada", latitude: 43.65, longitude: -79.38 },
  { name: "Los Angeles", country: "United States", latitude: 34.05, longitude: -118.24 },
  { name: "Dubai", country: "United Arab Emirates", latitude: 25.2, longitude: 55.27 },
  { name: "Singapore", country: "Singapore", latitude: 1.35, longitude: 103.82 },
  { name: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.41 },
  { name: "Mumbai", country: "India", latitude: 19.08, longitude: 72.88 },
  { name: "São Paulo", country: "Brazil", latitude: -23.55, longitude: -46.63 },
  { name: "Cairo", country: "Egypt", latitude: 30.04, longitude: 31.24 },
  { name: "Mexico City", country: "Mexico", latitude: 19.43, longitude: -99.13 },
];

// WMO weather interpretation codes -> description + icon name (see icons.js)
const WEATHER_CODES = {
  0: { desc: "Clear sky", icon: "sun", nightIcon: "moon" },
  1: { desc: "Mainly clear", icon: "sun", nightIcon: "moon" },
  2: { desc: "Partly cloudy", icon: "cloud-sun", nightIcon: "cloud-moon" },
  3: { desc: "Overcast", icon: "cloud" },
  45: { desc: "Fog", icon: "fog" },
  48: { desc: "Depositing rime fog", icon: "fog" },
  51: { desc: "Light drizzle", icon: "drizzle" },
  53: { desc: "Moderate drizzle", icon: "drizzle" },
  55: { desc: "Dense drizzle", icon: "drizzle" },
  56: { desc: "Light freezing drizzle", icon: "drizzle" },
  57: { desc: "Dense freezing drizzle", icon: "drizzle" },
  61: { desc: "Slight rain", icon: "rain" },
  63: { desc: "Moderate rain", icon: "rain" },
  65: { desc: "Heavy rain", icon: "rain" },
  66: { desc: "Light freezing rain", icon: "rain" },
  67: { desc: "Heavy freezing rain", icon: "rain" },
  71: { desc: "Slight snow", icon: "snow" },
  73: { desc: "Moderate snow", icon: "snow" },
  75: { desc: "Heavy snow", icon: "snow" },
  77: { desc: "Snow grains", icon: "snow" },
  80: { desc: "Slight rain showers", icon: "rain" },
  81: { desc: "Moderate rain showers", icon: "rain" },
  82: { desc: "Violent rain showers", icon: "thunder" },
  85: { desc: "Slight snow showers", icon: "snow" },
  86: { desc: "Heavy snow showers", icon: "snow" },
  95: { desc: "Thunderstorm", icon: "thunder" },
  96: { desc: "Thunderstorm with slight hail", icon: "thunder" },
  99: { desc: "Thunderstorm with heavy hail", icon: "thunder" },
};

// ---------- App state ----------

const state = {
  unit: localStorage.getItem("weather-unit") || "celsius", // "celsius" | "fahrenheit"
  location: null,
  locationSource: null, // "ip" | "gps" | "user"
  lastUpdated: null,
  refreshTimer: null,
  agoTimer: null,
  alertsLocKey: null,
  alertKeys: null,
};

// ---------- DOM references ----------

const el = {
  homeView: document.getElementById("home-view"),
  weatherView: document.getElementById("weather-view"),
  ticker: document.getElementById("ticker"),
  tickerTrack: document.getElementById("ticker-track"),
  homeForm: document.getElementById("home-form"),
  homeInput: document.getElementById("home-input"),
  homeResults: document.getElementById("home-results"),
  homeLocate: document.getElementById("home-locate"),
  homeUnit: document.getElementById("home-unit"),
  homeStatus: document.getElementById("home-status"),
  homeButton: document.getElementById("home-button"),
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  results: document.getElementById("search-results"),
  unitToggle: document.getElementById("unit-toggle"),
  soundToggle: document.getElementById("sound-toggle"),
  status: document.getElementById("status"),
  alerts: document.getElementById("alerts"),
  alertsList: document.getElementById("alerts-list"),
  current: document.getElementById("current"),
  hourly: document.getElementById("hourly"),
  daily: document.getElementById("daily"),
  currentLocation: document.getElementById("current-location"),
  currentDate: document.getElementById("current-date"),
  liveAgo: document.getElementById("live-ago"),
  currentIcon: document.getElementById("current-icon"),
  currentTemp: document.getElementById("current-temp"),
  currentDesc: document.getElementById("current-desc"),
  currentFeels: document.getElementById("current-feels"),
  currentHumidity: document.getElementById("current-humidity"),
  windText: document.getElementById("wind-text"),
  windArrow: document.getElementById("wind-arrow"),
  currentPrecip: document.getElementById("current-precip"),
  currentSunrise: document.getElementById("current-sunrise"),
  currentSunset: document.getElementById("current-sunset"),
  hourlyList: document.getElementById("hourly-list"),
  dailyList: document.getElementById("daily-list"),
};

// ---------- Helpers ----------

function weatherInfo(code, isDay = 1) {
  const info = WEATHER_CODES[code] || { desc: "Unknown", icon: "cloud" };
  const icon = !isDay && info.nightIcon ? info.nightIcon : info.icon;
  return { desc: info.desc, icon };
}

// Which background animation matches the current conditions.
function backgroundForWeather(code, isDay) {
  if (code >= 95 || code === 82) return "thunder";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 61 && code <= 67) || code === 80 || code === 81) return "rain";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "cloudy";
  if (code === 2) return isDay ? "cloudy" : "stars";
  return isDay ? "clear-day" : "stars";
}

// Within ~40 minutes of the location's sunrise or sunset (all timestamps
// are in the location's local time, so compare against current.time).
function isTwilight(data) {
  try {
    const now = new Date(data.current.time);
    const sunrise = new Date(data.daily.sunrise[0]);
    const sunset = new Date(data.daily.sunset[0]);
    const window = 40 * 60 * 1000;
    return Math.abs(now - sunrise) < window || Math.abs(now - sunset) < window;
  } catch {
    return false;
  }
}

function unitSymbol() {
  return state.unit === "fahrenheit" ? "°F" : "°C";
}

function windUnit() {
  return state.unit === "fahrenheit" ? "mph" : "km/h";
}

function precipUnit() {
  return state.unit === "fahrenheit" ? "in" : "mm";
}

// Compass point the wind blows FROM (meteorological convention).
function compassDir(degrees) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(degrees / 45) % 8];
}

function formatLocation(loc) {
  return [loc.name, loc.admin1, loc.country].filter(Boolean).join(", ");
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHour(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric" });
}

function formatDay(isoDate, index) {
  if (index === 0) return "Today";
  return new Date(isoDate + "T00:00").toLocaleDateString([], { weekday: "long" });
}

function setHomeStatus(message) {
  el.homeStatus.textContent = message || "";
  el.homeStatus.hidden = !message;
}

function setWeatherStatus(message) {
  el.status.textContent = message || "";
  el.status.hidden = !message;
}

function showSections(visible) {
  el.alerts.hidden = !visible;
  el.current.hidden = !visible;
  el.hourly.hidden = !visible;
  el.daily.hidden = !visible;
}

// ---------- Views ----------

function showView(view) {
  el.homeView.hidden = view !== "home";
  el.weatherView.hidden = view !== "weather";
}

function goHome() {
  stopLiveUpdates();
  setHomeStatus("");
  Background.setWeather("stars");
  Sound.setScene({});
  document.body.classList.remove("day-sky");
  showView("home");
  el.homeInput.focus();
}

// Rain audio level per background scene; thunder scenes also rumble.
function soundSceneFor(bgMode) {
  if (bgMode === "thunder") return { rain: 0.28, thunder: true };
  if (bgMode === "rain") return { rain: 0.22 };
  if (bgMode === "drizzle") return { rain: 0.12 };
  return {};
}

// ---------- Live updates ----------

function startLiveUpdates() {
  stopLiveUpdates();
  state.refreshTimer = setInterval(() => {
    if (state.location) loadWeather(state.location, { silent: true });
  }, REFRESH_INTERVAL_MS);
  state.agoTimer = setInterval(updateAgo, 1000);
}

function stopLiveUpdates() {
  clearInterval(state.refreshTimer);
  clearInterval(state.agoTimer);
  state.refreshTimer = null;
  state.agoTimer = null;
}

function updateAgo() {
  if (!state.lastUpdated) return;
  const seconds = Math.floor((Date.now() - state.lastUpdated) / 1000);
  let text;
  if (seconds < 10) text = "just now";
  else if (seconds < 60) text = `${seconds}s ago`;
  else text = `${Math.floor(seconds / 60)}m ago`;
  el.liveAgo.textContent = text;
}

// ---------- API calls ----------

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function searchCities(query) {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
  const data = await fetchJson(url);
  return dedupeCities(data.results || []);
}

// The geocoding API sometimes returns near-identical entries; keep the first
// of each "name, region, country" combination.
function dedupeCities(cities) {
  const seen = new Set();
  return cities.filter((city) => {
    const key = [city.name, city.admin1, city.country].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function reverseGeocode(latitude, longitude) {
  try {
    const url = `${REVERSE_GEOCODE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const data = await fetchJson(url);
    return {
      name: data.city || data.locality || "My location",
      admin1: data.principalSubdivision || "",
      country: data.countryName || "",
      latitude,
      longitude,
    };
  } catch {
    return { name: "My location", latitude, longitude };
  }
}

async function fetchForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: "7",
    temperature_unit: state.unit,
    wind_speed_unit: state.unit === "fahrenheit" ? "mph" : "kmh",
    precipitation_unit: state.unit === "fahrenheit" ? "inch" : "mm",
  });
  return fetchJson(`${FORECAST_URL}?${params}`);
}

// ---------- Weather alerts ----------

const SEVERITY_RANK = { extreme: 0, severe: 1, moderate: 2, minor: 3 };

async function fetchNwsAlerts(latitude, longitude) {
  const data = await fetchJson(`${NWS_ALERTS_URL}?point=${latitude},${longitude}`);
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    return {
      title: p.event || p.headline || "Weather alert",
      severity: p.severity || "",
      description: p.description || "",
      until: p.ends || p.expires || "",
    };
  });
}

async function fetchEcAlerts(latitude, longitude) {
  const d = 0.1;
  const bbox = [longitude - d, latitude - d, longitude + d, latitude + d].join(",");
  const data = await fetchJson(`${EC_ALERTS_URL}?f=json&lang=en&bbox=${bbox}`);
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    return {
      title: p.headline || p.alert_type || "Weather alert",
      severity: p.severity || "",
      description: p.descrip || p.description || "",
      until: p.expires || p.expiry || "",
    };
  });
}

// Returns a sorted alert list, or null when the region has no alert provider.
async function fetchAlerts(location) {
  const country = (location.country || "").toLowerCase();
  const tasks = [];
  if (!country || country.includes("united states")) {
    tasks.push(fetchNwsAlerts(location.latitude, location.longitude));
  }
  if (!country || country.includes("canada")) {
    tasks.push(fetchEcAlerts(location.latitude, location.longitude));
  }
  if (tasks.length === 0) return null;
  const settled = await Promise.allSettled(tasks);
  const alerts = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  // Dedupe identical alerts, then most severe first.
  const seen = new Set();
  const unique = alerts.filter((a) => {
    const key = `${a.title}|${a.until}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort(
    (a, b) =>
      (SEVERITY_RANK[(a.severity || "").toLowerCase()] ?? 4) -
      (SEVERITY_RANK[(b.severity || "").toLowerCase()] ?? 4),
  );
}

function severityClass(severity) {
  const s = (severity || "").toLowerCase();
  if (s === "extreme" || s === "severe") return "alert--severe";
  if (s === "moderate") return "alert--moderate";
  return "alert--minor";
}

// Built with DOM nodes (not innerHTML) since alert text is external data.
function renderAlerts(alerts) {
  el.alertsList.innerHTML = "";
  if (alerts === null || alerts.length === 0) {
    const p = document.createElement("p");
    p.className = "alerts__empty";
    p.textContent =
      alerts === null
        ? "Alerts aren't available for this region yet (US and Canada only for now)."
        : "No active alerts for this area.";
    el.alertsList.appendChild(p);
    return;
  }
  for (const alert of alerts) {
    const box = document.createElement("div");
    box.className = `alert ${severityClass(alert.severity)}`;

    const head = document.createElement("div");
    head.className = "alert__head";
    const title = document.createElement("strong");
    title.textContent = alert.title;
    head.appendChild(title);
    if (alert.severity) {
      const sev = document.createElement("span");
      sev.className = "alert__severity";
      sev.textContent = alert.severity;
      head.appendChild(sev);
    }
    box.appendChild(head);

    if (alert.until) {
      const until = document.createElement("p");
      until.className = "alert__until";
      until.textContent = `Until ${new Date(alert.until).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`;
      box.appendChild(until);
    }

    if (alert.description) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Details";
      const desc = document.createElement("p");
      desc.className = "alert__desc";
      desc.textContent = alert.description;
      details.appendChild(summary);
      details.appendChild(desc);
      box.appendChild(details);
    }

    el.alertsList.appendChild(box);
  }
}

async function loadAlerts(location) {
  try {
    const alerts = await fetchAlerts(location);
    if (state.location !== location) return; // user moved on mid-fetch
    // Chime softly when a NEW alert appears while watching this place.
    const locKey = `${location.latitude},${location.longitude}`;
    const keys = new Set((alerts || []).map((a) => `${a.title}|${a.until}`));
    if (state.alertsLocKey === locKey && state.alertKeys) {
      for (const key of keys) {
        if (!state.alertKeys.has(key)) {
          Sound.bell();
          break;
        }
      }
    }
    state.alertsLocKey = locKey;
    state.alertKeys = keys;
    renderAlerts(alerts);
  } catch (error) {
    console.error(error);
    if (state.location === location) renderAlerts([]);
  }
}

// ---------- Rendering ----------

function renderCurrent(data, location) {
  const { current, daily } = data;
  const info = weatherInfo(current.weather_code, current.is_day);

  el.currentLocation.textContent =
    formatLocation(location) + (location.approximate ? " (approx.)" : "");
  el.currentDate.textContent = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  el.currentIcon.innerHTML = WeatherIcons.iconSvg(info.icon);
  el.currentIcon.setAttribute("aria-label", info.desc);
  el.currentTemp.textContent = `${Math.round(current.temperature_2m)}${unitSymbol()}`;
  el.currentDesc.textContent = info.desc;
  el.currentFeels.textContent = `${Math.round(current.apparent_temperature)}${unitSymbol()}`;
  el.currentHumidity.textContent = `${current.relative_humidity_2m}%`;
  const dir = current.wind_direction_10m;
  el.windText.textContent =
    `${Math.round(current.wind_speed_10m)} ${windUnit()}` +
    (dir == null ? "" : ` ${compassDir(dir)}`);
  el.windArrow.hidden = dir == null;
  if (dir != null) {
    // Arrow points where the wind is blowing TO.
    el.windArrow.style.transform = `rotate(${(dir + 180) % 360}deg)`;
  }
  el.currentPrecip.textContent = `${current.precipitation} ${precipUnit()}`;
  el.currentSunrise.textContent = formatTime(daily.sunrise[0]);
  el.currentSunset.textContent = formatTime(daily.sunset[0]);
}

function renderHourly(data) {
  const { hourly } = data;
  const now = new Date();
  // Find the first hour at or after the current time, then show 24 hours.
  let start = hourly.time.findIndex((t) => new Date(t) >= now);
  if (start === -1) start = 0;

  el.hourlyList.innerHTML = "";
  for (let i = start; i < Math.min(start + 24, hourly.time.length); i++) {
    const info = weatherInfo(hourly.weather_code[i], hourly.is_day[i]);
    const item = document.createElement("div");
    item.className = "hourly__item";
    item.innerHTML = `
      <span class="hourly__time">${formatHour(hourly.time[i])}</span>
      <span class="hourly__icon" role="img" aria-label="${info.desc}">${WeatherIcons.iconSvg(info.icon)}</span>
      <span class="hourly__temp">${Math.round(hourly.temperature_2m[i])}°</span>
      <span class="hourly__precip">${hourly.precipitation_probability[i]}%</span>
    `;
    el.hourlyList.appendChild(item);
  }
}

function renderDaily(data) {
  const { daily } = data;
  el.dailyList.innerHTML = "";
  daily.time.forEach((date, i) => {
    const info = weatherInfo(daily.weather_code[i]);
    const row = document.createElement("div");
    row.className = "daily__row";
    row.innerHTML = `
      <span class="daily__day">${formatDay(date, i)}</span>
      <span class="daily__icon" role="img" aria-label="${info.desc}">${WeatherIcons.iconSvg(info.icon)}</span>
      <span class="daily__precip">${daily.precipitation_probability_max[i]}%</span>
      <span class="daily__temps">
        <strong>${Math.round(daily.temperature_2m_max[i])}°</strong>
        <span class="daily__min">/ ${Math.round(daily.temperature_2m_min[i])}°</span>
      </span>
    `;
    el.dailyList.appendChild(row);
  });
}

// ---------- Main flow ----------

async function loadWeather(location, { silent = false, source = "user" } = {}) {
  state.location = location;
  if (!silent) state.locationSource = source;
  if (!silent) {
    showView("weather");
    showSections(false);
    setWeatherStatus(`Loading weather for ${formatLocation(location)}…`);
  }
  try {
    const data = await fetchForecast(location.latitude, location.longitude);
    renderCurrent(data, location);
    renderHourly(data);
    renderDaily(data);
    const locKey = `${location.latitude},${location.longitude}`;
    if (
      state.alertsLocKey !== locKey ||
      Date.now() - (state.lastAlertsFetch || 0) > ALERTS_REFRESH_MS
    ) {
      state.lastAlertsFetch = Date.now();
      loadAlerts(location);
    }
    const bgMode = backgroundForWeather(data.current.weather_code, data.current.is_day);
    const twilight = isTwilight(data);
    Background.setWeather(bgMode, { isDay: !!data.current.is_day, twilight });
    document.body.classList.toggle("day-sky", !!data.current.is_day || twilight);
    Sound.setScene(soundSceneFor(bgMode));
    state.lastUpdated = Date.now();
    updateAgo();
    setWeatherStatus("");
    showSections(true);
    showView("weather");
    startLiveUpdates();
  } catch (error) {
    console.error(error);
    if (!silent) {
      setWeatherStatus("Could not load weather data. Please try again.");
    }
    // On a silent refresh failure, keep showing the last good data and
    // let the next interval try again.
  }
}

// ---------- Major-cities ticker ----------

// One batched Open-Meteo call fetches current weather for every ticker city.
async function loadTicker() {
  try {
    const params = new URLSearchParams({
      latitude: TICKER_CITIES.map((c) => c.latitude).join(","),
      longitude: TICKER_CITIES.map((c) => c.longitude).join(","),
      current: "temperature_2m,weather_code,is_day",
      temperature_unit: state.unit,
    });
    const data = await fetchJson(`${FORECAST_URL}?${params}`);
    renderTicker(Array.isArray(data) ? data : [data]);
  } catch (error) {
    // Ticker is decorative — leave it hidden if the lookup fails.
    console.error(error);
  }
}

function renderTicker(results) {
  el.tickerTrack.innerHTML = "";
  // Two identical copies make the marquee loop seamless.
  for (let copy = 0; copy < 2; copy++) {
    TICKER_CITIES.forEach((city, i) => {
      const current = results[i] && results[i].current;
      if (!current) return;
      const info = weatherInfo(current.weather_code, current.is_day);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ticker__item";
      chip.setAttribute("aria-label", `${city.name}: ${info.desc}`);
      chip.innerHTML = `
        <span>${city.name}</span>
        ${WeatherIcons.iconSvg(info.icon)}
        <span class="ticker__temp">${Math.round(current.temperature_2m)}°</span>
      `;
      chip.addEventListener("click", () => loadWeather(city));
      el.tickerTrack.appendChild(chip);
    });
  }
  el.ticker.hidden = el.tickerTrack.childElementCount === 0;
}

// ---------- Search (shared by home + weather header) ----------

function setupSearch({ form, input, results }, showStatus) {
  let debounceTimer = null;
  let resultsGen = 0; // guards against stale async updates

  function hideResults() {
    resultsGen++;
    results.hidden = true;
    results.innerHTML = "";
  }

  function showResults(cities) {
    const gen = ++resultsGen;
    results.innerHTML = "";
    cities.forEach((city) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = formatLocation(city);
      item.appendChild(name);
      item.tabIndex = 0;
      item.addEventListener("click", () => {
        hideResults();
        input.value = "";
        loadWeather(city);
      });
      results.appendChild(item);
    });
    results.hidden = cities.length === 0;
    if (cities.length > 0) enrichResults(cities, gen);
  }

  // Add live conditions (icon, temperature, wind speed) to each suggestion
  // with one batched forecast call.
  async function enrichResults(cities, gen) {
    try {
      const params = new URLSearchParams({
        latitude: cities.map((c) => c.latitude).join(","),
        longitude: cities.map((c) => c.longitude).join(","),
        current: "temperature_2m,weather_code,is_day,wind_speed_10m",
        temperature_unit: state.unit,
        wind_speed_unit: state.unit === "fahrenheit" ? "mph" : "kmh",
      });
      const data = await fetchJson(`${FORECAST_URL}?${params}`);
      if (gen !== resultsGen) return; // results changed while we were fetching
      const list = Array.isArray(data) ? data : [data];
      Array.from(results.children).forEach((item, i) => {
        const current = list[i] && list[i].current;
        if (!current) return;
        const info = weatherInfo(current.weather_code, current.is_day);
        const meta = document.createElement("span");
        meta.className = "search__meta";
        meta.innerHTML = `
          ${WeatherIcons.iconSvg(info.icon)}
          <span>${Math.round(current.temperature_2m)}°</span>
          <span>${Math.round(current.wind_speed_10m)} ${windUnit()}</span>
        `;
        item.appendChild(meta);
      });
    } catch {
      // Live details are best-effort; suggestions still work without them.
    }
  }

  // Live suggestions while typing.
  async function suggest() {
    const query = input.value.trim();
    if (query.length < 2) {
      hideResults();
      return;
    }
    try {
      const cities = await searchCities(query);
      // Ignore stale responses that arrive after the input changed.
      if (input.value.trim() === query) showResults(cities);
    } catch {
      // Suggestions are best-effort; a failed lookup just shows nothing.
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(suggest, 250);
  });

  // Submitting goes straight to the best match.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) return;
    try {
      const cities = await searchCities(query);
      if (cities.length === 0) {
        showStatus(`No results found for "${query}".`);
        hideResults();
        return;
      }
      showStatus("");
      hideResults();
      input.value = "";
      loadWeather(cities[0]);
    } catch (error) {
      console.error(error);
      showStatus("City search failed. Please try again.");
    }
  });

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) hideResults();
  });
}

// ---------- Geolocation ----------

// One shared IP lookup per page load (used for location and unit default).
let ipInfoPromise = null;
function getIpInfo() {
  if (!ipInfoPromise) ipInfoPromise = fetchJson(IP_LOCATE_URL);
  return ipInfoPromise;
}

// Approximate location from the visitor's IP address. Works even where
// the browser blocks the geolocation prompt (e.g. in-app browsers).
async function ipLocate() {
  const data = await getIpInfo();
  if (data.success === false || data.latitude == null) {
    throw new Error("IP lookup failed");
  }
  return {
    name: data.city || "My area",
    admin1: data.region || "",
    country: data.country || "",
    latitude: data.latitude,
    longitude: data.longitude,
    approximate: true,
  };
}

async function fallbackToIpLocation() {
  setHomeStatus("Precise location unavailable — finding your approximate area…");
  try {
    const location = await ipLocate();
    setHomeStatus("");
    loadWeather(location);
  } catch (error) {
    console.error(error);
    setHomeStatus("Couldn't detect your location — try searching for your town instead.");
  }
}

// On open: immediately show weather for the visitor's IP-estimated area,
// so the app is useful before (or without) the precise-location prompt.
async function autoLocateOnOpen() {
  try {
    const location = await ipLocate();
    if (state.location) return; // GPS or a search already won the race
    loadWeather(location, { source: "ip" });
  } catch {
    // No IP estimate — stay on the homepage.
  }
}

// Fired the moment the app opens: ask the browser for the precise position
// right away. If it's denied, ignored, or slow, the IP result (loading in
// parallel) stays on screen; a granted prompt upgrades it. A manual search
// always wins over both.
function autoGeolocate() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (state.locationSource === "user") return;
      const { latitude, longitude } = position.coords;
      const location = await reverseGeocode(latitude, longitude);
      if (state.locationSource === "user") return;
      loadWeather(location, { source: "gps" });
    },
    () => {}, // fall through to the IP-based weather already showing
    { timeout: 15000, maximumAge: 300000 },
  );
}

function requestGeolocation() {
  if (!navigator.geolocation) {
    fallbackToIpLocation();
    return;
  }
  setHomeStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const location = await reverseGeocode(latitude, longitude);
      setHomeStatus("");
      loadWeather(location);
    },
    // Denied, unavailable, or timed out — fall back to IP-based location.
    fallbackToIpLocation,
    { timeout: 8000, maximumAge: 300000 },
  );
}

// ---------- Units ----------

// Countries that use Fahrenheit day-to-day.
const FAHRENHEIT_COUNTRIES = ["US", "BS", "BZ", "KY", "PW", "FM", "MH", "LR"];

function handleUnitToggle() {
  state.unit = state.unit === "celsius" ? "fahrenheit" : "celsius";
  // Manual choice is saved and wins over auto-detection on future visits.
  localStorage.setItem("weather-unit", state.unit);
  updateUnitToggle();
  if (state.location) loadWeather(state.location, { silent: true });
  loadTicker();
}

function updateUnitToggle() {
  const label = state.unit === "celsius" ? "°C → °F" : "°F → °C";
  el.unitToggle.textContent = label;
  el.homeUnit.textContent = label;
}

// First visit only: default the unit to what the visitor's country uses.
async function detectDefaultUnit() {
  if (localStorage.getItem("weather-unit")) return;
  try {
    const data = await getIpInfo();
    const code = (data.country_code || "").toUpperCase();
    if (localStorage.getItem("weather-unit")) return; // user toggled meanwhile
    const detected = FAHRENHEIT_COUNTRIES.includes(code) ? "fahrenheit" : "celsius";
    if (detected !== state.unit) {
      state.unit = detected;
      updateUnitToggle();
      if (state.location) loadWeather(state.location, { silent: true });
      loadTicker();
    }
  } catch {
    // Keep the celsius default if the lookup fails.
  }
}

// ---------- Init ----------

function updateSoundToggle() {
  const on = Sound.isEnabled();
  el.soundToggle.innerHTML = WeatherIcons.iconSvg(on ? "volume" : "volume-off");
  el.soundToggle.setAttribute("aria-label", on ? "Mute sound" : "Unmute sound");
}

function init() {
  setupSearch(
    { form: el.homeForm, input: el.homeInput, results: el.homeResults },
    setHomeStatus,
  );
  setupSearch(
    { form: el.form, input: el.input, results: el.results },
    setWeatherStatus,
  );

  el.homeLocate.addEventListener("click", requestGeolocation);
  el.homeButton.addEventListener("click", goHome);
  el.unitToggle.addEventListener("click", handleUnitToggle);
  el.homeUnit.addEventListener("click", handleUnitToggle);

  updateSoundToggle();
  el.soundToggle.addEventListener("click", () => {
    Sound.toggle();
    updateSoundToggle();
  });

  // Refresh immediately when the tab becomes visible again.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.location && el.weatherView.hidden === false) {
      loadWeather(state.location, { silent: true });
    }
  });

  updateUnitToggle();
  showView("home");
  autoGeolocate(); // native location prompt fires immediately on open
  (async () => {
    await detectDefaultUnit(); // set the right unit before the first fetch
    autoLocateOnOpen(); // IP fallback loads in parallel
  })();
  loadTicker();
  setInterval(loadTicker, TICKER_REFRESH_MS);
}

init();
