// WebSocket Client Manager for Real-time Multiplayer
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.currentRoom = null;
        this.connectionListeners = [];
        this.roomListeners = [];
    }

    // Initialize WebSocket connection
    connect() {
        if (this.socket && this.connected) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.socket = io(window.location.origin);
            
            this.socket.on('connect', () => {
                console.log('✅ Connected to server');
                this.connected = true;
                this.notifyConnectionListeners('connected');
                resolve();
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from server');
                this.connected = false;
                this.notifyConnectionListeners('disconnected');
            });

            this.socket.on('error', (error) => {
                console.error('❌ Socket error:', error);
                this.notifyConnectionListeners('error', error);
                reject(error);
            });

            // Room event listeners
            this.setupRoomListeners();

            // Connection timeout
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    // Set up room-specific event listeners
    setupRoomListeners() {
        this.socket.on('room-created', (data) => {
            console.log('🏠 Room created:', data.roomCode);
            this.currentRoom = data.room;
            this.notifyRoomListeners('room-created', data);
        });

        this.socket.on('room-joined', (data) => {
            console.log('🚪 Joined room:', data.room.code);
            this.currentRoom = data.room;
            this.notifyRoomListeners('room-joined', data);
        });

        this.socket.on('player-joined', (data) => {
            console.log('👋 Player joined:', data.player.name);
            this.currentRoom = data.room;
            this.notifyRoomListeners('player-joined', data);
        });

        this.socket.on('player-left', (data) => {
            console.log('👋 Player left:', data.playerId);
            this.currentRoom = data.room;
            this.notifyRoomListeners('player-left', data);
        });

        this.socket.on('player-ready-update', (data) => {
            console.log('✅ Player ready update:', data.playerId, data.ready);
            this.currentRoom = data.room;
            this.notifyRoomListeners('player-ready-update', data);
        });

        this.socket.on('all-players-ready', () => {
            console.log('🎮 All players ready!');
            this.notifyRoomListeners('all-players-ready');
        });

        this.socket.on('game-started', (data) => {
            console.log('🎯 Game started:', data.gameType);
            this.currentRoom = data.room;
            this.notifyRoomListeners('game-started', data);
        });

        this.socket.on('room-deleted', () => {
            console.log('🗑️ Room deleted');
            this.currentRoom = null;
            this.notifyRoomListeners('room-deleted');
        });
    }

    // Create a new room
    createRoom(playerName) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('Not connected to server'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Room creation timeout'));
            }, 10000);

            const successHandler = (data) => {
                clearTimeout(timeout);
                this.socket.off('room-created', successHandler);
                this.socket.off('error', errorHandler);
                resolve(data);
            };

            const errorHandler = (error) => {
                clearTimeout(timeout);
                this.socket.off('room-created', successHandler);
                this.socket.off('error', errorHandler);
                reject(error);
            };

            this.socket.once('room-created', successHandler);
            this.socket.once('error', errorHandler);
            
            this.socket.emit('create-room', { playerName });
        });
    }

    // Join an existing room
    joinRoom(roomCode, playerName) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('Not connected to server'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Room join timeout'));
            }, 10000);

            const successHandler = (data) => {
                clearTimeout(timeout);
                this.socket.off('room-joined', successHandler);
                this.socket.off('error', errorHandler);
                resolve(data);
            };

            const errorHandler = (error) => {
                clearTimeout(timeout);
                this.socket.off('room-joined', successHandler);
                this.socket.off('error', errorHandler);
                reject(error);
            };

            this.socket.once('room-joined', successHandler);
            this.socket.once('error', errorHandler);
            
            this.socket.emit('join-room', { roomCode, playerName });
        });
    }

    // Set player ready status
    setPlayerReady(roomCode, ready) {
        if (this.connected) {
            this.socket.emit('player-ready', { roomCode, ready });
        }
    }

    // Start game (host only)
    startGame(roomCode, gameType, timeLimit) {
        if (this.connected) {
            this.socket.emit('start-game', { roomCode, gameType, timeLimit });
        }
    }

    // Leave current room
    leaveRoom(roomCode) {
        if (this.connected) {
            this.socket.emit('leave-room', { roomCode });
            this.currentRoom = null;
        }
    }

    // Add connection event listener
    onConnection(callback) {
        this.connectionListeners.push(callback);
    }

    // Add room event listener  
    onRoom(callback) {
        this.roomListeners.push(callback);
    }

    // Notify connection listeners
    notifyConnectionListeners(event, data) {
        this.connectionListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Connection listener error:', error);
            }
        });
    }

    // Notify room listeners
    notifyRoomListeners(event, data) {
        this.roomListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Room listener error:', error);
            }
        });
    }

    // Get current connection status
    isConnected() {
        return this.connected;
    }

    // Get current room
    getCurrentRoom() {
        return this.currentRoom;
    }
}

class MathGame {
    constructor() {
        this.currentGame = null;
        this.timer = null;
        this.timeLeft = 30;
        this.score = 0;
        this.totalQuestions = 0;
        this.correctAnswers = 0;
        this.startTime = null;
        this.currentQuestion = null;
        
        // Time-based system
        this.selectedTimeLimit = 60; // Default 1 minute
        this.maxTime = 60;
        
        // Difficulty and adaptive system
        this.difficulty = 'medium'; // easy, medium, hard
        this.correctStreak = 0;
        this.wrongStreak = 0;
        this.recentAnswers = []; // Track last 5 answers for adaptive difficulty
        this.maxStreak = 0;
        this.questionHistory = []; // Prevent recent duplicates
        this.layoutType = 'horizontal'; // for addition: horizontal or vertical
        
        // User and multiplayer system
        this.currentUser = null;
        this.isMultiplayer = false;
        this.players = [];
        this.playerScores = [];
        this.gameMode = 'single'; // 'single', 'local', or 'online'
        this.playersReady = [];
        this.gameStarted = false;
        this.countdownTimer = null;
        this.questionAnswered = false;
        
        // Real-time Room system with WebSocket
        this.webSocketManager = new WebSocketManager();
        this.currentRoom = null;
        this.isRoomHost = false;
        this.roomPlayers = [];
        this.connectionStatus = 'disconnected'; // disconnected, connecting, connected
        
        // Unlock system
        this.advancedUnlocked = false;
        this.mixHighScore = 0;
        this.feedbackGiven = false;
        this.gameCount = 0;
        
        // Error reporting system
        this.errorReports = [];
        this.loadErrorReports();
        
        // Initialize user session
        this.initializeUser();
        this.checkAdvancedUnlock();
        
        // Set up WebSocket event listeners
        this.setupWebSocketListeners();
    }

    // WebSocket Event Setup
    setupWebSocketListeners() {
        // Connection status updates
        this.webSocketManager.onConnection((event, data) => {
            this.connectionStatus = event;
            this.updateConnectionStatus(event, data);
        });

        // Room event updates
        this.webSocketManager.onRoom((event, data) => {
            this.handleRoomEvent(event, data);
        });
    }

    // Update connection status in UI
    updateConnectionStatus(status, data) {
        // Add connection indicator to the UI
        let indicator = document.getElementById('connectionIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'connectionIndicator';
            indicator.className = 'connection-indicator';
            document.querySelector('header').appendChild(indicator);
        }

        switch (status) {
            case 'connected':
                indicator.textContent = '🟢 Online';
                indicator.className = 'connection-indicator connected';
                break;
            case 'disconnected':
                indicator.textContent = '🔴 Offline';
                indicator.className = 'connection-indicator disconnected';
                break;
            case 'error':
                indicator.textContent = '⚠️ Connection Error';
                indicator.className = 'connection-indicator error';
                console.error('Connection error:', data);
                break;
        }
    }

    // Handle real-time room events
    handleRoomEvent(event, data) {
        switch (event) {
            case 'room-created':
                this.currentRoom = data.room;
                this.isRoomHost = true;
                this.showRoomLobby();
                break;
                
            case 'room-joined':
                this.currentRoom = data.room;
                this.isRoomHost = this.currentRoom.host === this.webSocketManager.socket?.id;
                this.showRoomLobby();
                break;
                
            case 'player-joined':
                this.currentRoom = data.room;
                this.updateRoomPlayersList();
                this.showQuickNotification(`${data.player.name} joined the room!`, 'info');
                break;
                
            case 'player-left':
                this.currentRoom = data.room;
                this.updateRoomPlayersList();
                this.showQuickNotification('A player left the room', 'info');
                break;
                
            case 'player-ready-update':
                this.currentRoom = data.room;
                this.updateRoomPlayersList();
                break;
                
            case 'all-players-ready':
                this.showQuickNotification('All players ready! Host can start the game.', 'success');
                break;
                
            case 'game-started':
                this.currentRoom = data.room;
                this.startOnlineMultiplayerGame(data.gameType, data.timeLimit);
                break;
                
            case 'room-deleted':
                this.currentRoom = null;
                this.isRoomHost = false;
                this.showQuickNotification('Room was deleted', 'error');
                this.goHome();
                break;
        }
    }

    // Initialize WebSocket connection when needed
    async ensureConnection() {
        if (!this.webSocketManager.isConnected()) {
            try {
                this.connectionStatus = 'connecting';
                this.updateConnectionStatus('connecting');
                await this.webSocketManager.connect();
                return true;
            } catch (error) {
                console.error('Failed to connect to server:', error);
                this.showQuickNotification('Failed to connect to server. Online features unavailable.', 'error');
                return false;
            }
        }
        return true;
    }

    // User Authentication System
    initializeUser() {
        const savedUser = localStorage.getItem('mathChallengeUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showUserInfo();
        }
    }

    login() {
        const nameInput = document.getElementById('nameInput');
        const name = nameInput.value.trim();
        
        if (name.length > 0) {
            this.currentUser = {
                name: name,
                loginTime: new Date().toISOString(),
                totalGames: 0,
                bestScores: {
                    addition: { score: 0, accuracy: 0 },
                    subtraction: { score: 0, accuracy: 0 },
                    multiplication: { score: 0, accuracy: 0 },
                    division: { score: 0, accuracy: 0 }
                }
            };
            
            // Load existing user data if available
            const existingUsers = JSON.parse(localStorage.getItem('mathChallengeUsers') || '{}');
            if (existingUsers[name]) {
                this.currentUser = { ...existingUsers[name], loginTime: new Date().toISOString() };
            }
            
            localStorage.setItem('mathChallengeUser', JSON.stringify(this.currentUser));
            this.showUserInfo();
            nameInput.value = '';
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('mathChallengeUser');
        this.showLoginSection();
    }

    showUserInfo() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userName').textContent = this.currentUser.name;
        document.getElementById('saveScoreBtn').style.display = 'inline-block';
        document.getElementById('viewHistoryBtn').style.display = 'inline-block';
    }

