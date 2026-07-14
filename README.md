# ⛅ Weather

A simple weather website built with plain HTML, CSS, and JavaScript — no build
step, no framework, no API key required.

## Features

- 🌌 **Grok-inspired homepage** — pure black with an animated starfield and shooting-star tracers (respects reduced-motion preferences)
- 📍 **Asks to use your location on arrival** — say yes and it jumps straight to live weather where you are (with your real town name via reverse geocoding); say no and you stay on the homepage
- 🔍 **Search any city in the world** with a disambiguation dropdown — from the homepage or the weather page header
- 🔴 **Live updating** — re-fetches fresh data every 60 seconds (and instantly when you return to the tab), with a pulsing "Live · updated Xs ago" indicator
- 🏠 **Home button** to get back to the starfield homepage and search somewhere else
- 🌡️ **Current conditions** — temperature, feels-like, humidity, wind, precipitation, sunrise/sunset
- ⏰ **Hourly forecast** for the next 24 hours
- 📅 **7-day forecast** with highs, lows, and precipitation chance
- 🔄 **°C / °F toggle** (remembered between visits)
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
│   └── style.css   # Styles (black theme, glassy cards)
├── js/
│   ├── stars.js    # Starfield + shooting-star background
│   └── app.js      # Search, API calls, rendering
└── README.md
```

## Data source

Weather and geocoding data come from the free [Open-Meteo](https://open-meteo.com/)
APIs, plus free reverse geocoding from
[BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api)
to turn your coordinates into a town name:

- Forecast: `https://api.open-meteo.com/v1/forecast`
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Reverse geocoding: `https://api.bigdatacloud.net/data/reverse-geocode-client`

No API keys or signups are required.

## Ideas for next steps

- Air quality and UV index
- Weather alerts
- Multiple saved locations
- Charts for temperature/precipitation trends
- Animated weather icons
