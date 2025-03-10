async function updateLocationHeader() {
    if (!navigator.geolocation) {
        console.error('Geolocation is not supported by your browser');
        const locationElement = document.getElementById('locationName');
        if (locationElement) {
            locationElement.textContent = 'Geolocation not supported';
        }
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    {
                        headers: {
                            'User-Agent': 'YourAppName/1.0 (your-email@example.com)'
                        }
                    }
                );
                const data = await response.json();

                // **Display the full address**
                const fullAddress = data.display_name || 'Address not available';

                // Update the header with the full address
                const locationElement = document.getElementById('locationName');
                if (locationElement) {
                    locationElement.textContent = fullAddress;
                }

                console.log('Full Address:', fullAddress); // Debugging purpose
            } catch (error) {
                console.error('Error fetching location data:', error);
                const locationElement = document.getElementById('locationName');
                if (locationElement) {
                    locationElement.textContent = 'Error fetching location';
                }
            }
        },
        (error) => {
            console.error('Error getting location:', error);
            const locationElement = document.getElementById('locationName');
            if (locationElement) {
                locationElement.textContent = 'Location access denied or unavailable';
            }
        },
        {
            enableHighAccuracy: true
        }
    );
}

window.addEventListener('load', updateLocationHeader);
