const API_URL = 'https://your-api-endpoint.com/images'; // Replace with your actual API URL

async function loadLatestImage() {
    const status = document.getElementById("status");

    try {
        // Fetch the latest image data from the API
        const res = await fetch(API_URL);

        // Log response status and headers to debug any potential issues
        console.log('Response Status:', res.status);
        console.log('Response Headers:', res.headers);

        // Check if response is OK (status code 200-299)
        if (!res.ok) {
            console.error(`API responded with error: ${res.statusText}`);
            status.textContent = `Error: API responded with status ${res.status}`;
            return;
        }

        // Parse the JSON response
        const data = await res.json();
        console.log('API Response Data:', data);  // Log the full response body

        // Check if the data is an array and contains any image items
        if (Array.isArray(data) && data.length > 0) {
            // Get the latest image from the last item in the array (or you can sort by timestamp)
            const latestImage = data[data.length - 1]; // Get the most recent image from the end of the array

            if (latestImage && latestImage.image) {
                const img = document.getElementById("latestImage");
                img.src = `https://pollen.botondhorvath.com/images/${latestImage.image}`; // URL of the image served by your CDN
                status.textContent = `Last updated: ${new Date(latestImage.timestamp).toLocaleTimeString()}`;

                // Update image history (you can extend this part to track more images)
                updateImageHistory(data);  // You could update the history with the full array or just the latest
            } else {
                console.warn('No image field in the latest data:', latestImage);
                status.textContent = "No image data found in the API.";
            }
        } else {
            console.warn('The API did not return an array or is empty:', data);
            status.textContent = "No images found in the API.";
        }

    } catch (err) {
        // Log the error and update the status
        console.error('Error during API call:', err);
        status.textContent = "Error loading image from the API.";
    }
}

// Function to update image history
function updateImageHistory(data) {
    const historyList = document.getElementById("image-history");
    historyList.innerHTML = '';  // Clear the history before updating

    data.forEach(item => {
        const listItem = document.createElement('li');
        listItem.textContent = `Image: ${item.image} - Updated at: ${new Date(item.timestamp).toLocaleTimeString()}`;
        historyList.appendChild(listItem);
    });
}

// Load the latest image on page load
window.onload = loadLatestImage;
