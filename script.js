const API_URL = "https://pollen.botondhorvath.com/api/history?device=pollen3";
const pollenData = [];
let tempHumidityChart;
let chart;
let tempChart, humidityChart;
let map, marker;
let lastImageFilename = null;

let boundingBoxes = [];
let isDrawing = false;
let startX, startY;
let canvas, ctx;
let canvasVisible = true;

async function loadLatestImage() {
  const status = document.getElementById("status");

  try {
    const res = await fetch(API_URL);

    if (!res.ok) {
      status.textContent = `Error: API responded with status ${res.status}`;
      return;
    }

    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const latestImage = data[0];

      if (latestImage && latestImage.image) {
        // Only update if a new image was received
        if (latestImage.image !== lastImageFilename) {
          lastImageFilename = latestImage.image;

          const img = document.getElementById("latestImage");
          img.src = `https://pollen.botondhorvath.com/images/${latestImage.image}`;

          // Update timestamp text
          status.textContent = `Last updated: ${new Date(latestImage.timestamp).toLocaleTimeString()}`;

          // Refresh history list
          updateImageHistory(data);
        }
      } else {
        status.textContent = "No image data found in the API.";
      }
    } else {
      status.textContent = "No images found in the API.";
    }
  } catch (err) {
    status.textContent = "Error loading image from the API.";
    console.error(err);
  }
}



function updateImageHistory(imageFiles) {
  const historyElement = document.getElementById("imageHistory");
  historyElement.innerHTML = '';

  imageFiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const recentImages = imageFiles.slice(0, 11);

  recentImages.forEach(file => {
      const li = document.createElement("li");
      li.textContent = new Date(file.timestamp).toLocaleString();
      li.style.cursor = 'pointer';
      li.title = "Click to view this image";
  
      li.addEventListener("click", () => {
          const img = document.getElementById("latestImage");
          img.src = `https://pollen.botondhorvath.com/images/${file.image}`;
          document.getElementById("status").textContent = `Viewing image from: ${new Date(file.timestamp).toLocaleString()}`;

          // Clear existing bounding boxes
          boundingBoxes = [];
          redrawCanvas();

          // Only process detections if they exist and are non-empty
          if (file.detections && file.detections.length > 0) {
              img.onload = () => {
                  setTimeout(() => {
                      boundingBoxes = []; // Clear previous boxes
                      redrawCanvas();
                  
                      const scaleX = canvas.width / img.naturalWidth;
                      const scaleY = canvas.height / img.naturalHeight;
                  
                      file.detections.forEach(detection => {
                          try {
                              // Skip if detection string is empty or null
                            
                              
                              
                              
                              // Skip if box data is missing or invalid
                              if (!detection?.box || 
                                  !detection.box.x1 || !detection.box.x2 || 
                                  !detection.box.y1 || !detection.box.y2) {
                                  return;
                              }
                              
                              const box = detection.box;
                              const x = box.x1 * scaleX;
                              const y = box.y1 * scaleY;
                              const width = (box.x2 - box.x1) * scaleX;
                              const height = (box.y2 - box.y1) * scaleY;
                  
                              boundingBoxes.push({ x, y, width, height });
                          } catch (e) {
                              console.warn("Invalid detection data:", detectionStr, e);
                          }
                      });
                  
                      redrawCanvas();
                  }, 100);
              };
          } else {
              // No detections available for this image
              console.log("No detections found for this image");
              boundingBoxes = [];
              redrawCanvas();
          }
      });
  
      historyElement.appendChild(li);
  });
}

let isInitialLoad = true;

async function updatePollenCount() {
  const API_URL = "https://pollen.botondhorvath.com/api/history?device=pollen3";

  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    

    if (isInitialLoad) {
      // Load the last 20 readings into pollenData
      
      const first20Data = data.slice(0, 20); // Slice first 20 entries

    // Reverse the data manually without using reverse()
    const reversedData = [];
    for (let i = first20Data.length - 1; i >= 0; i--) {
      reversedData.push(first20Data[i]);
    }

      pollenData.splice(0, pollenData.length, ...reversedData.map(entry => {
        const rawCount = entry.detectedPollenCount;
        
  
        const count = !isNaN(Number(rawCount)) ? Number(rawCount) : 0; // Fallback to 0 if invalid
        return {
          time: new Date(entry.timestamp),
          count: count
        };
      }));
      isInitialLoad = false;
    } else {
      // Add just the latest reading
      const latest = data[0]; // or data[data.length - 1] depending on order
      const newEntry = {
        time: new Date(latest.timestamp),
        count: Number(latest.detectedPollenCount)
      };

      pollenData.push(newEntry);
      if (pollenData.length > 20) pollenData.shift();
    }

    // Update display
    const pollenCountElement = document.getElementById("pollenCount");
    const latestCount = pollenData[pollenData.length - 1].count;
    pollenCountElement.textContent = `${latestCount} particles/m³`;

    updateChart();

  } catch (err) {
    status.textContent = "Error loading data from the API.";
    console.error(err);
  }
}



