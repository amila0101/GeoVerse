
const API_CONFIG = {
    WEATHER_API_KEY: '260bd9e4c2ce5936ee9ae90e1446df53',
    WEATHER_BASE_URL: 'https://api.openweathermap.org/data/2.5/weather',
    COUNTRIES_BASE_URL: 'https://restcountries.com/v3.1/name/', // මෙතනින් රටේ නම අයින් කරපන්
    
    BACKEND_URL: 'http://localhost:3000/api'
};



let currentWeatherData = null;
let currentCountryData = null;
let currentUser = null;
let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

// DOM Elements
const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const resultsSection = document.getElementById('resultsSection');
const weatherContent = document.getElementById('weatherContent');
const countryContent = document.getElementById('countryContent');
const submitBtn = document.getElementById('submitBtn');
const statusMessages = document.getElementById('statusMessages');

// New UI Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const searchHistoryDiv = document.getElementById('searchHistory');
const historyList = document.getElementById('historyList');
const favoritesBtn = document.getElementById('favoritesBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const analyticsBtn = document.getElementById('analyticsBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const shareBtn = document.getElementById('shareBtn');

// Section Elements
const dashboardSection = document.getElementById('dashboardSection');
const analyticsSection = document.getElementById('analyticsSection');
const favoritesSection = document.getElementById('favoritesSection');

// Navigation Elements
const navTabs = document.querySelectorAll('.nav-tab');

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initializeApp();
    
    // Event listeners
    searchForm.addEventListener('submit', handleSearch);
    submitBtn.addEventListener('click', handleSubmitData);
    
    // New event listeners
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    favoritesBtn.addEventListener('click', () => showSection('favorites'));
    dashboardBtn.addEventListener('click', () => showSection('dashboard'));
    analyticsBtn.addEventListener('click', () => showSection('analytics'));
    favoriteBtn.addEventListener('click', handleAddToFavorites);
    shareBtn.addEventListener('click', handleShare);
    
    // Navigation removed - using quick actions instead
    
    // Load search history
    loadSearchHistory();
});

async function handleSearch(event) {
    event.preventDefault();
    
    const city = cityInput.value.trim();
    if (!city) {
        showStatus('Please enter a city name', 'error');
        return;
    }

    setLoadingState(searchBtn, true);
    showStatus('Searching for weather and country data...', 'info');

    try {

        const [weatherData, countryData] = await Promise.all([
            fetchWeatherData(city),
            fetchCountryData(city)
        ]);

        currentWeatherData = weatherData;
        currentCountryData = countryData;

        displayWeatherData(weatherData);
        displayCountryData(countryData);
        addToSearchHistory(city);
        
        resultsSection.classList.remove('hidden');
        showStatus('Data retrieved successfully!', 'success');

    } catch (error) {
        console.error('Search error:', error);
        showStatus(error.message || 'Failed to retrieve data. Please try again.', 'error');
        resultsSection.classList.add('hidden');
    } finally {
        setLoadingState(searchBtn, false);
    }
}


async function fetchWeatherData(city) {
    const url = `${API_CONFIG.WEATHER_BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_CONFIG.WEATHER_API_KEY}&units=metric`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('City not found. Please check the city name and try again.');
        } else if (response.status === 401) {
            throw new Error('Weather API key is invalid. Please check your configuration.');
        } else {
            throw new Error('Failed to fetch weather data. Please try again.');
        }
    }
    
    return await response.json();
}


async function fetchCountryData(city) {


    let countryName = extractCountryFromCity(city);
    
    const url = `${API_CONFIG.COUNTRIES_BASE_URL}${encodeURIComponent(countryName)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Country information not found for "${countryName}". Try including the country name.`);
        } else {
            throw new Error('Failed to fetch country data. Please try again.');
        }
    }
    
    const data = await response.json();
    return data[0]; // Return the first match
}


function extractCountryFromCity(city) {

    const cityCountryMap = {
        'london': 'United Kingdom',
        'paris': 'France',
        'tokyo': 'Japan',
        'new york': 'United States',
        'sydney': 'Australia',
        'berlin': 'Germany',
        'rome': 'Italy',
        'madrid': 'Spain',
        'moscow': 'Russia',
        'beijing': 'China',
        'mumbai': 'India',
        'cairo': 'Egypt',
        'toronto': 'Canada',
        'mexico city': 'Mexico',
        'sao paulo': 'Brazil'
    };

    const cityLower = city.toLowerCase();
    

    if (city.includes(',')) {
        const parts = city.split(',');
        if (parts.length > 1) {
            return parts[1].trim();
        }
    }
    

    if (cityCountryMap[cityLower]) {
        return cityCountryMap[cityLower];
    }
    

    return city;
}


