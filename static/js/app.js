// Global state
let currentLocation = null;
let currentResults = [];
let currentSort = 'distance';
let currentService = null;
let allFoodResults = [];
let allSupermarketResults = [];
let allHostelResults = [];
let allHealthcareResults = [];
let allSimResults = [];

// DOM elements
const statusElement = document.getElementById('status-message');
const resultsBody = document.getElementById('results-body');
const resultsContainer = document.getElementById('results-container');
const controlsBar = document.getElementById('controls-bar');
const serviceButtons = document.querySelectorAll('.service-btn');
const sortButtons = document.querySelectorAll('.sort-btn');
const locationText = document.getElementById('location-text');
const priceHeader = document.getElementById('price-header');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  detectLocation();
});

function initializeEventListeners() {
  serviceButtons.forEach(button => {
    button.addEventListener('click', () => handleServiceClick(button));
  });

  sortButtons.forEach(button => {
    button.addEventListener('click', () => handleSortClick(button));
  });

  // Click to dismiss status messages
  statusElement.addEventListener('click', () => {
    statusElement.classList.remove('visible');
  });

  // Filter button clicks
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
      const filterType = e.target.dataset.type;
      const filterValue = e.target.dataset.filter;
      
      // Update active state
      const filterContainer = e.target.closest('.filter-container');
      filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      e.target.classList.add('active');
      
      // Apply the filter
      if (filterType === 'food') {
        filterFoodResults(filterValue);
      } else if (filterType === 'supermarket') {
        filterSupermarketResults(filterValue);
      } else if (filterType === 'hostel') {
        filterHostelResults(filterValue);
      } else if (filterType === 'healthcare') {
        filterHealthcareResults(filterValue);
      }
    }
  });
}

async function detectLocation() {
  try {
    const position = await getCurrentLocation();
    currentLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    updateLocationDisplay(currentLocation.lat, currentLocation.lng);
  } catch (error) {
    console.warn('Location detection failed:', error);
    currentLocation = { lat: -12.046374, lng: -77.042793 };
    locationText.textContent = "Lima, Peru (fallback)";
  }
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    const cached = localStorage.getItem("lastLocation");
    if (cached) {
      try {
        const coords = JSON.parse(cached);
        resolve({ coords });
        return;
      } catch (e) {}
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        localStorage.setItem("lastLocation", JSON.stringify(coords));
        resolve({ coords });
      },
      reject,
      options
    );
  });
}

