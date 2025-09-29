/**
 * WeatherRecord Model
 * 
 * Mongoose schema for storing aggregated weather and country data
 * in the MongoDB weatherRecords collection.
 * 
 * This model handles the structure for data received from the frontend
 * which combines weather information from OpenWeatherMap API and
 * country information from RestCountries API.
 */

const mongoose = require('mongoose');

// Define the weather data sub-schema
const weatherSchema = new mongoose.Schema({
    city: {
        type: String,
        required: [true, 'City name is required'],
        trim: true,
        maxlength: [100, 'City name cannot exceed 100 characters']
    },
    country: {
        type: String,
        required: [true, 'Country code is required'],
        trim: true,
        maxlength: [10, 'Country code cannot exceed 10 characters']
    },
    temperature: {
        type: Number,
        required: [true, 'Temperature is required'],
        min: [-100, 'Temperature cannot be below -100°C'],
        max: [100, 'Temperature cannot be above 100°C']
    },
    feels_like: {
        type: Number,
        required: [true, 'Feels like temperature is required'],
        min: [-100, 'Feels like temperature cannot be below -100°C'],
        max: [100, 'Feels like temperature cannot be above 100°C']
    },
    humidity: {
        type: Number,
        required: [true, 'Humidity is required'],
        min: [0, 'Humidity cannot be below 0%'],
        max: [100, 'Humidity cannot be above 100%']
    },
    pressure: {
        type: Number,
        required: [true, 'Pressure is required'],
        min: [800, 'Pressure cannot be below 800 hPa'],
        max: [1200, 'Pressure cannot be above 1200 hPa']
    },
    wind_speed: {
        type: Number,
        required: [true, 'Wind speed is required'],
        min: [0, 'Wind speed cannot be negative'],
        max: [200, 'Wind speed cannot exceed 200 m/s']
    },
    visibility: {
        type: Number,
        required: [true, 'Visibility is required'],
        min: [0, 'Visibility cannot be negative'],
        max: [100000, 'Visibility cannot exceed 100km']
    },
    cloudiness: {
        type: Number,
        required: [true, 'Cloudiness is required'],
        min: [0, 'Cloudiness cannot be below 0%'],
        max: [100, 'Cloudiness cannot be above 100%']
    },
    description: {
        type: String,
        required: [true, 'Weather description is required'],
        trim: true,
        maxlength: [200, 'Weather description cannot exceed 200 characters']
    },
    icon: {
        type: String,
        required: [true, 'Weather icon is required'],
        trim: true,
        maxlength: [10, 'Weather icon code cannot exceed 10 characters']
    }
}, { _id: false }); // Disable _id for sub-document

// Define the country data sub-schema
const countrySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Country name is required'],
        trim: true,
        maxlength: [100, 'Country name cannot exceed 100 characters']
    },
    capital: {
        type: String,
        trim: true,
        maxlength: [100, 'Capital name cannot exceed 100 characters'],
        default: null
    },
    population: {
        type: Number,
        required: [true, 'Population is required'],
        min: [0, 'Population cannot be negative'],
        max: [20000000000, 'Population cannot exceed 20 billion']
    },
    area: {
        type: Number,
        required: [true, 'Area is required'],
        min: [0, 'Area cannot be negative'],
        max: [200000000, 'Area cannot exceed 200 million km²']
    },
    region: {
        type: String,
        required: [true, 'Region is required'],
        trim: true,
        maxlength: [50, 'Region name cannot exceed 50 characters']
    },
    subregion: {
        type: String,
        trim: true,
        maxlength: [50, 'Subregion name cannot exceed 50 characters'],
        default: null
    },
    languages: {
        type: [String],
        required: [true, 'Languages array is required'],
        validate: {
            validator: function(languages) {
                return languages && languages.length > 0;
            },
            message: 'At least one language must be specified'
        }
    },
    currencies: {
        type: [Object],
        required: [true, 'Currencies array is required'],
        validate: {
            validator: function(currencies) {
                return currencies && currencies.length > 0;
            },
            message: 'At least one currency must be specified'
        }
    },
    timezones: {
        type: [String],
        required: [true, 'Timezones array is required'],
        validate: {
            validator: function(timezones) {
                return timezones && timezones.length > 0;
            },
            message: 'At least one timezone must be specified'
        }
    },
    flag: {
        type: String,
        required: [true, 'Flag URL is required'],
        trim: true,
        validate: {
            validator: function(url) {
                // Basic URL validation
                return /^https?:\/\/.+\.(png|jpg|jpeg|svg)$/i.test(url);
            },
            message: 'Flag must be a valid image URL'
        }
    }
}, { _id: false }); // Disable _id for sub-document

