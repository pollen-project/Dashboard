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
          status.textContent = `Last updated: ${new Date(
            latestImage.timestamp
          ).toLocaleTimeString()}`;

          // Refresh history list
          updateImageHistory(data);
          updatePollenCount();
          getAverages();
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
  historyElement.innerHTML = "";

  imageFiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const imagesToShow = showAll ? imageFiles : imageFiles.slice(0, 20);

  imagesToShow.forEach((file) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.padding = "4px 8px";
    li.style.cursor = "pointer";
    li.title = "Click to view this image";

    const timestampText = new Date(file.timestamp).toLocaleString();
    const detectionCount = file.detectedPollenCount ?? 0;
    const detectionText = parseFloat(detectionCount.toFixed(2));

    const dateSpan = document.createElement("span");
    dateSpan.textContent = timestampText;

    const countSpan = document.createElement("span");
    countSpan.textContent = detectionText;
    countSpan.style.fontSize = "0.9em";
    countSpan.style.color = detectionCount === 0 ? "#888" : "#2ba162";

    li.appendChild(dateSpan);
    li.appendChild(countSpan);

    li.addEventListener("click", () => {
      const img = document.getElementById("latestImage");
      img.src = `https://pollen.botondhorvath.com/images/${file.image}`;
      document.getElementById(
        "status"
      ).textContent = `Viewing image from: ${timestampText}`;

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

  file.detections.forEach((detection) => {
    try {
      const box = detection.box;
      if (
        !box ||
        box.x1 == null ||
        box.x2 == null ||
        box.y1 == null ||
        box.y2 == null
      ) {
        return;
      }

      const x = box.x1 * scaleX;
      const y = box.y1 * scaleY;
      const width = (box.x2 - box.x1) * scaleX;
      const height = (box.y2 - box.y1) * scaleY;

      boundingBoxes.push({
        x,
        y,
        width,
        height,
        confidence: detection.confidence,
      });
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

      pollenData.splice(
        0,
        pollenData.length,
        ...reversedData.map((entry) => {
          const rawCount = entry.detectedPollenCount * 7.1;

          const count = !isNaN(Number(rawCount)) ? Number(rawCount) : 0; // Fallback to 0 if invalid
          return {
            time: new Date(entry.timestamp),
            count: count,
          };
        })
      );
      isInitialLoad = false;
    } else {
      // Add just the latest reading
      const latest = data[0]; // or data[data.length - 1] depending on order
      const newEntry = {
        time: new Date(latest.timestamp),
        count: Number(latest.detectedPollenCount),
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

  const labels = pollenData.map((entry) => entry.time.toLocaleTimeString());
  const data = pollenData.map((entry) => entry.count);

  const avg = data.length
    ? data.reduce((sum, val) => sum + val, 0) / data.length
    : 0;
  const averageLine = new Array(data.length).fill(avg);

  if (!chart) {
    const ctx = document.getElementById("pollenChart").getContext("2d");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Pollen Count",
            data: data,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.3,
            pointRadius: 2,
          },
          {
            label: "Average",
            data: averageLine,
            borderColor: "rgba(255, 99, 132, 0.8)",
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: "Time" } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Particles/m³" },
          },
        },
        plugins: {
          legend: { labels: { boxWidth: 12, padding: 10 } },
        },
      },
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
    const response = await fetch(url);

    if (!response.ok) {
      status.textContent = `Error: API responded with status ${response.status}`;
      return;
    }

    const data = await response.json();

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
let vari = true; // To toggle between true and false

window.onload = function () {
  updateButtonColor(); // Set initial button color to green
  if (vari) {
    startLoadingImages(); // Start image loading if 'vari' is true
  }
  setupCanvas(); // Initialize the drawing canvas

  // Initial data load
  loadLatestImage();

  updateTempHumidityChart();

  fetchPollenEstimate();
  // Set intervals for auto-refreshing data

  setInterval(updateTempHumidityChart, 30000);
};

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
  console.log("starting loading...");
  if (!imageInterval) {
    // Prevent multiple intervals from running at the same time
    loadLatestImage(); // Load immediately first
    imageInterval = setInterval(loadLatestImage, 10000);
    console.log("setting interval");
  }
}

function stopLoadingImages() {
  console.log("stopping loading");
  if (imageInterval) {
    clearInterval(imageInterval);
    console.log("clearing interval");
    imageInterval = null;
  }
}

function updateButtonColor() {
  const button = document.getElementById("toggleButton");

  if (vari) {
    // If the update is on, make the button green
    button.style.backgroundColor = "green";
    button.style.color = "white";
  } else {
    // If the update is off, make the button red
    button.style.backgroundColor = "red";
    button.style.color = "white";
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

async function getAverages(mode = "daily") {
  try {
    const response = await fetch(
      `https://pollen.botondhorvath.com/api/detections?mode=${mode}`
    );
    const data = await response.json();

    const averages = data.map((entry) => {
      const date = new Date(entry.timestamp);

      let label;
      if (mode === "daily") {
        // e.g., "02 May"
        label = date.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        });
      } else {
        // e.g., "14:00"
        label = date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        console.log("label:", label, entry.detectedPollenCount);
      }

      return {
        label,
        average: entry.detectedPollenCount,
      };
    });

    displayAverages(averages, mode);
  } catch (error) {
    console.error("Error fetching pollen data:", error);
    displayAverages([], mode);
  }
}

document.getElementById("dailyBtn").addEventListener("click", () => {
  setActiveMode("daily");
});

document.getElementById("hourlyBtn").addEventListener("click", () => {
  setActiveMode("hourly");
});

function setActiveMode(mode) {
  // Fetch and display new data
  getAverages(mode);

  // Toggle active button class
  document
    .querySelectorAll(".mode-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.getElementById(`${mode}Btn`).classList.add("active");
}

function displayAverages(averages, mode = "daily") {
  const container = document.getElementById("averagesDisplay");
  container.innerHTML = "";

  const thresholds =
    mode === "hourly"
      ? { low: 20, moderate: 100 }
      : { low: 200, moderate: 500 };

  // Generate labels for the last 7 days or hours
  const labels = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    if (mode === "daily") {
      date.setDate(now.getDate() - i);
      labels.push(
        date.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        })
      );
    } else {
      date.setHours(now.getHours() - i);
      date.setMinutes(0, 0, 0); // Set minutes, seconds, and ms to 0
      labels.push(
        date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    }
  }

  // Map existing averages to their label
  const dataMap = Object.fromEntries(averages.map((a) => [a.label, a]));

  container.innerHTML = "<div class='pollen-container-wrapper'>";

  labels.forEach((label) => {
    const avg = dataMap[label];

    if (avg) {
      let colorClass = "";
      let levelText = "";

      if (avg.average < thresholds.low) {
        colorClass = "green";
        levelText = "LOW";
      } else if (avg.average <= thresholds.moderate) {
        colorClass = "yellow";
        levelText = "MED";
      } else {
        colorClass = "red";
        levelText = "HIGH";
      }

      container.innerHTML += `
        <div class="pollen-container">
          <div class="pollen-date">${avg.label}</div>
          <div class="pollen-item ${colorClass}">
            <div class="pollen-level">${levelText}</div>
            <div class="pollen-count">${avg.average}</div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML += `
        <div class="pollen-container">
          <div class="pollen-date">${label}</div>
          <div class="pollen-item no-data">
            <div class="pollen-level">NO DATA</div>
            <div class="pollen-count">--</div>
          </div>
        </div>
      `;
    }
  });

  container.innerHTML += "</div>";
}

document
  .getElementById("togglePollenBox")
  .addEventListener("click", function () {
    const box = document.getElementById("pollenBox");
    const isVisible = !box.classList.contains("hidden");

    if (isVisible) {
      box.classList.add("hidden");
      this.textContent = "Show Pollen Info";
    } else {
      box.classList.remove("hidden");
      this.textContent = "Hide Pollen Info";
    }
  });

async function fetchPollenEstimate() {
  try {
    const response = await fetch(
      "https://pollen.botondhorvath.com/api/history?device=pollen3"
    );
    const data = await response.json();

    // Take the latest 10 entries
    const latest = data;

    // Process values
    const multiplied = latest.map((entry) => entry.detectedPollenCount * 7.1);
    const average =
      multiplied.reduce((sum, val) => sum + val, 0) / multiplied.length;

    // Update the UI
    document.getElementById("pollen_estimate").textContent = average.toFixed(2);

    // Determine the pollen level and apply color
    const pollenLevelElement = document.getElementById("pollen_level");

    let levelText = "";
    let levelClass = "";

    if (average < 15) {
      levelText = "LOW";
      levelClass = "green";
    } else if (average >= 15 && average <= 50) {
      levelText = "MED";
      levelClass = "yellow";
    } else {
      levelText = "HIGH";
      levelClass = "red";
    }

    // Update the pollen level display with the appropriate text and color
    pollenLevelElement.textContent = levelText;
    pollenLevelElement.className = levelClass;
  } catch (error) {
    console.error("Failed to fetch or process pollen data:", error);
    document.getElementById("pollen_estimate").textContent = "Error";
    document.getElementById("pollen_level").textContent = "Error";
  }
}
