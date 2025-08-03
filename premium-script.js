// The Hypothetical Game - Premium JavaScript with Screen Navigation
// Clean, Apple-inspired UX with smooth transitions

console.log('📄 Premium script loading...');

class PremiumMathGame {
    constructor() {
        this.currentScreen = 'welcomeScreen';
        this.screenHistory = [];
        this.gameState = {
            playerName: '',
            playerEmail: '',
            playMode: 'solo', // solo or multiplayer
            duration: 60, // seconds
            fundamental: 'addition', // addition, subtraction, multiplication, division, mixed
            currentQuestion: null,
            score: 0,
            streak: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            timeRemaining: 60,
            gameActive: false,
            questions: [],
            currentQuestionIndex: 0
        };
        
        this.user = {
            plan: 'free',
            gamesPlayed: 0,
            totalXP: 0,
            currentStreak: 0,
            bestStreak: 0,
            accuracy: 0
        };

        this.gameTimer = null;
        this.questionStartTime = null;
        
        this.init();
    }

    init() {
        console.log('🎯 PremiumMathGame initializing...');
        this.hideLoadingScreen();
        this.setupEventListeners();
        this.showScreen('welcomeScreen');
    }

    hideLoadingScreen() {
        console.log('📱 Hiding loading screen...');
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            const mainApp = document.getElementById('mainApp');
            
            console.log('🔍 Loading screen element:', loadingScreen);
            console.log('🔍 Main app element:', mainApp);
            
            if (loadingScreen && mainApp) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    mainApp.style.display = 'block';
                    mainApp.style.visibility = 'visible';
                    mainApp.style.opacity = '1';
                    console.log('✅ Loading screen hidden, main app shown');
                }, 300);
            } else {
                console.error('❌ Could not find loading screen or main app elements');
            }
        }, 500); // Reduced timeout for faster debugging
    }

    setupEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.goBack();
            }
        });

        // Prevent zoom on inputs (iOS)
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        });
    }

    // Screen Navigation System
    showScreen(screenId, addToHistory = true) {
        console.log(`🔄 Showing screen: ${screenId}`);
        if (addToHistory && this.currentScreen !== screenId) {
            this.screenHistory.push(this.currentScreen);
        }

        // Hide current screen
        const currentScreenEl = document.getElementById(this.currentScreen);
        console.log(`🔍 Current screen element (${this.currentScreen}):`, currentScreenEl);
        if (currentScreenEl) {
            currentScreenEl.classList.add('exiting');
            setTimeout(() => {
                currentScreenEl.classList.remove('active', 'exiting');
            }, 300);
        }

        // Show new screen
        setTimeout(() => {
            const newScreenEl = document.getElementById(screenId);
            console.log(`🔍 New screen element (${screenId}):`, newScreenEl);
            if (newScreenEl) {
                newScreenEl.classList.add('active');
                this.currentScreen = screenId;
                console.log(`✅ Screen ${screenId} is now active`);
                this.onScreenChange(screenId);
            } else {
                console.error(`❌ Could not find screen element: ${screenId}`);
            }
        }, 150);
    }

    goBack() {
        if (this.screenHistory.length > 0) {
            const previousScreen = this.screenHistory.pop();
            this.showScreen(previousScreen, false);
        }
    }

    onScreenChange(screenId) {
        // Handle screen-specific logic
        switch(screenId) {
            case 'gameScreen':
                this.startGameplay();
                break;
            case 'victoryScreen':
                this.showResults();
                break;
        }
    }

    // Welcome Screen - Name Entry
    enterName(event) {
        event.preventDefault();
        
        const name = document.getElementById('playerName').value.trim();
        const email = document.getElementById('playerEmail').value.trim();
        
        if (!name) {
            this.showError('Please enter your name');
            return;
        }

        this.gameState.playerName = name;
        this.gameState.playerEmail = email;
        
        // Track user registration
        this.trackEvent('user_name_entered', { 
            hasEmail: !!email,
            nameLength: name.length 
        });

        this.showScreen('modeScreen');
    }

    // Mode Selection Screen
    selectPlayMode(mode) {
        this.gameState.playMode = mode;
        
        if (mode === 'multiplayer' && this.user.plan === 'free') {
            this.showUpgradePrompt('Multiplayer games require a premium subscription.');
            return;
        }

        this.trackEvent('play_mode_selected', { mode });
        this.showScreen('durationScreen');
    }

    // Duration Selection Screen
    selectDuration(seconds) {
        this.gameState.duration = seconds;
        this.gameState.timeRemaining = seconds;
        
        this.trackEvent('duration_selected', { 
            duration: seconds,
            mode: this.gameState.playMode 
        });
        
        this.showScreen('fundamentalsScreen');
    }

    // Fundamentals Selection Screen
    selectFundamental(type) {
        if (type === 'mixed' && this.user.plan === 'free') {
            this.showUpgradePrompt('Ultimate Mix requires a premium subscription to unlock AI-adaptive difficulty.');
            return;
        }

        this.gameState.fundamental = type;
        
        this.trackEvent('fundamental_selected', { 
            type,
            playerPlan: this.user.plan 
        });
        
        this.prepareGame();
        this.showScreen('gameScreen');
    }

    // Game Preparation
    prepareGame() {
        this.gameState.score = 0;
        this.gameState.streak = 0;
        this.gameState.totalQuestions = 0;
        this.gameState.correctAnswers = 0;
        this.gameState.currentQuestionIndex = 0;
        this.gameState.timeRemaining = this.gameState.duration;
        
        // Generate questions based on duration and difficulty
        const questionCount = Math.ceil(this.gameState.duration / 4); // ~1 question per 4 seconds
        this.gameState.questions = this.generateQuestions(questionCount);
        
        this.updateGameUI();
    }

    generateQuestions(count) {
        const questions = [];
        const fundamental = this.gameState.fundamental;
        
        for (let i = 0; i < count; i++) {
            let question;
            
            switch(fundamental) {
                case 'addition':
                    question = this.generateAdditionQuestion();
                    break;
                case 'subtraction':
                    question = this.generateSubtractionQuestion();
                    break;
                case 'multiplication':
                    question = this.generateMultiplicationQuestion();
                    break;
                case 'division':
                    question = this.generateDivisionQuestion();
                    break;
                case 'mixed':
                    question = this.generateMixedQuestion();
                    break;
                default:
                    question = this.generateAdditionQuestion();
            }
            
            questions.push(question);
        }
        
        return questions;
    }

    generateAdditionQuestion() {
        const a = Math.floor(Math.random() * 50) + 1;
        const b = Math.floor(Math.random() * 50) + 1;
        const correct = a + b;
        const options = this.generateOptions(correct);
        
        return {
            text: `${a} + ${b}`,
            correct: correct,
            options: options,
            correctIndex: options.indexOf(correct)
        };
    }

    generateSubtractionQuestion() {
        const a = Math.floor(Math.random() * 50) + 25;
        const b = Math.floor(Math.random() * (a - 1)) + 1;
        const correct = a - b;
        const options = this.generateOptions(correct);
        
        return {
            text: `${a} - ${b}`,
            correct: correct,
            options: options,
            correctIndex: options.indexOf(correct)
        };
    }

    generateMultiplicationQuestion() {
        const a = Math.floor(Math.random() * 12) + 1;
        const b = Math.floor(Math.random() * 12) + 1;
        const correct = a * b;
        const options = this.generateOptions(correct);
        
        return {
            text: `${a} × ${b}`,
            correct: correct,
            options: options,
            correctIndex: options.indexOf(correct)
        };
    }

    generateDivisionQuestion() {
        const b = Math.floor(Math.random() * 12) + 1;
        const correct = Math.floor(Math.random() * 12) + 1;
        const a = b * correct;
        const options = this.generateOptions(correct);
        
        return {
            text: `${a} ÷ ${b}`,
            correct: correct,
            options: options,
            correctIndex: options.indexOf(correct)
        };
    }

    generateMixedQuestion() {
        const types = ['addition', 'subtraction', 'multiplication', 'division'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        
        switch(randomType) {
            case 'addition': return this.generateAdditionQuestion();
            case 'subtraction': return this.generateSubtractionQuestion();
            case 'multiplication': return this.generateMultiplicationQuestion();
            case 'division': return this.generateDivisionQuestion();
        }
    }

    generateOptions(correct) {
        const options = [correct];
        
        while (options.length < 4) {
            let wrong;
            if (correct <= 10) {
                wrong = Math.floor(Math.random() * 20) + 1;
            } else if (correct <= 50) {
                wrong = correct + (Math.floor(Math.random() * 20) - 10);
            } else {
                wrong = correct + (Math.floor(Math.random() * 40) - 20);
            }
            
            if (wrong > 0 && !options.includes(wrong)) {
                options.push(wrong);
            }
        }
        
        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        
        return options;
    }

    // Game Logic
    startGameplay() {
        this.gameState.gameActive = true;
        this.questionStartTime = Date.now();
        
        this.displayCurrentQuestion();
        this.startTimer();
        
        this.trackEvent('game_started', {
            mode: this.gameState.playMode,
            duration: this.gameState.duration,
            fundamental: this.gameState.fundamental
        });
    }

    displayCurrentQuestion() {
        const question = this.gameState.questions[this.gameState.currentQuestionIndex];
        if (!question) {
            this.endGame();
            return;
        }

        this.gameState.currentQuestion = question;
        
        document.getElementById('questionText').textContent = `What is ${question.text}?`;
        
        const answersGrid = document.getElementById('answersGrid');
        answersGrid.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'answer-btn';
            button.textContent = option;
            button.onclick = () => this.selectAnswer(index);
            answersGrid.appendChild(button);
        });

        this.updateProgress();
    }

    selectAnswer(selectedIndex) {
        if (!this.gameState.gameActive) return;

        const question = this.gameState.currentQuestion;
        const isCorrect = selectedIndex === question.correctIndex;
        const responseTime = Date.now() - this.questionStartTime;
        
        // Visual feedback
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach((btn, index) => {
            btn.disabled = true;
            if (index === question.correctIndex) {
                btn.classList.add('correct');
            } else if (index === selectedIndex && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        // Update game state
        this.gameState.totalQuestions++;
        
        if (isCorrect) {
            this.gameState.correctAnswers++;
            this.gameState.streak++;
            
            // Score calculation with time bonus
            let points = 10;
            if (responseTime < 2000) points += 5; // Speed bonus
            if (this.gameState.streak >= 5) points += 3; // Streak bonus
            
            this.gameState.score += points;
            
            this.showFeedback('correct');
        } else {
            this.gameState.streak = 0;
            this.showFeedback('incorrect');
        }

        this.updateGameUI();
        
        // Track answer
        this.trackEvent('question_answered', {
            correct: isCorrect,
            responseTime: responseTime,
            questionType: this.gameState.fundamental,
            streak: this.gameState.streak
        });

        // Move to next question after feedback
        setTimeout(() => {
            this.nextQuestion();
        }, 1500);
    }

    showFeedback(type) {
        // Could add visual feedback animations here
        if (type === 'correct') {
            // Maybe show a green checkmark or positive animation
        } else {
            // Maybe show a red X or shake animation
        }
    }

    nextQuestion() {
        this.gameState.currentQuestionIndex++;
        this.questionStartTime = Date.now();
        
        if (this.gameState.currentQuestionIndex >= this.gameState.questions.length || 
            this.gameState.timeRemaining <= 0) {
            this.endGame();
        } else {
            this.displayCurrentQuestion();
        }
    }

    startTimer() {
        this.gameTimer = setInterval(() => {
            this.gameState.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.gameState.timeRemaining <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerEl = document.getElementById('gameTimer');
        if (timerEl) {
            timerEl.textContent = this.gameState.timeRemaining;
            
            // Color coding for urgency
            if (this.gameState.timeRemaining <= 10) {
                timerEl.style.color = 'var(--premium-error)';
            } else if (this.gameState.timeRemaining <= 30) {
                timerEl.style.color = 'var(--premium-warning)';
            }
        }
    }

    updateGameUI() {
        document.getElementById('currentScore').textContent = this.gameState.score;
        document.getElementById('currentStreak').textContent = this.gameState.streak;
    }

    updateProgress() {
        const progress = (this.gameState.currentQuestionIndex / this.gameState.questions.length) * 100;
        const progressFill = document.getElementById('gameProgress');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `Question ${this.gameState.currentQuestionIndex + 1} of ${this.gameState.questions.length}`;
        }
    }

    pauseGame() {
        this.gameState.gameActive = false;
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        // Could show pause modal here
    }

    skipQuestion() {
        if (this.gameState.gameActive) {
            this.trackEvent('question_skipped', {
                questionIndex: this.gameState.currentQuestionIndex,
                timeRemaining: this.gameState.timeRemaining
            });
            this.nextQuestion();
        }
    }

    endGame() {
        this.gameState.gameActive = false;
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }

        // Calculate final stats
        const accuracy = this.gameState.totalQuestions > 0 ? 
            Math.round((this.gameState.correctAnswers / this.gameState.totalQuestions) * 100) : 0;
        
        const xpEarned = this.gameState.score;
        
        // Update user stats
        this.user.gamesPlayed++;
        this.user.totalXP += xpEarned;
        this.user.accuracy = accuracy;
        this.user.currentStreak = this.gameState.streak;
        this.user.bestStreak = Math.max(this.user.bestStreak, this.gameState.streak);

        this.trackEvent('game_completed', {
            score: this.gameState.score,
            accuracy: accuracy,
            questionsAnswered: this.gameState.totalQuestions,
            correctAnswers: this.gameState.correctAnswers,
            timeUsed: this.gameState.duration - this.gameState.timeRemaining,
            bestStreak: this.gameState.streak,
            fundamental: this.gameState.fundamental,
            xpEarned: xpEarned
        });

        this.showScreen('victoryScreen');
    }

    // Victory Screen
    showResults() {
        const accuracy = this.gameState.totalQuestions > 0 ? 
            Math.round((this.gameState.correctAnswers / this.gameState.totalQuestions) * 100) : 0;
        
        // Update UI elements
        document.getElementById('finalScore').textContent = 
            `${this.gameState.correctAnswers}/${this.gameState.totalQuestions}`;
        document.getElementById('accuracyBadge').textContent = `${accuracy}% Accuracy`;
        document.getElementById('xpEarned').textContent = `+${this.gameState.score}`;
        
        // Show streak bonus if applicable
        const streakBonus = document.getElementById('streakBonus');
        if (this.gameState.streak >= 5) {
            streakBonus.textContent = `🔥 ${this.gameState.streak}-streak bonus: +${this.gameState.streak * 10} XP`;
            streakBonus.style.display = 'block';
        } else {
            streakBonus.style.display = 'none';
        }

        // Show Ultimate Mix upsell for free users who did well
        const upsellCard = document.getElementById('ultimateMixUpsell');
        if (this.user.plan === 'free' && accuracy >= 70 && this.gameState.fundamental !== 'mixed') {
            upsellCard.style.display = 'block';
        } else {
            upsellCard.style.display = 'none';
        }

        // Victory title based on performance
        const victoryTitle = document.getElementById('victoryTitle');
        if (accuracy >= 90) {
            victoryTitle.textContent = 'Perfect Genius!';
        } else if (accuracy >= 80) {
            victoryTitle.textContent = 'Math Master!';
        } else if (accuracy >= 70) {
            victoryTitle.textContent = 'Great Work!';
        } else {
            victoryTitle.textContent = 'Keep Practicing!';
        }
    }

    // Action Handlers
    playAgain() {
        this.trackEvent('play_again_clicked');
        this.showScreen('durationScreen');
    }

    backToMenu() {
        this.trackEvent('back_to_menu_clicked');
        this.screenHistory = []; // Clear history
        this.showScreen('modeScreen');
    }

    hideUpsell() {
        document.getElementById('ultimateMixUpsell').style.display = 'none';
    }

    showUpgrade() {
        this.trackEvent('upgrade_from_victory_clicked');
        this.showScreen('subscriptionScreen');
    }

    // Subscription System
    showUpgradePrompt(message) {
        // For now, just show an alert. Could be a modal in production.
        alert(message + ' Upgrade to Premium to unlock this feature!');
        this.showScreen('subscriptionScreen');
    }

    subscribeTo(plan) {
        this.trackEvent('subscription_initiated', { plan });
        
        // In production, this would integrate with Stripe
        alert(`Redirecting to ${plan} subscription checkout...`);
        
        // Mock successful subscription for demo
        setTimeout(() => {
            this.user.plan = plan;
            alert(`Welcome to ${plan} plan! All features unlocked.`);
            this.goBack();
        }, 2000);
    }

    continueWithFree() {
        this.trackEvent('continue_with_free_clicked');
        this.goBack();
    }

    // Utility Functions
    showError(message) {
        // Could show a toast or modal. For now, just alert.
        alert(message);
    }

    trackEvent(eventName, properties = {}) {
        // Analytics tracking
        console.log('Track Event:', eventName, properties);
        
        // In production, send to analytics service
        if (typeof plausible !== 'undefined') {
            plausible(eventName, { props: properties });
        }
    }
}

// Global Functions (called from HTML)
let game;

function enterName(event) {
    game.enterName(event);
}

function selectPlayMode(mode) {
    game.selectPlayMode(mode);
}

function selectDuration(seconds) {
    game.selectDuration(seconds);
}

function selectFundamental(type) {
    game.selectFundamental(type);
}

function selectAnswer(index) {
    game.selectAnswer(index);
}

function pauseGame() {
    game.pauseGame();
}

function skipQuestion() {
    game.skipQuestion();
}

function playAgain() {
    game.playAgain();
}

function backToMenu() {
    game.backToMenu();
}

function hideUpsell() {
    game.hideUpsell();
}

function showUpgrade() {
    game.showUpgrade();
}

function subscribeTo(plan) {
    game.subscribeTo(plan);
}

function continueWithFree() {
    game.continueWithFree();
}

function goBack() {
    game.goBack();
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing game...');
    try {
        game = new PremiumMathGame();
        console.log('✅ Game initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing game:', error);
    }
});

// Service Worker Registration (PWA) - Disabled for now
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('/sw.js')
//             .then(registration => {
//                 console.log('SW registered: ', registration);
//             })
//             .catch(registrationError => {
//                 console.log('SW registration failed: ', registrationError);
//             });
//     });
// }