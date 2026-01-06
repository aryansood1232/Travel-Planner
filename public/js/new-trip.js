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


window.onload = async function () {
  const form = document.getElementById('tripForm');
  const results = document.getElementById('tripResults');
  await loadGoogleMaps();
  


  // Initialize Google Places Autocomplete
  const autocomplete = new google.maps.places.Autocomplete(
    document.getElementById('destination'),
    { types: ['(cities)'] }
  );

  let latestItineraryResponse = null;

  // === 1. Fetch Itinerary ===
  async function fetchItinerary(destination, startDate, endDate, interests, prompt) {
    const itineraryContainer = document.getElementById('itinerary');
    itineraryContainer.innerHTML = "<p>Generating itinerary...</p>";

    try {
      const response = await fetch('http://localhost:3022/api/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, startDate, endDate, interests, prompt })
      });

      const data = await response.json();
      console.log("Itinerary Response:", data);

      if (!data.success) {
        itineraryContainer.innerHTML = "<p class='error'>Error generating itinerary.</p>";
        return;
      }

      latestItineraryResponse = data.itinerary;

      // Strip ```json ... ``` if present
      let jsonText = data.itinerary.replace(/^```json\s*/, '').replace(/```$/, '');
      const itineraryObj = JSON.parse(jsonText);

      itineraryContainer.innerHTML = ""; // clear loading text

      // Trip Summary
      if (itineraryObj.tripSummary) {
        const summary = document.createElement('p');
        summary.innerText = itineraryObj.tripSummary;
        summary.classList.add('trip-summary');
        itineraryContainer.appendChild(summary);
      }

      // Days
      itineraryObj.days.forEach(day => {
        const card = document.createElement('div');
        card.className = 'day-card';

        const dayHeader = document.createElement('h2');
        dayHeader.innerText = `Day ${day.day} (${day.date}): ${day.title}`;
        card.appendChild(dayHeader);

        const ul = document.createElement('ul');
        day.activities.forEach(activity => {
          const li = document.createElement('li');
          li.innerText = activity;
          ul.appendChild(li);
        });
        card.appendChild(ul);

        itineraryContainer.appendChild(card);
      });

    } catch (err) {
      console.error(err);
      itineraryContainer.innerHTML = "<p class='error'>Error connecting to server.</p>";
    }
  }

  // === Save Trip ===
  const saveBtn = document.getElementById('saveTripBtn');
  saveBtn.style.display = 'inline-block';

  saveBtn.onclick = async () => {
    const tripData = {
      destination: document.getElementById('destination').value,
      startDate: document.getElementById('startDate').value,
      endDate: document.getElementById('endDate').value,
      interests: document.getElementById('interests').value,
      itinerary: latestItineraryResponse
    };

    try {
      const response = await fetch('http://localhost:3022/api/save-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData)
      });

      const data = await response.json();

      if (data.success) {
        alert(`Trip saved successfully! Trip ID: ${data.tripId}`);
      } else {
        alert(`Error saving trip: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Server error. Could not save trip.');
    }
  };

 
  async function renderMap(destination) {
    document.getElementById('map').innerHTML = "";

    const map = new google.maps.Map(document.getElementById("map"), {
      zoom: 13,
      center: { lat: 0, lng: 0 }
    });

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: destination }, function (results, status) {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location;
        map.setCenter(location);

        const service = new google.maps.places.PlacesService(map);
        const request = {
          location: location,
          radius: 5000,
          type: ['tourist_attraction']
        };

        service.nearbySearch(request, function (places, status) {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            places.forEach(place => {
              const marker = new google.maps.Marker({
                position: place.geometry.location,
                map: map,
                title: place.name
              });

              const infoWindow = new google.maps.InfoWindow({
                content: `<div><strong>${place.name}</strong><br>${place.vicinity || ''}</div>`
              });

              marker.addListener('mouseover', () => infoWindow.open(map, marker));
              marker.addListener('mouseout', () => infoWindow.close());
            });
          } else {
            console.warn("No tourist attractions found:", status);
          }
        });
      } else {
        alert("Unable to find the location on the map.");
      }
    });
  }

  // === Form Submit Handler ===
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    results.style.display = 'block';

    const destination = document.getElementById('destination').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const interests = document.getElementById('interests').value;
    const prompt = document.getElementById('prompt').value;

    await fetchItinerary(destination, startDate, endDate, interests, prompt);
    await renderMap(destination);
  });
};