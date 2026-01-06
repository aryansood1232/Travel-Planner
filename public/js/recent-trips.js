window.onload = async function () {
  const grid = document.getElementById("tripsGrid");


  function checkEmptyGrid() {
    if (grid.children.length === 0) {
      grid.innerHTML = "<p>No recent trips yet.</p>";
    }
  }

  try {
    const res = await fetch("/api/complete-trips");
    const data = await res.json();

    if (!data.success) {
      grid.innerHTML = `<p>${data.error || "No trips found"}</p>`;
      return;
    }

    if (data.trips.length === 0) {
      grid.innerHTML = "<p>No saved trips yet.</p>";
      return;
    }

    data.trips.forEach(trip => {
      const card = document.createElement("div");
      card.classList.add("trip-card");
      card.innerHTML = `
        <div class="trip-card-content">
          <h2 class="trip-destination">${trip.destination}</h2>
          <p class="trip-dates">
            ${new Date(trip.start_date).toLocaleDateString()} – 
            ${new Date(trip.end_date).toLocaleDateString()}
          </p>
        </div>
        <div class="trip-card-buttons">
          <button class="delete-btn">Delete</button>
        </div>
      `;

      // Redirect to itinerary page
      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-btn") || e.target.classList.contains("complete-btn")) return;
        window.location.href = `/trip.html?id=${trip.id}`;
      });

      // Delete trip
      const deleteBtn = card.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(`/api/delete-trip/${trip.id}`, { method: "DELETE" });
          const result = await res.json();
          if (result.success) {
            card.remove();
            checkEmptyGrid(); // check after removing
          } else {
            alert(result.error || "Failed to delete trip");
          }
        } catch (err) {
          console.error(err);
          alert("Error deleting trip");
        }
      });

     

      grid.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = "<p>Something went wrong loading trips.</p>";
  }
};