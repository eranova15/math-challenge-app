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

// CORS configuration for Socket.io - allow Railway deployment URL
const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3000",
    "https://*.railway.app",
    "https://*.up.railway.app"
];

const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, etc.)
            if (!origin) return callback(null, true);
            
            // Check if origin matches allowed patterns
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

// Redis client setup with connection retry
let redisClient = null;
let redisConnected = false;

async function createRedisClient() {
    if (!process.env.REDIS_URL) {
        console.log('⚠️  No REDIS_URL found - multiplayer features will be disabled');
        return null;
    }
    
    try {
        const client = createClient({
            url: process.env.REDIS_URL,
            socket: {
                connectTimeout: 10000,
                commandTimeout: 5000
            }
        });
        
        client.on('error', (err) => {
            console.error('Redis connection error:', err);
            redisConnected = false;
        });
        
        client.on('connect', () => {
            console.log('✅ Connected to Redis - multiplayer features enabled');
            redisConnected = true;
        });
        
        client.on('disconnect', () => {
            console.log('⚠️  Disconnected from Redis - multiplayer features disabled');
            redisConnected = false;
        });
        
        return client;
    } catch (error) {
        console.error('Failed to create Redis client:', error);
        return null;
    }
}

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Constants
const ROOM_EXPIRY_TIME = 30 * 60; // 30 minutes in seconds
const MAX_PLAYERS_PER_ROOM = 6;
const GAME_TYPES = ['addition', 'subtraction', 'multiplication', 'division', 'mix'];

// Room Management Class
class RoomManager {
    constructor(redisClient) {
        this.redis = redisClient;
        this.enabled = redisClient !== null;
    }
    
    isEnabled() {
        return this.enabled && redisConnected;
    }

    // Generate a unique 6-character room code
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Create a new room
    async createRoom(hostId, hostName) {
        if (!this.isEnabled()) {
            throw new Error('Multiplayer features are not available - Redis connection required');
        }
        
        const roomCode = this.generateRoomCode();
        
        // Ensure room code is unique
        let attempts = 0;
        while (await this.roomExists(roomCode) && attempts < 50) {
            roomCode = this.generateRoomCode();
            attempts++;
        }

        if (attempts >= 50) {
            throw new Error('Unable to generate unique room code');
        }

        const room = {
            code: roomCode,
            host: hostId,
            hostName: hostName,
            players: [{
                id: hostId,
                name: hostName,
                ready: false,
                score: 0,
                totalQuestions: 0,
                correctAnswers: 0,
                accuracy: 0,
                connected: true
            }],
            gameStarted: false,
            gameType: null,
            timeLimit: 60,
            currentQuestion: null,
            questionStartTime: null,
            createdAt: new Date().toISOString()
        };

        if (this.isEnabled()) {
            await this.redis.setEx(`room:${roomCode}`, ROOM_EXPIRY_TIME, JSON.stringify(room));
        }
        return room;
    }

    // Check if room exists
    async roomExists(roomCode) {
        if (!this.isEnabled()) return false;
        const exists = await this.redis.exists(`room:${roomCode}`);
        return exists === 1;
    }

    // Get room data
    async getRoom(roomCode) {
        if (!this.isEnabled()) return null;
        const roomData = await this.redis.get(`room:${roomCode}`);
        return roomData ? JSON.parse(roomData) : null;
    }

    // Update room data
    async updateRoom(roomCode, roomData) {
        if (!this.isEnabled()) return;
        await this.redis.setEx(`room:${roomCode}`, ROOM_EXPIRY_TIME, JSON.stringify(roomData));
    }

    // Add player to room
    async addPlayerToRoom(roomCode, playerId, playerName) {
        const room = await this.getRoom(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }

        if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
            throw new Error('Room is full');
        }

