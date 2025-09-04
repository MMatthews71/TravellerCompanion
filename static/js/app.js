// DOM Elements
const statusElement = document.getElementById('status');
const resultsBody = document.getElementById('results-body');
let serviceButtons;
const sortButtons = document.querySelectorAll('.sort-btn');
const foodTypeFilter = document.getElementById('food-type-filter');
const supermarketTypeFilter = document.getElementById('supermarket-type-filter');
const hostelTypeFilter = document.getElementById('hostel-type-filter');

// Current state
let currentLocation = null;
let currentResults = [];
let currentSort = 'distance';
let currentService = null;
let allFoodResults = [];
let allSupermarketResults = [];
let allHostelResults = [];



// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    serviceButtons = document.querySelectorAll('.service-btn');

    serviceButtons.forEach(button => {
        button.addEventListener('click', () => handleServiceClick(button));
    });

    sortButtons.forEach(button => {
        button.addEventListener('click', () => handleSortClick(button));
    });

    if (foodTypeFilter) {
        foodTypeFilter.addEventListener('change', filterFoodResults);
    }

    if (supermarketTypeFilter) {
        supermarketTypeFilter.addEventListener('change', filterSupermarketResults);
    }

    if (hostelTypeFilter) {
        hostelTypeFilter.addEventListener('change', filterHostelResults);
    }
    
});

