/**
 * Data Routes
 * 
 * API endpoints for handling weather and country data operations.
 * This module contains the business logic for:
 * - POST /api/records: Store new weather and country data
 * - GET /api/records: Retrieve all stored records
 * 
 * Security features:
 * - API Key middleware for application-level authentication
 * - Input validation and sanitization
 * - Error handling and logging
 * - Ready for OAuth 2.0 integration
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const WeatherRecord = require('../models/weatherRecord');
const User = require('../models/user');

/**
 * API Key Middleware
 * 
 * Middleware function to validate the x-api-key header for application-level security.
 * This provides the first layer of security before processing any requests.
 * 
 * Future enhancement: This can be extended to support OAuth 2.0 tokens for user-level authentication.
 */
const validateApiKey = (req, res, next) => {
    try {
        // Get the API key from the request headers
        const apiKey = req.headers['x-api-key'];
        
        // Check if API key is provided
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key is required',
                message: 'Please provide a valid x-api-key header',
                code: 'MISSING_API_KEY'
            });
        }
        
        // Get the expected API key from environment variables
        const expectedApiKey = process.env.API_KEY;
        
        // Validate the API key
        if (apiKey !== expectedApiKey) {
            return res.status(403).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is not valid',
                code: 'INVALID_API_KEY'
            });
        }
        
        // API key is valid, proceed to the next middleware
        next();
        
    } catch (error) {
        console.error('API Key validation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to validate API key',
            code: 'API_KEY_VALIDATION_ERROR'
        });
    }
};

/**
 * OAuth 2.0 Token Validation Middleware
 * 
 * Validates JWT tokens for user-level authentication.
 * Extracts user information from the token and attaches it to the request.
 */
const validateOAuthToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required',
                message: 'Please provide a valid access token',
                code: 'MISSING_TOKEN'
            });
        }
        
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-localAuth.password -tokens');
        
        if (!user || user.status !== 'active') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'User not found or inactive',
                code: 'INVALID_TOKEN'
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                message: 'Please refresh your token',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(403).json({
            success: false,
            error: 'Invalid token',
            message: 'Token verification failed',
            code: 'TOKEN_VERIFICATION_FAILED'
        });
    }
};

/**
 * Rate Limiting Middleware
 * 
 * Applies rate limiting to prevent abuse and ensure fair usage.
 */
const dataLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests',
        message: 'Please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Input Validation Middleware
 * 
 * Validates the incoming JSON data structure before processing.
 * This ensures data integrity and prevents malformed data from being stored.
 */
const validateInputData = (req, res, next) => {
    try {
        const { timestamp, weather, country } = req.body;
        
        // Check if required fields are present
        if (!weather || !country) {
            return res.status(400).json({
                success: false,
                error: 'Invalid data structure',
                message: 'Both weather and country data are required',
                code: 'MISSING_REQUIRED_FIELDS',
                required: ['weather', 'country']
            });
        }
        
        // Validate weather data structure
        const requiredWeatherFields = [
            'city', 'country', 'temperature', 'feels_like', 
            'humidity', 'pressure', 'wind_speed', 'visibility', 
            'cloudiness', 'description', 'icon'
        ];
        
        for (const field of requiredWeatherFields) {
            if (weather[field] === undefined || weather[field] === null) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid weather data',
                    message: `Missing required weather field: ${field}`,
                    code: 'MISSING_WEATHER_FIELD',
                    field: field
                });
            }
        }
        
        // Validate country data structure
        const requiredCountryFields = [
            'name', 'population', 'area', 'region', 
            'languages', 'currencies', 'timezones', 'flag'
        ];
        
        for (const field of requiredCountryFields) {
            if (country[field] === undefined || country[field] === null) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid country data',
                    message: `Missing required country field: ${field}`,
                    code: 'MISSING_COUNTRY_FIELD',
                    field: field
                });
            }
        }
        
        // Additional validation for arrays
        if (!Array.isArray(country.languages) || country.languages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid country data',
                message: 'Languages must be a non-empty array',
                code: 'INVALID_LANGUAGES_ARRAY'
            });
        }
        
        if (!Array.isArray(country.currencies) || country.currencies.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid country data',
                message: 'Currencies must be a non-empty array',
                code: 'INVALID_CURRENCIES_ARRAY'
            });
        }
        
        if (!Array.isArray(country.timezones) || country.timezones.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid country data',
                message: 'Timezones must be a non-empty array',
                code: 'INVALID_TIMEZONES_ARRAY'
            });
        }
        
        // Data is valid, proceed to the next middleware
        next();
        
    } catch (error) {
        console.error('Input validation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to validate input data',
            code: 'INPUT_VALIDATION_ERROR'
        });
    }
};