    showLoginSection() {
        document.getElementById('loginSection').style.display = 'flex';
        document.getElementById('userInfo').style.display = 'none';
        document.getElementById('saveScoreBtn').style.display = 'none';
        document.getElementById('viewHistoryBtn').style.display = 'none';
    }

    // Time Selection System
    selectTimeLimit(timeInSeconds) {
        // Check if premium option is selected (2 minutes = 120 seconds)
        if (timeInSeconds === 120) {
            alert('⭐ Premium feature! Subscribe to unlock 2-minute challenges!');
            return;
        }
        
        this.selectedTimeLimit = timeInSeconds;
        this.maxTime = timeInSeconds;
        
        // Update UI - remove 'selected' class from all options
        document.querySelectorAll('.time-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add 'selected' class to clicked option
        const selectedOption = document.querySelector(`[data-value="${timeInSeconds}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }

    // Multiplayer System
    selectGameMode(mode) {
        this.gameMode = mode;
        document.getElementById('singleModeBtn').classList.toggle('active', mode === 'single');
        document.getElementById('localModeBtn').classList.toggle('active', mode === 'local');
        document.getElementById('onlineModeBtn').classList.toggle('active', mode === 'online');
        
        document.getElementById('multiplayerSetup').style.display = mode === 'local' ? 'block' : 'none';
        document.getElementById('roomSetup').style.display = mode === 'online' ? 'block' : 'none';
        document.getElementById('roomLobby').style.display = 'none';
        
        if (mode === 'local') {
            this.updatePlayerCount();
        }
    }

    updatePlayerCount() {
        const count = parseInt(document.getElementById('playerCount').value);
        document.getElementById('playerCountDisplay').textContent = count;
        
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        for (let i = 1; i <= count; i++) {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-input';
            playerDiv.innerHTML = `<input type="text" placeholder="Player ${i} name" maxlength="15" id="player${i}">`;
            playersList.appendChild(playerDiv);
        }
    }

    setupMultiplayerGame() {
        this.isMultiplayer = true;
        this.players = [];
        this.playerScores = [];
        this.playersReady = [];
        this.gameStarted = false;
        
        const playerCount = parseInt(document.getElementById('playerCount').value);
        
        for (let i = 1; i <= playerCount; i++) {
            const playerInput = document.getElementById(`player${i}`);
            const playerName = playerInput.value.trim() || `Player ${i}`;
            this.players.push(playerName);
            this.playerScores.push({
                name: playerName,
                score: 0,
                totalQuestions: 0,
                correctAnswers: 0,
                accuracy: 0
            });
            this.playersReady.push(false);
        }
        
        this.showReadyScreen();
    }

    showReadyScreen() {
        document.getElementById('gameSelection').style.display = 'none';
        document.getElementById('multiplayerReady').style.display = 'block';
        
        const readyPlayersDiv = document.getElementById('readyPlayers');
        readyPlayersDiv.innerHTML = this.players.map((player, index) => `
            <div class="ready-player" id="readyPlayer${index}">
                <div class="player-info">
                    <span class="player-name">${player}</span>
                    <span class="ready-status" id="readyStatus${index}">⏳ Waiting</span>
                </div>
                <button class="ready-btn" onclick="game.setPlayerReady(${index})" id="readyBtn${index}">
                    🎮 Ready!
                </button>
            </div>
        `).join('');
    }

    setPlayerReady(playerIndex) {
        this.playersReady[playerIndex] = true;
        
        // Update UI
        document.getElementById(`readyStatus${playerIndex}`).textContent = '✅ Ready';
        document.getElementById(`readyBtn${playerIndex}`).disabled = true;
        document.getElementById(`readyBtn${playerIndex}`).textContent = '✅ Ready';
        
        // Check if all players are ready
        if (this.playersReady.every(ready => ready)) {
            this.startCountdown();
        }
    }

    startCountdown() {
        document.getElementById('readyPlayers').style.display = 'none';
        document.getElementById('countdown').style.display = 'block';
        
        let count = 3;
        const countdownElement = document.getElementById('countdownNumber');
        
        this.countdownTimer = setInterval(() => {
            countdownElement.textContent = count;
            countdownElement.style.animation = 'none';
            // Trigger reflow
            countdownElement.offsetHeight;
            countdownElement.style.animation = 'countdownPulse 1s ease-out';
            
            count--;
            
            if (count < 0) {
                clearInterval(this.countdownTimer);
                this.startSimultaneousGame();
            }
        }, 1000);
    }

    startSimultaneousGame() {
        this.gameStarted = true;
        document.getElementById('multiplayerReady').style.display = 'none';
        this.showGameArea();
        document.getElementById('multiplayerStatus').style.display = 'block';
        document.getElementById('multiplayerScores').style.display = 'block';
        this.updateMultiplayerScoreboard();
        this.startTimer();
        this.generateQuestion();
    }

    showMultiplayerUI() {
        document.getElementById('multiplayerStatus').style.display = 'block';
        document.getElementById('multiplayerScores').style.display = 'block';
        this.updateMultiplayerScoreboard();
    }

    updateMultiplayerScoreboard() {
        if (!this.isMultiplayer) return;
        
        const scoreboard = document.getElementById('playersScoreboard');
        // Sort players by score for display (but don't modify the original array)
        const sortedPlayers = [...this.playerScores].sort((a, b) => {
            if (b.score === a.score) {
                return b.accuracy - a.accuracy;
            }
            return b.score - a.score;
        });
        
        scoreboard.innerHTML = sortedPlayers.map((player, rank) => {
            const rankEmoji = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`;
            return `
                <div class="player-score ${rank === 0 ? 'leading' : ''}">
                    <span class="player-rank">${rankEmoji}</span>
                    <span class="player-score-name">${player.name}</span>
                    <span class="player-score-value">${player.score}/${player.totalQuestions} (${player.accuracy}%)</span>
                </div>
            `;
        }).join('');
    }

    startAdditionGame() {
        this.currentGame = 'addition';
        this.initializeGame();
    }

    startSubtractionGame() {
        this.currentGame = 'subtraction';
        this.initializeGame();
    }

    startMultiplicationGame() {
        this.currentGame = 'multiplication';
        this.initializeGame();
    }

    startDivisionGame() {
        this.currentGame = 'division';
        this.initializeGame();
    }

    startMixGame() {
        this.currentGame = 'mix';
        this.initializeGame();
    }

    startSquaresGame() {
        this.currentGame = 'squares';
        this.initializeGame();
    }

    startCubesGame() {
        this.currentGame = 'cubes';
        this.initializeGame();
    }

    startRootsGame() {
        this.currentGame = 'roots';
        this.initializeGame();
    }

    startPowersGame() {
        this.currentGame = 'powers';
        this.initializeGame();
    }

    initializeGame() {
        if (this.gameMode === 'local') {
            this.setupMultiplayerGame();
        } else if (this.gameMode === 'online') {
            this.setupOnlineGame();
        } else {
            this.isMultiplayer = false;
        }
        
        this.timeLeft = this.selectedTimeLimit;
        this.maxTime = this.selectedTimeLimit;
        this.score = 0;
        this.totalQuestions = 0;
        this.correctAnswers = 0;
        this.difficulty = 'medium';
        this.correctStreak = 0;
        this.wrongStreak = 0;
        this.recentAnswers = [];
        this.maxStreak = 0;
        
        this.showGameArea();
        this.startTimer();
        this.generateQuestion();
    }

    generateQuestion() {
        this.questionAnswered = false; // Reset for new question
        switch (this.currentGame) {
            case 'addition':
                this.generateAdditionQuestion();
                break;
            case 'subtraction':
                this.generateSubtractionQuestion();
                break;
            case 'multiplication':
                this.generateMultiplicationQuestion();
                break;
            case 'division':
                this.generateDivisionQuestion();
                break;
            case 'mix':
                this.generateMixQuestion();
                break;
            case 'squares':
                this.generateSquaresQuestion();
                break;
            case 'cubes':
                this.generateCubesQuestion();
                break;
            case 'roots':
                this.generateRootsQuestion();
                break;
            case 'powers':
                this.generatePowersQuestion();
                break;
        }
    }

    showGameArea() {
        document.getElementById('gameSelection').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        document.getElementById('results').style.display = 'none';
        this.startTime = Date.now();
        this.updateStats();
    }