function displayWeatherData(data) {
    const weatherInfo = `
        <div class="weather-info">
            <div class="weather-main">
                <div class="weather-location">${data.name}, ${data.sys.country}</div>
                <div class="weather-temp">${Math.round(data.main.temp)}°C</div>
                <div class="weather-description">${data.weather[0].description}</div>
            </div>
            <div class="weather-details">
                <div class="weather-detail-item">
                    <i class="fas fa-thermometer-half"></i>
                    <div class="label">Feels Like</div>
                    <div class="value">${Math.round(data.main.feels_like)}°C</div>
                </div>
                <div class="weather-detail-item">
                    <i class="fas fa-tint"></i>
                    <div class="label">Humidity</div>
                    <div class="value">${data.main.humidity}%</div>
                </div>
                <div class="weather-detail-item">
                    <i class="fas fa-gauge-high"></i>
                    <div class="label">Pressure</div>
                    <div class="value">${data.main.pressure} hPa</div>
                </div>
                <div class="weather-detail-item">
                    <i class="fas fa-wind"></i>
                    <div class="label">Wind Speed</div>
                    <div class="value">${data.wind.speed} m/s</div>
                </div>
                <div class="weather-detail-item">
                    <i class="fas fa-eye"></i>
                    <div class="label">Visibility</div>
                    <div class="value">${(data.visibility / 1000).toFixed(1)} km</div>
                </div>
                <div class="weather-detail-item">
                    <i class="fas fa-cloud"></i>
                    <div class="label">Cloudiness</div>
                    <div class="value">${data.clouds.all}%</div>
                </div>
            </div>
        </div>
    `;
    weatherContent.innerHTML = weatherInfo;
}


function displayCountryData(data) {
    const countryInfo = `
        <div class="country-info">
            <div class="country-header">
                <img src="${data.flags.png}" alt="${data.name.common} flag" class="country-flag">
                <div class="country-name">${data.name.common}</div>
                <div class="country-capital">Capital: ${data.capital?.[0] || 'N/A'}</div>
            </div>
            <div class="country-details">
                <div class="country-detail-item">
                    <i class="fas fa-users"></i>
                    <div class="label">Population</div>
                    <div class="value">${formatNumber(data.population)}</div>
                </div>
                <div class="country-detail-item">
                    <i class="fas fa-map"></i>
                    <div class="label">Area</div>
                    <div class="value">${formatNumber(data.area)} km²</div>
                </div>
                <div class="country-detail-item">
                    <i class="fas fa-globe"></i>
                    <div class="label">Region</div>
                    <div class="value">${data.region}</div>
                </div>
                <div class="country-detail-item">
                    <i class="fas fa-language"></i>
                    <div class="label">Languages</div>
                    <div class="value">${Object.values(data.languages || {}).slice(0, 2).join(', ')}</div>
                </div>
                <div class="country-detail-item">
                    <i class="fas fa-coins"></i>
                    <div class="label">Currency</div>
                    <div class="value">${Object.values(data.currencies || {})[0]?.name || 'N/A'}</div>
                </div>
                <div class="country-detail-item">
                    <i class="fas fa-clock"></i>
                    <div class="label">Timezone</div>
                    <div class="value">${data.timezones?.[0] || 'N/A'}</div>
                </div>
            </div>
        </div>
    `;
    countryContent.innerHTML = countryInfo;
}


async function handleSubmitData() {
    if (!currentWeatherData || !currentCountryData) {
        showStatus('No data to submit. Please search for a city first.', 'error');
        return;
    }

    setLoadingState(submitBtn, true);
    showStatus('Saving data to dashboard...', 'info');

    try {

        const aggregatedData = {
            timestamp: new Date().toISOString(),
            weather: {
                city: currentWeatherData.name,
                country: currentWeatherData.sys.country,
                temperature: currentWeatherData.main.temp,
                feels_like: currentWeatherData.main.feels_like,
                humidity: currentWeatherData.main.humidity,
                pressure: currentWeatherData.main.pressure,
                wind_speed: currentWeatherData.wind.speed,
                visibility: currentWeatherData.visibility,
                cloudiness: currentWeatherData.clouds.all,
                description: currentWeatherData.weather[0].description,
                icon: currentWeatherData.weather[0].icon
            },
            country: {
                name: currentCountryData.name.common,
                capital: currentCountryData.capital?.[0] || null,
                population: currentCountryData.population,
                area: currentCountryData.area,
                region: currentCountryData.region,
                subregion: currentCountryData.subregion,
                languages: Object.values(currentCountryData.languages || {}),
                currencies: Object.values(currentCountryData.currencies || {}),
                timezones: currentCountryData.timezones,
                flag: currentCountryData.flags.png
            }
        };


        await submitToBackend(aggregatedData);
        
        showStatus('Data saved successfully to your dashboard!', 'success');
        
    } catch (error) {
        console.error('Submit error:', error);
        showStatus(error.message || 'Failed to save data. Please try again.', 'error');
    } finally {
        setLoadingState(submitBtn, false);
    }
}


