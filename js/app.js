/* ============================================
   Weather — app logic
   Two views: a starfield home page (search or
   "use my location") and a live-updating
   weather page for the chosen place.

   APIs (all free, no key needed):
   - Forecast:  https://open-meteo.com/en/docs
   - Geocoding: https://open-meteo.com/en/docs/geocoding-api
   - Reverse geocoding: https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api
   ============================================ */

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

// How often the weather view re-fetches fresh data.
const REFRESH_INTERVAL_MS = 60 * 1000;

// WMO weather interpretation codes -> description + emoji icon
const WEATHER_CODES = {
  0: { desc: "Clear sky", icon: "☀️", nightIcon: "🌙" },
  1: { desc: "Mainly clear", icon: "🌤️", nightIcon: "🌙" },
  2: { desc: "Partly cloudy", icon: "⛅", nightIcon: "☁️" },
  3: { desc: "Overcast", icon: "☁️" },
  45: { desc: "Fog", icon: "🌫️" },
  48: { desc: "Depositing rime fog", icon: "🌫️" },
  51: { desc: "Light drizzle", icon: "🌦️" },
  53: { desc: "Moderate drizzle", icon: "🌦️" },
  55: { desc: "Dense drizzle", icon: "🌧️" },
  56: { desc: "Light freezing drizzle", icon: "🌧️" },
  57: { desc: "Dense freezing drizzle", icon: "🌧️" },
  61: { desc: "Slight rain", icon: "🌦️" },
  63: { desc: "Moderate rain", icon: "🌧️" },
  65: { desc: "Heavy rain", icon: "🌧️" },
  66: { desc: "Light freezing rain", icon: "🌧️" },
  67: { desc: "Heavy freezing rain", icon: "🌧️" },
  71: { desc: "Slight snow", icon: "🌨️" },
  73: { desc: "Moderate snow", icon: "🌨️" },
  75: { desc: "Heavy snow", icon: "❄️" },
  77: { desc: "Snow grains", icon: "❄️" },
  80: { desc: "Slight rain showers", icon: "🌦️" },
  81: { desc: "Moderate rain showers", icon: "🌧️" },
  82: { desc: "Violent rain showers", icon: "⛈️" },
  85: { desc: "Slight snow showers", icon: "🌨️" },
  86: { desc: "Heavy snow showers", icon: "❄️" },
  95: { desc: "Thunderstorm", icon: "⛈️" },
  96: { desc: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { desc: "Thunderstorm with heavy hail", icon: "⛈️" },
};

// ---------- App state ----------

const state = {
  unit: localStorage.getItem("weather-unit") || "celsius", // "celsius" | "fahrenheit"
  location: null,
  lastUpdated: null,
  refreshTimer: null,
  agoTimer: null,
};

// ---------- DOM references ----------

const el = {
  homeView: document.getElementById("home-view"),
  weatherView: document.getElementById("weather-view"),
  homeForm: document.getElementById("home-form"),
  homeInput: document.getElementById("home-input"),
  homeResults: document.getElementById("home-results"),
  homeLocate: document.getElementById("home-locate"),
  homeStatus: document.getElementById("home-status"),
  geoModal: document.getElementById("geo-modal"),
  geoYes: document.getElementById("geo-yes"),
  geoNo: document.getElementById("geo-no"),
  homeButton: document.getElementById("home-button"),
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  results: document.getElementById("search-results"),
  unitToggle: document.getElementById("unit-toggle"),
  status: document.getElementById("status"),
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
  currentWind: document.getElementById("current-wind"),
  currentPrecip: document.getElementById("current-precip"),
  currentSunrise: document.getElementById("current-sunrise"),
  currentSunset: document.getElementById("current-sunset"),
  hourlyList: document.getElementById("hourly-list"),
  dailyList: document.getElementById("daily-list"),
};

// ---------- Helpers ----------

function weatherInfo(code, isDay = 1) {
  const info = WEATHER_CODES[code] || { desc: "Unknown", icon: "❔" };
  const icon = !isDay && info.nightIcon ? info.nightIcon : info.icon;
  return { desc: info.desc, icon };
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
  showView("home");
  el.homeInput.focus();
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
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const data = await fetchJson(url);
  return data.results || [];
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
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
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

// ---------- Rendering ----------

function renderCurrent(data, location) {
  const { current, daily } = data;
  const info = weatherInfo(current.weather_code, current.is_day);

  el.currentLocation.textContent = formatLocation(location);
  el.currentDate.textContent = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  el.currentIcon.textContent = info.icon;
  el.currentIcon.setAttribute("aria-label", info.desc);
  el.currentTemp.textContent = `${Math.round(current.temperature_2m)}${unitSymbol()}`;
  el.currentDesc.textContent = info.desc;
  el.currentFeels.textContent = `${Math.round(current.apparent_temperature)}${unitSymbol()}`;
  el.currentHumidity.textContent = `${current.relative_humidity_2m}%`;
  el.currentWind.textContent = `${Math.round(current.wind_speed_10m)} ${windUnit()}`;
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
      <span class="hourly__icon" role="img" aria-label="${info.desc}">${info.icon}</span>
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
      <span class="daily__icon" role="img" aria-label="${info.desc}">${info.icon}</span>
      <span class="daily__precip">💧${daily.precipitation_probability_max[i]}%</span>
      <span class="daily__temps">
        <strong>${Math.round(daily.temperature_2m_max[i])}°</strong>
        <span class="daily__min">/ ${Math.round(daily.temperature_2m_min[i])}°</span>
      </span>
    `;
    el.dailyList.appendChild(row);
  });
}

// ---------- Main flow ----------

async function loadWeather(location, { silent = false } = {}) {
  state.location = location;
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

// ---------- Search (shared by home + weather header) ----------

function setupSearch({ form, input, results }, showStatus) {
  function hideResults() {
    results.hidden = true;
    results.innerHTML = "";
  }

  function showResults(cities) {
    results.innerHTML = "";
    cities.forEach((city) => {
      const item = document.createElement("li");
      item.textContent = formatLocation(city);
      item.tabIndex = 0;
      item.addEventListener("click", () => {
        hideResults();
        input.value = "";
        loadWeather(city);
      });
      results.appendChild(item);
    });
    results.hidden = cities.length === 0;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
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
      if (cities.length === 1) {
        hideResults();
        input.value = "";
        loadWeather(cities[0]);
      } else {
        showResults(cities);
      }
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

function requestGeolocation() {
  if (!navigator.geolocation) {
    setHomeStatus("Geolocation is not supported by this browser.");
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
    () => setHomeStatus("Couldn't get your location — try searching instead."),
    { timeout: 10000, maximumAge: 300000 },
  );
}

// ---------- Location permission modal ----------

function maybeAskLocation() {
  // Ask once per visit; a fresh visit asks again.
  if (sessionStorage.getItem("geo-prompted")) return;
  el.geoModal.hidden = false;
}

function closeGeoModal() {
  sessionStorage.setItem("geo-prompted", "1");
  el.geoModal.hidden = true;
}

// ---------- Units ----------

function handleUnitToggle() {
  state.unit = state.unit === "celsius" ? "fahrenheit" : "celsius";
  localStorage.setItem("weather-unit", state.unit);
  updateUnitToggle();
  if (state.location) loadWeather(state.location, { silent: true });
}

function updateUnitToggle() {
  el.unitToggle.textContent = state.unit === "celsius" ? "°C → °F" : "°F → °C";
}

// ---------- Init ----------

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

  el.geoYes.addEventListener("click", () => {
    closeGeoModal();
    requestGeolocation();
  });
  el.geoNo.addEventListener("click", closeGeoModal);

  // Refresh immediately when the tab becomes visible again.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.location && el.weatherView.hidden === false) {
      loadWeather(state.location, { silent: true });
    }
  });

  updateUnitToggle();
  showView("home");
  maybeAskLocation();
}

init();