        // Check if player already in room
        const existingPlayer = room.players.find(p => p.id === playerId);
        if (existingPlayer) {
            // Reconnect existing player
            existingPlayer.connected = true;
        } else {
            // Add new player
            room.players.push({
                id: playerId,
                name: playerName,
                ready: false,
                score: 0,
                totalQuestions: 0,
                correctAnswers: 0,
                accuracy: 0,
                connected: true
            });
        }

        await this.updateRoom(roomCode, room);
        return room;
    }

    // Remove player from room
    async removePlayerFromRoom(roomCode, playerId) {
        const room = await this.getRoom(roomCode);
        if (!room) return null;

        room.players = room.players.filter(p => p.id !== playerId);
        
        if (room.players.length === 0) {
            // Delete empty room
            if (this.isEnabled()) {
                await this.redis.del(`room:${roomCode}`);
            }
            return null;
        }

        // If host left, assign new host
        if (room.host === playerId && room.players.length > 0) {
            room.host = room.players[0].id;
            room.hostName = room.players[0].name;
        }

        await this.updateRoom(roomCode, room);
        return room;
    }

    // Set player ready status
    async setPlayerReady(roomCode, playerId, ready) {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const player = room.players.find(p => p.id === playerId);
        if (!player) throw new Error('Player not found');

        player.ready = ready;
        await this.updateRoom(roomCode, room);
        return room;
    }

    // Check if all players are ready
    isAllPlayersReady(room) {
        return room.players.length > 1 && room.players.every(p => p.ready);
    }

    // Delete room
    async deleteRoom(roomCode) {
        if (!this.isEnabled()) return;
        await this.redis.del(`room:${roomCode}`);
    }
}