// Main WeatherRecord schema
const weatherRecordSchema = new mongoose.Schema({
    // User who created this record
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User reference is required']
    },
    
    // Timestamp when the record was created
    timestamp: {
        type: Date,
        required: [true, 'Timestamp is required'],
        default: Date.now,
        validate: {
            validator: function(timestamp) {
                // Ensure timestamp is not in the future
                return timestamp <= new Date();
            },
            message: 'Timestamp cannot be in the future'
        }
    },
    
    // Weather information from OpenWeatherMap API
    weather: {
        type: weatherSchema,
        required: [true, 'Weather data is required']
    },
    
    // Country information from RestCountries API
    country: {
        type: countrySchema,
        required: [true, 'Country data is required']
    },
    
    // Optional metadata
    metadata: {
        source: {
            type: String,
            default: 'geoverse-dashboard',
            trim: true
        },
        version: {
            type: String,
            default: '1.0.0',
            trim: true
        },
        userAgent: {
            type: String,
            trim: true,
            maxlength: [500, 'User agent cannot exceed 500 characters']
        }
    }
}, {
    // Schema options
    timestamps: true, // Automatically add createdAt and updatedAt
    collection: 'weatherRecords', // Specify collection name
    strict: true // Reject unknown fields
});

// Indexes for better query performance
weatherRecordSchema.index({ user: 1, timestamp: -1 }); // User-specific records, most recent first
weatherRecordSchema.index({ timestamp: -1 }); // Descending order for recent records first
weatherRecordSchema.index({ 'weather.city': 1, 'weather.country': 1 }); // Compound index for city/country queries
weatherRecordSchema.index({ 'country.name': 1 }); // Index for country name queries
weatherRecordSchema.index({ createdAt: -1 }); // Index for creation time queries
weatherRecordSchema.index({ user: 1, 'weather.city': 1 }); // User-specific city queries
weatherRecordSchema.index({ user: 1, 'country.name': 1 }); // User-specific country queries

// Virtual for formatted timestamp
weatherRecordSchema.virtual('formattedTimestamp').get(function() {
    return this.timestamp.toISOString();
});

// Virtual for weather location string
weatherRecordSchema.virtual('location').get(function() {
    return `${this.weather.city}, ${this.weather.country}`;
});

// Instance method to get weather summary
weatherRecordSchema.methods.getWeatherSummary = function() {
    return {
        location: this.location,
        temperature: `${this.weather.temperature}°C`,
        description: this.weather.description,
        humidity: `${this.weather.humidity}%`,
        windSpeed: `${this.weather.wind_speed} m/s`
    };
};

// Instance method to get country summary
weatherRecordSchema.methods.getCountrySummary = function() {
    return {
        name: this.country.name,
        capital: this.country.capital,
        population: this.country.population.toLocaleString(),
        area: `${this.country.area.toLocaleString()} km²`,
        region: this.country.region
    };
};

// Static method to find records by city (user-specific)
weatherRecordSchema.statics.findByCity = function(cityName, userId = null) {
    const query = { 'weather.city': new RegExp(cityName, 'i') };
    if (userId) query.user = userId;
    return this.find(query)
        .sort({ timestamp: -1 });
};

// Static method to find records by country (user-specific)
weatherRecordSchema.statics.findByCountry = function(countryName, userId = null) {
    const query = { 'country.name': new RegExp(countryName, 'i') };
    if (userId) query.user = userId;
    return this.find(query)
        .sort({ timestamp: -1 });
};

// Static method to get recent records (user-specific)
weatherRecordSchema.statics.getRecentRecords = function(limit = 10, userId = null) {
    const query = userId ? { user: userId } : {};
    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(limit);
};

// Static method to get user's records
weatherRecordSchema.statics.getUserRecords = function(userId, options = {}) {
    const { limit = 50, offset = 0, sortBy = 'timestamp', sortOrder = -1 } = options;
    return this.find({ user: userId })
        .sort({ [sortBy]: sortOrder })
        .skip(offset)
        .limit(limit)
        .populate('user', 'displayName email profilePicture');
};

// Static method to get analytics data for a user
weatherRecordSchema.statics.getUserAnalytics = function(userId) {
    return this.aggregate([
        { $match: { user: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                avgTemperature: { $avg: '$weather.temperature' },
                avgHumidity: { $avg: '$weather.humidity' },
                avgPressure: { $avg: '$weather.pressure' },
                uniqueCities: { $addToSet: '$weather.city' },
                uniqueCountries: { $addToSet: '$country.name' }
            }
        },
        {
            $project: {
                totalRecords: 1,
                avgTemperature: { $round: ['$avgTemperature', 2] },
                avgHumidity: { $round: ['$avgHumidity', 2] },
                avgPressure: { $round: ['$avgPressure', 2] },
                uniqueCitiesCount: { $size: '$uniqueCities' },
                uniqueCountriesCount: { $size: '$uniqueCountries' }
            }
        }
    ]);
};

// Pre-save middleware to validate data consistency
weatherRecordSchema.pre('save', function(next) {
    // Additional validation can be added here
    // For example, checking if the country and weather country code match
    
    // Ensure timestamp is set
    if (!this.timestamp) {
        this.timestamp = new Date();
    }
    
    next();
});

// Post-save middleware for logging
weatherRecordSchema.post('save', function(doc) {
    console.log(`Weather record saved for ${doc.location} at ${doc.timestamp}`);
});

// Export the model
module.exports = mongoose.model('WeatherRecord', weatherRecordSchema);
