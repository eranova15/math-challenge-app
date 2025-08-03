const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS configuration for Railway deployment
const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3001",
    "https://thehypotheticalgame.com",
    "https://www.thehypotheticalgame.com",
    "https://*.railway.app",
    "https://*.up.railway.app"
];

const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            
            const isAllowed = allowedOrigins.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp(pattern.replace('*', '.*'));
                    return regex.test(origin);
                }
                return pattern === origin;
            });
            
            callback(null, isAllowed);
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Redis client setup with graceful fallback
let redisClient = null;
let redisConnected = false;

async function createRedisClient() {
    // Temporarily disable Redis to fix connection spam
    console.log('⚠️  Redis temporarily disabled - using memory storage');
    return null;
    
    if (!process.env.REDIS_URL) {
        console.log('⚠️  No REDIS_URL found - using memory storage');
        return null;
    }
    
    try {
        const client = createClient({
            url: process.env.REDIS_URL,
            socket: {
                connectTimeout: 5000,
                commandTimeout: 3000,
                lazyConnect: true
            }
        });
        
        client.on('error', (err) => {
            console.error('Redis connection error:', err.message);
            redisConnected = false;
        });
        
        client.on('connect', () => {
            console.log('✅ Connected to Redis - multiplayer features enabled');
            redisConnected = true;
        });
        
        return client;
    } catch (error) {
        console.error('Failed to create Redis client:', error.message);
        return null;
    }
}

// Middleware - Configure Helmet with CSP that allows inline scripts in development
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: process.env.NODE_ENV === 'production' 
                ? ["'self'", "https://js.stripe.com", "https://plausible.io"] 
                : ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://js.stripe.com", "https://plausible.io"], // Allow inline scripts and event handlers in development
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            fontSrc: ["'self'", "https:", "data:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            childSrc: ["'none'"],
        },
    },
}));
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());

// Static files with aggressive cache busting for development
app.use((req, res, next) => {
    // Disable all caching for development
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('ETag', Math.random().toString()); // Force unique ETags
    res.setHeader('Last-Modified', new Date().toUTCString());
    next();
});

app.use(express.static('.'));

// Health check endpoint - CRITICAL for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        redis: redisConnected,
        environment: process.env.NODE_ENV || 'development',
        message: 'The Hypothetical Game Server is running'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        redis: redisConnected,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Simple user registration
app.post('/api/user/register', (req, res) => {
    const { name, email } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    
    const userId = email || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const userData = {
        id: userId,
        name,
        email: email || null,
        plan: 'free',
        gamesPlayed: 0,
        createdAt: new Date().toISOString()
    };
    
    res.json({ 
        success: true, 
        user: userData,
        message: 'User registered successfully'
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
    });
});

// Server startup with Railway optimization
async function startServer() {
    const startTime = Date.now();
    
    try {
        console.log('🚀 Starting The Hypothetical Game Server...');
        console.log(`📍 Platform: ${process.platform}, Node: ${process.version}`);
        
        // Start HTTP server immediately
        const PORT = process.env.PORT || 3003;
        console.log(`🔌 Binding to PORT: ${PORT}`);
        
        server.listen(PORT, '0.0.0.0', () => {
            const startupTime = Date.now() - startTime;
            console.log(`✅ The Hypothetical Game Server ONLINE on port ${PORT} (${startupTime}ms)`);
            console.log(`📡 WebSocket server ready for connections`);
            console.log(`🏠 Serving static files from current directory`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check available at /health`);
        });
        
        // Connect to Redis in background after server starts
        setTimeout(async () => {
            try {
                redisClient = await createRedisClient();
                if (redisClient) {
                    await redisClient.connect();
                }
            } catch (error) {
                console.warn('⚠️  Redis connection failed - continuing without multiplayer:', error.message);
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    
    server.close(async () => {
        console.log('📡 HTTP server closed');
        
        if (redisClient) {
            try {
                await redisClient.quit();
                console.log('🔌 Redis connection closed');
            } catch (error) {
                console.error('Error closing Redis:', error.message);
            }
        }
        
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
    });
    
    setTimeout(() => {
        console.log('⏰ Force exit after timeout');
        process.exit(1);
    }, 10000);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    
    server.close(async () => {
        if (redisClient) {
            try {
                await redisClient.quit();
            } catch (error) {
                console.error('Error closing Redis:', error.message);
            }
        }
        process.exit(0);
    });
});

// Start the server
startServer();