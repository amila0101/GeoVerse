# GeoVerse Backend v2.0

Advanced backend service for the Global Weather and Country Info Dashboard with OAuth 2.0, real-time updates, analytics, and comprehensive security features.

## 🚀 New Features in v2.0

### 🔐 OAuth 2.0 Authentication & Authorization
- **Google OAuth 2.0** integration with Passport.js
- **JWT token management** with access and refresh tokens
- **User-specific data** - all records are now tied to authenticated users
- **Account management** - profile updates, account deletion
- **Session handling** with MongoDB session store

### 📊 Data Analytics & Reporting
- **Comprehensive analytics endpoint** (`/api/analytics`)
- **MongoDB Aggregation Framework** for complex queries
- **User-specific insights** - temperature distribution, monthly activity
- **Top cities and countries** analysis
- **Weather statistics** - averages, min/max values

### 🔌 Real-Time Updates (WebSockets)
- **Socket.IO integration** for real-time communication
- **Live notifications** when new records are saved
- **User-specific rooms** for targeted updates
- **Connection management** with proper error handling

### 🛡️ API Rate Limiting
- **Global rate limiting** - 1000 requests per 15 minutes
- **Endpoint-specific limits** - 100 requests per 15 minutes for data endpoints
- **Authentication rate limiting** - 10 requests per 15 minutes
- **Configurable limits** via environment variables

## 📁 Project Structure

```
backend/
├── config/
│   └── passport.js          # OAuth 2.0 configuration
├── models/
│   ├── user.js              # User model with OAuth integration
│   └── weatherRecord.js     # Updated weather record model
├── routes/
│   ├── authRoutes.js        # Authentication endpoints
│   └── dataRoutes.js        # Updated data endpoints
├── env.template             # Environment variables template
├── package.json             # Dependencies and scripts
├── server.js                # Main server with WebSocket support
└── README.md                # This file
```

## 🛠️ Installation & Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Configuration
```bash
# Copy the template
cp env.template .env

# Edit .env with your actual values
nano .env
```

### 3. Required Environment Variables
```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5500

# MongoDB
MONGODB_URI=mongodb://localhost:27017/geoverse

# Security
API_KEY=your_secure_api_key_here
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
SESSION_SECRET=your_session_secret_here

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# CORS
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500
```

### 4. Google OAuth 2.0 Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback`
   - `http://localhost:5500/auth/callback` (for frontend)

### 5. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🔗 API Endpoints

### Authentication Endpoints
- **GET** `/auth/google` - Initiate Google OAuth 2.0
- **GET** `/auth/google/callback` - OAuth callback handler
- **POST** `/auth/refresh` - Refresh access token
- **POST** `/auth/logout` - Logout user
- **GET** `/auth/me` - Get user profile
- **PUT** `/auth/profile` - Update user profile
- **DELETE** `/auth/account` - Delete user account
- **GET** `/auth/stats` - Get user statistics

### Data Endpoints (Require API Key + OAuth Token)
- **POST** `/api/records` - Store weather and country data
- **GET** `/api/records` - Retrieve user-specific records
- **GET** `/api/records/stats` - Get basic statistics
- **GET** `/api/analytics` - Get comprehensive analytics

### Utility Endpoints
- **GET** `/health` - Health check
- **GET** `/api` - API documentation

## 🔐 Authentication Flow

### 1. OAuth 2.0 Login
```javascript
// Redirect user to Google OAuth
window.location.href = 'http://localhost:3000/auth/google';
```

### 2. Handle OAuth Callback
```javascript
// Frontend receives tokens via URL parameters
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('access_token');
const refreshToken = urlParams.get('refresh_token');
```

### 3. Make Authenticated Requests
```javascript
// Include both API key and OAuth token
const response = await fetch('/api/records', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your_api_key',
        'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(data)
});
```

## 📊 Analytics Features

### Comprehensive Analytics Endpoint
```bash
GET /api/analytics
```

**Response includes:**
- **Overview**: Total records, average temperatures, unique cities/countries
- **Top Cities**: Most searched cities with average temperatures
- **Top Countries**: Most searched countries with statistics
- **Temperature Distribution**: Bucketed temperature analysis
- **Monthly Activity**: 12-month activity trends
- **User Statistics**: Account age, last active, etc.

