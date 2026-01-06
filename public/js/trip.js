function getTripId() {
  return new URLSearchParams(window.location.search).get("id");
}

// Load Google Maps API dynamically (API key from backend)
async function loadGoogleMaps() {
  const res = await fetch("/api/google-maps-key");
  if (!res.ok) throw new Error("Failed to fetch Google Maps API key");

  const { key } = await res.json();
  if (!key) throw new Error("No Google Maps API key returned");

  if (window.google && window.google.maps) return;

  return new Promise((resolve, reject) => {
    window.initMap = resolve;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error("Google Maps script failed to load"));

    document.head.appendChild(script);
  });
}

// Render map + destination + nearby tourist attractions
function renderMap(destination) {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const map = new google.maps.Map(mapEl, {
    zoom: 13,
    center: { lat: 0, lng: 0 },
  });

  const geocoder = new google.maps.Geocoder();

  geocoder.geocode({ address: destination }, (results, status) => {
    if (status !== "OK" || !results[0]) {
      console.warn("Geocode failed:", status);
      return;
    }

    const location = results[0].geometry.location;
    map.setCenter(location);

    // Destination marker
    const destMarker = new google.maps.Marker({
      map,
      position: location,
      title: destination,
    });

    const destInfo = new google.maps.InfoWindow({
      content: `<strong>${destination}</strong>`,
    });

    destMarker.addListener("click", () =>
      destInfo.open(map, destMarker)
    );

    // Nearby tourist attractions
    const service = new google.maps.places.PlacesService(map);

    service.nearbySearch(
      {
        location,
        radius: 50000,
        type: ["tourist_attraction"],
      },
      (places, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK) return;

        places.forEach((place) => {
          const marker = new google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name,
          });

          const info = new google.maps.InfoWindow({
            content: `<strong>${place.name}</strong><br>${place.vicinity || ""}`,
          });

          marker.addListener("click", () =>
            info.open(map, marker)
          );
        });
      }
    );
  });
}

// Page load
window.onload = async () => {
  const tripId = getTripId();
  const destinationEl = document.getElementById("tripDestination");
  const datesEl = document.getElementById("tripDates");
  const itineraryEl = document.getElementById("tripItinerary");

  if (!tripId) {
    destinationEl.textContent = "No trip specified";
    return;
  }

  try {
    const res = await fetch(`/api/trip/${tripId}`);
    const data = await res.json();

    if (!data.success) {
      destinationEl.textContent = "Trip not found";
      return;
    }

    const trip = data.trip;

    destinationEl.textContent = trip.destination;
    datesEl.textContent =
      `${new Date(trip.start_date).toLocaleDateString()} – ` +
      `${new Date(trip.end_date).toLocaleDateString()}`;

    // ✅ Load Google Maps FIRST
    await loadGoogleMaps();

    // Extra safety check
    if (!window.google || !window.google.maps) {
      throw new Error("Google Maps failed to initialize");
    }

    // Render map
    renderMap(trip.destination);

    // Render itinerary
    itineraryEl.innerHTML = "";
    if (trip.itinerary) {
      const cleaned = trip.itinerary.replace(/^```json|```$/g, "").trim();
      const itinerary = JSON.parse(cleaned);

      itinerary.days.forEach((day) => {
        const card = document.createElement("div");
        card.className = "day-card";

        card.innerHTML = `
          <h2>Day ${day.day} – ${day.title}</h2>
          <ul>${day.activities.map((a) => `<li>${a}</li>`).join("")}</ul>
        `;

        itineraryEl.appendChild(card);
      });
    }
  } catch (err) {
    console.error(err);
    destinationEl.textContent = "Error loading trip";
  }
}