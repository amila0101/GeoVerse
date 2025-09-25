
const API_CONFIG = {
    WEATHER_API_KEY: //'https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API key}',
    WEATHER_BASE_URL: //'https://openweathermap.org/api',
    COUNTRIES_BASE_URL: //'https://restcountries.com/',
    
    BACKEND_URL: //'http://localhost:3000/api'
};

let currentWeatherData = null;
let currentCountryData = null;

const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const resultsSection = document.getElementById('resultsSection');
const weatherContent = document.getElementById('weatherContent');
const countryContent = document.getElementById('countryContent');
const submitBtn = document.getElementById('submitBtn');
const statusMessages = document.getElementById('statusMessages');

document.addEventListener('DOMContentLoaded', function() {
    searchForm.addEventListener('submit', handleSearch);
    submitBtn.addEventListener('click', handleSubmitData);
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
    
    const url = `${API_CONFIG.COUNTRIES_BASE_URL}/${encodeURIComponent(countryName)}`;
    
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
        'X-API-Key': 'YOUR_API_KEY' // Replace with actual API key
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


searchForm.addEventListener('submit', function(e) {
    if (!navigator.onLine) {
        e.preventDefault();
        showStatus('You are offline. Please check your internet connection.', 'error');
    }
});