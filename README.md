# ⛅ Weather

A simple weather website built with plain HTML, CSS, and JavaScript — no build
step, no framework, no API key required.

## Features

- 🔍 **City search** with autocomplete suggestions
- 📍 **Use my location** via browser geolocation
- 🌡️ **Current conditions** — temperature, feels-like, humidity, wind, precipitation, sunrise/sunset
- ⏰ **Hourly forecast** for the next 24 hours
- 📅 **7-day forecast** with highs, lows, and precipitation chance
- 🔄 **°C / °F toggle** (remembered between visits)
- 🌙 **Dark mode** that follows your system preference
- 📱 Responsive layout for mobile and desktop

## Getting started

No install needed. Just serve the folder and open it in a browser:

```bash
# any static file server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly also works in most browsers, but a local server
is recommended (geolocation requires a secure context: `localhost` or HTTPS).

## Project structure

```
Weather/
├── index.html      # Page markup
├── css/
│   └── style.css   # Styles (light + dark theme)
├── js/
│   └── app.js      # Search, API calls, rendering
└── README.md
```

## Data source

Weather and geocoding data come from the free [Open-Meteo](https://open-meteo.com/)
APIs:

- Forecast: `https://api.open-meteo.com/v1/forecast`
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`

No API key or signup is required.

## Ideas for next steps

- Air quality and UV index
- Weather alerts
- Multiple saved locations
- Charts for temperature/precipitation trends
- Animated weather icons