async function submitToBackend(data) {

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_OAUTH_TOKEN', // Replace with actual OAuth token
            'X-API-Key': 'your_secure_api_key_here' // Replace with actual API key from .env
        };

    const response = await fetch(`${API_CONFIG.BACKEND_URL}/records`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Authentication failed. Please check your credentials.');
        } else if (response.status === 403) {
            throw new Error('Access denied. Invalid API key.');
        } else {
            throw new Error('Failed to save data to server.');
        }
    }

    return await response.json();
}


function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}


function setLoadingState(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}


function showStatus(message, type = 'info') {
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    
    statusMessages.appendChild(statusDiv);
    

    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                statusDiv.remove();
            }, 300);
        }
    }, 5000);
}


const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);


cityInput.addEventListener('input', function(e) {
    const value = e.target.value.toLowerCase();


});


cityInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch(e);
    }
});


function validateApiKeys() {
    if (API_CONFIG.WEATHER_API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
        console.warn('⚠️ Please replace YOUR_OPENWEATHERMAP_API_KEY with your actual OpenWeatherMap API key');
    }
}


document.addEventListener('DOMContentLoaded', validateApiKeys);


window.addEventListener('offline', function() {
    showStatus('You are offline. Please check your internet connection.', 'error');
});

window.addEventListener('online', function() {
    showStatus('You are back online!', 'success');
});

// New Functions for Enhanced Features

function initializeApp() {
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        // Validate token and load user data
        loadUserProfile();
    }
    
    // Show search section by default
    showSection('search');
}

function handleLogin() {
    // Redirect to Google OAuth
    window.location.href = `${API_CONFIG.BACKEND_URL.replace('/api', '')}/auth/google`;
}

function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    currentUser = null;
    
    // Update UI
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    
    showStatus('Logged out successfully', 'success');
}

function loadUserProfile() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        currentUser = JSON.parse(userData);
        userAvatar.src = currentUser.profilePicture || '/default-avatar.png';
        userName.textContent = currentUser.displayName || 'User';
        
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
    }
}

