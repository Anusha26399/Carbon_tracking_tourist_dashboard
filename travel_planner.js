// Global variables
const geoserverUrl = "http://localhost:8080/geoserver";
let sitesData = [];

// Function to load WFS data from geoserver
function loadWFSData() {
    const url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=routing:ahm_point&outputformat=application/json`;
    
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            if (!data.features || !Array.isArray(data.features)) {
                console.error('Invalid WFS response format:', data);
                return [];
            }
            console.log('Received WFS data:', data);
            sitesData = data.features;
            console.log('Processed sites data:', sitesData);
            return data;
        })
        .catch(error => {
            console.error('Error fetching WFS data:', error);
            alert('Failed to load map locations. Please try refreshing the page.');
            return [];
        });
}

// Function to populate category and location dropdowns
function populateDropdowns() {
    const categorySelect = document.getElementById('category');
    const locationSelect = document.getElementById('location');

    // Clear existing options
    categorySelect.innerHTML = '<option value="">Select a category</option>';
    locationSelect.innerHTML = '<option value="">Select a location</option>';

    // Add categories
    const categories = [
        { value: 'Heritage_Gems', label: 'Heritage Sites' },
        { value: 'museum', label: 'Museums' },
        { value: 'Temples and Religious Sites', label: 'Temples' },
        { value: 'Parks', label: 'Parks' },
        { value: 'Public_Structure', label: 'Public Structures' }
    ];
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.value;
        option.textContent = category.label;
        categorySelect.appendChild(option);
    });

    // Add event listeners
    categorySelect.addEventListener('change', function() {
        updateLocationDropdown(this.value);
    });

    locationSelect.addEventListener('change', function() {
        const selectedLocation = JSON.parse(this.value);
        if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
        }
    });
}

// Function to update location dropdown based on selected category
function updateLocationDropdown(selectedCategory) {
    const locationSelect = document.getElementById('location');
    locationSelect.innerHTML = '<option value="">Select a location</option>';
    
    if (!selectedCategory) return;
 
    // Filter sites by selected category
    const filteredSites = sitesData.filter(site => {
        console.log('Checking site:', site);
        console.log('Site properties:', site.properties);
        return site.properties.layer === selectedCategory;
    });
    
    // Sort sites alphabetically
    filteredSites.sort((a, b) => 
        a.properties.site_name.localeCompare(b.properties.site_name)
    );
    
    // Add filtered sites to location dropdown
    filteredSites.forEach(site => {
        const option = document.createElement('option');
        option.value = JSON.stringify({
            name: site.properties.site_name,
            longitude: site.properties.longitude,
            latitude: site.properties.latitude
        });
        option.textContent = site.properties.site_name;
        locationSelect.appendChild(option);
    });
}

// Function to handle form submission
// In travel_planner.js - modify the handleFormSubmit function
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const category = document.getElementById('category').value;
    const locationValue = document.getElementById('location').value;
    const date = document.getElementById('tripDate').value;
    
    if (!category || !locationValue || !date) {
        alert('Please fill all fields');
        return;
    }

    try {
        // Get location name from selected value
        const locationData = JSON.parse(locationValue);
        const locationName = locationData.name;
        const latitude = parseFloat(locationData.latitude);
        const longitude = parseFloat(locationData.longitude);



        // Calculate distance if user location is available
        let distance = null;
        if (typeof window.calculateTripDistance === 'function' && 
            locationData && locationData.latitude && locationData.longitude) {
            distance = window.calculateTripDistance(
                locationData.latitude, 
                locationData.longitude
            );


            console.log(`Calculated distance to ${locationData.name}: ${distance} km`);
        } else {
            console.warn('Unable to calculate distance: location data or function unavailable');
        }


        // Validate and format the date
        const visitdate = new Date(date);
        if (isNaN(visitdate.getTime())) {
            throw new Error('Invalid date selected');
        }
        const formattedDate = visitdate.toISOString().split('T')[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Prepare request body with distance if available
        const requestBody = {
            category,
            location: locationName,
            latitude: latitude,
            longitude: longitude,



            visitdate: formattedDate,
                transportMode: document.getElementById('transportMode').value,
                status: visitdate < today ? 'completed' : 'pending',

        };
        
        // Add distance if calculated
            if (distance !== null) {
                requestBody.distance = parseFloat(distance.toFixed(2)); // Round to 2 decimal places
            }
            
            // Validate location is a non-empty string
            if (typeof locationName !== 'string' || !locationName.trim()) {
                throw new Error('Invalid location format');
            }

        
        const response = await fetch('http://localhost:3000/api/trips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

            if (response.ok) {
                const tripData = await response.json();
                let successMessage = 'Trip saved successfully!';
                if (distance !== null) {
                    successMessage += ` Distance: ${distance.toFixed(2)} km`;
                }
                alert(successMessage);
                
                // Clear form fields
                document.getElementById('category').value = '';
                document.getElementById('location').value = '';
                document.getElementById('tripDate').value = '';
                document.getElementById('transportMode').value = 'bus';
                
                // Dispatch tripAdded event
                const event = new CustomEvent('tripAdded', { detail: tripData });
                document.dispatchEvent(event);
                
                    // Refresh trips display and counts
                    loadTrips();
                    if (typeof window.updateTripCounts === 'function') {
                        window.updateTripCounts();
                    }


        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save trip');
        }
    } catch (error) {
        console.error('Error saving trip:', error);
        alert('Failed to save trip. Please try again.');
    }
}
// Import trip overview functions
import { loadTrips, updateTripsDisplay } from './trip_overview.js';

// Initialize dropdowns and event listeners when page loads
window.addEventListener('load', () => {
    loadWFSData().then((data) => {
        console.log('WFS data loaded successfully');
        populateDropdowns();
    }).catch(error => {
        console.error('Error loading WFS data:', error);
    });
    
    // Add form submit handler
    document.getElementById('tripForm').addEventListener('submit', handleFormSubmit);
    
    // Load existing trips
    loadTrips();
});