/**
 * POST /api/records
 * 
 * Endpoint to store new weather and country data.
 * 
 * Security: Protected by API key and OAuth token middleware
 * Validation: Input data is validated before processing
 * Error Handling: Comprehensive error handling with appropriate HTTP status codes
 * Real-time: Emits WebSocket event for new records
 * 
 * Request Body:
 * {
 *   "timestamp": "2025-01-01T12:00:00.000Z",
 *   "weather": { ... },
 *   "country": { ... }
 * }
 * 
 * Response:
 * - 201: Successfully created record
 * - 400: Invalid input data
 * - 401: Missing API key or token
 * - 403: Invalid API key or token
 * - 500: Internal server error
 */
router.post('/records', dataLimiter, validateApiKey, validateOAuthToken, validateInputData, async (req, res) => {
    try {
        console.log('Received POST request to /api/records');
        
        // Extract data from request body
        const { timestamp, weather, country, metadata } = req.body;
        
        // Create new WeatherRecord instance
        const newRecord = new WeatherRecord({
            user: req.user._id, // Associate with authenticated user
            timestamp: timestamp || new Date(),
            weather: weather,
            country: country,
            metadata: {
                ...metadata,
                userAgent: req.headers['user-agent'] || 'Unknown'
            }
        });
        
        // Save the record to the database
        const savedRecord = await newRecord.save();
        
        // Add record reference to user
        await req.user.addRecord(savedRecord._id);
        
        // Update user statistics
        await req.user.updateStats();
        
        console.log(`Successfully saved weather record for ${savedRecord.location} by user ${req.user.email}`);
        
        // Emit WebSocket event for real-time updates
        if (req.app.get('io')) {
            req.app.get('io').emit('new-record', {
                recordId: savedRecord._id,
                user: {
                    id: req.user._id,
                    displayName: req.user.displayName,
                    profilePicture: req.user.profilePicture
                },
                location: savedRecord.location,
                timestamp: savedRecord.timestamp,
                weather: {
                    temperature: savedRecord.weather.temperature,
                    description: savedRecord.weather.description,
                    city: savedRecord.weather.city
                },
                country: {
                    name: savedRecord.country.name,
                    flag: savedRecord.country.flag
                }
            });
        }
        
        // Return success response with the saved data
        return res.status(201).json({
            success: true,
            message: 'Weather and country data saved successfully',
            data: {
                id: savedRecord._id,
                timestamp: savedRecord.timestamp,
                location: savedRecord.location,
                weather: savedRecord.weather,
                country: savedRecord.country,
                createdAt: savedRecord.createdAt,
                updatedAt: savedRecord.updatedAt
            },
            metadata: {
                recordId: savedRecord._id,
                savedAt: new Date().toISOString(),
                user: req.user.getSummary()
            }
        });
        
    } catch (error) {
        console.error('Error saving weather record:', error);
        
        // Handle specific MongoDB errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message,
                value: err.value
            }));
            
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'The provided data does not meet the required schema',
                code: 'VALIDATION_ERROR',
                details: validationErrors
            });
        }
        
        if (error.name === 'MongoError' && error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'Duplicate record',
                message: 'A record with this data already exists',
                code: 'DUPLICATE_RECORD'
            });
        }
        
        // Generic error response
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to save weather and country data',
            code: 'SAVE_ERROR'
        });
    }
});

