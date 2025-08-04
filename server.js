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
    // Redis enabled for feedback logging and multiplayer features
    console.log('🔗 Connecting to Redis for feedback logging...');
    
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

// Middleware - Configure Helmet with CSP that allows inline scripts
// For now, allow inline scripts in all environments since our app requires them
console.log(`📊 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`🚂 RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'undefined'}`);
console.log(`🔒 CSP Mode: DEVELOPMENT (allowing inline scripts for app functionality)`);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://js.stripe.com", "https://plausible.io"], // Allow inline scripts for app functionality
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

// Feedback API - Store user suggestions and complaints
app.post('/api/feedback', async (req, res) => {
    try {
        const { userId, userEmail, userName, type, message, context } = req.body;
        
        if (!message || !type) {
            return res.status(400).json({ error: 'Message and type are required' });
        }
        
        const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Date.now();
        
        const feedbackData = {
            id: feedbackId,
            userId: userId || 'anonymous',
            userEmail: userEmail || null,
            userName: userName || 'Anonymous',
            type: type, // 'suggestion', 'complaint', 'bug', 'compliment'
            message: message,
            context: context || {},
            timestamp: timestamp,
            resolved: false,
            createdAt: new Date().toISOString()
        };
        
        // Store in Redis if available, otherwise log to console
        if (redisConnected && redisClient) {
            const redisKey = `feedback:${timestamp}:${userId || 'anonymous'}`;
            await redisClient.setEx(redisKey, 86400 * 30, JSON.stringify(feedbackData)); // Store for 30 days
            
            // Also add to feedback list for easy retrieval
            await redisClient.lPush('feedback:all', JSON.stringify(feedbackData));
            
            console.log(`📝 Feedback stored in Redis: ${feedbackId}`);
        } else {
            console.log('📝 Feedback received (Redis not available):', feedbackData);
        }
        
        res.json({
            success: true,
            feedbackId: feedbackId,
            message: 'Thank you for your feedback! We appreciate your input.'
        });
        
    } catch (error) {
        console.error('Error storing feedback:', error);
        res.status(500).json({ error: 'Failed to store feedback' });
    }
});

// Admin endpoint to retrieve all feedback
app.get('/admin/feedback', async (req, res) => {
    try {
        let feedbackList = [];
        
        if (redisConnected && redisClient) {
            // Get all feedback from Redis list
            const allFeedback = await redisClient.lRange('feedback:all', 0, -1);
            feedbackList = allFeedback.map(item => JSON.parse(item));
        }
        
        // Sort by timestamp (newest first)
        feedbackList.sort((a, b) => b.timestamp - a.timestamp);
        
        // Simple admin HTML page
        const adminHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>The Hypothetical Game - Admin Feedback</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #f5f5f5; }
                .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
                .header { text-align: center; margin-bottom: 30px; }
                .feedback-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; background: #fff; }
                .feedback-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                .feedback-type { padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; }
                .type-suggestion { background: #e3f2fd; color: #1976d2; }
                .type-complaint { background: #ffebee; color: #d32f2f; }
                .type-bug { background: #fff3e0; color: #f57c00; }
                .type-compliment { background: #e8f5e8; color: #388e3c; }
                .feedback-message { margin: 10px 0; line-height: 1.5; }
                .feedback-meta { font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px; }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
                .refresh-btn { background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 The Hypothetical Game - Admin Feedback Dashboard</h1>
                    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
                </div>
                
                <div class="stats">
                    <div class="stat-card">
                        <h3>Total Feedback</h3>
                        <h2>${feedbackList.length}</h2>
                    </div>
                    <div class="stat-card">
                        <h3>Suggestions</h3>
                        <h2>${feedbackList.filter(f => f.type === 'suggestion').length}</h2>
                    </div>
                    <div class="stat-card">
                        <h3>Complaints</h3>
                        <h2>${feedbackList.filter(f => f.type === 'complaint').length}</h2>
                    </div>
                    <div class="stat-card">
                        <h3>Bug Reports</h3>
                        <h2>${feedbackList.filter(f => f.type === 'bug').length}</h2>
                    </div>
                </div>
                
                <div class="feedback-list">
                    ${feedbackList.map(feedback => `
                        <div class="feedback-item">
                            <div class="feedback-header">
                                <div>
                                    <strong>${feedback.userName}</strong>
                                    <span class="feedback-type type-${feedback.type}">${feedback.type.toUpperCase()}</span>
                                </div>
                                <div>${new Date(feedback.timestamp).toLocaleString()}</div>
                            </div>
                            <div class="feedback-message">${feedback.message}</div>
                            <div class="feedback-meta">
                                ID: ${feedback.id} | User: ${feedback.userId} | Email: ${feedback.userEmail || 'N/A'}
                                ${feedback.context ? `| Context: ${JSON.stringify(feedback.context)}` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${feedbackList.length === 0 ? '<p style="text-align: center; color: #666; margin: 50px 0;">No feedback yet. Encourage users to share their thoughts!</p>' : ''}
            </div>
        </body>
        </html>`;
        
        res.send(adminHTML);
        
    } catch (error) {
        console.error('Error retrieving feedback:', error);
        res.status(500).json({ error: 'Failed to retrieve feedback' });
    }
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