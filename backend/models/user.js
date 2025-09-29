/**
 * User Model
 * 
 * Mongoose schema for user authentication and management.
 * This model handles OAuth 2.0 user data from Google and other providers,
 * stores user preferences, and maintains references to their weather records.
 * 
 * Features:
 * - OAuth 2.0 integration (Google, future: Facebook, GitHub)
 * - JWT token management
 * - User preferences and settings
 * - Record ownership tracking
 * - Account statistics
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the user preferences sub-schema
const userPreferencesSchema = new mongoose.Schema({
    // Display preferences
    theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
    },
    language: {
        type: String,
        default: 'en',
        maxlength: [10, 'Language code cannot exceed 10 characters']
    },
    units: {
        temperature: {
            type: String,
            enum: ['celsius', 'fahrenheit'],
            default: 'celsius'
        },
        wind: {
            type: String,
            enum: ['m/s', 'km/h', 'mph'],
            default: 'm/s'
        },
        pressure: {
            type: String,
            enum: ['hPa', 'mmHg', 'inHg'],
            default: 'hPa'
        }
    },
    
    // Notification preferences
    notifications: {
        email: {
            type: Boolean,
            default: true
        },
        push: {
            type: Boolean,
            default: false
        },
        newRecords: {
            type: Boolean,
            default: true
        },
        weeklyReport: {
            type: Boolean,
            default: false
        }
    },
    
    // Privacy settings
    privacy: {
        profilePublic: {
            type: Boolean,
            default: false
        },
        shareData: {
            type: Boolean,
            default: false
        }
    }
}, { _id: false });

// Define the OAuth provider sub-schema
const oauthProviderSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: true,
        enum: ['google', 'facebook', 'github', 'local']
    },
    providerId: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    picture: {
        type: String,
        trim: true,
        validate: {
            validator: function(url) {
                if (!url) return true; // Optional field
                return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)$/i.test(url);
            },
            message: 'Profile picture must be a valid image URL'
        }
    },
    verified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Main User schema
const userSchema = new mongoose.Schema({
    // Basic user information
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: 'Please provide a valid email address'
        }
    },
    
    // Display name
    displayName: {
        type: String,
        required: [true, 'Display name is required'],
        trim: true,
        maxlength: [100, 'Display name cannot exceed 100 characters']
    },
    
    // Profile picture URL
    profilePicture: {
        type: String,
        trim: true,
        validate: {
            validator: function(url) {
                if (!url) return true; // Optional field
                return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)$/i.test(url);
            },
            message: 'Profile picture must be a valid image URL'
        }
    },
    
    // OAuth providers (array to support multiple providers)
    providers: [oauthProviderSchema],
    
    // Local authentication (for future implementation)
    localAuth: {
        password: {
            type: String,
            minlength: [8, 'Password must be at least 8 characters long'],
            select: false // Don't include in queries by default
        },
        resetPasswordToken: {
            type: String,
            select: false
        },
        resetPasswordExpires: {
            type: Date,
            select: false
        },
        emailVerificationToken: {
            type: String,
            select: false
        },
        emailVerified: {
            type: Boolean,
            default: false
        }
    },
    
    // User preferences and settings
    preferences: {
        type: userPreferencesSchema,
        default: () => ({})
    },
    
    // References to user's weather records
    records: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WeatherRecord'
    }],
    
    // User statistics
    stats: {
        totalRecords: {
            type: Number,
            default: 0
        },
        totalCities: {
            type: Number,
            default: 0
        },
        totalCountries: {
            type: Number,
            default: 0
        },
        lastRecordDate: {
            type: Date
        },
        favoriteCities: [{
            city: String,
            count: Number
        }],
        favoriteCountries: [{
            country: String,
            count: Number
        }]
    },
    
    // Account status and metadata
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending'],
        default: 'active'
    },
    
    // Account creation and activity tracking
    accountCreated: {
        type: Date,
        default: Date.now
    },
    
    lastActive: {
        type: Date,
        default: Date.now
    },
    
    // JWT token management
    tokens: [{
        token: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['access', 'refresh'],
            default: 'access'
        },
        expiresAt: {
            type: Date,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    // Schema options
    timestamps: true, // Automatically add createdAt and updatedAt
    collection: 'users',
    strict: true
});

// Indexes for better query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'providers.providerId': 1, 'providers.provider': 1 });
userSchema.index({ status: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'stats.totalRecords': -1 });

// Virtual for user's full profile URL
userSchema.virtual('profileUrl').get(function() {
    return `/api/users/${this._id}/profile`;
});

// Virtual for user's records count
userSchema.virtual('recordCount').get(function() {
    return this.records ? this.records.length : 0;
});

// Virtual for account age in days
userSchema.virtual('accountAge').get(function() {
    const now = new Date();
    const created = this.accountCreated;
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Instance method to get user summary
userSchema.methods.getSummary = function() {
    return {
        id: this._id,
        email: this.email,
        displayName: this.displayName,
        profilePicture: this.profilePicture,
        status: this.status,
        stats: this.stats,
        accountAge: this.accountAge,
        lastActive: this.lastActive
    };
};

// Instance method to get public profile
userSchema.methods.getPublicProfile = function() {
    return {
        id: this._id,
        displayName: this.displayName,
        profilePicture: this.profilePicture,
        stats: {
            totalRecords: this.stats.totalRecords,
            totalCities: this.stats.totalCities,
            totalCountries: this.stats.totalCountries
        },
        accountAge: this.accountAge
    };
};

// Instance method to update last active
userSchema.methods.updateLastActive = function() {
    this.lastActive = new Date();
    return this.save();
};

// Instance method to add a record reference
userSchema.methods.addRecord = function(recordId) {
    if (!this.records.includes(recordId)) {
        this.records.push(recordId);
        this.stats.totalRecords += 1;
        this.stats.lastRecordDate = new Date();
        return this.save();
    }
    return Promise.resolve(this);
};

// Instance method to remove a record reference
userSchema.methods.removeRecord = function(recordId) {
    const index = this.records.indexOf(recordId);
    if (index > -1) {
        this.records.splice(index, 1);
        this.stats.totalRecords = Math.max(0, this.stats.totalRecords - 1);
        return this.save();
    }
    return Promise.resolve(this);
};

// Instance method to update statistics
userSchema.methods.updateStats = function() {
    return this.populate('records').then(user => {
        const cities = new Set();
        const countries = new Set();
        const cityCounts = {};
        const countryCounts = {};
        
        user.records.forEach(record => {
            if (record.weather) {
                cities.add(record.weather.city);
                cityCounts[record.weather.city] = (cityCounts[record.weather.city] || 0) + 1;
            }
            if (record.country) {
                countries.add(record.country.name);
                countryCounts[record.country.name] = (countryCounts[record.country.name] || 0) + 1;
            }
        });
        
        // Update stats
        this.stats.totalCities = cities.size;
        this.stats.totalCountries = countries.size;
        this.stats.favoriteCities = Object.entries(cityCounts)
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        this.stats.favoriteCountries = Object.entries(countryCounts)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        return this.save();
    });
};

// Static method to find user by OAuth provider
userSchema.statics.findByOAuthProvider = function(provider, providerId) {
    return this.findOne({
        'providers.provider': provider,
        'providers.providerId': providerId
    });
};

// Static method to find active users
userSchema.statics.findActiveUsers = function() {
    return this.find({ status: 'active' }).sort({ lastActive: -1 });
};

// Static method to get user statistics
userSchema.statics.getUserStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                },
                totalRecords: { $sum: '$stats.totalRecords' },
                avgRecordsPerUser: { $avg: '$stats.totalRecords' }
            }
        }
    ]);
};

// Pre-save middleware to hash password (if using local auth)
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('localAuth.password')) return next();
    
    try {
        // Hash password with cost of 12
        const hashedPassword = await bcrypt.hash(this.localAuth.password, 12);
        this.localAuth.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to update last active
userSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.lastActive = new Date();
    }
    next();
});

// Post-save middleware for logging
userSchema.post('save', function(doc) {
    console.log(`User ${doc.email} saved/updated`);
});

// Export the model
module.exports = mongoose.model('User', userSchema);