/**
 * GET /api/records
 * 
 * Endpoint to retrieve user-specific weather and country records.
 * 
 * Security: Protected by API key and OAuth token middleware
 * Performance: Returns records in descending order by timestamp (most recent first)
 * Error Handling: Comprehensive error handling with appropriate HTTP status codes
 * 
 * Query Parameters (optional):
 * - limit: Number of records to return (default: 50, max: 100)
 * - offset: Number of records to skip (default: 0)
 * - city: Filter by city name (case-insensitive)
 * - country: Filter by country name (case-insensitive)
 * 
 * Response:
 * - 200: Successfully retrieved records
 * - 401: Missing API key or token
 * - 403: Invalid API key or token
 * - 500: Internal server error
 */
router.get('/records', dataLimiter, validateApiKey, validateOAuthToken, async (req, res) => {
    try {
        console.log('Received GET request to /api/records');
        
        // Extract query parameters
        const { 
            limit = 50, 
            offset = 0, 
            city, 
            country 
        } = req.query;
        
        // Validate and sanitize query parameters
        const parsedLimit = Math.min(parseInt(limit) || 50, 100); // Max 100 records
        const parsedOffset = Math.max(parseInt(offset) || 0, 0); // Min 0 offset
        
        // Build query filter (user-specific)
        let filter = { user: req.user._id };
        
        if (city) {
            filter['weather.city'] = new RegExp(city, 'i');
        }
        
        if (country) {
            filter['country.name'] = new RegExp(country, 'i');
        }
        
        // Execute database query
        const records = await WeatherRecord.find(filter)
            .sort({ timestamp: -1 }) // Most recent first
            .skip(parsedOffset)
            .limit(parsedLimit)
            .lean(); // Use lean() for better performance
        
        // Get total count for pagination info
        const totalCount = await WeatherRecord.countDocuments(filter);
        
        console.log(`Retrieved ${records.length} weather records`);
        
        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Weather and country records retrieved successfully',
            data: records,
            pagination: {
                total: totalCount,
                limit: parsedLimit,
                offset: parsedOffset,
                hasMore: (parsedOffset + parsedLimit) < totalCount
            },
            metadata: {
                retrievedAt: new Date().toISOString(),
                recordCount: records.length
            }
        });
        
    } catch (error) {
        console.error('Error retrieving weather records:', error);
        
        // Generic error response
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to retrieve weather and country records',
            code: 'RETRIEVE_ERROR'
        });
    }
});

/**
 * GET /api/analytics
 * 
 * Endpoint to get comprehensive analytics and insights from user's stored records.
 * This endpoint provides aggregated data using MongoDB's Aggregation Framework.
 * 
 * Security: Protected by API key and OAuth token middleware
 * 
 * Response:
 * - 200: Successfully retrieved analytics
 * - 401: Missing API key or token
 * - 403: Invalid API key or token
 * - 500: Internal server error
 */