async function updateLocationDisplay(lat, lng) {
  try {
    const response = await fetch(`/reverse-geocode?lat=${lat}&lng=${lng}`);
    const data = await response.json();
    if (data.status === "ok") {
      locationText.textContent = data.address;
    } else {
      locationText.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    locationText.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

async function handleServiceClick(button) {
  const service = button.dataset.service;
  currentService = service;

  // Update button states
  serviceButtons.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');

  // Show controls
  controlsBar.classList.remove('hidden');

  // Hide all filters
  document.querySelectorAll('[class*="-filter-container"]').forEach(container => {
    container.classList.add('hidden');
  });

  // Show/hide price column and sort button
  const costSortBtn = document.getElementById('sort-cost');
  if (service === 'food') {
    costSortBtn.classList.remove('hidden');
    priceHeader.style.display = 'table-cell';
  } else {
    costSortBtn.classList.add('hidden');
    priceHeader.style.display = 'none';
    if (costSortBtn.classList.contains('active')) {
      document.getElementById('sort-distance').click();
    }
  }

  showStatus(`Searching for nearby ${getServiceDisplayName(service)}...`, 'info');

  try {
    if (!currentLocation) {
      throw new Error('Location not available. Please allow location access.');
    }

    let results = [];

    if (service === 'food') {
      results = await searchPlaces('food');
      allFoodResults = results;
      document.querySelector('.food-filter-container').classList.remove('hidden');

    } else if (service === 'supermarket') {
      results = await searchPlaces('supermarket');
      allSupermarketResults = results;
      document.querySelector('.supermarket-filter-container').classList.remove('hidden');

    } else if (service === 'hostel') {
      results = await searchPlaces('hostel');
      allHostelResults = results;
      document.querySelector('.hostel-filter-container').classList.remove('hidden');

    } else if (service === 'pharmacy') {
      results = await searchPlaces('pharmacy');
      allHealthcareResults = results;
      document.querySelector('.healthcare-filter-container').classList.remove('hidden');

    } else {
      results = await searchPlaces(service);
    }

    currentResults = results;
    displayResults(results);

    if (results.length === 0) {
      showStatus(`No ${getServiceDisplayName(service)} found nearby.`, 'info');
    } else {
      showStatus(`Found ${results.length} ${getServiceDisplayName(service, results.length)}.`, 'info');
    }

  } catch (error) {
    showStatus('Search failed. Please try again.', 'error');
    console.error('Search error:', error);
  }
}

async function searchPlaces(keyword) {
  if (!currentLocation) {
    throw new Error('Location not available');
  }

  try {
    const params = new URLSearchParams({
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      keyword: keyword
    });

    const response = await fetch(`/search?${params}`);
    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.message || 'Search failed');
    }

    return data.results.map(place => {
      return {
        ...place,
        distance: calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          place.location.lat,
          place.location.lng
        ),
        walkTime: Math.round((calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          place.location.lat,
          place.location.lng
        ) / 5) * 60)
      };
    });
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

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

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

function displayResults(results) {
  resultsBody.innerHTML = '';
  resultsContainer.classList.remove('hidden');

  if (!results || results.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = 'No locations found.';
    cell.style.textAlign = 'center';
    cell.style.padding = '2rem';
    cell.style.color = 'var(--text-muted)';
    row.appendChild(cell);
    resultsBody.appendChild(row);
    return;
  }

  const sortedResults = sortResults(results, currentSort);

  sortedResults.forEach(place => {
    const row = document.createElement('tr');
    row.dataset.placeId = place.place_id;

    // Place name with icon
    const nameCell = document.createElement('td');
    const nameContent = document.createElement('div');
    nameContent.className = 'place-name';
    
    if (place.icon) {
      const icon = document.createElement('img');
      icon.src = place.icon;
      icon.className = 'place-icon';
      icon.alt = place.name;
      nameContent.appendChild(icon);
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = place.name;
    nameContent.appendChild(nameSpan);
    nameCell.appendChild(nameContent);

    // Category
    const categoryCell = document.createElement('td');
    categoryCell.textContent = formatCategoryName(place.category || 'general');

    // Price (only for food)
    const priceCell = document.createElement('td');
    priceCell.className = 'price-display';
    if (currentService === 'food') {
      if (place.price_level !== undefined && place.price_level !== null) {
        priceCell.textContent = '$'.repeat(Math.min(place.price_level + 1, 4));
      } else {
        priceCell.textContent = '?';
        priceCell.style.opacity = '0.6';
      }
    } else {
      priceCell.style.display = 'none';
    }

    // Rating
    const ratingCell = document.createElement('td');
    const ratingContent = document.createElement('div');
    ratingContent.className = 'rating-display';
    if (place.rating && place.rating !== 'N/A') {
      ratingContent.innerHTML = `⭐ ${place.rating}`;
    } else {
      ratingContent.textContent = 'N/A';
      ratingContent.style.opacity = '0.6';
    }
    ratingCell.appendChild(ratingContent);

    // Total ratings
    const ratingsCell = document.createElement('td');
    ratingsCell.textContent = place.total_ratings || 'N/A';

    // Status
    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge';

    if (place.open_now === true) {
      statusBadge.classList.add('open');
      statusBadge.innerHTML = '🟢 Open';
    } else if (place.open_now === false) {
      statusBadge.classList.add('closed');
      statusBadge.innerHTML = '🔴 Closed';
    } else {
      statusBadge.classList.add('unknown');
      statusBadge.innerHTML = '⚪ Unknown';
    }
    statusCell.appendChild(statusBadge);

    // Distance/Walk time
    const distanceCell = document.createElement('td');
    distanceCell.innerHTML = `🚶 ${place.walkTime} min`;

    row.appendChild(nameCell);
    row.appendChild(categoryCell);
    row.appendChild(priceCell);
    row.appendChild(ratingCell);
    row.appendChild(ratingsCell);
    row.appendChild(statusCell);
    row.appendChild(distanceCell);

    row.addEventListener('click', () => toggleDetailsRow(place, row));
    resultsBody.appendChild(row);
  });
}

function sortResults(results, sortBy) {
  const sorted = [...results];
  switch (sortBy) {
    case 'distance':
      return sorted.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    case 'rating':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'ratings':
      return sorted.sort((a, b) => (b.total_ratings || 0) - (a.total_ratings || 0));
    case 'cost':
      return sorted.sort((a, b) => {
        const aPrice = (a.price_level !== undefined && a.price_level !== null) ? a.price_level : Infinity;
        const bPrice = (b.price_level !== undefined && b.price_level !== null) ? b.price_level : Infinity;
        return aPrice - bPrice;
      });
    default:
      return sorted;
  }
}

function handleSortClick(button) {
  const sortBy = button.dataset.sort;
  sortButtons.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  currentSort = sortBy;
  if (currentResults.length > 0) {
    displayResults(currentResults);
  }
}

function filterFoodResults(filterType) {
  if (currentService !== 'food' || allFoodResults.length === 0) return;
  const filtered = filterType === 'all' 
    ? allFoodResults 
    : allFoodResults.filter(p => p.category === filterType);
  currentResults = filtered;
  displayResults(filtered);
}

function filterSupermarketResults(filterType) {
  if (currentService !== 'supermarket' || allSupermarketResults.length === 0) return;
  const filtered = filterType === 'all' 
    ? allSupermarketResults 
    : allSupermarketResults.filter(p => p.category === filterType);
  currentResults = filtered;
  displayResults(filtered);
}

function filterHostelResults(filterType) {
  if (currentService !== 'hostel' || allHostelResults.length === 0) return;
  const filtered = filterType === 'all' 
    ? allHostelResults 
    : allHostelResults.filter(p => p.category === filterType);
  currentResults = filtered;
  displayResults(filtered);
}

function filterHealthcareResults(filterType) {
  if (currentService !== 'pharmacy' || allHealthcareResults.length === 0) return;
  const filtered = filterType === 'all' 
    ? allHealthcareResults 
    : allHealthcareResults.filter(p => p.category === filterType);
  currentResults = filtered;
  displayResults(filtered);
}

async function toggleDetailsRow(place, row) {
  const existingDetailsRow = row.nextElementSibling;
  if (existingDetailsRow && existingDetailsRow.classList.contains('details-row')) {
      existingDetailsRow.remove();
      return;
  }

  // Remove other open details
  document.querySelectorAll('.details-row').forEach(r => r.remove());

  const detailsRow = document.createElement('tr');
  detailsRow.className = 'details-row';

  const mapContainerId = `map-${place.place_id}`;
  
  detailsRow.innerHTML = `
  <td colspan="7">
      <div class="details-content merged-container">
          <div class="details-body">
              <div class="details-columns">
                  <div class="details-about" id="about-items-${place.place_id}">
                      <h5 class="section-subtitle">Details</h5>
                      <div class="about-item"><strong>Address:</strong> ${place.address}</div>
                      <div class="about-item"><strong>Walk Time:</strong> ${place.walkTime} min</div>
                  </div>
                  
                  <div class="details-photos">
                      <div class="photos-container" id="photos-container-${place.place_id}">
                          Loading photos...
                      </div>
                  </div>
              </div>
              
              <div class="details-map">
                  <div class="map-container" id="${mapContainerId}"></div>
                  <div class="map-legend">
                      <div class="legend-item">
                          <span class="legend-dot current-dot"></span>
                          Your location
                      </div>
                      <div class="legend-item">
                          <span class="legend-dot place-dot"></span>
                          ${place.name}
                      </div>
                  </div>
              </div>
          </div>
      </div>
  </td>
`;

  row.insertAdjacentElement('afterend', detailsRow);
  
  // Render the map with a slight delay to ensure DOM is ready
  setTimeout(() => {
      renderMap(place, mapContainerId);
  }, 100);

  // Load photos and additional details
  if (place.place_id) {
      try {
          const response = await fetch(`/place-details?place_id=${place.place_id}`);
          const data = await response.json();

          const aboutItems = document.getElementById(`about-items-${place.place_id}`);
          const photosContainer = document.getElementById(`photos-container-${place.place_id}`);

          // Add additional about information
          if (data.about && data.about.length > 0) {
              data.about.forEach(item => {
                  const aboutItem = document.createElement('div');
                  aboutItem.className = 'about-item';
                  
                  if (item.includes('http')) {
                      const url = item.replace(/.*?Website: /, '').trim();
                      aboutItem.innerHTML = `🌐 <a href="${url}" target="_blank" rel="noopener">Visit Website</a>`;
                  } else {
                      aboutItem.textContent = item;
                  }
                  
                  aboutItems.appendChild(aboutItem);
              });
          }

          // Display photos
          if (data.photos && data.photos.length > 0) {
              photosContainer.innerHTML = '';
              data.photos.forEach(photoUrl => {
                  const photoWrapper = document.createElement('div');
                  photoWrapper.className = 'photo-wrapper';
                  
                  const link = document.createElement('a');
                  link.href = photoUrl;
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  
                  const img = document.createElement('img');
                  img.src = photoUrl;
                  img.alt = place.name;
                  img.loading = 'lazy';
                  
                  link.appendChild(img);
                  photoWrapper.appendChild(link);
                  photosContainer.appendChild(photoWrapper);
              });
          } else {
              photosContainer.innerHTML = '<div class="no-content">No photos available</div>';
          }

      } catch (error) {
          console.error('Failed to load place details:', error);
          document.getElementById(`photos-container-${place.place_id}`).innerHTML = 
              '<div class="no-content">Failed to load photos</div>';
      }
  } else {
      document.getElementById(`photos-container-${place.place_id}`).innerHTML = 
          '<div class="no-content">No additional details available</div>';
  }
}

function formatCategoryName(category) {
  const categoryMap = {
    'food': 'Restaurant',
    'restaurant': 'Restaurant',
    'cafe': 'Café',
    'bakery': 'Café',
    'fast_food': 'Fast Food',
    'local_market': 'Local Market',
    'convenience_store': 'Convenience Store',
    'supermarket': 'Supermarket',
    'lodging': 'Lodging',
    'bed_and_breakfast': 'B&B',
    'hotel': 'Hotel',
    'hostel': 'Hostel',
    'pharmacy': 'Pharmacy',
    'hospital': 'Hospital',
    'sim_card': 'SIM Card',
    'laundry': 'Laundry',
    'atm': 'ATM'
  };
  
  return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
}

function getServiceDisplayName(service, count = 1) {
  const serviceNames = {
    'laundry': { singular: 'laundry service', plural: 'laundry services' },
    'pharmacy': { singular: 'healthcare location', plural: 'healthcare locations' },
    'supermarket': { singular: 'shopping location', plural: 'shopping locations' },
    'food': { singular: 'restaurant', plural: 'restaurants' },
    'atm': { singular: 'ATM', plural: 'ATMs' },
    'hostel': { singular: 'accommodation', plural: 'accommodations' },
    'sim': { singular: 'SIM card provider', plural: 'SIM card providers' }
  };

  const serviceInfo = serviceNames[service] || { singular: service, plural: `${service}s` };
  return count === 1 ? serviceInfo.singular : serviceInfo.plural;
}

function showStatus(message, type = 'info') {
  statusElement.textContent = message;
  statusElement.className = `status-message visible ${type}`;
  
  if (type === 'info') {
    setTimeout(() => {
      statusElement.classList.remove('visible');
    }, 4000);
  }
}
// Enhanced map rendering function with gradient route & animated arrow
function renderMap(place, mapContainerId) {
  try {
    const mapContainer = document.getElementById(mapContainerId);
    if (!mapContainer) {
      console.error('Map container not found:', mapContainerId);
      return;
    }

    // Clear existing map
    if (mapContainer._leaflet_id) {
      mapContainer._leaflet_map.remove();
    }

    const map = L.map(mapContainerId, {
      zoomControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      attributionControl: false
    }).setView([currentLocation.lat, currentLocation.lng], 15);

    // Store reference for cleanup
    mapContainer._leaflet_map = map;

    // Clean basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Marker HTML templates
    const pulseMarkerHTML = (color) => `
      <div style="position: relative; width: 28px; height: 28px;">
        <div style="
          width: 14px; height: 14px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
        "></div>
        <div style="
          width: 28px; height: 28px;
          border-radius: 50%;
          background: ${color}33;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 2s infinite;
        "></div>
      </div>
    `;

    const pinMarkerHTML = (color) => `
      <div style="position: relative; width: 30px; height: 40px;">
        <div style="
          width: 18px; height: 18px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
        "></div>
        <div style="
          width: 0; height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 14px solid ${color};
          position: absolute;
          top: 16px; left: 50%;
          transform: translateX(-50%);
        "></div>
      </div>
    `;

    // Marker icons
    const currentLocationIcon = L.divIcon({
      className: 'custom-marker',
      html: pulseMarkerHTML('#06b6d4'),
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    const placeIcon = L.divIcon({
      className: 'custom-marker',
      html: pinMarkerHTML('#ef4444'),
      iconSize: [30, 40],
      iconAnchor: [15, 40]
    });

    // Add markers
    L.marker([currentLocation.lat, currentLocation.lng], { icon: currentLocationIcon }).addTo(map);
    L.marker([place.location.lat, place.location.lng], { icon: placeIcon }).addTo(map);

    // Routing
    getWalkingRoute(currentLocation, place.location).then(routeCoords => {
      if (routeCoords && routeCoords.length > 0) {
        // White outline
        L.polyline(routeCoords, {
          color: '#ffffff',
          weight: 10,
          opacity: 0.9,
          lineJoin: 'round'
        }).addTo(map);

        // Gradient main route (cyan → blue)
        const gradientLine = L.polyline(routeCoords, {
          weight: 6,
          opacity: 1,
          lineJoin: 'round'
        }).addTo(map);
        const gradient = {
          0.0: "#06b6d4",
          0.5: "#0284c7",
          1.0: "#0ea5e9"
        };
        gradientLine.setStyle({ color: '#06b6d4' });
        gradientLine.setText('►', {
          repeat: true,
          offset: 6,
          attributes: { fill: "#0ea5e9", "font-size": 16 }
        });

        // Animated arrow moving along route
        const arrowIcon = L.divIcon({
          className: 'arrow-icon',
          html: `<div style="
            transform: rotate(0deg);
            font-size: 18px;
            color: #0ea5e9;
          ">➤</div>`,
          iconSize: [18, 18]
        });
        let arrowIndex = 0;
        const arrowMarker = L.marker(routeCoords[0], { icon: arrowIcon }).addTo(map);
        setInterval(() => {
          arrowIndex = (arrowIndex + 1) % routeCoords.length;
          arrowMarker.setLatLng(routeCoords[arrowIndex]);
        }, 120);

        // Smooth zoom/pan to fit route
        const bounds = L.latLngBounds(routeCoords);
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });

        // Distance label
        const midIndex = Math.floor(routeCoords.length / 2);
        const midPoint = routeCoords[midIndex];
        const distanceLabel = L.divIcon({
          className: 'distance-label',
          html: `<div style="
            background: linear-gradient(135deg, #fff, #f9fafb);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            color: #111;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            border: 1px solid #e5e7eb;
            white-space: nowrap;
          ">${place.distance} km</div>`,
          iconSize: [90, 28],
          iconAnchor: [45, 14]
        });
        L.marker(midPoint, { icon: distanceLabel, interactive: false }).addTo(map);

      } else {
        // Fallback line
        const polyline = L.polyline([
          [currentLocation.lat, currentLocation.lng],
          [place.location.lat, place.location.lng]
        ], { color: '#06b6d4', weight: 4, opacity: 1 }).addTo(map);
        map.flyToBounds(polyline.getBounds(), { padding: [50, 50], duration: 1.2 });
      }
    }).catch(error => {
      console.error('Routing failed:', error);
    });

    setTimeout(() => map.invalidateSize(), 200);
    return map;

  } catch (error) {
    console.error('Error rendering map:', error);
    const mapContainer = document.getElementById(mapContainerId);
    if (mapContainer) {
      mapContainer.innerHTML = '<div class="no-content">Map failed to load</div>';
    }
  }
}

// Walking route function
async function getWalkingRoute(start, end) {
  try {
    const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
    }
    return null;
  } catch (error) {
    console.error('OSRM routing error:', error);
    return null;
  }
}