    generateAdditionQuestion() {
        const { min, max, count } = this.getAdditionDifficulty();
        const numbers = [];
        
        for (let i = 0; i < count; i++) {
            numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        
        const totalSum = numbers.reduce((sum, num) => sum + num, 0);
        
        // Choose from different creative layouts
        const layouts = ['horizontal', 'vertical', 'visual', 'word', 'missing'];
        this.layoutType = layouts[Math.floor(Math.random() * layouts.length)];
        
        // Handle missing number problems specially
        if (this.layoutType === 'missing') {
            const missingIndex = Math.floor(Math.random() * numbers.length);
            const missingNumber = numbers[missingIndex];
            
            // Validate the question before proceeding
            const questionData = { numbers, layout: this.layoutType };
            if (this.validateQuestion(questionData, missingNumber, 'addition')) {
                this.renderAdditionProblem(numbers, totalSum, this.layoutType, missingIndex);
                this.generateOptions(missingNumber, 'addition'); // Generate options for the missing number
                this.currentQuestion = { numbers, correctAnswer: missingNumber, layout: this.layoutType };
            } else {
                // Fallback to horizontal if validation fails
                this.layoutType = 'horizontal';
                this.renderAdditionProblem(numbers, totalSum, this.layoutType);
                this.generateOptions(totalSum, 'addition');
                this.currentQuestion = { numbers, correctAnswer: totalSum, layout: this.layoutType };
            }
        } else {
            const questionData = { numbers, layout: this.layoutType };
            if (this.validateQuestion(questionData, totalSum, 'addition')) {
                this.renderAdditionProblem(numbers, totalSum, this.layoutType);
                this.generateOptions(totalSum, 'addition');
                this.currentQuestion = { numbers, correctAnswer: totalSum, layout: this.layoutType };
            } else {
                // Regenerate if validation fails
                console.warn('Question failed validation, regenerating...');
                this.generateAdditionQuestion();
                return;
            }
        }
    }

    renderAdditionProblem(numbers, correctAnswer, layout, missingIndex = null) {
        const numbersDisplay = document.getElementById('numbersDisplay');
        const questionDiv = document.getElementById('question');
        
        switch (layout) {
            case 'horizontal':
                const expression = numbers.join(' + ') + ' = ?';
                numbersDisplay.innerHTML = '';
                questionDiv.innerHTML = `<div class="horizontal-math">${expression}</div>`;
                break;
                
            case 'vertical':
                numbersDisplay.innerHTML = 
                    `<div class="vertical-addition">
                        ${numbers.map((n, i) => `<div class="addend ${i === 0 ? 'first' : ''}">${i === 0 ? '' : '+'} ${n}</div>`).join('')}
                        <div class="addition-line">_____</div>
                        <div class="sum-placeholder">?</div>
                    </div>`;
                questionDiv.textContent = '';
                break;
                
            case 'visual':
                numbersDisplay.innerHTML = this.createVisualRepresentation(numbers);
                questionDiv.innerHTML = '<div class="visual-question">How many total?</div>';
                break;
                
            case 'word':
                numbersDisplay.innerHTML = '';
                questionDiv.innerHTML = this.createWordProblem(numbers);
                break;
                
            case 'missing':
                const visibleNumbers = [...numbers];
                visibleNumbers[missingIndex] = '?';
                
                numbersDisplay.innerHTML = '';
                questionDiv.innerHTML = `
                    <div class="missing-number-problem">
                        <div class="equation">${visibleNumbers.join(' + ')} = ${correctAnswer}</div>
                        <div class="find-text">Find the missing number!</div>
                    </div>
                `;
                break;
        }
    }

    createVisualRepresentation(numbers) {
        return `
            <div class="visual-math">
                ${numbers.map((num, index) => `
                    <div class="number-group">
                        <div class="number-label">${num}</div>
                        <div class="dots-container">
                            ${this.createDots(num)}
                        </div>
                        ${index < numbers.length - 1 ? '<div class="plus-sign">+</div>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    createDots(count) {
        let dots = '';
        for (let i = 0; i < Math.min(count, 15); i++) { // Limit to 15 dots for visual clarity
            dots += '<div class="dot"></div>';
        }
        if (count > 15) {
            dots += `<div class="more-dots">... (+${count - 15} more)</div>`;
        }
        return dots;
    }

    createWordProblem(numbers) {
        const scenarios = [
            {
                context: "🍎 Sarah has {0} apples. She picks {1} more from the tree. How many apples does she have now?",
                applicable: (nums) => nums.length === 2
            },
            {
                context: "🚗 There are {0} cars in the parking lot. {1} more cars arrive. How many cars are there in total?",
                applicable: (nums) => nums.length === 2
            },
            {
                context: "📚 Tom has {0} books, Lisa has {1} books, and Jake has {2} books. How many books do they have altogether?",
                applicable: (nums) => nums.length === 3
            },
            {
                context: "⭐ You collect {0} stars on level 1, {1} stars on level 2, {2} stars on level 3, and {3} stars on level 4. What's your total score?",
                applicable: (nums) => nums.length === 4
            },
            {
                context: "🎈 At the party, there are {0} red balloons and {1} blue balloons. How many balloons are there altogether?",
                applicable: (nums) => nums.length === 2
            }
        ];

        const validScenarios = scenarios.filter(s => s.applicable(numbers));
        const scenario = validScenarios[Math.floor(Math.random() * validScenarios.length)] || scenarios[0];
        
        let problemText = scenario.context;
        numbers.forEach((num, index) => {
            problemText = problemText.replace(`{${index}}`, num);
        });

        return `<div class="word-problem">${problemText}</div>`;
    }

    generateSubtractionQuestion() {
        const { min, max, count } = this.getSubtractionDifficulty();
        
        // For subtraction, we need to ensure positive results
        let numbers = [];
        let correctAnswer;
        
        if (count === 2) {
            // Simple two-number subtraction
            const num1 = Math.floor(Math.random() * (max - min + 1)) + min;
            const num2 = Math.floor(Math.random() * num1) + 1; // Ensure num2 < num1
            numbers = [num1, num2];
            correctAnswer = num1 - num2;
        } else {
            // Multi-number subtraction (start with larger number)
            const startNum = Math.floor(Math.random() * (max - min + 1)) + max; // Start with larger number
            numbers = [startNum];
            let result = startNum;
            
            for (let i = 1; i < count; i++) {
                const subtractNum = Math.floor(Math.random() * Math.min(result, max)) + 1;
                numbers.push(subtractNum);
                result -= subtractNum;
                if (result <= 0) break;
            }
            correctAnswer = result;
        }
        
        // Alternate between horizontal and vertical layouts
        this.layoutType = Math.random() > 0.5 ? 'horizontal' : 'vertical';
        
        if (this.layoutType === 'horizontal') {
            const expression = numbers.join(' - ') + ' = ?';
            document.getElementById('numbersDisplay').innerHTML = '';
            document.getElementById('question').innerHTML = `<div class="horizontal-math">${expression}</div>`;
        } else {
            document.getElementById('numbersDisplay').innerHTML = 
                `<div class="vertical-subtraction">
                    ${numbers.map((n, i) => `<div class="subtractend ${i === 0 ? 'first' : ''}">${i === 0 ? '' : '-'} ${n}</div>`).join('')}
                    <div class="subtraction-line">_____</div>
                    <div class="difference-placeholder">?</div>
                </div>`;
            document.getElementById('question').textContent = '';
        }
        
        this.generateOptions(correctAnswer, 'subtraction');
        this.currentQuestion = { numbers, correctAnswer, layout: this.layoutType };
    }

    generateMultiplicationQuestion() {
        const { min, max } = this.getMultiplicationDifficulty();
        const num1 = Math.floor(Math.random() * (max - min + 1)) + min;
        const num2 = Math.floor(Math.random() * (max - min + 1)) + min;
        const correctAnswer = num1 * num2;
        
        document.getElementById('numbersDisplay').innerHTML = '';
        document.getElementById('question').textContent = `${num1} × ${num2} = ?`;
        
        this.generateOptions(correctAnswer, 'multiplication');
        this.currentQuestion = { num1, num2, correctAnswer };
    }

    generateDivisionQuestion() {
        const { min, max } = this.getDivisionDifficulty();
        const divisor = Math.floor(Math.random() * (max - min + 1)) + min;
        const quotient = Math.floor(Math.random() * (max - min + 1)) + min;
        const dividend = divisor * quotient;
        
        document.getElementById('numbersDisplay').innerHTML = '';
        document.getElementById('question').textContent = `${dividend} ÷ ${divisor} = ?`;
        
        this.generateOptions(quotient, 'division');
        this.currentQuestion = { num1: dividend, num2: divisor, correctAnswer: quotient };
    }

    generateMixQuestion() {
        // Randomly choose one of the basic operations
        const operations = ['addition', 'subtraction', 'multiplication', 'division'];
        const randomOp = operations[Math.floor(Math.random() * operations.length)];
        
        switch (randomOp) {
            case 'addition':
                this.generateAdditionQuestion();
                break;
            case 'subtraction':
                this.generateSubtractionQuestion();
                break;
            case 'multiplication':
                this.generateMultiplicationQuestion();
                break;
            case 'division':
                this.generateDivisionQuestion();
                break;
        }
    }

    generateSquaresQuestion() {
        const baseNumbers = this.difficulty === 'easy' ? [1, 2, 3, 4, 5, 6, 7] :
                          this.difficulty === 'medium' ? [5, 6, 7, 8, 9, 10, 11, 12] :
                          [8, 9, 10, 11, 12, 13, 14, 15, 16];
        
        const number = baseNumbers[Math.floor(Math.random() * baseNumbers.length)];
        const correctAnswer = number * number;
        
        document.getElementById('numbersDisplay').innerHTML = '';
        document.getElementById('question').innerHTML = `${number}<sup>2</sup> = ?`;
        
        this.generateAdvancedOptions(correctAnswer, 'squares', number);
        this.currentQuestion = { number, correctAnswer };
    }

    generateCubesQuestion() {
        const baseNumbers = this.difficulty === 'easy' ? [1, 2, 3, 4, 5] :
                          this.difficulty === 'medium' ? [3, 4, 5, 6, 7, 8] :
                          [5, 6, 7, 8, 9, 10];
        
        const number = baseNumbers[Math.floor(Math.random() * baseNumbers.length)];
        const correctAnswer = number * number * number;
        
        document.getElementById('numbersDisplay').innerHTML = '';
        document.getElementById('question').innerHTML = `${number}<sup>3</sup> = ?`;
        
        this.generateAdvancedOptions(correctAnswer, 'cubes', number);
        this.currentQuestion = { number, correctAnswer };
    }

    generateRootsQuestion() {
        // Generate perfect squares for root questions
        const squares = this.difficulty === 'easy' ? [4, 9, 16, 25, 36, 49] :
                       this.difficulty === 'medium' ? [25, 36, 49, 64, 81, 100, 121] :
                       [64, 81, 100, 121, 144, 169, 196, 225];
        
        const square = squares[Math.floor(Math.random() * squares.length)];
        const correctAnswer = Math.sqrt(square);
        
        document.getElementById('numbersDisplay').innerHTML = '';
        document.getElementById('question').innerHTML = `√${square} = ?`;
        
        this.generateAdvancedOptions(correctAnswer, 'roots', square);
        this.currentQuestion = { number: square, correctAnswer };
    }

    generatePowersQuestion() {
        const bases = this.difficulty === 'easy' ? [2, 3, 4, 5] :
                     this.difficulty === 'medium' ? [2, 3, 4, 5, 6] :
                     [2, 3, 4, 5, 6, 7];
        const exponents = this.difficulty === 'easy' ? [2, 3] :
                         this.difficulty === 'medium' ? [2, 3, 4] :
                         [3, 4, 5];
        
        const base = bases[Math.floor(Math.random() * bases.length)];
        const exponent = exponents[Math.floor(Math.random() * exponents.length)];
        const correctAnswer = Math.pow(base, exponent);
        
        document.getElementById('numbersDisplay').innerHTML = '';
        document.getElementById('question').innerHTML = `${base}<sup>${exponent}</sup> = ?`;
        
        this.generateAdvancedOptions(correctAnswer, 'powers', base);
        this.currentQuestion = { base, exponent, correctAnswer };
    }

    generateAdvancedOptions(correctAnswer, gameType, baseNumber) {
        const options = [correctAnswer];
        
        while (options.length < 4) {
            let wrongAnswer;
            
            switch (gameType) {
                case 'squares':
                    wrongAnswer = Math.pow(baseNumber + Math.floor(Math.random() * 4) - 2, 2);
                    break;
                case 'cubes':
                    wrongAnswer = Math.pow(baseNumber + Math.floor(Math.random() * 4) - 2, 3);
                    break;
                case 'roots':
                    wrongAnswer = Math.sqrt(baseNumber) + Math.floor(Math.random() * 6) - 3;
                    wrongAnswer = Math.max(1, wrongAnswer);
                    break;
                case 'powers':
                    wrongAnswer = correctAnswer + Math.floor(Math.random() * 40) - 20;
                    break;
            }
            
            if (wrongAnswer > 0 && !options.includes(wrongAnswer) && Number.isInteger(wrongAnswer)) {
                options.push(wrongAnswer);
            }
        }
        
        options.sort(() => Math.random() - 0.5);
        
        const optionsHtml = options.map(option => 
            `<button class="option-btn" onclick="game.checkAnswer(${option})">${option}</button>`
        ).join('');
        
        document.getElementById('options').innerHTML = optionsHtml;
    }

    generateOptions(correctAnswer, gameType) {
        // CRITICAL FIX: Ensure correct answer is ALWAYS included
        const wrongAnswers = [];
        const maxAttempts = 50; // Prevent infinite loops
        let attempts = 0;
        
        // Generate exactly 3 wrong answers
        while (wrongAnswers.length < 3 && attempts < maxAttempts) {
            attempts++;
            let wrongAnswer;
            
            if (gameType === 'addition') {
                // More realistic wrong answers for addition
                const deviation = Math.floor(Math.random() * 20) + 1; // 1-20
                wrongAnswer = Math.random() > 0.5 ? 
                    correctAnswer + deviation : 
                    Math.max(1, correctAnswer - deviation);
            } else {
                // More constrained wrong answers for other operations
                const deviation = Math.floor(Math.random() * 10) + 1; // 1-10
                wrongAnswer = Math.random() > 0.5 ? 
                    correctAnswer + deviation : 
                    Math.max(1, correctAnswer - deviation);
            }
            
            // Ensure wrong answer is different from correct answer and not already used
            if (wrongAnswer !== correctAnswer && 
                wrongAnswer > 0 && 
                !wrongAnswers.includes(wrongAnswer)) {
                wrongAnswers.push(wrongAnswer);
            }
        }
        
        // CRITICAL: Always include correct answer + exactly 3 wrong answers
        const allOptions = [correctAnswer, ...wrongAnswers];
        
        // Validate we have exactly 4 options with correct answer included
        if (allOptions.length !== 4 || !allOptions.includes(correctAnswer)) {
            console.error('CRITICAL ERROR: Invalid options generated!', {
                correctAnswer,
                allOptions,
                gameType
            });
            
            // Fallback: Ensure we have valid options
            const fallbackOptions = [
                correctAnswer,
                correctAnswer + 1,
                correctAnswer + 2,
                correctAnswer + 3
            ];
            allOptions.splice(0, allOptions.length, ...fallbackOptions);
        }
        
        // Shuffle options while preserving all 4
        const shuffledOptions = [...allOptions];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }
        
        // COMPREHENSIVE VALIDATION before displaying
        const isValid = this.validateQuestionOptions(correctAnswer, shuffledOptions, gameType);
        
        if (!isValid) {
            console.error('CRITICAL ERROR: Options validation failed!');
            // Emergency fallback - regenerate with simple sequential options
            const emergencyOptions = [
                correctAnswer,
                correctAnswer + 1,
                correctAnswer + 2, 
                correctAnswer - 1 > 0 ? correctAnswer - 1 : correctAnswer + 3
            ];
            
            // Shuffle emergency options
            for (let i = emergencyOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [emergencyOptions[i], emergencyOptions[j]] = [emergencyOptions[j], emergencyOptions[i]];
            }
            
            shuffledOptions.splice(0, shuffledOptions.length, ...emergencyOptions);
            
            // Auto-report this critical issue
            this.reportAutoDetectedError('options-validation-failed', {
                originalOptions: shuffledOptions,
                correctAnswer,
                gameType,
                emergencyOptionsUsed: emergencyOptions
            });
        }
        
        // Generate HTML with fully validated options
        const optionsHtml = shuffledOptions.map(option => 
            `<button class="option-btn" onclick="game.checkAnswer(${option})">${option}</button>`
        ).join('');
        
        document.getElementById('options').innerHTML = optionsHtml;
        
        // Log successful generation for debugging
        console.log('Options generated and validated successfully:', {
            correctAnswer,
            options: shuffledOptions,
            gameType,
            validationPassed: isValid
        });
    }

    checkAnswer(selectedAnswer, playerIndex = null) {
        // If someone already answered this question correctly, ignore subsequent answers
        if (this.isMultiplayer && this.questionAnswered) {
            return;
        }
        
        this.totalQuestions++;
        const isCorrect = selectedAnswer === this.currentQuestion.correctAnswer;
        
        if (isCorrect) {
            this.correctAnswers++;
            this.correctStreak++;
            this.wrongStreak = 0;
            if (this.correctStreak > this.maxStreak) {
                this.maxStreak = this.correctStreak;
            }
            
            // Mark question as answered to prevent multiple correct answers
            if (this.isMultiplayer) {
                this.questionAnswered = true;
            }
        } else {
            this.wrongStreak++;
            this.correctStreak = 0;
        }
        
        // Show notifications selectively - not every answer
        const shouldShowNotification = this.shouldShowNotification(isCorrect);
        if (shouldShowNotification) {
            this.showAnswerNotification(this.totalQuestions, isCorrect);
        }
        
        // In multiplayer, update all players for question
        if (this.isMultiplayer) {
            this.updateAllPlayersForQuestion(isCorrect);
        }
        
        // Track recent answers for adaptive difficulty
        this.recentAnswers.push(isCorrect);
        if (this.recentAnswers.length > 5) {
            this.recentAnswers.shift();
        }
        
        this.showFeedback(isCorrect);
        this.adjustDifficulty();
        this.updateStats();
        
        setTimeout(() => {
            if (this.timeLeft > 0) {
                this.generateQuestion();
            }
        }, 1500);
    }

    updateAllPlayersForQuestion(someoneGotItRight) {
        // In simultaneous mode, we'll award points more fairly
        // For now, let's use a simple approach where any correct answer awards a point to all players
        this.playerScores.forEach(player => {
            player.totalQuestions++;
            if (someoneGotItRight) {
                // Award partial points or use different logic
                player.correctAnswers += 0.5; // Half point for group success
                player.score += 0.5;
            }
            player.accuracy = Math.round((player.correctAnswers / player.totalQuestions) * 100);
        });
        this.updateMultiplayerScoreboard();
    }

    shouldShowNotification(isCorrect) {
        // Show notifications very rarely to avoid annoyance
        if (isCorrect) {
            // Never show notifications for correct answers
            return false;
        } else {
            // Only show for wrong answers when breaking a really good streak (5+)
            return this.correctStreak >= 5;
        }
    }

    showAnswerNotification(questionNumber, isCorrect) {
        let message = '';
        let type = '';
        
        if (isCorrect) {
            // Convert number to ordinal (1st, 2nd, 3rd, etc.)
            const ordinal = this.getOrdinalNumber(questionNumber);
            message = `🎯 ${ordinal} Correct!`;
            type = 'success';
        } else {
            // Motivational messages for wrong answers (only when breaking streaks)
            const motivationalMessages = [
                "Don't stress, let's go! 💪",
                "Keep trying, you got this! 🌟",
                "Almost there, stay focused! 🎯",
                "No worries, next one! 🚀",
                "Keep going, champion! 👑",
                "Stay positive! 📚",
                "Shake it off! ✨",
                "You're doing great! 🌈"
            ];
            message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
            type = 'encouragement';
        }
        
        this.showQuickNotification(message, type);
    }

    getOrdinalNumber(num) {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const value = num % 100;
        return num + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
    }

    showQuickNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `quick-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    showFeedback(isCorrect) {
        const optionBtns = document.querySelectorAll('.option-btn');
        optionBtns.forEach(btn => {
            btn.disabled = true;
            if (parseInt(btn.textContent) === this.currentQuestion.correctAnswer) {
                btn.classList.add('correct');
            } else if (parseInt(btn.textContent) !== this.currentQuestion.correctAnswer && btn.classList.contains('selected')) {
                btn.classList.add('wrong');
            }
        });
        
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                this.classList.add('selected');
            });
        });
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            const timerElement = document.getElementById('timer');
            timerElement.textContent = `Time: ${this.timeLeft}s`;
            
            // Color coding for timer
            if (this.timeLeft <= 5) {
                timerElement.className = 'timer critical';
            } else if (this.timeLeft <= 10) {
                timerElement.className = 'timer warning';
            } else {
                timerElement.className = 'timer';
            }
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    // Difficulty adjustment methods
    adjustDifficulty() {
        // Adjust based on recent performance
        if (this.wrongStreak >= 2) {
            // Make it easier after 2 wrong answers
            if (this.difficulty === 'hard') {
                this.difficulty = 'medium';
            } else if (this.difficulty === 'medium') {
                this.difficulty = 'easy';
            }
        } else if (this.correctStreak >= 3) {
            // Make it harder after 3 correct answers
            if (this.difficulty === 'easy') {
                this.difficulty = 'medium';
            } else if (this.difficulty === 'medium') {
                this.difficulty = 'hard';
            }
        }
        
        // Update difficulty display
        this.updateDifficultyDisplay();
    }

    getAdditionDifficulty() {
        switch (this.difficulty) {
            case 'easy':
                return { min: 1, max: 5, count: 3 };
            case 'medium':
                return { min: 1, max: 10, count: 4 };
            case 'hard':
                return { min: 5, max: 15, count: 5 };
            default:
                return { min: 1, max: 10, count: 4 };
        }
    }

    getSubtractionDifficulty() {
        switch (this.difficulty) {
            case 'easy':
                return { min: 1, max: 10, count: 2 };
            case 'medium':
                return { min: 5, max: 20, count: 3 };
            case 'hard':
                return { min: 10, max: 50, count: 4 };
            default:
                return { min: 5, max: 20, count: 3 };
        }
    }

    getMultiplicationDifficulty() {
        switch (this.difficulty) {
            case 'easy':
                return { min: 1, max: 5 };
            case 'medium':
                return { min: 1, max: 10 };
            case 'hard':
                return { min: 5, max: 15 };
            default:
                return { min: 1, max: 10 };
        }
    }

    getDivisionDifficulty() {
        switch (this.difficulty) {
            case 'easy':
                return { min: 1, max: 5 };
            case 'medium':
                return { min: 1, max: 10 };
            case 'hard':
                return { min: 2, max: 15 };
            default:
                return { min: 1, max: 10 };
        }
    }

    updateDifficultyDisplay() {
        const difficultyElement = document.getElementById('difficulty');
        if (difficultyElement) {
            difficultyElement.textContent = this.difficulty.toUpperCase();
            difficultyElement.className = `difficulty-indicator ${this.difficulty}`;
        }
    }

    updateStats() {
        const accuracy = this.totalQuestions > 0 ? Math.round((this.correctAnswers / this.totalQuestions) * 100) : 0;
        
        document.getElementById('questionsCount').textContent = this.totalQuestions;
        document.getElementById('correctCount').textContent = this.correctAnswers;
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        document.getElementById('score').textContent = `Score: ${this.correctAnswers}/${this.totalQuestions} (${accuracy}%)`;
        
        // Update streak displays
        const currentStreakElement = document.getElementById('currentStreak');
        const maxStreakElement = document.getElementById('maxStreak');
        
        if (currentStreakElement) {
            currentStreakElement.textContent = this.correctStreak;
        }
        if (maxStreakElement) {
            maxStreakElement.textContent = this.maxStreak;
        }
        
        this.updateDifficultyDisplay();
    }

    endGame() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        if (this.isMultiplayer) {
            this.showMultiplayerResults();
        } else {
            this.endSinglePlayerGame();
        }
    }

    endSinglePlayerGame() {
        const timeTaken = Math.round((Date.now() - this.startTime) / 1000);
        const accuracy = this.totalQuestions > 0 ? Math.round((this.correctAnswers / this.totalQuestions) * 100) : 0;
        
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('results').style.display = 'block';
        document.getElementById('singlePlayerResults').style.display = 'block';
        document.getElementById('multiplayerResults').style.display = 'none';
        document.getElementById('winnerAnnouncement').style.display = 'none';
        
        const questionsPerSecond = this.totalQuestions > 0 ? (this.totalQuestions / timeTaken).toFixed(1) : 0;
        
        document.getElementById('finalScore').textContent = `${this.correctAnswers}/${this.totalQuestions}`;
        document.getElementById('finalAccuracy').textContent = `${accuracy}%`;
        document.getElementById('finalTime').textContent = `${questionsPerSecond}/sec`;
        
        // Check for unlock conditions
        this.checkUnlockConditions();
        
        // Show feedback after certain number of games
        this.gameCount++;
        this.maybeShowFeedback();
        
        // Update user's best scores
        if (this.currentUser) {
            this.updateUserBestScore(accuracy);
        }
    }

    // Real-time Room-based multiplayer system
    async createRoom() {
        if (!this.currentUser) {
            alert('Please login first to create a room!');
            return;
        }

        const connected = await this.ensureConnection();
        if (!connected) {
            alert('Cannot create room: Not connected to server');
            return;
        }

        try {
            const data = await this.webSocketManager.createRoom(this.currentUser.name);
            console.log('Room created successfully:', data.roomCode);
            // Room state will be updated via WebSocket events
        } catch (error) {
            console.error('Failed to create room:', error);
            alert(`Failed to create room: ${error.message}`);
        }
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async joinRoom() {
        const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        if (!roomCode) {
            alert('Please enter a room code!');
            return;
        }

        if (!this.currentUser) {
            alert('Please login first to join a room!');
            return;
        }

        const connected = await this.ensureConnection();
        if (!connected) {
            alert('Cannot join room: Not connected to server');
            return;
        }

        try {
            const data = await this.webSocketManager.joinRoom(roomCode, this.currentUser.name);
            console.log('Joined room successfully:', roomCode);
            // Room state will be updated via WebSocket events
            
            // Clear the room code input
            document.getElementById('roomCodeInput').value = '';
        } catch (error) {
            console.error('Failed to join room:', error);
            alert(`Failed to join room: ${error.message}`);
        }
    }

    showRoomLobby() {
        document.getElementById('roomSetup').style.display = 'none';
        document.getElementById('roomLobby').style.display = 'block';
        document.getElementById('currentRoomCode').textContent = this.currentRoom.code;
        
        if (this.isRoomHost) {
            document.getElementById('hostControls').style.display = 'block';
        }
        
        this.updateRoomPlayersList();
    }

    updateRoomPlayersList() {
        const playersList = document.getElementById('roomPlayersList');
        playersList.innerHTML = this.currentRoom.players.map((player, index) => {
            const isHost = index === 0;
            return `
                <div class="room-player ${isHost ? 'host' : ''}">
                    <span class="room-player-name">${player}</span>
                    <span class="room-player-status">${isHost ? '👑 Host' : '👤 Player'}</span>
                </div>
            `;
        }).join('');
    }

    copyRoomCode() {
        const roomCode = this.currentRoom.code;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(roomCode).then(() => {
                this.showQuickNotification(`Room code ${roomCode} copied to clipboard!`, 'success');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = roomCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showQuickNotification(`Room code ${roomCode} copied!`, 'success');
        }
    }

    leaveRoom() {
        if (this.currentRoom) {
            this.currentRoom.players = this.currentRoom.players.filter(p => p !== this.currentUser.name);
            
            if (this.currentRoom.players.length === 0) {
                // Delete room if empty
                this.deleteRoomFromStorage();
            } else {
                this.saveRoomToStorage();
            }
            
            this.currentRoom = null;
            this.isRoomHost = false;
            document.getElementById('roomLobby').style.display = 'none';
            document.getElementById('roomSetup').style.display = 'block';
        }
    }

    setupOnlineGame() {
        if (!this.currentRoom) {
            alert('No room found! Please create or join a room first.');
            return;
        }

        this.isMultiplayer = true;
        this.players = [...this.currentRoom.players];
        this.playerScores = this.players.map(name => ({
            name: name,
            score: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            accuracy: 0
        }));
        this.playersReady = new Array(this.players.length).fill(false);
        this.gameStarted = false;
        
        document.getElementById('roomLobby').style.display = 'none';
        this.showReadyScreen();
    }

    saveRoomToStorage() {
        const rooms = JSON.parse(localStorage.getItem('mathChallengeRooms') || '{}');
        rooms[this.currentRoom.code] = this.currentRoom;
        localStorage.setItem('mathChallengeRooms', JSON.stringify(rooms));
    }

    loadRoomFromStorage(roomCode) {
        const rooms = JSON.parse(localStorage.getItem('mathChallengeRooms') || '{}');
        return rooms[roomCode] || null;
    }

    deleteRoomFromStorage() {
        const rooms = JSON.parse(localStorage.getItem('mathChallengeRooms') || '{}');
        delete rooms[this.currentRoom.code];
        localStorage.setItem('mathChallengeRooms', JSON.stringify(rooms));
    }

    showMultiplayerResults() {
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('results').style.display = 'block';
        document.getElementById('singlePlayerResults').style.display = 'none';
        document.getElementById('multiplayerResults').style.display = 'block';
        
        // Sort players by score
        const sortedPlayers = [...this.playerScores].sort((a, b) => {
            if (b.score === a.score) {
                return b.accuracy - a.accuracy; // Tie-breaker: higher accuracy
            }
            return b.score - a.score;
        });
        
        const winner = sortedPlayers[0];
        
        // Show winner announcement
        this.showWinnerAnnouncement(winner);
        
        // Show final leaderboard
        const leaderboard = document.getElementById('finalLeaderboard');
        leaderboard.innerHTML = sortedPlayers.map((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `
                <div class="leaderboard-entry ${index === 0 ? 'winner' : ''}">
                    <span class="rank">${medal}</span>
                    <span class="player-name">${player.name}</span>
                    <span class="player-final-score">${player.score}/${player.totalQuestions}</span>
                    <span class="player-final-accuracy">${player.accuracy}%</span>
                </div>
            `;
        }).join('');
    }

    showWinnerAnnouncement(winner) {
        document.getElementById('winnerAnnouncement').style.display = 'block';
        document.getElementById('winnerName').textContent = winner.name;
        
        // Trigger confetti animation
        this.showConfetti();
        
        // Hide after 3 seconds
        setTimeout(() => {
            document.getElementById('winnerAnnouncement').style.display = 'none';
        }, 3000);
    }

    showConfetti() {
        const confetti = document.getElementById('confetti');
        confetti.innerHTML = '';
        
        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
            confetti.appendChild(piece);
        }
    }

    // Score saving functionality
    saveScore() {
        if (!this.currentUser) return;
        
        const scoreData = {
            gameType: this.currentGame,
            score: this.correctAnswers,
            totalQuestions: this.totalQuestions,
            accuracy: Math.round((this.correctAnswers / this.totalQuestions) * 100),
            maxStreak: this.maxStreak,
            date: new Date().toISOString(),
            timeTaken: Math.round((Date.now() - this.startTime) / 1000)
        };
        
        // Save to user's history
        const allUsers = JSON.parse(localStorage.getItem('mathChallengeUsers') || '{}');
        if (!allUsers[this.currentUser.name]) {
            allUsers[this.currentUser.name] = this.currentUser;
        }
        
        if (!allUsers[this.currentUser.name].gameHistory) {
            allUsers[this.currentUser.name].gameHistory = [];
        }
        
        allUsers[this.currentUser.name].gameHistory.push(scoreData);
        allUsers[this.currentUser.name].totalGames++;
        
        localStorage.setItem('mathChallengeUsers', JSON.stringify(allUsers));
        localStorage.setItem('mathChallengeUser', JSON.stringify(allUsers[this.currentUser.name]));
        
        alert('Score saved successfully! 🎉');
    }

    updateUserBestScore(accuracy) {
        if (!this.currentUser) return;
        
        const currentBest = this.currentUser.bestScores[this.currentGame];
        if (this.correctAnswers > currentBest.score || 
            (this.correctAnswers === currentBest.score && accuracy > currentBest.accuracy)) {
            currentBest.score = this.correctAnswers;
            currentBest.accuracy = accuracy;
        }
    }

    viewScoreHistory() {
        if (!this.currentUser || !this.currentUser.gameHistory) {
            alert('No score history available.');
            return;
        }
        
        document.getElementById('results').style.display = 'none';
        document.getElementById('scoreHistory').style.display = 'block';
        
        const historyContent = document.getElementById('historyContent');
        const history = this.currentUser.gameHistory.slice().reverse(); // Show newest first
        
        historyContent.innerHTML = history.map(game => {
            const date = new Date(game.date).toLocaleDateString();
            return `
                <div class="history-entry">
                    <div class="history-game-type">${game.gameType.toUpperCase()}</div>
                    <div class="history-score">${game.score}/${game.totalQuestions}</div>
                    <div class="history-accuracy">${game.accuracy}%</div>
                    <div class="history-date">${date}</div>
                </div>
            `;
        }).join('');
    }

    hideScoreHistory() {
        document.getElementById('scoreHistory').style.display = 'none';
        document.getElementById('results').style.display = 'block';
    }

    // Unlock System
    checkAdvancedUnlock() {
        const savedProgress = localStorage.getItem('mathChallengeProgress');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            this.mixHighScore = progress.mixHighScore || 0;
            this.advancedUnlocked = progress.advancedUnlocked || this.mixHighScore >= 5;
            this.feedbackGiven = progress.feedbackGiven || false;
            this.gameCount = progress.gameCount || 0;
        }
        this.updateAdvancedSectionUI();
    }

    checkUnlockConditions() {
        if (this.currentGame === 'mix' && this.correctAnswers > this.mixHighScore) {
            this.mixHighScore = this.correctAnswers;
            this.saveProgress();
            
            if (this.correctAnswers >= 5 && !this.advancedUnlocked) {
                this.unlockAdvancedChallenges();
            }
        }
    }

    unlockAdvancedChallenges() {
        this.advancedUnlocked = true;
        this.saveProgress();
        
        // Show unlock animation
        setTimeout(() => {
            this.showUnlockNotification();
            this.updateAdvancedSectionUI();
        }, 2000); // Delay to show after results
    }

    showUnlockNotification() {
        const notification = document.createElement('div');
        notification.className = 'quick-notification success';
        notification.innerHTML = '🎉 Advanced Challenges Unlocked! 🚀';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    updateAdvancedSectionUI() {
        const unlockReq = document.getElementById('unlockRequirement');
        const advancedModes = document.getElementById('advancedModes');
        
        if (this.advancedUnlocked) {
            unlockReq.style.display = 'none';
            advancedModes.style.display = 'grid';
            advancedModes.className = 'advanced-modes unlocked';
        } else {
            unlockReq.style.display = 'block';
            advancedModes.style.display = 'none';
            
            // Update progress bar and text
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const progressHint = document.getElementById('progressHint');
            
            const progress = Math.min(this.mixHighScore, 5);
            const percentage = (progress / 5) * 100;
            
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${progress}/5`;
            
            if (this.mixHighScore > 0) {
                progressHint.textContent = progress < 5 ? 
                    `Great start! ${5 - progress} more correct answers to unlock!` :
                    'Congratulations! Advanced Challenges unlocked!';
            }
        }
    }

    saveProgress() {
        const progress = {
            mixHighScore: this.mixHighScore,
            advancedUnlocked: this.advancedUnlocked,
            feedbackGiven: this.feedbackGiven,
            gameCount: this.gameCount
        };
        localStorage.setItem('mathChallengeProgress', JSON.stringify(progress));
    }

    // Feedback System
    maybeShowFeedback() {
        // Show feedback after 3rd game, and every 10 games after that
        if (!this.feedbackGiven && (this.gameCount === 3 || this.gameCount % 10 === 0)) {
            setTimeout(() => {
                this.showFeedbackModal();
            }, 1500); // Show after a brief delay
        }
    }

    showFeedbackModal() {
        document.getElementById('feedbackSection').style.display = 'flex';
    }

    hideFeedback() {
        document.getElementById('feedbackSection').style.display = 'none';
    }

    submitFeedback(rating) {
        this.saveFeedback(rating, '');
        this.hideFeedback();
        
        // Show thank you message
        const notification = document.createElement('div');
        notification.className = 'quick-notification info';
        notification.innerHTML = '💙 Thanks for your feedback!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    submitDetailedFeedback() {
        const feedbackText = document.getElementById('feedbackText').value;
        this.saveFeedback('detailed', feedbackText);
        this.hideFeedback();
        
        // Show thank you message
        const notification = document.createElement('div');
        notification.className = 'quick-notification info';
        notification.innerHTML = '💙 Thanks for your detailed feedback!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
        
        // Clear the textarea
        document.getElementById('feedbackText').value = '';
    }

    saveFeedback(rating, text) {
        this.feedbackGiven = true;
        this.saveProgress();
        
        // Save feedback to localStorage (in a real app, this would go to a server)
        const feedback = {
            rating: rating,
            text: text,
            timestamp: new Date().toISOString(),
            user: this.currentUser ? this.currentUser.name : 'Anonymous',
            gameCount: this.gameCount
        };
        
        const allFeedback = JSON.parse(localStorage.getItem('mathChallengeFeedback') || '[]');
        allFeedback.push(feedback);
        localStorage.setItem('mathChallengeFeedback', JSON.stringify(allFeedback));
    }

    // Navigation
    goHome() {
        // Reset all UI states to home
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('results').style.display = 'none';
        document.getElementById('scoreHistory').style.display = 'none';
        document.getElementById('multiplayerReady').style.display = 'none';
        document.getElementById('roomLobby').style.display = 'none';
        document.getElementById('feedbackSection').style.display = 'none';
        document.getElementById('gameSelection').style.display = 'block';
        
        // Reset game state
        this.resetGameState();
        
        // Update UI
        this.updateAdvancedSectionUI();
    }

    resetGameState() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
        }
        
        this.currentGame = null;
        this.isMultiplayer = false;
        this.gameStarted = false;
        this.currentRoom = null;
        this.playersReady = [];
    }

    // Question Validation System
    validateQuestion(questionData, correctAnswer, gameType) {
        try {
            // Basic validation
            if (correctAnswer === null || correctAnswer === undefined || !Number.isFinite(correctAnswer)) {
                console.error('Invalid correct answer:', correctAnswer);
                return false;
            }

            // Game-specific validation
            switch (gameType) {
                case 'addition':
                    if (questionData.numbers && this.layoutType === 'missing') {
                        // Validate missing number problems
                        const actualSum = questionData.numbers.reduce((sum, num) => sum + num, 0);
                        const expectedSum = actualSum - correctAnswer; // Remove the missing number
                        
                        // The missing number should be positive and reasonable
                        if (correctAnswer <= 0 || correctAnswer > 20) {
                            console.error('Invalid missing number:', correctAnswer);
                            return false;
                        }
                    }
                    break;
                    
                case 'subtraction':
                    if (correctAnswer < 0) {
                        console.error('Subtraction result is negative:', correctAnswer);
                        return false;
                    }
                    break;
                    
                case 'division':
                    if (questionData.num1 % questionData.num2 !== 0) {
                        console.error('Division not exact:', questionData.num1, '÷', questionData.num2);
                        return false;
                    }
                    break;
                    
                case 'squares':
                    const expectedSquare = questionData.number * questionData.number;
                    if (correctAnswer !== expectedSquare) {
                        console.error('Square calculation error:', questionData.number, '^2 should be', expectedSquare, 'not', correctAnswer);
                        return false;
                    }
                    break;
                    
                case 'cubes':
                    const expectedCube = questionData.number * questionData.number * questionData.number;
                    if (correctAnswer !== expectedCube) {
                        console.error('Cube calculation error:', questionData.number, '^3 should be', expectedCube, 'not', correctAnswer);
                        return false;
                    }
                    break;
                    
                case 'roots':
                    const expectedRoot = Math.sqrt(questionData.number);
                    if (Math.abs(correctAnswer - expectedRoot) > 0.001) {
                        console.error('Square root calculation error: √', questionData.number, 'should be', expectedRoot, 'not', correctAnswer);
                        return false;
                    }
                    break;
                    
                case 'powers':
                    const expectedPower = Math.pow(questionData.base, questionData.exponent);
                    if (correctAnswer !== expectedPower) {
                        console.error('Power calculation error:', questionData.base, '^', questionData.exponent, 'should be', expectedPower, 'not', correctAnswer);
                        return false;
                    }
                    break;
            }
            
            return true;
        } catch (error) {
            console.error('Question validation error:', error);
            return false;
        }
    }

    // Options Validation System
    validateQuestionOptions(correctAnswer, options, gameType) {
        try {
            // Critical validation: correct answer must be present
            if (!options.includes(correctAnswer)) {
                console.error('CRITICAL: Correct answer not in options!', {
                    correctAnswer,
                    options,
                    gameType
                });
                this.reportAutoDetectedError('missing-correct-answer', {
                    correctAnswer,
                    options,
                    gameType
                });
                return false;
            }

            // Must have exactly 4 options
            if (options.length !== 4) {
                console.error('Invalid number of options:', options.length);
                return false;
            }

            // All options must be positive integers
            if (!options.every(opt => Number.isInteger(opt) && opt > 0)) {
                console.error('Invalid option values:', options);
                return false;
            }

            // Options must be unique
            const uniqueOptions = [...new Set(options)];
            if (uniqueOptions.length !== 4) {
                console.error('Duplicate options detected:', options);
                return false;
            }

            // Game-specific validation
            switch (gameType) {
                case 'addition':
                    // For addition, wrong answers shouldn't be wildly off
                    const maxReasonableDeviation = Math.max(50, correctAnswer * 2);
                    if (options.some(opt => Math.abs(opt - correctAnswer) > maxReasonableDeviation)) {
                        console.warn('Options may be unrealistic for addition:', options);
                    }
                    break;
                    
                case 'subtraction':
                    // Subtraction results should be reasonable
                    if (options.some(opt => opt > correctAnswer * 3)) {
                        console.warn('Options may be unrealistic for subtraction:', options);
                    }
                    break;
            }

            return true;
        } catch (error) {
            console.error('Options validation error:', error);
            return false;
        }
    }

    // Auto-detect mathematical errors and report them
    reportAutoDetectedError(errorType, details) {
        const autoReport = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type: 'auto-detected',
            errorType: errorType,
            details: details,
            gameType: this.currentGame,
            user: 'System Auto-Detection'
        };

        // Add to error reports for tracking
        this.errorReports.push(autoReport);
        this.saveErrorReports();

        console.error('Auto-detected math error:', autoReport);
    }

    // Comprehensive Testing System
    runComprehensiveTests() {
        console.log('🧪 Starting comprehensive math question testing...');
        
        const testResults = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            errors: []
        };

        // Test each game type multiple times
        const gameTypes = ['addition', 'subtraction', 'multiplication', 'division', 'mix'];
        const testsPerType = 10;

        gameTypes.forEach(gameType => {
            console.log(`Testing ${gameType}...`);
            
            for (let i = 0; i < testsPerType; i++) {
                testResults.totalTests++;
                
                try {
                    // Store original state
                    const originalGame = this.currentGame;
                    this.currentGame = gameType;
                    
                    // Generate a question
                    this.generateQuestion();
                    
                    // Validate the current question
                    if (!this.currentQuestion || !this.currentQuestion.correctAnswer) {
                        throw new Error('No question generated or missing correct answer');
                    }
                    
                    // Extract options from DOM
                    const optionButtons = document.querySelectorAll('.option-btn');
                    if (optionButtons.length !== 4) {
                        throw new Error(`Expected 4 options, got ${optionButtons.length}`);
                    }
                    
                    const options = Array.from(optionButtons).map(btn => parseInt(btn.textContent));
                    const correctAnswer = this.currentQuestion.correctAnswer;
                    
                    // Critical test: correct answer must be in options
                    if (!options.includes(correctAnswer)) {
                        throw new Error(`Correct answer ${correctAnswer} not found in options: [${options.join(', ')}]`);
                    }
                    
                    // Validate options are reasonable
                    if (!this.validateQuestionOptions(correctAnswer, options, gameType)) {
                        throw new Error('Options validation failed');
                    }
                    
                    testResults.passedTests++;
                    console.log(`✅ ${gameType} test ${i + 1}: PASS`);
                    
                    // Restore original state
                    this.currentGame = originalGame;
                    
                } catch (error) {
                    testResults.failedTests++;
                    testResults.errors.push({
                        gameType,
                        testNumber: i + 1,
                        error: error.message,
                        currentQuestion: this.currentQuestion
                    });
                    console.error(`❌ ${gameType} test ${i + 1}: FAIL - ${error.message}`);
                }
            }
        });

        // Test word problems specifically
        console.log('Testing word problems...');
        for (let i = 0; i < 5; i++) {
            testResults.totalTests++;
            
            try {
                this.currentGame = 'addition';
                
                // Force word problem layout
                const originalLayoutType = this.layoutType;
                this.layoutType = 'word';
                
                this.generateAdditionQuestion();
                
                const correctAnswer = this.currentQuestion.correctAnswer;
                const optionButtons = document.querySelectorAll('.option-btn');
                const options = Array.from(optionButtons).map(btn => parseInt(btn.textContent));
                
                if (!options.includes(correctAnswer)) {
                    throw new Error(`Word problem: Correct answer ${correctAnswer} not in options: [${options.join(', ')}]`);
                }
                
                testResults.passedTests++;
                console.log(`✅ Word problem test ${i + 1}: PASS`);
                
                this.layoutType = originalLayoutType;
                
            } catch (error) {
                testResults.failedTests++;
                testResults.errors.push({
                    gameType: 'word-problems',
                    testNumber: i + 1,
                    error: error.message
                });
                console.error(`❌ Word problem test ${i + 1}: FAIL - ${error.message}`);
            }
        }

        // Print final results
        console.log('\n🎯 COMPREHENSIVE TEST RESULTS:');
        console.log(`Total Tests: ${testResults.totalTests}`);
        console.log(`Passed: ${testResults.passedTests} (${Math.round(testResults.passedTests / testResults.totalTests * 100)}%)`);
        console.log(`Failed: ${testResults.failedTests} (${Math.round(testResults.failedTests / testResults.totalTests * 100)}%)`);
        
        if (testResults.errors.length > 0) {
            console.log('\n❌ ERRORS FOUND:');
            testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.gameType} Test ${error.testNumber}: ${error.error}`);
            });
        } else {
            console.log('\n🎉 ALL TESTS PASSED! No mathematical errors detected.');
        }

        return testResults;
    }

    // Error Reporting System
    loadErrorReports() {
        const savedReports = localStorage.getItem('mathChallengeErrorReports');
        if (savedReports) {
            this.errorReports = JSON.parse(savedReports);
        }
    }

    reportError() {
        if (!this.currentQuestion) {
            alert('No current question to report!');
            return;
        }
        
        // Capture current question details
        this.captureQuestionSnapshot();
        this.showErrorReportModal();
    }

    captureQuestionSnapshot() {
        const questionElement = document.getElementById('question');
        const optionsElement = document.getElementById('options');
        
        // Create a comprehensive snapshot of the current question
        this.currentQuestionSnapshot = {
            gameType: this.currentGame,
            questionText: questionElement.innerHTML,
            questionData: { ...this.currentQuestion },
            optionsHTML: optionsElement.innerHTML,
            difficulty: this.difficulty,
            timestamp: new Date().toISOString()
        };
    }

    showErrorReportModal() {
        // Populate the question snapshot
        const snapshot = document.getElementById('questionSnapshot');
        const gameTypeText = this.currentGame.charAt(0).toUpperCase() + this.currentGame.slice(1);
        
        snapshot.innerHTML = `
            <div><strong>Game Type:</strong> ${gameTypeText}</div>
            <div><strong>Question:</strong> ${this.currentQuestionSnapshot.questionText.replace(/<[^>]*>/g, ' ').trim()}</div>
            <div><strong>Correct Answer:</strong> ${this.currentQuestion.correctAnswer}</div>
            <div><strong>Difficulty:</strong> ${this.difficulty.toUpperCase()}</div>
            <div><strong>Question Data:</strong> ${JSON.stringify(this.currentQuestion, null, 2)}</div>
        `;
        
        document.getElementById('errorReportModal').style.display = 'flex';
    }

    cancelErrorReport() {
        document.getElementById('errorReportModal').style.display = 'none';
        this.clearErrorReportForm();
    }

    clearErrorReportForm() {
        // Uncheck all checkboxes
        const checkboxes = document.querySelectorAll('.error-options input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        
        // Clear description
        document.getElementById('errorDescription').value = '';
    }

    submitErrorReport() {
        // Collect selected error types
        const selectedTypes = [];
        const checkboxes = document.querySelectorAll('.error-options input[type="checkbox"]:checked');
        checkboxes.forEach(cb => selectedTypes.push(cb.value));
        
        if (selectedTypes.length === 0) {
            alert('Please select at least one error type.');
            return;
        }
        
        const description = document.getElementById('errorDescription').value;
        
        // Create error report
        const errorReport = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            gameType: this.currentGame,
            questionSnapshot: this.currentQuestionSnapshot,
            errorTypes: selectedTypes,
            description: description,
            user: this.currentUser ? this.currentUser.name : 'Anonymous',
            userAgent: navigator.userAgent
        };
        
        // Save the report
        this.errorReports.push(errorReport);
        this.saveErrorReports();
        
        // Hide modal and show confirmation
        this.cancelErrorReport();
        this.showErrorReportConfirmation();
    }

    showErrorReportConfirmation() {
        const notification = document.createElement('div');
        notification.className = 'quick-notification success';
        notification.innerHTML = '🐛 Error reported! Thank you for helping improve the app.';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    saveErrorReports() {
        localStorage.setItem('mathChallengeErrorReports', JSON.stringify(this.errorReports));
    }

    // Error Review Interface
    showErrorReview() {
        document.getElementById('gameSelection').style.display = 'none';
        document.getElementById('errorReviewSection').style.display = 'block';
        this.updateErrorReviewDisplay();
        this.showErrorTab('patterns'); // Default to patterns tab
    }

    hideErrorReview() {
        document.getElementById('errorReviewSection').style.display = 'none';
        document.getElementById('gameSelection').style.display = 'block';
    }

    updateErrorReviewDisplay() {
        // Update stats
        const totalErrors = this.errorReports.length;
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentErrors = this.errorReports.filter(report => 
            new Date(report.timestamp) > twentyFourHoursAgo
        ).length;
        
        // Count critical errors (wrong-answer or calculation-error)
        const criticalErrors = this.errorReports.filter(report => 
            report.errorTypes.includes('wrong-answer') || 
            report.errorTypes.includes('calculation-error')
        ).length;
        
        document.getElementById('totalErrors').textContent = totalErrors;
        document.getElementById('recentErrors').textContent = recentErrors;
        document.getElementById('criticalErrors').textContent = criticalErrors;
        
        // Update all analysis views
        this.updatePatternAnalysis();
        this.updateReportsList();
        this.runAutoDetection();
    }

    updatePatternAnalysis() {
        // Analyze error patterns
        const errorTypeFrequency = {};
        const gameTypeFrequency = {};
        
        this.errorReports.forEach(report => {
            // Count error types
            report.errorTypes.forEach(errorType => {
                errorTypeFrequency[errorType] = (errorTypeFrequency[errorType] || 0) + 1;
            });
            
            // Count game types
            gameTypeFrequency[report.gameType] = (gameTypeFrequency[report.gameType] || 0) + 1;
        });
        
        this.displayErrorPatterns(errorTypeFrequency);
        this.displayGameTypeAnalysis(gameTypeFrequency);
        this.displayCriticalErrors();
    }

    displayErrorPatterns(frequency) {
        const patternsList = document.getElementById('errorPatternsList');
        
        if (Object.keys(frequency).length === 0) {
            patternsList.innerHTML = '<div class="no-errors">No error patterns detected yet.</div>';
            return;
        }
        
        // Sort by frequency (highest first)
        const sortedPatterns = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
        
        const patternDescriptions = {
            'wrong-answer': 'The provided correct answer is mathematically incorrect',
            'calculation-error': 'Mathematical calculation errors in question generation',
            'impossible-question': 'Questions that are logically impossible or nonsensical',
            'option-errors': 'Incorrect multiple choice options provided',
            'display-issue': 'Problems with how questions are displayed or formatted',
            'other': 'Other issues not covered by standard categories'
        };
        
        patternsList.innerHTML = sortedPatterns.map(([type, count]) => `
            <div class="error-pattern-item">
                <div class="pattern-info">
                    <div class="pattern-type">${type.replace('-', ' ').toUpperCase()}</div>
                    <div class="pattern-description">${patternDescriptions[type] || 'No description available'}</div>
                </div>
                <div class="pattern-count">${count}</div>
            </div>
        `).join('');
    }

    displayGameTypeAnalysis(frequency) {
        const analysisContainer = document.getElementById('gameTypeAnalysis');
        
        if (Object.keys(frequency).length === 0) {
            analysisContainer.innerHTML = '<div class="no-errors">No game type data available yet.</div>';
            return;
        }
        
        const totalReports = this.errorReports.length;
        const sortedGameTypes = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
        
        analysisContainer.innerHTML = `
            <div class="game-type-stats">
                ${sortedGameTypes.map(([gameType, count]) => {
                    const percentage = ((count / totalReports) * 100).toFixed(1);
                    return `
                        <div class="game-type-stat">
                            <div class="game-type-name">${gameType}</div>
                            <span class="game-type-count">${count}</span>
                            <div class="game-type-percentage">${percentage}% of all errors</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    displayCriticalErrors() {
        const criticalContainer = document.getElementById('criticalErrorsList');
        
        // Find reports with critical math errors
        const criticalReports = this.errorReports.filter(report => 
            report.errorTypes.includes('wrong-answer') || 
            report.errorTypes.includes('calculation-error') ||
            report.errorTypes.includes('impossible-question')
        );
        
        if (criticalReports.length === 0) {
            criticalContainer.innerHTML = '<div class="no-errors">No critical math errors detected! 🎉</div>';
            return;
        }
        
        // Group by similar issues
        const criticalByType = {};
        criticalReports.forEach(report => {
            const key = `${report.gameType}-${report.errorTypes.join(',')}`;
            if (!criticalByType[key]) {
                criticalByType[key] = [];
            }
            criticalByType[key].push(report);
        });
        
        criticalContainer.innerHTML = Object.entries(criticalByType).map(([key, reports]) => {
            const sample = reports[0];
            return `
                <div class="critical-error-item">
                    <div class="critical-error-title">
                        🚨 ${sample.gameType.toUpperCase()} - ${sample.errorTypes.join(', ').replace(/-/g, ' ')}
                        ${reports.length > 1 ? `(${reports.length} reports)` : ''}
                    </div>
                    <div class="critical-error-details">
                        <strong>Sample Question:</strong> ${sample.questionSnapshot.questionText.replace(/<[^>]*>/g, ' ').trim()}<br>
                        <strong>Reported Answer:</strong> ${sample.questionSnapshot.questionData.correctAnswer}<br>
                        ${sample.description ? `<strong>User Notes:</strong> "${sample.description}"<br>` : ''}
                        <strong>First Reported:</strong> ${new Date(sample.timestamp).toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateReportsList() {
        const reportsList = document.getElementById('errorReportsList');
        if (this.errorReports.length === 0) {
            reportsList.innerHTML = '<div class="no-errors">No error reports yet. Great job! 🎉</div>';
            return;
        }
        
        // Sort by timestamp (newest first)
        const sortedReports = [...this.errorReports].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        reportsList.innerHTML = sortedReports.map(report => this.createErrorReportHTML(report)).join('');
    }

    runAutoDetection() {
        const autoDetectedList = document.getElementById('autoDetectedList');
        const detectedIssues = [];
        
        // Analyze patterns automatically
        if (this.errorReports.length >= 3) {
            // Check for repeated issues in same game type
            const gameTypeErrors = {};
            this.errorReports.forEach(report => {
                if (!gameTypeErrors[report.gameType]) {
                    gameTypeErrors[report.gameType] = [];
                }
                gameTypeErrors[report.gameType].push(report);
            });
            
            Object.entries(gameTypeErrors).forEach(([gameType, reports]) => {
                if (reports.length >= 3) {
                    detectedIssues.push({
                        type: 'repeated-game-errors',
                        title: `High Error Rate in ${gameType.toUpperCase()}`,
                        description: `${reports.length} errors reported in ${gameType} mode. This suggests systematic issues with question generation.`
                    });
                }
            });
            
            // Check for calculation error patterns
            const calcErrors = this.errorReports.filter(r => 
                r.errorTypes.includes('calculation-error') || r.errorTypes.includes('wrong-answer')
            );
            
            if (calcErrors.length >= 2) {
                detectedIssues.push({
                    type: 'math-accuracy-issue',
                    title: 'Mathematical Accuracy Problems Detected',
                    description: `${calcErrors.length} reports indicate problems with math calculations. Review question generation algorithms.`
                });
            }
        }
        
        if (detectedIssues.length === 0) {
            autoDetectedList.innerHTML = '<div class="no-errors">No systematic issues detected yet.</div>';
        } else {
            autoDetectedList.innerHTML = detectedIssues.map(issue => `
                <div class="auto-detected-item">
                    <div class="auto-detected-title">${issue.title}</div>
                    <div class="auto-detected-issue">${issue.description}</div>
                </div>
            `).join('');
        }
    }

    showErrorTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tabName + 'Tab').classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.error-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(tabName + 'Content').style.display = 'block';
    }

    exportErrorLogs() {
        const exportData = {
            exportTime: new Date().toISOString(),
            totalReports: this.errorReports.length,
            reports: this.errorReports,
            summary: this.generateErrorSummary()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `math-challenge-error-logs-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        // Show confirmation
        const notification = document.createElement('div');
        notification.className = 'quick-notification success';
        notification.innerHTML = '📊 Error logs exported successfully!';
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    generateErrorSummary() {
        const errorTypes = {};
        const gameTypes = {};
        
        this.errorReports.forEach(report => {
            report.errorTypes.forEach(type => {
                errorTypes[type] = (errorTypes[type] || 0) + 1;
            });
            gameTypes[report.gameType] = (gameTypes[report.gameType] || 0) + 1;
        });
        
        return {
            totalReports: this.errorReports.length,
            errorTypeFrequency: errorTypes,
            gameTypeFrequency: gameTypes,
            mostCommonError: Object.entries(errorTypes).sort((a, b) => b[1] - a[1])[0] || null,
            mostProblematicGame: Object.entries(gameTypes).sort((a, b) => b[1] - a[1])[0] || null
        };
    }

    runQuestionValidation() {
        // Run comprehensive testing and show results
        const notification = document.createElement('div');
        notification.className = 'quick-notification info';
        notification.innerHTML = '🧪 Running comprehensive math validation tests...';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            const results = this.runComprehensiveTests();
            
            // Update notification with results
            if (results.failedTests === 0) {
                notification.className = 'quick-notification success';
                notification.innerHTML = `✅ All ${results.totalTests} validation tests passed! No math errors detected.`;
            } else {
                notification.className = 'quick-notification error';
                notification.innerHTML = `⚠️ Found ${results.failedTests} issues out of ${results.totalTests} tests. Check console for details.`;
            }
            
            setTimeout(() => notification.remove(), 6000);
        }, 1000);
    }

    createErrorReportHTML(report) {
        const date = new Date(report.timestamp).toLocaleString();
        const errorTypesHTML = report.errorTypes.map(type => 
            `<span class="error-type-tag">${type.replace('-', ' ')}</span>`
        ).join('');
        
        return `
            <div class="error-report-item">
                <div class="error-report-header">
                    <span class="error-timestamp">${date}</span>
                    <span class="error-game-type">${report.gameType}</span>
                </div>
                <div class="error-question">
                    Question: ${report.questionSnapshot.questionText.replace(/<[^>]*>/g, ' ').trim()}
                    <br>Correct Answer: ${report.questionSnapshot.questionData.correctAnswer}
                    <br>Difficulty: ${report.questionSnapshot.difficulty}
                </div>
                <div class="error-types-reported">
                    <strong>Issues:</strong> ${errorTypesHTML}
                </div>
                ${report.description ? `<div class="error-description">"${report.description}"</div>` : ''}
                <div style="font-size: 0.8rem; color: #6c757d; margin-top: 10px;">
                    Reported by: ${report.user}
                </div>
            </div>
        `;
    }

    clearErrorReports() {
        if (confirm('Are you sure you want to clear all error reports? This cannot be undone.')) {
            this.errorReports = [];
            this.saveErrorReports();
            this.updateErrorReviewDisplay();
            
            const notification = document.createElement('div');
            notification.className = 'quick-notification info';
            notification.innerHTML = '🗑️ All error reports cleared.';
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }

    backToMenu() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
        }
        
        this.currentGame = null;
        this.timeLeft = 30;
        this.score = 0;
        this.totalQuestions = 0;
        this.correctAnswers = 0;
        this.startTime = null;
        this.difficulty = 'medium';
        this.correctStreak = 0;
        this.wrongStreak = 0;
        this.recentAnswers = [];
        this.maxStreak = 0;
        this.isMultiplayer = false;
        this.players = [];
        this.playerScores = [];
        this.playersReady = [];
        this.gameStarted = false;
        this.questionAnswered = false;
        this.currentRoom = null;
        this.isRoomHost = false;
        this.roomPlayers = [];
        
        document.getElementById('gameSelection').style.display = 'block';
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('results').style.display = 'none';
        document.getElementById('scoreHistory').style.display = 'none';
        document.getElementById('multiplayerReady').style.display = 'none';
        document.getElementById('multiplayerStatus').style.display = 'none';
        document.getElementById('multiplayerScores').style.display = 'none';
        document.getElementById('roomLobby').style.display = 'none';
    }
}

const game = new MathGame();

// Global functions for HTML onclick handlers
function login() {
    game.login();
}

function logout() {
    game.logout();
}

function selectGameMode(mode) {
    game.selectGameMode(mode);
}

function updatePlayerCount() {
    game.updatePlayerCount();
}

function selectTimeLimit(timeInSeconds) {
    game.selectTimeLimit(timeInSeconds);
}

function startAdditionGame() {
    game.startAdditionGame();
}

function startMultiplicationGame() {
    game.startMultiplicationGame();
}

function startSubtractionGame() {
    game.startSubtractionGame();
}

function startDivisionGame() {
    game.startDivisionGame();
}

function startMixGame() {
    game.startMixGame();
}

function startSquaresGame() {
    game.startSquaresGame();
}

function startCubesGame() {
    game.startCubesGame();
}

function startRootsGame() {
    game.startRootsGame();
}

function startPowersGame() {
    game.startPowersGame();
}

function goHome() {
    game.goHome();
}

function submitFeedback(rating) {
    game.submitFeedback(rating);
}

function submitDetailedFeedback() {
    game.submitDetailedFeedback();
}

function hideFeedback() {
    game.hideFeedback();
}

function reportError() {
    game.reportError();
}

function submitErrorReport() {
    game.submitErrorReport();
}

function cancelErrorReport() {
    game.cancelErrorReport();
}

function showErrorReview() {
    game.showErrorReview();
}

function hideErrorReview() {
    game.hideErrorReview();
}

function clearErrorReports() {
    game.clearErrorReports();
}

function showErrorTab(tabName) {
    game.showErrorTab(tabName);
}

function exportErrorLogs() {
    game.exportErrorLogs();
}

function runQuestionValidation() {
    game.runQuestionValidation();
}

function backToMenu() {
    game.backToMenu();
}

function saveScore() {
    game.saveScore();
}

function viewScoreHistory() {
    game.viewScoreHistory();
}

function hideScoreHistory() {
    game.hideScoreHistory();
}

// New global functions for multiplayer ready system  
function setPlayerReady(playerIndex) {
    game.setPlayerReady(playerIndex);
}

// Room system functions
function createRoom() {
    game.createRoom();
}

function joinRoom() {
    game.joinRoom();
}

function copyRoomCode() {
    game.copyRoomCode();
}

function leaveRoom() {
    game.leaveRoom();
}

// Testing function for developers/QA
function runMathTests() {
    return game.runComprehensiveTests();
}

// Auto-fill name input on Enter key
document.addEventListener('DOMContentLoaded', function() {
    const nameInput = document.getElementById('nameInput');
    if (nameInput) {
        nameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
});