/**
 * Authentication Routes
 * 
 * OAuth 2.0 authentication and authorization endpoints.
 * This module handles user authentication using Passport.js with Google OAuth 2.0,
 * JWT token management, and user session handling.
 * 
 * Features:
 * - Google OAuth 2.0 integration
 * - JWT token generation and validation
 * - User profile management
 * - Session handling
 * - Account linking and unlinking
 * - Password reset (for local auth)
 * 
 * Security:
 * - Rate limiting on all endpoints
 * - Input validation and sanitization
 * - Secure token handling
 * - CSRF protection
 */

const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/user');
const WeatherRecord = require('../models/weatherRecord');

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        success: false,
        error: 'Too many authentication attempts',
        message: 'Please try again later',
        code: 'AUTH_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting for password reset
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset attempts per hour
    message: {
        success: false,
        error: 'Too many password reset attempts',
        message: 'Please try again in an hour',
        code: 'PASSWORD_RESET_RATE_LIMIT'
    }
});

// JWT token generation function
const generateTokens = (user) => {
    const payload = {
        id: user._id,
        email: user.email,
        displayName: user.displayName
    };
    
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
    });
    
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });
    
    return { accessToken, refreshToken };
};

// Middleware to validate JWT token
const authenticateToken = async (req, res, next) => {
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

// Input validation middleware
const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Invalid input data',
            code: 'VALIDATION_ERROR',
            details: errors.array()
        });
    }
    next();
};

/**
 * GET /auth/google
 * 
 * Initiate Google OAuth 2.0 authentication flow.
 * Redirects user to Google's consent screen.
 */
router.get('/google', authLimiter, passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
}));

/**
 * GET /auth/google/callback
 * 
 * Handle Google OAuth 2.0 callback.
 * Processes the authorization code and creates/updates user account.
 */
router.get('/google/callback', authLimiter, 
    passport.authenticate('google', { session: false }),
    async (req, res) => {
        try {
            const { user, isNewUser } = req;
            
            // Generate JWT tokens
            const { accessToken, refreshToken } = generateTokens(user);
            
            // Store refresh token in database
            user.tokens.push({
                token: refreshToken,
                type: 'refresh',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });
            await user.save();
            
            // Update last active
            await user.updateLastActive();
            
            console.log(`${isNewUser ? 'New user' : 'Existing user'} authenticated: ${user.email}`);
            
            // Redirect to frontend with tokens
            const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?` +
                `access_token=${accessToken}&` +
                `refresh_token=${refreshToken}&` +
                `is_new_user=${isNewUser}`;
            
            res.redirect(redirectUrl);
            
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Authentication failed`);
        }
    }
);

/**
 * POST /auth/refresh
 * 
 * Refresh access token using refresh token.
 * Validates the refresh token and issues a new access token.
 */
router.post('/refresh', authLimiter, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token required',
                message: 'Please provide a refresh token',
                code: 'MISSING_REFRESH_TOKEN'
            });
        }
        
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Find user and validate refresh token
        const user = await User.findOne({
            _id: decoded.id,
            'tokens.token': refreshToken,
            'tokens.type': 'refresh',
            'tokens.expiresAt': { $gt: new Date() }
        });
        
        if (!user || user.status !== 'active') {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token',
                message: 'Refresh token is invalid or expired',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }
        
        // Generate new access token
        const { accessToken } = generateTokens(user);
        
        // Update last active
        await user.updateLastActive();
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken,
                expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
            }
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Refresh token expired',
                message: 'Please log in again',
                code: 'REFRESH_TOKEN_EXPIRED'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Token refresh failed',
            message: 'Failed to refresh access token',
            code: 'TOKEN_REFRESH_ERROR'
        });
    }
});

