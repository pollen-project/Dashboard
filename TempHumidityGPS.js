async function updateTempHumidityChart() {
    const status = document.getElementById("status");

    try {
      const res = await fetch(API_URL);

      if (!res.ok) {
        status.textContent = `Error: API responded with status ${res.status}`;
        return;
      }

      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        // Handle Temperature and Humidity
        const labels = data.map(entry => new Date(entry.timestamp).toLocaleTimeString());
        const tempData = data.map(entry => entry.temperature);
        const humidityData = data.map(entry => entry.humidity);

        // Display the latest temperature and humidity
        const latestTemp = tempData[0];
        const latestHumidity = humidityData[0];
        document.getElementById("latestTemp").textContent = `Latest Temp: ${latestTemp}°C`;
        document.getElementById("latestHumidity").textContent = `Latest Humidity: ${latestHumidity}%`;

        // Update Temperature Chart
        updateTemperatureChart(labels, tempData);

        // Update Humidity Chart
        updateHumidityChart(labels, humidityData);

        updateMapWithGPS(data[0].gps);
      }
    } catch (err) {
      status.textContent = "Error loading temperature, humidity, or GPS data from the API.";
      console.error(err);
    }
  }


  function updateTemperatureChart(labels, tempData) {
    if (!tempChart) {
      const ctx = document.getElementById("tempChart").getContext("2d");
      tempChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Temperature (°C)',
              data: tempData,
              borderColor: 'rgba(255, 159, 64, 1)',
              backgroundColor: 'rgba(255, 159, 64, 0.2)',
              tension: 0.3,
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              title: { display: true, text: 'Time' },
              reverse: true // Reverses the x-axis to show the most recent time on the left
            },
            y: {
              beginAtZero: false,
              title: { display: true, text: 'Temperature (°C)' }
            }
          }
        }
      });
    } else {
      tempChart.data.labels = labels;
      tempChart.data.datasets[0].data = tempData;
      tempChart.update();
    }
  }


  function updateHumidityChart(labels, humidityData) {
    if (!humidityChart) {
      const ctx = document.getElementById("humidityChart").getContext("2d");
      humidityChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Humidity (%)',
              data: humidityData,
              borderColor: 'rgba(54, 162, 235, 1)',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              tension: 0.3,
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              title: { display: true, text: 'Time' },
              reverse: true // Reverses the x-axis to show the most recent time on the left
            },
            y: {
              beginAtZero: false,
              title: { display: true, text: 'Humidity (%)' }
            }
          }
        }
      });
    } else {
      humidityChart.data.labels = labels;
      humidityChart.data.datasets[0].data = humidityData;
      humidityChart.update();
    }
  }



  
  function updateMapWithGPS(gps) {
    const gpsStatus = document.getElementById("gpsStatus");

    let lat, lon;

    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      lat = gps.latitude;
      lon = gps.longitude;
      gpsStatus.textContent = `Latitude: ${lat}, Longitude: ${lon}`;
    } else {
      // Generate random coordinates for testing (within Europe)
      lat = 47 + Math.random();     // 47 to 48
      lon = 19 + Math.random();     // 19 to 20
      gpsStatus.textContent = `Random Test Location: Latitude: ${lat.toFixed(5)}, Longitude: ${lon.toFixed(5)}`;
      console.warn('Using random GPS coordinates for testing.');
    }

    updateMap(lat, lon);
  }



  function updateMap(lat, lon) {
    if (!map) {
      // Initialize map
      map = L.map('map').setView([lat, lon], 13); // Default zoom level of 13

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
    }

    // Update marker position
    if (marker) {
      marker.setLatLng([lat, lon]);
    } else {
      marker = L.marker([lat, lon]).addTo(map);
    }

    // Adjust the view to fit the new marker
    map.setView([lat, lon], 13);
  }