// Function to load and display trips
async function loadTrips() {
    try {
        console.log('Fetching trips from API...');
        const response = await fetch('http://localhost:3000/api/trips');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const trips = await response.json();
        console.log('Trips data received:', trips);
        console.log('Number of trips:', trips.length);
        console.log('First trip:', trips[0]);

        
        // Validate trips data structure
        if (!Array.isArray(trips)) {
            throw new Error('Invalid trips data format: expected array');
        }
        
        // Validate and normalize trip objects
        trips.forEach(trip => {
            if (!trip.id) {
                console.warn('Trip missing id, generating temporary id');
                trip.id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
            if (!trip.location) {
                console.warn('Trip missing location, using default location');
                trip.location = { name: 'Unknown Location' };
            } else if (typeof trip.location === 'string') {
                trip.location = { name: trip.location };
            } else if (trip.location.coordinates && !trip.location.name) {
                trip.location.name = 'Unknown Location';
            }

            // Validate and set visitdate
            if (!trip.visitdate || isNaN(new Date(trip.visitdate))) {
                console.warn('Trip has invalid or missing visitdate, using current date');
                trip.visitdate = new Date().toISOString();
            } else {
                // Ensure visitdate is in ISO format
                trip.visitdate = new Date(trip.visitdate).toISOString();
            }

        });


        updateTripsDisplay(trips);
    } catch (error) {
        console.error('Error loading trips:', JSON.stringify({
            message: error.message,
            stack: error.stack,
            name: error.name,
            responseStatus: error.response?.status,
            responseText: error.response?.statusText
        }, null, 2));

        const tripsContainer = document.getElementById('tripsList');
        if (tripsContainer) {
            tripsContainer.innerHTML = `
                <div class="p-4 bg-red-100 rounded-lg">
                    <p class="text-red-700">Error loading trips: ${error.message}</p>
                    ${error.stack ? `<pre class="text-xs text-red-600 mt-2">${error.stack}</pre>` : ''}
                    <p class="text-sm text-red-600 mt-2">Please try refreshing the page or contact support.</p>
                </div>
            `;
        }
    }

}
// Function to update both counters
async function updatePlacesVisitedCount() {
    try {
        const response = await fetch('http://localhost:3000/api/trips/counts');
        if (response.ok) {
            const counts = await response.json();
            
            const plannedVisitsElement = document.querySelector('.planned-visits-count');
            if (plannedVisitsElement) {
                plannedVisitsElement.textContent = counts.pending;
            }
            
            const placesVisitedElement = document.querySelector('.places-visited-count');
            if (placesVisitedElement) {
                placesVisitedElement.textContent = counts.completed;
            }
        }
    } catch (error) {
        console.error('Error updating trip counts:', error);
    }
}



function updateTripsDisplay(trips) {
    const tripsContainer = document.getElementById('tripsList');
    if (!tripsContainer) {
        console.error('Trips container element not found');
        return;
    }

    // Clear existing content
    tripsContainer.innerHTML = '';

    // Get completed trips sorted by most recent ID first
    const completedTrips = trips
        .filter(trip => trip.status === 'completed')
        .sort((a, b) => b.id - a.id)
        .slice(0, 4);

    // Get pending trips sorted by most recent ID first
    const pendingTrips = trips
        .filter(trip => trip.status === 'pending')
        .sort((a, b) => b.id - a.id)
        .slice(0, 4);

    // Create the main trips content container
    const tripsContent = document.createElement('div');
    tripsContent.className = 'space-y-4';

    // Create completed trips section
    if (completedTrips.length > 0) {
        const completedSection = document.createElement('div');
        completedSection.innerHTML = `
            <h3 class="text-base mb-2 text-green-400 font-medium">Completed Trips</h3>
            <ul class="text-sm list-disc list-inside space-y-1"></ul>
        `;
        const completedList = completedSection.querySelector('ul');
        completedTrips.forEach(trip => {
            const tripItem = document.createElement('li');
            tripItem.className = 'p-1.5 bg-green-900/30 rounded-md';
            tripItem.innerHTML = `
                ${trip.location.name} <span class="text-xs text-gray-400">- ${new Date(trip.visitdate).toLocaleDateString('en-US', { day: 'numeric', date:'numeric' ,month: 'long', year: 'numeric' })}</span>



            `;
            completedList.appendChild(tripItem);
        });
        tripsContent.appendChild(completedSection);
    }

    // Create pending trips section
    if (pendingTrips.length > 0) {
        const pendingSection = document.createElement('div');
        pendingSection.innerHTML = `
            <h3 class="text-base mb-2 text-yellow-400 font-medium">Pending Trips</h3>
            <ul class="text-sm list-disc list-inside space-y-1"></ul>
        `;
        const pendingList = pendingSection.querySelector('ul');
        pendingTrips.forEach(trip => {
            const tripItem = document.createElement('li');
            tripItem.className = 'p-1.5 bg-yellow-900/30 rounded-md';
            tripItem.innerHTML = `
                ${trip.location?.name  || 'Unknown Location'} <span class="text-xs text-gray-400">- ${new Date(trip.visitdate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>



            `;
            pendingList.appendChild(tripItem);
        });
        tripsContent.appendChild(pendingSection);
    }

    // Show message if no trips
    if (trips.length === 0) {
        tripsContainer.innerHTML = `
            <div class="p-6 bg-gray-100 rounded-lg text-center">
                <p class="text-gray-600">No trips planned yet.</p>
                <p class="text-sm text-gray-500 mt-2">Start by adding a new trip using the planner!</p>
            </div>
        `;
    } else {
        // Append the trips content to the container
        tripsContainer.appendChild(tripsContent);
    }
}

// Initialize trip overview when page loads
window.addEventListener('load', () => {
    loadTrips();
    updatePlacesVisitedCount(); // Fetch initial count on load
});


// Listen for trip added event
document.addEventListener('tripAdded', () => {
    updatePlacesVisitedCount(); // Update count when a trip is added
});



export { loadTrips, updateTripsDisplay };