// Handle service button clicks
// Handle service button clicks
async function handleServiceClick(button) {
    const service = button.dataset.service;
    currentService = service;
    const serviceName = button.textContent.trim();

    serviceButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Hide filters by default
    document.querySelector('.food-filter-container')?.classList.add('hidden');
    document.querySelector('.supermarket-filter-container')?.classList.add('hidden');
    document.querySelector('.hostel-filter-container')?.classList.add('hidden'); 
    
    // Map service names to their plural forms
    const pluralForms = {
        'laundry': 'laundries',
        'pharmacy': 'pharmacies',
        'supermarket': 'supermarkets',
        'food': 'restaurants',
        'atm': 'ATMs',
        'hostel': 'hostels',
        'bus_station': 'transport'
    };
    
    const displayText = pluralForms[service] || `${serviceName}s`;
    showStatus(`Finding nearby ${displayText}...`, 'info');

    try {
        const position = await getCurrentLocation();
        currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        // ✅ Update location box with city + country
        updateLocationBox(currentLocation.lat, currentLocation.lng);

        let results = [];

        if (service === 'food') {
            const categories = [
                { key: 'restaurant', label: 'restaurant' },
                { key: 'fast food', label: 'fast food' },
                { key: 'cafe', label: 'cafe' }
            ];

            const searches = categories.map(cat =>
                searchPlaces(cat.key, currentLocation, cat.key)
            );
            const resultsArrays = await Promise.all(searches);
            const merged = [].concat(...resultsArrays);

            const seen = new Set();
            results = merged.filter(p => {
                const key = p.place_id || `${p.name}|${p.address}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            allFoodResults = results;
            document.querySelector('.food-filter-container').classList.remove('hidden');
        }
        else if (service === 'supermarket') {
            const categories = [
                { key: 'supermarket', label: 'supermarket' },
                { key: 'convenience store', label: 'convenience store' },
                { key: 'local market', label: 'local market' },
                { key: 'general store', label: 'general store' }
            ];

            const searches = categories.map(cat =>
                searchPlaces(cat.key, currentLocation, cat.key)
            );
            const resultsArrays = await Promise.all(searches);
            const merged = [].concat(...resultsArrays);

            const seen = new Set();
            results = merged.filter(p => {
                const key = p.place_id || `${p.name}|${p.address}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            allSupermarketResults = results;
            document.querySelector('.supermarket-filter-container').classList.remove('hidden');
        }
        else if (service === 'hostel') {
            const categories = [
                { key: 'hostel', label: 'hostel' },
                { key: 'hotel', label: 'hotel' },
                { key: 'lodging', label: 'lodging' }
            ];
        
            const searches = categories.map(cat =>
                searchPlaces(cat.key, currentLocation, cat.key)
            );
            const resultsArrays = await Promise.all(searches);
            const merged = [].concat(...resultsArrays);
        
            // Add category to each place and deduplicate
            const seen = new Set();
            results = merged.map(p => ({
                ...p,
                category: p.types && p.types[0] || p.category || 'lodging'  // Use the most specific category available
            })).filter(p => {
                const key = p.place_id || `${p.name}|${p.address}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        
            allHostelResults = results;
            document.querySelector('.hostel-filter-container').classList.remove('hidden');
        }
        else {
            results = await searchPlaces(service, currentLocation);
            allFoodResults = [];
            allSupermarketResults = [];
        }

        currentResults = results;

        // Map service names to their plural forms
        const pluralForms = {
            'laundry': { singular: 'laundry', plural: 'laundries' },
            'pharmacy': { singular: 'pharmacy', plural: 'pharmacies' },
            'supermarket': { singular: 'supermarket', plural: 'supermarkets' },
            'food': { singular: 'restaurant', plural: 'restaurants' },
            'atm': { singular: 'ATM', plural: 'ATMs' },
            'hostel': { singular: 'hostel', plural: 'hostels' },
            'bus_station': { singular: 'transport', plural: 'transport' }
        };
        
        const serviceInfo = pluralForms[service] || { singular: serviceName.toLowerCase(), plural: `${serviceName.toLowerCase()}s` };
        
        if (results.length === 0) {
            showStatus(`No ${serviceInfo.plural} found nearby.`, 'info');
            clearResults();
        } else {
            const countText = results.length === 1 ? serviceInfo.singular : serviceInfo.plural;
            showStatus(`Found ${results.length} ${countText} nearby.`, 'info');
            displayResults(results);
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus(error.message, 'error');
        clearResults();
    }
}

function getCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn("Geolocation not supported, using fallback.");
            resolve({ coords: { latitude: -12.046374, longitude: -77.042793 } }); // Lima
            return;
        }

        // Check cached location first
        const cached = localStorage.getItem("lastLocation");
        if (cached) {
            resolve({ coords: JSON.parse(cached) });
        }

        const options = { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 };
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                localStorage.setItem("lastLocation", JSON.stringify(coords));
                resolve({ coords });
            },
            (err) => {
                console.warn("Location error, using fallback:", err);
                resolve({ coords: { latitude: -12.046374, longitude: -77.042793 } });
            },
            options
        );
    });
}


// Search for places using backend API
async function searchPlaces(keyword, location, category = null) {
    try {
        const params = new URLSearchParams({
            lat: location.lat,
            lng: location.lng,
            keyword: keyword
        });

        const response = await fetch(`/search?${params}`);
        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message || 'Failed to search for places.');
        }

        return data.results.map(place => {
            // Determine which category to use based on current service
            let placeCategory = category;
            if (currentService === 'hostel') {
                placeCategory = place.category || category;
            }
            
            return {
                ...place,
                distance: calculateDistance(
                    location.lat,
                    location.lng,
                    place.location.lat,
                    place.location.lng
                ),
                foodCategory: currentService === 'food' ? category : null,
                supermarketCategory: currentService === 'supermarket' ? category : null,
                category: placeCategory  // Add the category to the place object
            };
        });
    } catch (error) {
        console.error('Search error:', error);
        throw new Error('Failed to search for places. Please try again later.');
    }
}

// Distance calculation (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
}
function toRad(degrees) { return degrees * (Math.PI / 180); }

// Display results
function displayResults(results) {
    clearResults();
    const resultsSection = document.getElementById('results-section');
    const sortOptions = document.getElementById('sort-options');
    
    // Hide sort options by default
    sortOptions.classList.add('hidden');
    
    resultsSection.classList.remove('hidden');

    if (!results || results.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8; // Updated to account for the new Price column
        cell.textContent = 'No locations found.';
        cell.className = 'no-results';
        row.appendChild(cell);
        resultsBody.appendChild(row);
        return;
    }
    
    // Show sort options since we have results
    sortOptions.classList.remove('hidden');

    const sortedResults = sortResults(results, currentSort);

    // Show/hide price column header based on current service
    const priceHeader = document.querySelector('th:nth-child(3)');
    if (priceHeader) {
        priceHeader.style.display = currentService === 'food' ? 'table-cell' : 'none';
    }

    sortedResults.forEach(place => {
        const row = document.createElement('tr');
        row.classList.add('place-row');
        row.dataset.placeId = place.place_id;

        const name = document.createElement('td');

        // Add icon if available
        if (place.icon) {
            const iconImg = document.createElement('img');
            iconImg.src = place.icon;
            iconImg.alt = place.name;
            iconImg.className = "place-icon"; // we'll style this
            name.appendChild(iconImg);
        }

        // Add the name text
        const nameText = document.createElement('span');
        nameText.textContent = place.name;
        name.appendChild(nameText);

        const category = document.createElement('td');
        let categoryValue;
        if (currentService === 'hostel') {
            // For hostels, use the category from the place object first
            categoryValue = place.category || place.types?.[0] || 'lodging';
        } else if (currentService === 'laundry') {
            // For laundry, use the specific category
            categoryValue = 'laundry';
        } else if (currentService === 'pharmacy') {
            // For pharmacy, use the specific category
            categoryValue = 'pharmacy';
        } else if (currentService === 'atm') {
            // For ATM, use the specific category
            categoryValue = 'atm';
        } else {
            // For other services, use the existing logic
            categoryValue = place.foodCategory || place.supermarketCategory || 'general';
        }
        const formattedCategory = formatCategoryName(categoryValue);
        category.textContent = formattedCategory;

        // Add price level
        const price = document.createElement('td');
        if (place.price_level !== undefined) {
            price.textContent = '$$$$'.substring(0, Math.min(place.price_level, 4)) || 'N/A';
        } else {
            price.textContent = 'N/A';
        }

        const rating = document.createElement('td');
        rating.textContent = place.rating !== 'N/A' ? place.rating : 'N/A';

        const totalRatings = document.createElement('td');
        totalRatings.textContent = place.total_ratings || 'N/A';

        const status = document.createElement('td');
        const statusBadge = document.createElement('span');

        if (place.open_now === true) {
            statusBadge.className = 'status open';
            statusBadge.textContent = 'Open';
        } else if (place.open_now === false) {
            statusBadge.className = 'status closed';
            statusBadge.textContent = 'Closed';
        } else {
            statusBadge.className = 'status unknown';
            statusBadge.textContent = 'Unknown';
        }

        status.appendChild(statusBadge);


        const distance = document.createElement('td');
        const walkingMinutes = Math.round((place.distance / 5) * 60); // 5 km/h speed
        distance.textContent = `${walkingMinutes} min`;

        const mapLink = document.createElement('td');
        if (place.place_id) {       
            const link = document.createElement('a');
            link.href = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'map-link';
            link.textContent = 'View';
            mapLink.appendChild(link);
        } else {
            mapLink.textContent = 'N/A';
        }

        row.appendChild(name);
        row.appendChild(category);
        
        // Only show price column for food service
        if (currentService === 'food') {
            row.appendChild(price);
        }
        
        row.appendChild(rating);
        row.appendChild(totalRatings);
        row.appendChild(status);
        row.appendChild(distance);
        row.appendChild(mapLink);

        row.addEventListener('click', () => toggleDetailsRow(place, row));

        resultsBody.appendChild(row);
    });
}

// Clear results
function clearResults() { resultsBody.innerHTML = ''; }

// Handle sort clicks
function handleSortClick(button) {
    const sortBy = button.dataset.sort;
    sortButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    currentSort = sortBy;
    if (currentResults.length > 0) displayResults(currentResults);
}

// Sort results
function sortResults(results, sortBy) {
    const sorted = [...results];
    switch (sortBy) {
        case 'distance': return sorted.sort((a, b) => a.distance - b.distance);
        case 'rating': return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        case 'ratings': return sorted.sort((a, b) => (b.total_ratings || 0) - (a.total_ratings || 0));
        default: return sorted;
    }
}

// Status messages
function showStatus(message, type = 'info') {
    statusElement.textContent = message;
    statusElement.className = 'status-message visible ' + type;
    if (type === 'info') {
        setTimeout(() => { statusElement.classList.remove('visible'); }, 5000);
    }
}

// Filtering
function filterFoodResults() {
    if (currentService !== 'food' || allFoodResults.length === 0) return;
    const filterType = foodTypeFilter.value;
    const filtered = filterType === 'all'
        ? allFoodResults
        : allFoodResults.filter(p => p.foodCategory === filterType);
    currentResults = filtered;
    displayResults(filtered);
}

function filterSupermarketResults() {
    if (currentService !== 'supermarket' || allSupermarketResults.length === 0) return;
    const filterType = supermarketTypeFilter.value;
    const filtered = filterType === 'all'
        ? allSupermarketResults
        : allSupermarketResults.filter(p => p.supermarketCategory === filterType);
    currentResults = filtered;
    displayResults(filtered);
}
function filterHostelResults() {
    if (currentService !== 'hostel' || allHostelResults.length === 0) return;
    const filterType = hostelTypeFilter.value;
    const filtered = filterType === 'all'
        ? allHostelResults
        : allHostelResults.filter(p => p.foodCategory === filterType || p.supermarketCategory === filterType || p.category === filterType);
    currentResults = filtered;
    displayResults(filtered);
}


// Format category names for display
function formatCategoryName(category) {
    const categoryMap = {
        'restaurant': 'Restaurant',
        'fast_food': 'Fast Food',
        'cafe': 'Café',
        'supermarket': 'Supermarket',
        'convenience_store': 'Convenience Store',
        'local_market': 'Local Market',
        'hostel': 'Hostel',
        'hotel': 'Hotel',
        'lodging': 'Lodging',
        'laundry': 'Laundry',
        'atm': 'ATM',
        'general': 'General'
    };
    
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
}

// Toggle details row with photo gallery
async function toggleDetailsRow(place, row) {
    const existingDetailsRow = row.nextElementSibling;
    if (existingDetailsRow && existingDetailsRow.classList.contains('details-row')) {
        existingDetailsRow.remove();
        return;
    }

    document.querySelectorAll('.details-row').forEach(r => r.remove());

    const detailsRow = document.createElement('tr');
    detailsRow.classList.add('details-row');

    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 7;
    detailsCell.textContent = 'Loading photos...';
    detailsRow.appendChild(detailsCell);

    row.insertAdjacentElement('afterend', detailsRow);

    try {
        if (!place.place_id) {
            detailsCell.textContent = '⚠️ No place_id available for this location.';
            return;
        }

        console.log("Fetching photos for place_id:", place.place_id);
        const response = await fetch(`/place-details?place_id=${place.place_id}`);
        console.log("Raw photo fetch response:", response);

        const data = await response.json();
        console.log("Photo fetch JSON:", data);

        detailsCell.innerHTML = '';

// About info section (if available)
const aboutSection = document.createElement('div');
aboutSection.classList.add('about-section');

// Add price level to about section if not food service
if (currentService !== 'food' && place.price_level !== undefined) {
    const priceItem = document.createElement('div');
    priceItem.classList.add('about-item');
    priceItem.innerHTML = `<strong>Price Level:</strong> ${'$'.repeat(Math.min(place.price_level, 4)) || 'N/A'}`;
    aboutSection.appendChild(priceItem);
}

if (data.about && data.about.length > 0) {
    const aboutTitle = document.createElement('h4');
    aboutTitle.textContent = "About this place";
    aboutSection.appendChild(aboutTitle);

    const aboutList = document.createElement('ul');
    data.about.forEach(item => {
        const li = document.createElement('li');
    
        // Detect website entries and make them clickable
        if (item.startsWith("🌐 Website: ")) {
            const url = item.replace("🌐 Website: ", "").trim();
            const link = document.createElement('a');
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "🌐 Website";
            li.appendChild(link);
        } else {
            li.textContent = item;
        }
    
        aboutList.appendChild(li);
    });
    
    aboutSection.appendChild(aboutList);
}

detailsCell.appendChild(aboutSection);

        // Photos section (if available)
        if (data.photos && data.photos.length > 0) {
            const gallery = document.createElement('div');
            gallery.classList.add('photo-gallery');

            data.photos.forEach(url => {
                const imgWrapper = document.createElement('div');
                imgWrapper.classList.add('photo-wrapper');

                const img = document.createElement('img');
                img.src = url;
                img.alt = place.name;
                img.loading = "lazy";

                const link = document.createElement('a');
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";

                link.appendChild(img);
                imgWrapper.appendChild(link);
                gallery.appendChild(imgWrapper);
            });

            detailsCell.appendChild(gallery);
        } else {
            if (!data.about || data.about.length === 0) {
                detailsCell.textContent = 'No details available.';
            }
        }

    } catch (err) {
        console.error('Photo fetch error:', err);
        detailsCell.textContent = '❌ Failed to load photos.';
    }
}
let currentAddress = null;

async function updateLocationBox(lat, lng) {
    if (currentAddress) {
        document.getElementById("user-location").textContent = `📍 ${currentAddress}`;
        return;
    }

    try {
        const resp = await fetch(`/reverse-geocode?lat=${lat}&lng=${lng}`);
        const data = await resp.json();
        if (data.status === "ok") {
            currentAddress = data.address;
            document.getElementById("user-location").textContent = `📍 ${currentAddress}`;
        } else {
            document.getElementById("user-location").textContent = `📍 Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        }
    } catch {
        document.getElementById("user-location").textContent = `📍 Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
}