### Example Analytics Response
```json
{
    "success": true,
    "data": {
        "overview": {
            "totalRecords": 150,
            "avgTemperature": 22.5,
            "minTemperature": -5.2,
            "maxTemperature": 45.8,
            "uniqueCitiesCount": 25,
            "uniqueCountriesCount": 15
        },
        "topCities": [
            {"city": "London", "count": 12, "avgTemp": 15.2},
            {"city": "Tokyo", "count": 8, "avgTemp": 18.5}
        ],
        "topCountries": [
            {"country": "United Kingdom", "count": 15, "avgTemp": 14.8},
            {"country": "Japan", "count": 10, "avgTemp": 17.2}
        ],
        "tempDistribution": [
            {"_id": 0, "count": 45},
            {"_id": 10, "count": 67},
            {"_id": 20, "count": 38}
        ],
        "monthlyActivity": [
            {"_id": {"year": 2025, "month": 1}, "count": 25},
            {"_id": {"year": 2024, "month": 12}, "count": 18}
        ]
    }
}
```

## 🔌 WebSocket Integration

### Client-Side Connection
```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Join user-specific room
socket.emit('join-user-room', userId);

// Listen for new records
socket.on('new-record', (data) => {
    console.log('New record saved:', data);
    // Update UI with new record
    updateDashboard(data);
});
```

### Server-Side Events
- **new-record**: Emitted when a new weather record is saved
- **user-joined**: User joins their personal room
- **user-left**: User disconnects

## 🛡️ Security Features

### Multi-Layer Authentication
1. **API Key**: Application-level security
2. **OAuth 2.0**: User-level authentication
3. **JWT Tokens**: Stateless session management
4. **Rate Limiting**: Abuse prevention

### Rate Limiting Configuration
- **Global**: 1000 requests per 15 minutes
- **Data Endpoints**: 100 requests per 15 minutes
- **Authentication**: 10 requests per 15 minutes
- **Password Reset**: 3 requests per hour

### Security Headers
- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Content Security Policy**: XSS protection

## 📈 Performance Optimizations

### Database Indexes
- User-specific queries optimized
- Compound indexes for city/country searches
- Timestamp-based sorting indexes

### Aggregation Pipelines
- Efficient analytics queries
- Minimal data transfer
- Cached results where appropriate

### WebSocket Optimization
- Room-based messaging
- Connection pooling
- Graceful disconnection handling

## 🧪 Testing

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test OAuth flow
curl http://localhost:3000/auth/google

# Test authenticated endpoint
curl -H "X-API-Key: your_key" \
     -H "Authorization: Bearer your_token" \
     http://localhost:3000/api/records
```

### WebSocket Testing
```javascript
// Test WebSocket connection
const socket = io('http://localhost:3000');
socket.on('connect', () => console.log('Connected!'));
socket.on('new-record', (data) => console.log('New record:', data));
```

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-production-jwt-secret
SESSION_SECRET=your-production-session-secret
GOOGLE_CLIENT_ID=your-production-google-client-id
GOOGLE_CLIENT_SECRET=your-production-google-client-secret
CORS_ORIGIN=https://yourdomain.com
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 Troubleshooting

### Common Issues

1. **OAuth Callback Errors**
   - Check Google Cloud Console configuration
   - Verify redirect URIs match exactly
   - Ensure OAuth consent screen is configured

2. **JWT Token Errors**
   - Verify JWT secrets are set
   - Check token expiration times
   - Ensure proper token format

3. **WebSocket Connection Issues**
   - Check CORS configuration
   - Verify Socket.IO version compatibility
   - Check firewall settings

4. **Rate Limiting Issues**
   - Adjust rate limits in environment variables
   - Check IP-based limiting
   - Monitor request patterns

### Logs and Monitoring
- All requests are logged with timestamps
- Error handling with detailed error codes
- WebSocket connection/disconnection tracking
- Database query performance monitoring

## 📚 API Documentation

### Complete API Reference
Visit `http://localhost:3000/api` for complete API documentation with examples.

### Postman Collection
Import the API collection for easy testing:
- Authentication endpoints
- Data management endpoints
- Analytics endpoints
- WebSocket examples

## 🤝 Contributing

1. Follow existing code style
2. Add comprehensive comments
3. Test all endpoints
4. Update documentation
5. Ensure security best practices

## 📄 License

MIT License - see main project README for details.

---

**GeoVerse Backend v2.0** - Advanced weather dashboard with OAuth 2.0, real-time updates, and comprehensive analytics.