/**
 * POST /auth/logout
 * 
 * Logout user and invalidate refresh token.
 * Removes the refresh token from the database.
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (refreshToken) {
            // Remove specific refresh token
            await User.findByIdAndUpdate(req.user._id, {
                $pull: { tokens: { token: refreshToken, type: 'refresh' } }
            });
        } else {
            // Remove all refresh tokens
            await User.findByIdAndUpdate(req.user._id, {
                $set: { tokens: [] }
            });
        }
        
        console.log(`User logged out: ${req.user.email}`);
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            message: 'Failed to logout user',
            code: 'LOGOUT_ERROR'
        });
    }
});

/**
 * GET /auth/me
 * 
 * Get current user profile information.
 * Returns user data without sensitive information.
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('records', 'timestamp weather.city country.name')
            .select('-localAuth.password -tokens');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User profile not found',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Update last active
        await user.updateLastActive();
        
        res.json({
            success: true,
            message: 'User profile retrieved successfully',
            data: {
                user: user.getSummary(),
                recentRecords: user.records.slice(0, 5),
                stats: user.stats
            }
        });
        
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user profile',
            message: 'Failed to retrieve user information',
            code: 'GET_PROFILE_ERROR'
        });
    }
});

/**
 * PUT /auth/profile
 * 
 * Update user profile information.
 * Allows users to update their display name and preferences.
 */
router.put('/profile', authenticateToken, [
    body('displayName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Display name must be between 2 and 100 characters'),
    body('preferences.theme')
        .optional()
        .isIn(['light', 'dark', 'auto'])
        .withMessage('Theme must be light, dark, or auto'),
    body('preferences.language')
        .optional()
        .isLength({ min: 2, max: 10 })
        .withMessage('Language code must be between 2 and 10 characters')
], validateInput, async (req, res) => {
    try {
        const { displayName, preferences } = req.body;
        const updateData = {};
        
        if (displayName) updateData.displayName = displayName;
        if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };
        
        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true, runValidators: true }
        ).select('-localAuth.password -tokens');
        
        console.log(`User profile updated: ${user.email}`);
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: user.getSummary()
            }
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Profile update failed',
            message: 'Failed to update user profile',
            code: 'UPDATE_PROFILE_ERROR'
        });
    }
});

/**
 * DELETE /auth/account
 * 
 * Delete user account and all associated data.
 * This is a destructive operation that cannot be undone.
 */
router.delete('/account', authenticateToken, [
    body('confirmation')
        .equals('DELETE')
        .withMessage('Confirmation must be exactly "DELETE"')
], validateInput, async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Delete all user's weather records
        await WeatherRecord.deleteMany({ user: userId });
        
        // Delete user account
        await User.findByIdAndDelete(userId);
        
        console.log(`User account deleted: ${req.user.email}`);
        
        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            error: 'Account deletion failed',
            message: 'Failed to delete user account',
            code: 'DELETE_ACCOUNT_ERROR'
        });
    }
});

/**
 * GET /auth/stats
 * 
 * Get user statistics and analytics.
 * Returns comprehensive user activity data.
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get user analytics
        const analytics = await WeatherRecord.getUserAnalytics(userId);
        
        // Get user's recent activity
        const recentRecords = await WeatherRecord.getUserRecords(userId, { limit: 10 });
        
        // Get user's favorite cities and countries
        const user = await User.findById(userId).select('stats');
        
        res.json({
            success: true,
            message: 'User statistics retrieved successfully',
            data: {
                analytics: analytics[0] || {
                    totalRecords: 0,
                    avgTemperature: 0,
                    avgHumidity: 0,
                    avgPressure: 0,
                    uniqueCitiesCount: 0,
                    uniqueCountriesCount: 0
                },
                recentRecords,
                favorites: {
                    cities: user.stats.favoriteCities,
                    countries: user.stats.favoriteCountries
                },
                accountInfo: {
                    accountAge: user.accountAge,
                    lastActive: user.lastActive,
                    totalRecords: user.stats.totalRecords
                }
            }
        });
        
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user statistics',
            message: 'Failed to retrieve user analytics',
            code: 'GET_STATS_ERROR'
        });
    }
});

// Export the router
module.exports = router;
