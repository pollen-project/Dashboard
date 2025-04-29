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
          const img = document.getElementById("latestImage");
          lastImageFilename = latestImage.image;
          img.src = `https://pollen.botondhorvath.com/images/${latestImage.image}`;
          img.onload = () => drawDetections(latestImage);

          
          // Update timestamp text
          status.textContent = `Last updated: ${new Date(latestImage.timestamp).toLocaleTimeString()}`;

          // Refresh history list
          updateImageHistory(data);
          updatePollenCount();
          img.onload = () => {
            drawDetections(latestImage);
          };

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



function updateImageHistory(imageFiles, showAll = false) {
  const historyElement = document.getElementById("imageHistory");
  historyElement.innerHTML = '';

  imageFiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const imagesToShow = showAll ? imageFiles : imageFiles.slice(0, 20);

  imagesToShow.forEach(file => {
    const li = document.createElement("li");
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.padding = '4px 8px';
    li.style.cursor = 'pointer';
    li.title = "Click to view this image";

    const timestampText = new Date(file.timestamp).toLocaleString();
    const detectionCount = file.detections ? file.detections.length : 0;
    const detectionText = detectionCount === 1 ? "1 detection" : `${detectionCount} detections`;

    const dateSpan = document.createElement("span");
    dateSpan.textContent = timestampText;

    const countSpan = document.createElement("span");
    countSpan.textContent = detectionText;
    countSpan.style.fontSize = '0.9em';
    countSpan.style.color = detectionCount === 0 ? '#888' : '#2ba162';

    li.appendChild(dateSpan);
    li.appendChild(countSpan);

    li.addEventListener("click", () => {
      const img = document.getElementById("latestImage");
      img.src = `https://pollen.botondhorvath.com/images/${file.image}`;
      document.getElementById("status").textContent = `Viewing image from: ${timestampText}`;

      img.onload = () => {
        drawDetections(file);
      };
    });

    historyElement.appendChild(li);
  });
}




function drawDetections(file) {
  const img = document.getElementById("latestImage");

  if (!canvas || !ctx) {
    console.warn("Canvas not initialized yet");
    return;
  }

  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;

  boundingBoxes = [];
  redrawCanvas();

  if (!file || !file.detections || file.detections.length === 0) {
    console.log("No detections found");
    return;
  }

  const scaleX = canvas.width / img.naturalWidth;
  const scaleY = canvas.height / img.naturalHeight;

  file.detections.forEach(detection => {
    try {
      const box = detection.box;
      if (!box ||
          box.x1 == null || box.x2 == null ||
          box.y1 == null || box.y2 == null) {
        return;
      }

      const x = box.x1 * scaleX;
      const y = box.y1 * scaleY;
      const width = (box.x2 - box.x1) * scaleX;
      const height = (box.y2 - box.y1) * scaleY;

      boundingBoxes.push({ x, y, width, height, confidence: detection.confidence });


    } catch (e) {
      console.warn("Invalid detection data:", detection, e);
    }
  });

  redrawCanvas();
}

let isInitialLoad = true;

async function updatePollenCount() {
  const API_URL = "https://pollen.botondhorvath.com/api/history?device=pollen3";

  try {
    const res = await fetch(API_URL);
    const data = await res.json();



    if (isInitialLoad) {
      // Load the last 20 readings into pollenData

      const first20Data = data; // Slice first 20 entries

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
  const recentData = pollenData;
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




async function loadFilteredImages() {
  const fromInput = document.getElementById("fromDate")?.value;
  const untilInput = document.getElementById("untilDate")?.value;
  const status = document.getElementById("status");
  const img = document.getElementById("latestImage");

  if (!status || !img) {
    console.error("Missing status or image elements in the DOM.");
    return;
  }

  if (!fromInput || !untilInput) {
    status.textContent = "Please select both 'From' and 'Until' dates.";
    return;
  }

  const fromDate = new Date(fromInput);
  const untilDate = new Date(untilInput);

  if (fromDate >= untilDate) {
    status.textContent = "'Until' date must be after 'From' date.";
    return;
  }

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
      const latestImage = data[data.length - 1];
    
      if (latestImage.image !== lastImageFilename) {
        lastImageFilename = latestImage.image;
        img.src = `https://pollen.botondhorvath.com/images/${latestImage.image}`;
      }
    
      updateImageHistory(data, true); // now pass the full list, not sliced
      status.textContent = `Showing ${data.length} image(s) from ${fromInput} to ${untilInput}`;
    } else {
      status.textContent = "No images found for the selected time range.";
    }
  } catch (err) {
    status.textContent = "An error occurred while loading images.";
    console.error("Fetch error:", err);
  }
}



let imageInterval = null; // To hold the setInterval ID
let vari = true;         // To toggle between true and false

window.onload = function () {
  updateButtonColor(); // Set initial button color to green
  if (vari) {
    startLoadingImages(); // Start image loading if 'vari' is true
  }
  setupCanvas(); // Initialize the drawing canvas
  

  // Initial data load
  loadLatestImage();

  updateTempHumidityChart();

  // Set intervals for auto-refreshing data

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
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!canvasVisible) return;

  for (const box of boundingBoxes) {
    ctx.strokeStyle = "limegreen";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    if (box.confidence !== undefined) {
      ctx.fillStyle = "white";
      ctx.font = "14px Arial";
      const confText = `Conf: ${(box.confidence * 100).toFixed(1)}%`;
      ctx.fillText(confText, box.x + 2, box.y - 5);
    }
  }
}

function toggleBoundingBoxes() {
  canvasVisible = !canvasVisible;
  canvas.style.display = canvasVisible ? "block" : "none";
  redrawCanvas();
  console.log("SHOWING/REMOVING BOXES");
}