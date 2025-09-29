/**
 * Passport Configuration
 * 
 * OAuth 2.0 authentication configuration using Passport.js.
 * This module configures Google OAuth 2.0 strategy and handles
 * user serialization/deserialization for sessions.
 * 
 * Features:
 * - Google OAuth 2.0 strategy
 * - User profile handling
 * - Account creation and linking
 * - Session management
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

// Configure Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google OAuth callback received for:', profile.emails[0].value);
        
        // Check if user already exists with this Google ID
        let user = await User.findByOAuthProvider('google', profile.id);
        
        if (user) {
            // User exists, update their last login
            const providerIndex = user.providers.findIndex(p => p.provider === 'google' && p.providerId === profile.id);
            if (providerIndex !== -1) {
                user.providers[providerIndex].lastLogin = new Date();
                await user.save();
            }
            
            console.log('Existing user logged in:', user.email);
            return done(null, user, { isNewUser: false });
        }
        
        // Check if user exists with the same email but different provider
        const existingUser = await User.findOne({ email: profile.emails[0].value });
        
        if (existingUser) {
            // Link Google account to existing user
            existingUser.providers.push({
                provider: 'google',
                providerId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                picture: profile.photos[0]?.value,
                verified: true,
                lastLogin: new Date()
            });
            
            await existingUser.save();
            console.log('Google account linked to existing user:', existingUser.email);
            return done(null, existingUser, { isNewUser: false });
        }
        
        // Create new user
        const newUser = new User({
            email: profile.emails[0].value,
            displayName: profile.displayName,
            profilePicture: profile.photos[0]?.value,
            providers: [{
                provider: 'google',
                providerId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                picture: profile.photos[0]?.value,
                verified: true,
                lastLogin: new Date()
            }],
            status: 'active'
        });
        
        await newUser.save();
        console.log('New user created:', newUser.email);
        
        return done(null, newUser, { isNewUser: true });
        
    } catch (error) {
        console.error('OAuth strategy error:', error);
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-localAuth.password -tokens');
        done(null, user);
    } catch (error) {
        console.error('Deserialize user error:', error);
        done(error, null);
    }
});

module.exports = passport;