// Initialize room manager
let roomManager;

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Check if multiplayer is available
    socket.on('check-multiplayer', () => {
        socket.emit('multiplayer-status', { 
            enabled: roomManager && roomManager.isEnabled(),
            redisConnected: redisConnected
        });
    });

    // Join room
    socket.on('create-room', async (data) => {
        try {
            if (!roomManager || !roomManager.isEnabled()) {
                socket.emit('error', { message: 'Multiplayer features are not available. Redis connection required.' });
                return;
            }
            
            const { playerName } = data;
            if (!playerName || playerName.trim().length === 0) {
                socket.emit('error', { message: 'Player name is required' });
                return;
            }

            const room = await roomManager.createRoom(socket.id, playerName.trim());
            socket.join(room.code);
            
            socket.emit('room-created', { 
                roomCode: room.code, 
                room: room 
            });
            
            console.log(`Room created: ${room.code} by ${playerName}`);
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Join existing room
    socket.on('join-room', async (data) => {
        try {
            if (!roomManager || !roomManager.isEnabled()) {
                socket.emit('error', { message: 'Multiplayer features are not available. Redis connection required.' });
                return;
            }
            
            const { roomCode, playerName } = data;
            
            if (!roomCode || !playerName) {
                socket.emit('error', { message: 'Room code and player name are required' });
                return;
            }

            const room = await roomManager.addPlayerToRoom(roomCode.toUpperCase(), socket.id, playerName.trim());
            socket.join(roomCode.toUpperCase());
            
            // Notify all players in room
            io.to(roomCode.toUpperCase()).emit('player-joined', { 
                player: room.players.find(p => p.id === socket.id),
                room: room 
            });
            
            socket.emit('room-joined', { room: room });
            console.log(`${playerName} joined room: ${roomCode.toUpperCase()}`);
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Player ready status
    socket.on('player-ready', async (data) => {
        try {
            const { roomCode, ready } = data;
            const room = await roomManager.setPlayerReady(roomCode, socket.id, ready);
            
            // Broadcast to all players in room
            io.to(roomCode).emit('player-ready-update', { 
                playerId: socket.id, 
                ready: ready,
                room: room 
            });

            // Check if all players are ready to start game
            if (roomManager.isAllPlayersReady(room)) {
                io.to(roomCode).emit('all-players-ready');
            }

            console.log(`Player ${socket.id} ready status: ${ready} in room ${roomCode}`);
        } catch (error) {
            console.error('Error updating ready status:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Start game (host only)
    socket.on('start-game', async (data) => {
        try {
            const { roomCode, gameType, timeLimit } = data;
            const room = await roomManager.getRoom(roomCode);
            
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (room.host !== socket.id) {
                socket.emit('error', { message: 'Only host can start the game' });
                return;
            }

            if (!roomManager.isAllPlayersReady(room)) {
                socket.emit('error', { message: 'Not all players are ready' });
                return;
            }

            // Update room with game settings
            room.gameStarted = true;
            room.gameType = gameType;
            room.timeLimit = timeLimit || 60;
            
            // Reset all player scores
            room.players.forEach(player => {
                player.score = 0;
                player.totalQuestions = 0;
                player.correctAnswers = 0;
                player.accuracy = 0;
                player.ready = false;
            });

            await roomManager.updateRoom(roomCode, room);

            // Start game for all players
            io.to(roomCode).emit('game-started', { 
                gameType: gameType,
                timeLimit: timeLimit,
                room: room 
            });

            console.log(`Game started in room ${roomCode}: ${gameType} (${timeLimit}s)`);
        } catch (error) {
            console.error('Error starting game:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
        
        // Find and update rooms where this player was present
        // This is a simplified approach - in production, you'd want to track socket-room relationships
        // For now, we'll handle cleanup when players explicitly leave rooms
    });

    // Leave room
    socket.on('leave-room', async (data) => {
        try {
            const { roomCode } = data;
            const room = await roomManager.removePlayerFromRoom(roomCode, socket.id);
            
            socket.leave(roomCode);
            
            if (room) {
                // Notify remaining players
                io.to(roomCode).emit('player-left', { 
                    playerId: socket.id, 
                    room: room 
                });
            } else {
                // Room was deleted (no players left)
                io.to(roomCode).emit('room-deleted');
            }

            console.log(`Player ${socket.id} left room ${roomCode}`);
        } catch (error) {
            console.error('Error leaving room:', error);
            socket.emit('error', { message: error.message });
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Server status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        multiplayer: {
            enabled: roomManager && roomManager.isEnabled(),
            redisConnected: redisConnected,
            redisUrl: process.env.REDIS_URL ? 'configured' : 'not configured'
        },
        environment: process.env.NODE_ENV || 'development'
    });
});

// Get room info (for debugging)
app.get('/api/room/:roomCode', async (req, res) => {
    try {
        if (!roomManager || !roomManager.isEnabled()) {
            return res.status(503).json({ error: 'Multiplayer features not available' });
        }
        
        const room = await roomManager.getRoom(req.params.roomCode.toUpperCase());
        if (room) {
            res.json(room);
        } else {
            res.status(404).json({ error: 'Room not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize server
async function startServer() {
    try {
        console.log('🚀 Starting Math Challenge Server...');
        
        // Try to connect to Redis (optional)
        redisClient = await createRedisClient();
        if (redisClient) {
            try {
                await redisClient.connect();
                console.log('✅ Redis connected - multiplayer features enabled');
            } catch (error) {
                console.warn('⚠️  Redis connection failed - continuing without multiplayer:', error.message);
                redisClient = null;
            }
        }

        // Initialize room manager (works with or without Redis)
        roomManager = new RoomManager(redisClient);
        
        if (roomManager.isEnabled()) {
            console.log('🎮 Multiplayer rooms: ENABLED');
        } else {
            console.log('🎮 Multiplayer rooms: DISABLED (Redis not available)');
        }

        // Start server
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`🚀 Math Challenge Server running on port ${PORT}`);
            console.log(`📡 WebSocket server ready for connections`);
            console.log(`🏠 Serving static files from current directory`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        if (redisClient) {
            redisClient.quit();
        }
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        if (redisClient) {
            redisClient.quit();
        }
        process.exit(0);
    });
});

// Start the server
startServer();