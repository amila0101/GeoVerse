/**
 * GeoVerse Backend Server
 * 
 * Main server file for the Global Weather and Country Info Dashboard backend.
 * This Express.js server provides a RESTful API for storing and retrieving
 * aggregated weather and country data from MongoDB.
 * 
 * Features:
 * - Express.js web framework
 * - MongoDB integration with Mongoose ODM
 * - CORS support for cross-origin requests
 * - Body parsing middleware
 * - Environment variable configuration
 * - Comprehensive error handling
 * - Security middleware
 * - Logging and monitoring
 * 
 * Author: GeoVerse Team
 * Version: 1.0.0
 */

// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import route modules
const dataRoutes = require('./routes/dataRoutes');
const authRoutes = require('./routes/authRoutes');

// Import Passport configuration
require('./config/passport');

// Initialize Express application
const app = express();

// Get configuration from environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/geoverse';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:5500';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret-here';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-here';

// Configure CORS
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Parse allowed origins from environment variable
        const allowedOrigins = CORS_ORIGIN.split(',').map(origin => origin.trim());
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true
};

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// Apply CORS middleware
app.use(cors(corsOptions));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' })); // Support JSON payloads up to 10MB
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // Support URL-encoded payloads

// Session configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
        secure: NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Global rate limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests',
        message: 'Please try again later',
        code: 'GLOBAL_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(globalLimiter);

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'GeoVerse Backend is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        version: '1.0.0'
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'GeoVerse API Documentation',
        version: '2.0.0',
        endpoints: {
            'GET /health': 'Health check endpoint',
            'GET /api': 'API documentation',
            'POST /api/records': 'Store weather and country data (requires x-api-key header and OAuth token)',
            'GET /api/records': 'Retrieve user-specific weather and country records (requires x-api-key header and OAuth token)',
            'GET /api/records/stats': 'Get basic statistics about stored records (requires x-api-key header and OAuth token)',
            'GET /api/analytics': 'Get comprehensive analytics and insights (requires x-api-key header and OAuth token)',
            'GET /auth/google': 'Initiate Google OAuth 2.0 authentication',
            'GET /auth/google/callback': 'Google OAuth 2.0 callback handler',
            'POST /auth/refresh': 'Refresh access token using refresh token',
            'POST /auth/logout': 'Logout user and invalidate tokens',
            'GET /auth/me': 'Get current user profile information',
            'PUT /auth/profile': 'Update user profile information',
            'DELETE /auth/account': 'Delete user account and all associated data',
            'GET /auth/stats': 'Get user statistics and analytics'
        },
        authentication: {
            apiKey: {
                type: 'API Key',
                header: 'x-api-key',
                description: 'All API endpoints require a valid API key in the x-api-key header'
            },
            oauth: {
                type: 'OAuth 2.0 + JWT',
                header: 'Authorization: Bearer <token>',
                description: 'All data endpoints require a valid OAuth token for user-specific access'
            }
        },
        features: {
            realTime: 'WebSocket support for real-time updates',
            analytics: 'Comprehensive data analytics and reporting',
            rateLimiting: 'API rate limiting for security',
            userManagement: 'Complete user authentication and profile management'
        },
        cors: {
            enabled: true,
            origins: CORS_ORIGIN.split(',').map(origin => origin.trim())
        }
    });
});

// Mount API routes
app.use('/api', dataRoutes);
app.use('/auth', authRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `The requested route ${req.method} ${req.originalUrl} does not exist`,
        code: 'ROUTE_NOT_FOUND',
        availableRoutes: [
            'GET /health',
            'GET /api',
            'POST /api/records',
            'GET /api/records',
            'GET /api/records/stats',
            'GET /api/analytics',
            'GET /auth/google',
            'GET /auth/google/callback',
            'POST /auth/refresh',
            'POST /auth/logout',
            'GET /auth/me',
            'PUT /auth/profile',
            'DELETE /auth/account',
            'GET /auth/stats'
        ]
    });
});

// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    // Handle CORS errors
    if (error.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            error: 'CORS Error',
            message: 'Origin not allowed by CORS policy',
            code: 'CORS_ERROR'
        });
    }
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON',
            message: 'The request body contains invalid JSON',
            code: 'INVALID_JSON'
        });
    }
    
    // Handle other errors
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
    });
});

// Database connection function
async function connectToDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        
        // MongoDB connection options
        const options = {
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        };
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, options);
        
        console.log('✅ Successfully connected to MongoDB');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        console.log(`🔗 Connection URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs
        
        // Handle connection events
        mongoose.connection.on('error', (error) => {
            console.error('❌ MongoDB connection error:', error);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });
        
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1); // Exit the process if database connection fails
    }
}

// Graceful shutdown function
function gracefulShutdown(signal, server, io) {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    // Close Socket.IO server
    if (io) {
        io.close(() => {
            console.log('✅ Socket.IO server closed');
        });
    }
    
    // Close the HTTP server
    if (server) {
        server.close(() => {
            console.log('✅ HTTP server closed');
            
            // Close the database connection
            mongoose.connection.close().then(() => {
                console.log('✅ MongoDB connection closed');
                console.log('👋 GeoVerse Backend shutdown complete');
                process.exit(0);
            }).catch((error) => {
                console.error('❌ Error closing MongoDB connection:', error);
                process.exit(1);
            });
        });
    } else {
        // Close the database connection directly if no server
        mongoose.connection.close().then(() => {
            console.log('✅ MongoDB connection closed');
            console.log('👋 GeoVerse Backend shutdown complete');
            process.exit(0);
        }).catch((error) => {
            console.error('❌ Error closing MongoDB connection:', error);
            process.exit(1);
        });
    }
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

// Start the server
async function startServer() {
    try {
        // Connect to the database first
        await connectToDatabase();
        
        // Create HTTP server
        const server = createServer(app);
        
        // Initialize Socket.IO
        const io = new Server(server, {
            cors: {
                origin: CORS_ORIGIN.split(',').map(origin => origin.trim()),
                methods: ['GET', 'POST'],
                credentials: true
            }
        });
        
        // Make io available to routes
        app.set('io', io);
        
        // Socket.IO connection handling
        io.on('connection', (socket) => {
            console.log(`🔌 Client connected: ${socket.id}`);
            
            // Join user to their personal room for targeted updates
            socket.on('join-user-room', (userId) => {
                socket.join(`user-${userId}`);
                console.log(`👤 User ${userId} joined their personal room`);
            });
            
            // Handle disconnection
            socket.on('disconnect', () => {
                console.log(`🔌 Client disconnected: ${socket.id}`);
            });
            
            // Handle errors
            socket.on('error', (error) => {
                console.error(`❌ Socket error for ${socket.id}:`, error);
            });
        });
        
        // Start the HTTP server
        server.listen(PORT, () => {
            console.log('\n🚀 GeoVerse Backend Server Started v2.0');
            console.log('=====================================');
            console.log(`🌐 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${NODE_ENV}`);
            console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
            console.log(`🔑 API Key + OAuth 2.0 required for data endpoints`);
            console.log(`🔌 WebSocket support enabled`);
            console.log('=====================================');
            console.log('\n📋 Available Endpoints:');
            console.log(`   GET  http://localhost:${PORT}/health`);
            console.log(`   GET  http://localhost:${PORT}/api`);
            console.log(`   POST http://localhost:${PORT}/api/records`);
            console.log(`   GET  http://localhost:${PORT}/api/records`);
            console.log(`   GET  http://localhost:${PORT}/api/records/stats`);
            console.log(`   GET  http://localhost:${PORT}/api/analytics`);
            console.log(`   GET  http://localhost:${PORT}/auth/google`);
            console.log(`   GET  http://localhost:${PORT}/auth/me`);
            console.log('\n💡 Tip: Use x-api-key header + OAuth token for API requests');
            console.log('🔌 WebSocket: ws://localhost:' + PORT);
            console.log('=====================================\n');
        });
        
        // Handle graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server, io));
        process.on('SIGINT', () => gracefulShutdown('SIGINT', server, io));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            gracefulShutdown('uncaughtException', server, io);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection', server, io);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// Export the app for testing purposes
module.exports = app;
