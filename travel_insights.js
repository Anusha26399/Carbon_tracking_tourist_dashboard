// Global variables to store user's current location and trips data
let userLatitude = null;
let userLongitude = null;
let completedTrips = [];

// Function to fetch completed trips from API
async function fetchCompletedTrips() {
    try {
        const response = await fetch('http://localhost:3000/api/trips?status=completed');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Validate and normalize trip data
        const validatedTrips = data.map(trip => {
            try {
                // Skip if no coordinates
                if (typeof trip.latitude !== 'number' || typeof trip.longitude !== 'number') {
                    console.warn('Trip missing valid coordinates:', {
                        id: trip.id,
                        latitude: trip.latitude,
                        longitude: trip.longitude,
                        location: trip.location,
                        status: trip.status
                    });
                    return null;
                }


                // Return trip with coordinates
                return {
                    ...trip,
                    location: {
                        coordinates: [trip.longitude, trip.latitude],
                        name: trip.location || 'Unknown Location'
                    }
                };

            } catch (error) {
                console.error('Error processing trip data:', {
                    tripId: trip.id,
                    error: error.message,
                    stack: error.stack
                });
                return null;
            }
        }).filter(trip => trip !== null);


        completedTrips = validatedTrips;
        console.log('Completed trips fetched and validated:', completedTrips);
        return validatedTrips;
    } catch (error) {
        console.error('Error fetching completed trips:', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}



// Function to initialize location tracking and trips data
function initLocationTracking() {
    // Fetch completed trips when initializing
    fetchCompletedTrips()
        .then(trips => {
            // Add markers for completed trips
            trips.forEach(trip => {
                if (trip.location) {
                    try {
                        // Parse location data safely
                        const locationData = typeof trip.location === 'string' ? 
                            JSON.parse(trip.location) : trip.location;
                        
                        // Validate coordinates
                        if (locationData && locationData.coordinates && 
                            Array.isArray(locationData.coordinates) &&
                            locationData.coordinates.length === 2) {
                            
                            const coordinates = locationData.coordinates;
                            const marker = new ol.Feature({
                                geometry: new ol.geom.Point(ol.proj.fromLonLat(coordinates)),
                                name: locationData.name || 'Unknown Location'
                            });
                            map.getLayers().getArray()[1].getSource().addFeature(marker);
                        } else {
                            console.warn('Invalid location data format:', locationData);
                        }
                    } catch (error) {
                        console.error('Error processing location data:', {
                            error: error.message,
                            location: trip.location
                        });
                    }
                }
            });


        })
        .catch(error => {
            console.error('Error initializing trips data:', error);
        });

    if (!navigator.geolocation) {
        console.error('Geolocation is not supported by your browser');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLatitude = position.coords.latitude;
            userLongitude = position.coords.longitude;
            console.log('User location initialized:', userLatitude, userLongitude);
        },
        (error) => {
            console.error('Error getting initial location:', error);
        },
        {
            enableHighAccuracy: true
        }
    );
    
    // Set up a watcher to update location if user moves
    navigator.geolocation.watchPosition(
        (position) => {
            userLatitude = position.coords.latitude;
            userLongitude = position.coords.longitude;
            console.log('User location updated:', userLatitude, userLongitude);
        },
        (error) => {
            console.error('Error watching location:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 30000, // 30 seconds
            timeout: 27000 // 27 seconds
        }
    );
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Function to modify the existing handleFormSubmit to include distance calculation
function enhanceFormSubmitWithDistance(originalHandleFormSubmit) {
    return async function enhancedHandleFormSubmit(event) {
        event.preventDefault();
        
        // Check if location is available
        if (userLatitude === null || userLongitude === null) {
            console.warn('User location not available for distance calculation');
            // Still allow the form to submit without distance
            return originalHandleFormSubmit(event);
        }
        
        const locationSelectValue = document.getElementById('location').value;
        if (!locationSelectValue) {
            return originalHandleFormSubmit(event);
        }
        
        try {
            // Parse the destination location from the dropdown
            const selectedLocation = JSON.parse(locationSelectValue);
            
            if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
                // Calculate distance
                const distance = calculateDistance(
                    userLatitude,
                    userLongitude,
                    parseFloat(selectedLocation.latitude),
                    parseFloat(selectedLocation.longitude)
                );
                
                console.log('Calculated distance:', distance, 'km');
                
                // Add the distance to the form data by modifying the original event handler
                const originalFormSubmit = originalHandleFormSubmit;
                
                // Create a new submit event 
                const newEvent = Object.create(event);
                
                // Override the preventDefault to do nothing
                newEvent.preventDefault = function() {};
                
                // Call the original handler first to validate inputs
                await originalFormSubmit(newEvent);
                
                // Now submit with our distance included
                const category = document.getElementById('category').value;
                const location = document.getElementById('location').value;
                const date = document.getElementById('tripDate').value;
                
                if (!category || !location || !date) {
                    alert('Please fill all fields');
                    return;
                }
                
                // Validate and format the date
                const visitDate = new Date(date);
                if (isNaN(visitDate.getTime())) {
                    throw new Error('Invalid date selected');
                }
                const formattedDate = visitDate.toISOString().split('T')[0];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Build the request body with distance included
                const requestBody = {
                    category,
                    location: JSON.parse(location).name || location,
                    visitDate: formattedDate,
                    transportMode: document.getElementById('transportMode').value,
                    status: visitDate < today ? 'completed' : 'pending',
                    distance: parseFloat(distance.toFixed(2))  // Round to 2 decimal places
                };
                
                const response = await fetch('http://localhost:3000/api/trips', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                
                if (response.ok) {
                    alert(`Trip saved successfully! Distance: ${distance.toFixed(2)} km`);
                    // Clear form fields
                    document.getElementById('category').value = '';
                    document.getElementById('location').value = '';
                    document.getElementById('tripDate').value = '';
                    document.getElementById('transportMode').value = 'bus';
                    // Refresh trips display
                    loadTrips();
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to save trip');
                }
            } else {
                // If no valid coordinates, fall back to original handler
                return originalHandleFormSubmit(event);
            }
        } catch (error) {
            console.error('Error in enhanced form handler:', error);
            return originalHandleFormSubmit(event);
        }
    };
}

// Function to enhance trip display with distance information
function enhanceTripDisplayWithDistance() {
    // Modify the updateTripsDisplay function to show distance
    const originalUpdateTripsDisplay = window.updateTripsDisplay;
    
    if (typeof originalUpdateTripsDisplay === 'function') {
        window.updateTripsDisplay = function(trips) {

            // Let the original function do its work
            originalUpdateTripsDisplay(trips);
            
            // Now enhance the display with distance information
            const tripCards = document.querySelectorAll('.trip-card');
            
            trips.forEach((trip, index) => {
                if (trip.distance && tripCards[index]) {
                    // Find or create a distance element
                    let distanceElement = tripCards[index].querySelector('.trip-distance');
                    
                    if (!distanceElement) {
                        distanceElement = document.createElement('div');
                        distanceElement.className = 'trip-distance';
                        tripCards[index].appendChild(distanceElement);
                    }
                    
                    // Update the distance text
                    distanceElement.textContent = `Distance: ${trip.distance} km`;
                }
            });
        };
    }
}

// Initialize the travel insights module
function initTravelInsights() {
    console.log('Initializing Travel Insights module');
    
    // Listen for new trip additions
    document.addEventListener('tripAdded', async (event) => {
        const trip = event.detail;
        if (trip.status === 'completed') {
            // Add new marker
            const marker = new ol.Feature({
                geometry: new ol.geom.Point(
                    ol.proj.fromLonLat([trip.longitude, trip.latitude])
                ),
                name: trip.location
            });
            map.getLayers().getArray()[1].getSource().addFeature(marker);
            
            // Update places visited count
            const placesVisitedElement = document.querySelector('.places-visited-count');
            if (placesVisitedElement) {
                const currentCount = parseInt(placesVisitedElement.textContent) || 0;
                placesVisitedElement.textContent = currentCount + 1;
            }
            
            // Update total distance
            const totalDistanceElement = document.getElementById('totalDistance');
            if (totalDistanceElement && trip.distance) {
                const currentDistance = parseFloat(totalDistanceElement.textContent) || 0;
                totalDistanceElement.textContent = (currentDistance + trip.distance).toFixed(2);
            }
            
            // Update trip counts
            const plannedVisitsElement = document.querySelector('.planned-visits-count');

            if (plannedVisitsElement && placesVisitedElement) {
                const response = await fetch('http://localhost:3000/api/trips/counts');
                if (response.ok) {
                    const counts = await response.json();
                    plannedVisitsElement.textContent = counts.pending;
                    placesVisitedElement.textContent = counts.completed;
                }
                if (typeof window.fetchEmissionsData === 'function') {
                    window.fetchEmissionsData();
                } else {
                    // Fallback if fetchEmissionsData isn't available in the global scope
                    try {
                        const response = await fetch('http://localhost:3000/api/emissions');
                        if (response.ok) {
                            const data = await response.json();
                            const netCarbonElement = document.getElementById('net');
                            const emissionsSavedElement = document.getElementById('saved');
                            
                        }
                    } catch (error) {
                        console.error('Error updating emissions data:', error);
                    }
            }
        }
    }
});


    
    // Start tracking user location
    initLocationTracking();
    
    // Initialize map markers for completed trips
    initTripMarkers();

    
    // Function to fetch and display total distance
    async function updateTotalDistance() {
        try {
            const response = await fetch('http://localhost:3000/api/trips/total-distance');
            if (response.ok) {
                const data = await response.json();
                const totalDistanceElement = document.getElementById('totalDistance');
                if (totalDistanceElement) {
                totalDistanceElement.textContent = `${data.totalDistance.toFixed(2)} km`;


                }
            }
        } catch (error) {
            console.error('Error fetching total distance:', error);
        }
    }

    // Function to fetch and update trip counts
    async function updateTripCounts() {
        try {
            const response = await fetch('http://localhost:3000/api/trips/counts');
            if (response.ok) {
                const counts = await response.json();
                
                // Update planned visits count
                const plannedVisitsElement = document.querySelector('.planned-visits-count');
                if (plannedVisitsElement) {
                    plannedVisitsElement.textContent = counts.pending;
                }
                
                // Update places visited count
                const placesVisitedElement = document.querySelector('.places-visited-count');
                if (placesVisitedElement) {
                    placesVisitedElement.textContent = counts.completed;
                }
            }
        } catch (error) {
            console.error('Error fetching trip counts:', error);
        }
    }

    // Update trip counts on load and set interval for periodic updates
    updateTripCounts();
    setInterval(updateTripCounts, 10000); // Update every 10 seconds

    // Update total distance on load and set interval for periodic updates
    updateTotalDistance();
    setInterval(updateTotalDistance, 10000); // Update every 10 seconds
    
    // Wait for the page to load completely
    window.addEventListener('load', () => {
        // Check if the form exists and handleFormSubmit is defined
        const tripForm = document.getElementById('tripForm');
        
        if (tripForm && typeof handleFormSubmit === 'function') {
            // Remove the original event listener
            const clonedForm = tripForm.cloneNode(true);
            tripForm.parentNode.replaceChild(clonedForm, tripForm);
            
            // Add our enhanced event listener
            const enhancedHandler = enhanceFormSubmitWithDistance(handleFormSubmit);
            clonedForm.addEventListener('submit', enhancedHandler);
            
            console.log('Form submit handler enhanced with distance calculation');
        } else {
            console.warn('Trip form or handler not found, could not enhance with distance');
        }
        
        // Enhance trip display with distance information
        enhanceTripDisplayWithDistance();
    });
    
    // Also provide a utility function to manually calculate distance
    window.calculateTripDistance = function(destinationLat, destinationLng) {
        if (userLatitude === null || userLongitude === null) {
            console.warn('User location not available');
            return null;
        }
        
        return calculateDistance(
            userLatitude,
            userLongitude,
            parseFloat(destinationLat),
            parseFloat(destinationLng)
        );
    };
}

// Function to initialize and update trip markers on map
async function initTripMarkers() {
    try {
        // Fetch completed trips from database
        const response = await fetch('http://localhost:3000/api/trips?status=completed');
        if (!response.ok) throw new Error('Failed to fetch trips');
        
        const trips = await response.json();
        
        // Create vector source for markers
        const markerSource = new ol.source.Vector();
        
        // Add markers for each completed trip
        trips.forEach(trip => {
            if (trip.location && trip.location.coordinates) {
                const marker = new ol.Feature({
                    geometry: new ol.geom.Point(
                        ol.proj.fromLonLat(trip.location.coordinates)
                    ),
                    name: trip.location.name
                });
                
                marker.setStyle(new ol.style.Style({
                    image: new ol.style.Icon({
                        src: 'map with roouting/icons/source_marker.png',
                        scale: 0.07
                    })
                }));
                
                markerSource.addFeature(marker);
            }
        });
        
        // Add marker layer to map
        const markerLayer = new ol.layer.Vector({
            source: markerSource
        });
        map.addLayer(markerLayer);
        
    } catch (error) {
        console.error('Error initializing trip markers:', error);
    }
}


// Export functions for use in other modules
export {
    initTravelInsights,
    calculateDistance,
    enhanceFormSubmitWithDistance,
    initTripMarkers
};

// Auto-initialize when script is loaded
initTravelInsights();
