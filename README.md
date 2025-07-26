# Math Challenge - Real-time Multiplayer Math Learning Game

A fun, interactive math learning platform with real-time multiplayer capabilities, time-based challenges, and comprehensive error reporting.

## 🚀 Features

### ✅ **Fully Working**
- **Solo Math Games** - Addition, Subtraction, Multiplication, Division, Mix, Advanced modes
- **Time-Based Scoring** - 30s, 1min, 1.5min challenges with premium 2min option
- **User Authentication** - Login/logout with score history
- **Error Reporting** - User reporting + automatic error detection
- **Local Multiplayer** - Turn-based games for 2-6 players
- **Advanced Unlock System** - Progressive challenges
- **Question Validation** - Comprehensive math accuracy checking

### 🆕 **Real-time Online Multiplayer**
- **WebSocket-Based Rooms** - Create and join 6-digit room codes
- **Live Player Synchronization** - Real-time join/leave notifications
- **Connection Status** - Visual connection indicators
- **Host Controls** - Room host can start games for all players
- **Redis-Backed** - Scalable room management

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 16+ 
- Redis server (local or cloud)

### Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Redis** (if running locally)
   ```bash
   redis-server
   ```

3. **Start the Server**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Open in Browser**
   ```
   http://localhost:3001
   ```

### Environment Configuration

Create/modify `.env` file:
```env
PORT=3001
CLIENT_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
```

For production, update `CLIENT_URL` to your domain.

## 📡 Real-time Multiplayer Usage

### Creating a Room
1. Login with your name
2. Click "Online Rooms" → "Create Room"
3. Share the 6-digit room code with friends
4. Wait for players to join
5. Start the game when everyone is ready

### Joining a Room
1. Login with your name  
2. Click "Online Rooms" → "Join Room"
3. Enter the 6-digit room code
4. Click "Ready" when you're prepared
5. Game starts when host initiates

### Connection Status
- 🟢 **Online** - Connected to server, can create/join rooms
- 🔴 **Offline** - No server connection, online features unavailable
- ⚠️ **Error** - Connection issues, check server status

## 🏗️ Architecture

### Backend (Node.js + Socket.io + Redis)
- **Express Server** - Static file serving + API endpoints
- **Socket.io** - Real-time WebSocket communication
- **Redis** - Room state management and persistence
- **Room Manager** - Handle create/join/leave operations

### Frontend (Vanilla JavaScript)
- **WebSocketManager** - Handle all real-time communication
- **MathGame Class** - Core game logic and state management
- **Event-Driven UI** - Real-time updates for multiplayer

### Room Lifecycle
1. **Create** - Generate unique 6-digit code, store in Redis
2. **Join** - Add players to room, broadcast updates
3. **Ready** - Track player ready status
4. **Start** - Host initiates synchronized gameplay
5. **Cleanup** - Auto-expire after 30 minutes of inactivity

## 🧪 Testing & Quality

### Automatic Math Validation
```javascript
// Run comprehensive validation tests
runMathTests()
```

### Features Tested
- ✅ Question generation accuracy (all game types)
- ✅ Options validation (correct answer always present)
- ✅ Word problem mathematical correctness
- ✅ Real-time room synchronization
- ✅ Connection handling and reconnection

## 🚀 Production Deployment

### Server Deployment (Railway/Heroku)
1. Push to Git repository
2. Set environment variables:
   - `PORT` (auto-set by platform)
   - `CLIENT_URL` (your domain)
   - `REDIS_URL` (managed Redis service)
3. Deploy and monitor

### Redis Setup
- **Local Development** - `redis-server`
- **Production** - Use managed Redis (Redis Cloud, Railway Redis, etc.)

## 📊 Monitoring & Analytics

### Error Reporting
- Real-time error detection and reporting
- Pattern analysis for common issues
- Export logs for debugging
- Auto-detection of mathematical errors

### Performance
- Connection status monitoring
- Room lifecycle tracking
- Player synchronization metrics

## 🔧 Development

### Adding New Game Types
1. Add to `GAME_TYPES` array in server.js
2. Implement question generation logic
3. Add validation rules
4. Update frontend UI

### WebSocket Events
- `create-room` - Create new multiplayer room
- `join-room` - Join existing room
- `player-ready` - Set ready status
- `start-game` - Begin synchronized gameplay
- `leave-room` - Exit room

## 🐛 Troubleshooting

### Common Issues
- **Connection Failed** - Check server is running on correct port
- **Room Not Found** - Verify 6-digit code is correct
- **Redis Connection** - Ensure Redis server is accessible
- **Math Errors** - Run `runMathTests()` to validate question generation

### Debug Mode
Open browser console to see detailed WebSocket communication and room events.

## 📈 Future Enhancements

- [ ] Synchronized question delivery (server-side generation)
- [ ] Real-time scoring updates during gameplay
- [ ] Voice chat integration
- [ ] Tournament brackets
- [ ] Leaderboards and rankings
- [ ] Mobile app (React Native)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add comprehensive tests
4. Submit pull request

---

**Made with ❤️ for better math education**