function updateChart() {
  // Use only the last 20 entries
  const recentData = pollenData.slice(-20);
  console.log(recentData);

  const labels = pollenData.map(entry => entry.time.toLocaleTimeString());
  const data = pollenData.map(entry => entry.count);


  const avg = data.length ? data.reduce((sum, val) => sum + val, 0) / data.length : 0;
  const averageLine = new Array(data.length).fill(avg);

  if (!chart) {
    const ctx = document.getElementById("pollenChart").getContext("2d");
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Pollen Count',
            data: data,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: 'Average',
            data: averageLine,
            borderColor: 'rgba(255, 99, 132, 0.8)',
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: 'Time' } },
          y: { beginAtZero: true, title: { display: true, text: 'Particles/m³' } }
        },
        plugins: {
          legend: { labels: { boxWidth: 12, padding: 10 } }
        }
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[1].data = averageLine;

    chart.update();
  }
}


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

async function loadFilteredImages() {
    const fromInput = document.getElementById("fromDate")?.value;
    const status = document.getElementById("status");
    const img = document.getElementById("latestImage");
  
    if (!status || !img) {
        console.error("Missing status or image elements in the DOM.");
        return;
    }
  
    if (!fromInput) {
        status.textContent = "Please select a 'From' date.";
        return;
    }
  
    const fromDate = new Date(fromInput);
    const untilDate = new Date(fromDate.getTime() + 15 * 60 * 1000); // +15 min
  
    const fromISO = fromDate.toISOString();
    const untilISO = untilDate.toISOString();
  
    // Build the URL safely with query params
    const url = new URL(API_URL);
    url.searchParams.set("from", fromISO);
    url.searchParams.set("until", untilISO);
  
    console.log("Fetching from:", url.toString());
  
    try {
        const res = await fetch(url);
        if (!res.ok) {
            status.textContent = `Error: API responded with status ${res.status}`;
            return;
        }
    
        const data = await res.json();
    
        if (Array.isArray(data) && data.length > 0) {
            const last11 = data.slice(-11);
            const latestImage = last11[last11.length - 1];
    
            if (latestImage.image !== lastImageFilename) {
                lastImageFilename = latestImage.image;
                img.src = `https://pollen.botondhorvath.com/images/${latestImage.image}`;
            }
    
            updateImageHistory(last11);
            status.textContent = `Showing last 11 images from: ${fromInput}`;
        } else {
            status.textContent = "No images found for the selected time range.";
        }
    } catch (err) {
        status.textContent = "An error occurred while loading images.";
        console.error("Fetch error:", err);
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

let imageInterval = null; // To hold the setInterval ID
let vari = true;         // To toggle between true and false

window.onload = function() {
    updateButtonColor(); // Set initial button color to green
    if (vari) {
        startLoadingImages(); // Start image loading if 'vari' is true
    }
    setupCanvas(); // Initialize the drawing canvas
    
    // Initial data load
    loadLatestImage();
    updatePollenCount();
    updateTempHumidityChart();

    // Set intervals for auto-refreshing data
    setInterval(updatePollenCount, 30000);
    setInterval(updateTempHumidityChart, 30000);
}

function toggleLoadLatest() {
    vari = !vari; // Switch the state of 'vari' between true and false

    if (vari) {
        // Start the interval if 'vari' is true
        startLoadingImages();
    } else {
        // Clear the interval and stop the loading if 'vari' is false
        stopLoadingImages();
    }

    // Change the button color based on the state of 'vari'
    updateButtonColor();
}

function startLoadingImages() {
    console.log("starting loading...")
    if (!imageInterval) { // Prevent multiple intervals from running at the same time
        loadLatestImage(); // Load immediately first
        imageInterval = setInterval(loadLatestImage, 10000);
        console.log("setting interval")
    }
}

function stopLoadingImages() {
    console.log("stopping loading")
    if (imageInterval) {
        clearInterval(imageInterval);
        console.log("clearing interval")
        imageInterval = null;
    }
}

function updateButtonColor() {
    const button = document.getElementById('toggleButton');
  
    if (vari) {
        // If the update is on, make the button green
        button.style.backgroundColor = 'green';
        button.style.color = 'white';
    } else {
        // If the update is off, make the button red
        button.style.backgroundColor = 'red';
        button.style.color = 'white';
    }
}

function setupCanvas() {
    const img = document.getElementById("latestImage");
    canvas = document.getElementById("boundingCanvas");
    ctx = canvas.getContext("2d");

    const syncCanvasSize = () => {
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
    };

    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    img.onload = syncCanvasSize;

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", endDraw);
}

function startDraw(e) {
    if (!canvasVisible) return;

    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Clear and redraw all previous boxes
    redrawCanvas();

    const width = x - startX;
    const height = y - startY;

    ctx.strokeStyle = "limegreen";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, width, height);
}

function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const box = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY)
    };

    boundingBoxes.push(box);
    redrawCanvas();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!canvasVisible) return;

    for (const box of boundingBoxes) {
        ctx.strokeStyle = "limegreen";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
}

function toggleBoundingBoxes() {
    canvasVisible = !canvasVisible;
    canvas.style.display = canvasVisible ? "block" : "none";
    redrawCanvas();
    console.log("SHOWING/REMOVING BOXES");
}