function showSection(sectionName) {
    // Hide all sections
    const sections = ['search', 'dashboard', 'favorites', 'analytics'];
    sections.forEach(section => {
        const element = document.getElementById(`${section}Section`) || 
                       document.querySelector(`.${section}-section`);
        if (element) {
            element.classList.add('hidden');
        }
    });
    
    // Show selected section
    const targetSection = document.getElementById(`${sectionName}Section`) || 
                         document.querySelector(`.${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // Load section data
    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'favorites':
            loadFavorites();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Navigation function removed

function addToSearchHistory(city) {
    if (!searchHistory.includes(city)) {
        searchHistory.unshift(city);
        if (searchHistory.length > 10) {
            searchHistory.pop();
        }
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        loadSearchHistory();
    }
}

function loadSearchHistory() {
    const recentSearchesList = document.getElementById('recentSearchesList');
    
    if (searchHistory.length > 0) {
        searchHistoryDiv.classList.remove('hidden');
        historyList.innerHTML = '';
        
        // Update dashboard recent searches
        if (recentSearchesList) {
            recentSearchesList.innerHTML = '';
            
            searchHistory.slice(0, 5).forEach((city, index) => {
                const searchItem = document.createElement('div');
                searchItem.className = 'recent-search-item';
                searchItem.innerHTML = `
                    <div class="recent-search-content">
                        <div class="recent-search-icon">
                            <i class="fas fa-search"></i>
                        </div>
                        <div class="recent-search-text">
                            <div class="recent-search-name">${city}</div>
                            <div class="recent-search-time">Searched recently</div>
                        </div>
                    </div>
                    <div class="recent-search-actions">
                        <button class="recent-search-action-btn" onclick="searchFromHistory('${city}')" title="Search again">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button class="recent-search-action-btn" onclick="removeFromHistory(${index})" title="Remove">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                recentSearchesList.appendChild(searchItem);
            });
        }
        
        // Update main search history (for search dropdown)
        searchHistory.slice(0, 5).forEach(city => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.textContent = city;
            historyItem.addEventListener('click', () => {
                cityInput.value = city;
                handleSearch({ preventDefault: () => {} });
            });
            historyList.appendChild(historyItem);
        });
    } else {
        searchHistoryDiv.classList.add('hidden');
        
        // Show empty state in dashboard
        if (recentSearchesList) {
            recentSearchesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h4>No Recent Searches</h4>
                    <p>Your search history will appear here</p>
                </div>
            `;
        }
    }
}

function searchFromHistory(city) {
    cityInput.value = city;
    handleSearch({ preventDefault: () => {} });
    showSection('search');
}

function removeFromHistory(index) {
    searchHistory.splice(index, 1);
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    loadSearchHistory();
}

function clearSearchHistory() {
    searchHistory = [];
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    loadSearchHistory();
    showStatus('Search history cleared', 'success');
}

function handleAddToFavorites() {
    if (!currentWeatherData || !currentCountryData) {
        showStatus('No data to add to favorites', 'error');
        return;
    }
    
    const favorite = {
        id: Date.now(),
        city: currentWeatherData.name,
        country: currentCountryData.name.common,
        temperature: currentWeatherData.main.temp,
        timestamp: new Date().toISOString()
    };
    
    favorites.unshift(favorite);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    showStatus('Added to favorites!', 'success');
    favoriteBtn.innerHTML = '<i class="fas fa-heart"></i><span class="btn-text">Added to Favorites</span>';
    favoriteBtn.style.background = 'linear-gradient(135deg, #4caf50, #81c784)';
}

function handleShare() {
    if (!currentWeatherData || !currentCountryData) {
        showStatus('No data to share', 'error');
        return;
    }
    
    const shareText = `Check out the weather in ${currentWeatherData.name}, ${currentCountryData.name.common}! Temperature: ${currentWeatherData.main.temp}°C`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Weather Information',
            text: shareText,
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showStatus('Copied to clipboard!', 'success');
        });
    }
}

function loadDashboard() {
    // Load user's saved records and statistics
    const totalSearches = searchHistory.length;
    const totalFavorites = favorites.length;
    const countriesVisited = new Set(favorites.map(f => f.country)).size;
    
    document.getElementById('totalSearches').textContent = totalSearches;
    document.getElementById('totalFavorites').textContent = totalFavorites;
    document.getElementById('countriesVisited').textContent = countriesVisited;
    
    // Load saved records
    loadSavedRecords();
}

function loadSavedRecords() {
    const savedRecords = document.getElementById('savedRecords');
    
    // Clear any existing content except the header
    const existingContent = savedRecords.querySelectorAll('.record-item, .empty-state');
    existingContent.forEach(item => item.remove());
    
    // Check if there are any saved records from backend
    // For now, show empty state since we don't have backend integration yet
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
        <i class="fas fa-database"></i>
        <h4>No Saved Records</h4>
        <p>Your saved weather and country data will appear here</p>
    `;
    savedRecords.appendChild(emptyState);
}

function loadFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-heart" style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 20px; opacity: 0.5;"></i>
                <h3 style="color: var(--text-primary); font-size: 1.5rem; margin-bottom: 10px;">No Favorites Yet</h3>
                <p style="color: var(--text-secondary); font-size: 1.1rem;">Add some cities to your favorites to see them here!</p>
            </div>
        `;
        return;
    }
    
    favorites.forEach((favorite, index) => {
        const favoriteDiv = document.createElement('div');
        favoriteDiv.className = 'favorite-item';
        favoriteDiv.innerHTML = `
            <input type="checkbox" class="checkbox" id="fav-${index}">
            <h3>${favorite.city}, ${favorite.country}</h3>
            <p class="temperature">${favorite.temperature}°C</p>
            <p class="date">Added: ${new Date(favorite.timestamp).toLocaleDateString()}</p>
            <button class="remove-btn" onclick="removeFavorite(${favorite.id})">
                <i class="fas fa-trash"></i>
                Remove
            </button>
        `;
        favoritesList.appendChild(favoriteDiv);
    });
}

function removeFavorite(id) {
    favorites = favorites.filter(f => f.id !== id);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
    showStatus('Removed from favorites', 'success');
}

function loadAnalytics() {
    // Load analytics data
    loadAnalyticsData();
    
    // Create charts
    createTemperatureChart();
    createCitiesChart();
    createActivityChart();
    createWeatherChart();
    
    // Setup chart controls
    setupChartControls();
}

function loadAnalyticsData() {
    // Calculate analytics from search history and favorites
    const totalSearches = searchHistory.length;
    const totalCities = new Set(searchHistory).size;
    const totalCountries = new Set(searchHistory.map(city => {
        // This would need country mapping in real implementation
        return 'Unknown';
    })).size;
    
    // Calculate average temperature (mock data for now)
    const avgTemperature = Math.round(Math.random() * 30 + 5); // 5-35°C
    
    // Update stat cards
    document.getElementById('totalSearches').textContent = totalSearches;
    document.getElementById('totalCities').textContent = totalCities;
    document.getElementById('totalCountries').textContent = totalCountries;
    document.getElementById('avgTemperature').textContent = `${avgTemperature}°C`;
    
    // Update insights
    updateInsights();
}

function updateInsights() {
    if (searchHistory.length > 0) {
        const mostSearched = getMostFrequent(searchHistory);
        document.getElementById('hottestSearch').textContent = mostSearched || 'No data available';
        document.getElementById('coldestSearch').textContent = mostSearched || 'No data available';
        document.getElementById('mostFavorited').textContent = mostSearched || 'No data available';
        document.getElementById('peakActivity').textContent = 'Afternoon (2-4 PM)';
    }
}

function getMostFrequent(arr) {
    if (arr.length === 0) return null;
    const frequency = {};
    arr.forEach(item => {
        frequency[item] = (frequency[item] || 0) + 1;
    });
    return Object.keys(frequency).reduce((a, b) => 
        frequency[a] > frequency[b] ? a : b
    );
}

function setupChartControls() {
    // Setup chart control buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from siblings
            this.parentElement.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update chart based on button data attributes
            const chartCard = this.closest('.chart-card');
            const chartId = chartCard.querySelector('canvas').id;
            
            // Refresh chart with new data
            refreshChart(chartId, this.dataset);
        });
    });
}

function refreshChart(chartId, data) {
    // This would update the chart based on the selected period/type
    console.log(`Refreshing ${chartId} with data:`, data);
}

function createWeatherChart() {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Temperature', 'Humidity', 'Pressure', 'Wind Speed', 'Visibility', 'Cloudiness'],
            datasets: [{
                label: 'Weather Metrics',
                data: [75, 60, 80, 45, 90, 30],
                backgroundColor: 'rgba(0, 212, 255, 0.2)',
                borderColor: 'rgba(0, 212, 255, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(0, 212, 255, 1)',
                pointBorderColor: 'rgba(255, 255, 255, 1)',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)'
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        stepSize: 20
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    pointLabels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function createTemperatureChart() {
    const ctx = document.getElementById('tempChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cold (0-10°C)', 'Cool (10-20°C)', 'Warm (20-30°C)', 'Hot (30°C+)'],
            datasets: [{
                data: [25, 35, 30, 10],
                backgroundColor: [
                    'rgba(0, 212, 255, 0.8)',
                    'rgba(0, 255, 150, 0.8)', 
                    'rgba(255, 193, 7, 0.8)',
                    'rgba(255, 87, 87, 0.8)'
                ],
                borderColor: [
                    'rgba(0, 212, 255, 1)',
                    'rgba(0, 255, 150, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(255, 87, 87, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function createCitiesChart() {
    const ctx = document.getElementById('citiesChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['London', 'Tokyo', 'New York', 'Paris', 'Sydney'],
            datasets: [{
                label: 'Search Count',
                data: [12, 8, 6, 4, 3],
                backgroundColor: 'rgba(0, 212, 255, 0.8)',
                borderColor: 'rgba(0, 212, 255, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createActivityChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Monthly Searches',
                data: [5, 8, 12, 6, 9, 15],
                borderColor: 'rgba(0, 212, 255, 1)',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(0, 212, 255, 1)',
                pointBorderColor: 'rgba(255, 255, 255, 1)',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

searchForm.addEventListener('submit', function(e) {
    if (!navigator.onLine) {
        e.preventDefault();
        showStatus('You are offline. Please check your internet connection.', 'error');
    }
});