router.get('/analytics', dataLimiter, validateApiKey, validateOAuthToken, async (req, res) => {
    try {
        console.log('Received GET request to /api/analytics');
        
        const userId = req.user._id;
        
        // Get user-specific analytics using aggregation pipeline
        const analytics = await WeatherRecord.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    avgTemperature: { $avg: '$weather.temperature' },
                    minTemperature: { $min: '$weather.temperature' },
                    maxTemperature: { $max: '$weather.temperature' },
                    avgHumidity: { $avg: '$weather.humidity' },
                    avgPressure: { $avg: '$weather.pressure' },
                    avgWindSpeed: { $avg: '$weather.wind_speed' },
                    uniqueCities: { $addToSet: '$weather.city' },
                    uniqueCountries: { $addToSet: '$country.name' }
                }
            },
            {
                $project: {
                    totalRecords: 1,
                    avgTemperature: { $round: ['$avgTemperature', 2] },
                    minTemperature: { $round: ['$minTemperature', 2] },
                    maxTemperature: { $round: ['$maxTemperature', 2] },
                    avgHumidity: { $round: ['$avgHumidity', 2] },
                    avgPressure: { $round: ['$avgPressure', 2] },
                    avgWindSpeed: { $round: ['$avgWindSpeed', 2] },
                    uniqueCitiesCount: { $size: '$uniqueCities' },
                    uniqueCountriesCount: { $size: '$uniqueCountries' }
                }
            }
        ]);
        
        // Get top 5 most searched cities
        const topCities = await WeatherRecord.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$weather.city', count: { $sum: 1 }, avgTemp: { $avg: '$weather.temperature' } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $project: { city: '$_id', count: 1, avgTemp: { $round: ['$avgTemp', 2] } } }
        ]);
        
        // Get top 5 most searched countries
        const topCountries = await WeatherRecord.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$country.name', count: { $sum: 1 }, avgTemp: { $avg: '$weather.temperature' } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $project: { country: '$_id', count: 1, avgTemp: { $round: ['$avgTemp', 2] } } }
        ]);
        
        // Get temperature distribution
        const tempDistribution = await WeatherRecord.aggregate([
            { $match: { user: userId } },
            {
                $bucket: {
                    groupBy: '$weather.temperature',
                    boundaries: [-50, -20, 0, 10, 20, 30, 40, 50],
                    default: 'Other',
                    output: { count: { $sum: 1 } }
                }
            }
        ]);
        
        // Get monthly activity
        const monthlyActivity = await WeatherRecord.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ]);
        
        console.log('Retrieved analytics successfully');
        
        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Analytics retrieved successfully',
            data: {
                overview: analytics[0] || {
                    totalRecords: 0,
                    avgTemperature: 0,
                    minTemperature: 0,
                    maxTemperature: 0,
                    avgHumidity: 0,
                    avgPressure: 0,
                    avgWindSpeed: 0,
                    uniqueCitiesCount: 0,
                    uniqueCountriesCount: 0
                },
                topCities,
                topCountries,
                tempDistribution,
                monthlyActivity,
                user: req.user.getSummary()
            },
            metadata: {
                generatedAt: new Date().toISOString(),
                userId: userId
            }
        });
        
    } catch (error) {
        console.error('Error retrieving statistics:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to retrieve analytics',
            code: 'ANALYTICS_ERROR'
        });
    }
});

/**
 * GET /api/records/stats
 * 
 * Endpoint to get basic statistics about stored records.
 * This is a simplified version of the analytics endpoint.
 * 
 * Security: Protected by API key and OAuth token middleware
 * 
 * Response:
 * - 200: Successfully retrieved statistics
 * - 401: Missing API key or token
 * - 403: Invalid API key or token
 * - 500: Internal server error
 */
router.get('/records/stats', dataLimiter, validateApiKey, validateOAuthToken, async (req, res) => {
    try {
        console.log('Received GET request to /api/records/stats');
        
        const userId = req.user._id;
        
        // Get basic statistics
        const totalRecords = await WeatherRecord.countDocuments({ user: userId });
        const uniqueCities = await WeatherRecord.distinct('weather.city', { user: userId });
        const uniqueCountries = await WeatherRecord.distinct('country.name', { user: userId });
        
        // Get recent activity (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentRecords = await WeatherRecord.countDocuments({
            user: userId,
            createdAt: { $gte: oneDayAgo }
        });
        
        // Get most popular cities
        const popularCities = await WeatherRecord.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$weather.city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        
        // Get most popular countries
        const popularCountries = await WeatherRecord.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$country.name', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        
        console.log('Retrieved statistics successfully');
        
        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Statistics retrieved successfully',
            data: {
                totalRecords,
                uniqueCities: uniqueCities.length,
                uniqueCountries: uniqueCountries.length,
                recentRecords,
                popularCities,
                popularCountries
            },
            metadata: {
                generatedAt: new Date().toISOString(),
                userId: userId
            }
        });
        
    } catch (error) {
        console.error('Error retrieving statistics:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to retrieve statistics',
            code: 'STATS_ERROR'
        });
    }
});

// Export the router
module.exports = router;
