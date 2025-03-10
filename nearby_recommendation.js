// Constants for GeoServer configuration
const GEOSERVER_URL = "http://localhost:8080/geoserver";
const SEARCH_RADIUS = 3000; // 2km radius for nearby places

// Tourist place categories from layer attribute
const TOURIST_CATEGORIES = [
    'Heritage_Gems',
    'museum',
    'Temples and Religious Sites',
    'Parks',
    'Public_Structure'
];

// Function to get user's current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            (error) => reject(error),
            { enableHighAccuracy: true }
        );
    });
}

// Function to calculate distance for sorting
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Function to fetch nearby places from GeoServer based on layer
async function fetchNearbyPlaces(latitude, longitude, layer) {
    const bbox = calculateBoundingBox(latitude, longitude, SEARCH_RADIUS);
    const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=routing:ahm_point&outputFormat=application/json&bbox=${bbox.join(',')},EPSG:4326`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Filter features based on layer type
        const filteredFeatures = data.features.filter(feature => {
            if (layer === 'tourist_places') {
                return TOURIST_CATEGORIES.includes(feature.properties.layer);
            }
            return feature.properties.layer === layer;
        });

        // Sort by distance and return only site names
        return filteredFeatures
            .map(feature => ({
                name: feature.properties.site_name,
                distance: calculateDistance(
                    latitude,
                    longitude,
                    feature.properties.latitude,
                    feature.properties.longitude
                )
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 2) // Get top 2 nearest places
            .map(place => place.name); // Return only the names
    } catch (error) {
        console.error(`Error fetching ${layer}:`, error);
        return ['Unable to load places'];
    }
}

// Function to calculate bounding box for WFS query
function calculateBoundingBox(latitude, longitude, radius) {
    const latDegree = radius / 111320;
    const lonDegree = radius / (111320 * Math.cos(latitude * Math.PI / 180));
    return [
        longitude - lonDegree,
        latitude - latDegree,
        longitude + lonDegree,
        latitude + latDegree
    ];
}

// Function to update recommendations in the UI with original dashboard styling
function updateRecommendationsUI(recommendations) {
    // Update Hotels section - keeping original styling
    const hotelsList = document.querySelector('h3.text-blue-400').nextElementSibling;
    hotelsList.innerHTML = recommendations.hotels.map(hotelName => `
        <li class="p-1.5 bg-blue-900/20 rounded-md flex">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            ${hotelName}
        </li>
    `).join('');

    // Update Restaurants section - keeping original styling
    const restaurantsList = document.querySelector('h3.text-orange-400').nextElementSibling;
    restaurantsList.innerHTML = recommendations.restaurants.map(restaurantName => `
        <li class="p-1.5 bg-pink-900/20 rounded-md flex">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ${restaurantName}
        </li>
    `).join('');

    // Update Places to Visit section - keeping original styling
    const placesList = document.querySelector('h3.text-purple-400').nextElementSibling;
    placesList.innerHTML = recommendations.places.map(placeName => `
        <li class="p-1.5 bg-purple-900/20 rounded-md flex">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ${placeName}
        </li>
    `).join('');
}

// Main function to fetch and update recommendations
async function updateRecommendations() {
    try {
        const coords = await getCurrentLocation();
        
        // Fetch recommendations for each category
        const [hotels, restaurants, places] = await Promise.all([
            fetchNearbyPlaces(coords.latitude, coords.longitude, 'hotel'),
            fetchNearbyPlaces(coords.latitude, coords.longitude, 'food'),
            fetchNearbyPlaces(coords.latitude, coords.longitude, 'tourist_places')
        ]);

        // Update UI with fetched recommendations
        updateRecommendationsUI({
            hotels,
            restaurants,
            places
        });

    } catch (error) {
        console.error('Error updating recommendations:', error);
        // Show error message in UI
        const recommendationsContainer = document.querySelector('.text-sm.space-y-4');
        recommendationsContainer.innerHTML = `
            <div class="p-4 bg-red-900/20 rounded-md">
                <p class="text-red-400">Unable to fetch recommendations. Please check your location settings and try again.</p>
            </div>
        `;
    }
}

// Initialize recommendations when page loads
document.addEventListener('DOMContentLoaded', () => {
    updateRecommendations();
    
    // Update recommendations every 5 minutes
    setInterval(updateRecommendations, 300000);
});

// Export functions for use in other modules
export {
    updateRecommendations,
    getCurrentLocation,
    fetchNearbyPlaces
};