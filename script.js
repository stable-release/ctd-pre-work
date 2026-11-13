const form = document.getElementById("searchForm");
const cityInput = document.getElementById("city");
const regionInput = document.getElementById("region");
const resultsMeta = document.getElementById("resultsMeta");
const resultsList = document.getElementById("resultsList");
const forecast = document.getElementById("forecast");
const backButton = document.getElementById("back");
const dailyView = document.getElementById("daily-view");
const hourlyView = document.getElementById("hourly-view");
const dailyButton = document.getElementById("daily-button");
const hourlyButton = document.getElementById("hourly-button");

// Hash routing
function buildHash({ city, region, id, latitude, longitude } = {}) {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (region) params.set("region", region);
    if (id != null) params.set("id", String(id));
    if (latitude != null) params.set("latitude", String(latitude));
    if (longitude != null) params.set("longitude", String(longitude));
    return params.toString();
}

function readRoute() {
    const params = new URLSearchParams(location.hash.slice(1));
    const city = params.get("city") ?? "";
    const region = params.get("region") ?? "";
    const id = params.get("id");
    const latitude = params.get("latitude");
    const longitude = params.get("longitude");
    if (id != null)
        return { page: "forecast", id, city, region, latitude, longitude };
    if (city || region) return { page: "results", city, region };
    return { page: "root", city: "", region: "" };
}

// For bookmarked forecasts so a back button returns to the search results
(function seedHistory() {
    const route = readRoute();
    if (route.page !== "forecast") return;
    history.replaceState(
        null,
        "",
        "#" + buildHash({ city: route.city, region: route.region }),
    );
    history.pushState(
        null,
        "",
        "#" +
            buildHash({
                city: route.city,
                region: route.region,
                id: route.id,
                latitude: route.latitude,
                longitude: route.longitude,
            }),
    );
})();

// Rendering the rest of the page based on route params
function render() {
    const route = readRoute();

    document.getElementById("page-root").hidden = route.page !== "root";
    document.getElementById("page-results").hidden = route.page !== "results";
    document.getElementById("page-forecast").hidden = route.page !== "forecast";

    backButton.hidden = route.page !== "forecast";

    if (cityInput.value !== route.city) cityInput.value = route.city;
    if (regionInput.value !== route.region) regionInput.value = route.region;

    if (route.page === "results") renderResults(route);
    if (route.page === "forecast") renderForecast(route);
}

// Results page
async function renderResults(route) {
    const token = buildHash({ city: route.city, region: route.region });
    resultsMeta.textContent = "Loading…";
    resultsList.replaceChildren();

    try {
        const url =
            route.city && route.region
                ? `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(route.city)}%2C+${encodeURIComponent(route.region)}&count=10&language=en&format=json`
                : route.city
                  ? `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(route.city)}&count=10&language=en&format=json`
                  : `https://geocoding-api.open-meteo.com/v1/search?name=shenzhen&count=10&language=en&format=json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("search failed (" + res.status + ")");

        const locations = await res.json();

        if (buildHash(readRoute()) !== token) return;

        if (!locations.results.length) {
            resultsMeta.textContent = "No results.";
            return;
        }
        resultsMeta.textContent = `Top ${locations.results.length} result(s) found`;

        for (const l of locations.results) {
            console.log(l);
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href =
                "#" +
                buildHash({
                    city: route.city,
                    region: route.region,
                    id: l.id,
                    latitude: l.latitude,
                    longitude: l.longitude,
                });
            a.textContent = `${l.name} ${l.admin1} <Latitude: ${l.latitude}, Longitude: ${l.longitude}>`;
            li.append(a);
            resultsList.append(li);
        }
    } catch (e) {
        resultsMeta.textContent = "Error: " + e.message;
    }
}

// Forecast page daily / hourly toggle
let daily = "on";

function setDailyView(view) {
    daily = view;
    dailyView.hidden = view !== "on";
    hourlyView.hidden = view !== "off";
    dailyButton.setAttribute("aria-pressed", String(view === "on"));
    hourlyButton.setAttribute("aria-pressed", String(view === "off"));
}

// Forecast page
async function renderForecast(route) {
    daily = "on";
    setDailyView("on");

    dailyView.replaceChildren(document.createTextNode("Loading..."));
    hourlyView.replaceChildren();

    try {
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(route.latitude)}&longitude=${encodeURIComponent(route.longitude)}&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m&timezone=auto`,
        );
        if (!res.ok)
            throw new Error(
                "Location " + route.id + " not found (" + res.status + ")",
            );
        const data = await res.json();

        console.log(data);

        if (readRoute().id !== route.id) return; // user navigated away

        // Daily tab
        dailyView.replaceChildren();
        const dailyTemperatureMax = data.daily.temperature_2m_max;
        const dailyTemperatureMin = data.daily.temperature_2m_min;
        const dailyTime = data.daily.time;
        for (let i = 0; i < dailyTemperatureMax.length; i++) {
            const li = document.createElement("li");
            const card = document.createElement("div");
            const date = document.createElement("p");
            const temperature = document.createElement("p");

            li.classList.add("daily-list");
            card.classList.add("daily-card");
            date.classList.add("daily-date");
            temperature.classList.add("daily-temperature");

            const [y, m, d] = dailyTime[i].split('-').map(Number);
            const parsed = new Date(y, m - 1, d).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });

            date.textContent = parsed;
            temperature.textContent = `${dailyTemperatureMin[i]}° / ${dailyTemperatureMax[i]}° C`;

            card.append(date);
            card.append(temperature);
            li.append(card);
            dailyView.append(li);
        }

        // Hourly tab
        hourlyView.replaceChildren();
        const hourlyTemperature = data.hourly.temperature_2m.slice(0, 24);
        const hourlyTime = data.hourly.time.slice(0, 24);

        for (let i = 0; i < 24; i++) {
            const li = document.createElement("li");
            const card = document.createElement("div");
            const hour = document.createElement("p");
            const temperature = document.createElement("p");

            li.classList.add("hourly-list");
            card.classList.add("hourly-card");
            hour.classList.add("hourly-hour");
            temperature.classList.add("hourly-temperature");

            hour.textContent = `${i}:00 ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
            temperature.textContent = `${hourlyTemperature[i]}° C`;

            card.append(hour);
            card.append(temperature);
            li.append(card);
            hourlyView.append(li);
        }
    } catch (e) {
        console.log(e);
        dailyView.textContent = "Error: " + e.message;
        hourlyView.replaceChildren();
    }
}

// Event listeners
form.addEventListener("submit", (e) => {
    e.preventDefault();
    const next = buildHash({
        city: cityInput.value.trim(),
        region: regionInput.value.trim(),
    });
    if (location.hash.slice(1) === next) return;
    location.hash = next;
});

backButton.addEventListener("click", () => history.back());
window.addEventListener("hashchange", render);
dailyButton.addEventListener("click", () => setDailyView("on"));
hourlyButton.addEventListener("click", () => setDailyView("off"));

render();