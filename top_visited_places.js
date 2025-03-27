class TopVisitedPlaces {
    constructor() {
        this.geoserverUrl = 'http://localhost:8080/geoserver/wfs';
        this.tripsApiUrl = 'http://localhost:3000/api/trips';

        this.chart = null;
        this.useFallbackData = false; // Set to false to always use real data
        document.addEventListener('tripAdded', () => this.refreshData());
    }

    refreshData() {
        this.updateChartData();
    }

    async init() {

        try {
            await this.setupChart();
            await this.updateChartData();
        } catch (error) {
            console.error('Failed to initialize TopVisitedPlaces:', error);
            this.showErrorMessage('Failed to initialize');
        }
    }

    async setupChart() {
        const ctx = document.getElementById('barChart');
        if (!ctx) {
            console.error('Chart canvas element not found');
            return;
        }

        // Create gradient for bars
        const ctx2d = ctx.getContext('2d');
        const gradient = ctx2d.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, '#f9a3ff');
        gradient.addColorStop(1, '#cf65e9');
        
        // Create gradient for hover state
        const hoverGradient = ctx2d.createLinearGradient(0, 0, 0, 300);
        hoverGradient.addColorStop(0, '#ca83e3');
        hoverGradient.addColorStop(1, '#b56be6');

        this.chart = new Chart(ctx2d, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Rating',
                    data: [],
                    backgroundColor: gradient,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: hoverGradient,
                    hoverBorderColor: 'rgba(255, 255, 255, 0.6)',
                    hoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 10
                            },
                            stepSize: 1,
                            padding: 10
                        },
                        title: {
                            display: true,
                            text: 'Rating',
                            color: 'rgba(255, 255, 255, 0.9)',
                            font: {
                                size: 12,
                                weight: 'normal'
                            },
                            padding: {
                                top: 0,
                                bottom: 10
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 10
                            },
                            maxRotation: 45,
                            minRotation: 45,
                            padding: 5
                        },
                        title: {
                            display: true,
                            text: 'Top Rated Places',
                            color: 'rgba(255, 255, 255, 0.9)',
                            font: {
                                size: 12,
                                weight: 'normal'
                            },
                            padding: {
                                top: 10,
                                bottom: 0
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(35, 29, 39, 0.9)',
                        titleColor: '#f9a3ff',
                        titleFont: {
                            size: 13,
                            weight: 'bold'
                        },
                        bodyColor: 'rgba(255, 255, 255, 0.9)',
                        bodyFont: {
                            size: 12
                        },
                        cornerRadius: 6,
                        padding: 10,
                        displayColors: false,
                        borderColor: 'rgba(208, 130, 223, 0.3)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `Rating: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
    }

    async updateChartData() {
        try {
            // Always fetch from both sources
            const sites = await this.fetchSitesData();
            const dbLocations = await this.fetchDbLocationsWithVisitCounts();
            
            console.log('Fetched sites from geoserver:', sites);
            console.log('Fetched locations from database:', dbLocations);

            // Match places from database with geoserver sites to get ratings
            const matchedPlaces = this.matchPlaces(sites, dbLocations);
            console.log('Matched places with ratings:', matchedPlaces);
            
            // Get top 5 places by rating
            const topPlaces = matchedPlaces
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 5);
            console.log('Top places by rating:', topPlaces);

            if (topPlaces.length > 0) {
                this.updateChart(topPlaces);
            } else {
                console.warn('No matching places found');
                this.showErrorMessage('No matching places found');
            }
        } catch (error) {
            console.error('Error updating chart data:', error);
            this.showErrorMessage('Error updating data');
        }
    }

    async fetchSitesData() {
        try {
            const url = `${this.geoserverUrl}?service=WFS&version=1.0.0&request=GetFeature&typeName=ahm_point&outputFormat=application/json`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Geoserver error: ${response.status}`);
            }
            
            const data = await response.json();
            const sites = data.features
                .map(feature => ({
                    name: feature.properties.site_name,
                    rating: parseFloat(feature.properties.rating) || 0
                }))
                .filter(site => site.rating > 0 && site.name);
            
            return sites;
        } catch (error) {
            console.error('Error fetching sites from geoserver:', error);
            throw error;
        }
    }

    async fetchDbLocationsWithVisitCounts() {
        try {
            console.log(`Fetching trips from API at: ${this.tripsApiUrl}`);
            const response = await fetch(this.tripsApiUrl);
            console.log(`Response status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Trips API error: ${response.status} - ${response.statusText}`);
            }
            
            const trips = await response.json();
            
            if (!Array.isArray(trips)) {
                throw new Error('Expected array of trips');
            }
            
            // Count visits for each location
            const locationCounts = {};
            trips.forEach(trip => {
                if (trip && trip.location) {
                    const normalizedName = this.normalizeLocationName(trip.location);
                    if (!locationCounts[normalizedName]) {
                        locationCounts[normalizedName] = {
                            name: trip.location, // Keep original name for display
                            count: 0
                        };
                    }
                    locationCounts[normalizedName].count++;
                }
            });
            
            // Convert to array and sort by visit count (most visited first)
            const locationsArray = Object.values(locationCounts)
                .sort((a, b) => b.count - a.count);
            
            return locationsArray;
        } catch (error) {
            console.error('Error fetching trips from database:', error);
            throw error;
        }
    }

    showErrorMessage(message) {
        if (this.chart) {
            this.chart.data.labels = [message];
            this.chart.data.datasets[0].data = [0];
            this.chart.update();
        }
    }

    matchPlaces(sites, dbLocations) {
        if (!sites.length || !dbLocations.length) {
            return [];
        }
        
        // Match locations from database with sites from geoserver
        const matchedPlaces = [];
        
        for (const location of dbLocations) {
            const normalizedLocationName = this.normalizeLocationName(location.name);
            
            // Find matching site to get rating
            const matchingSite = sites.find(site => 
                this.normalizeLocationName(site.name) === normalizedLocationName
            );
            
            if (matchingSite) {
                matchedPlaces.push({
                    name: location.name, // Use original database location name
                    rating: matchingSite.rating,
                    visits: location.count
                });
            }
        }
        
        return matchedPlaces;
    }

    normalizeLocationName(name) {
        if (!name) return '';
        return name.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    updateChart(places) {
        if (!this.chart) {
            console.error('Chart not initialized');
            return;
        }
        
        if (places.length === 0) {
            this.showErrorMessage('No matching places found');
            return;
        }
        
        // Add animation for updating data
        this.chart.data.labels = places.map(p => p.name);
        
        // Update with animation
        this.chart.data.datasets[0].data = places.map(p => p.rating);
        
        // Update tooltip to show both rating and visit count
        this.chart.options.plugins.tooltip.callbacks.label = function(context) {
            const place = places[context.dataIndex];
            return [`Rating: ${place.rating}`, `Visits: ${place.visits}`];
        };
        
        // Apply a staggered animation effect
        this.chart.update({
            duration: 1000,
            easing: 'easeOutBounce'
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const topPlaces = new TopVisitedPlaces();
    topPlaces.init();
});

export default TopVisitedPlaces;
