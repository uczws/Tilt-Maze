import { InputController } from './input.js';
import { Renderer } from './renderer.js';
import { BallState, simulatePhysicsStep } from './physics.js';
import { UIManager } from './ui.js';
import { getLevelData, TOTAL_LEVELS } from './levels.js';

class GameEngine {
    constructor() {
        this.renderer = new Renderer('game-canvas');
        this.ball = new BallState();
        this.currentLevel = 1;
        this.levelData = null;
        this.lives = 3;
        this.levelStartTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isPaused = true;
        this.animationFrame = null;
        this.completedLevels = new Set();
        this.bestTimes = {}; // { levelNumber: bestTimeInSeconds }
        this.loadProgress();

        this.input = new InputController({
            onModeChange: (message) => this.ui?.updateControlMode(message),
            onSensorStatus: (message) => this.ui?.updateSensorStatus(message),
            onCalibrationStart: () => this.ui?.setCalibrationMessage(true),
            onCalibrationEnd: () => this.ui?.setCalibrationMessage(false)
        });

        this.ui = new UIManager({
            totalLevels: TOTAL_LEVELS,
            onStart: async () => {
                try {
                    await this.input.requestPermission();
                } catch (error) {
                }
                this.beginAdventure(1, { resetProgress: false });
            },
            onSelectLevel: async (level) => {
                try {
                    await this.input.requestPermission();
                } catch (error) {
                }
                this.beginAdventure(level, { resetProgress: false });
            },
            onPause: () => this.pauseGame(),
            onResume: () => this.resumeGame(),
            onRestart: () => this.restartLevel(),
            onMenu: () => this.returnToMenu(),
            onNextLevel: () => this.advanceToNextLevel(),
            onRetry: () => this.restartLevel(),
            onCalibrate: async () => {
                if (!this.input.deviceOrientationActive) {
                    await this.input.requestPermission();
                }
                this.input.calibrate();
            }
        });

        this.syncUIProgress();
        this.bindSystemEvents();
    }

    beginAdventure(levelNumber, { resetProgress } = { resetProgress: false }) {
        try {
            this.pauseGame();
            if (resetProgress) {
                this.resetProgress();
            }
            this.currentLevel = levelNumber;
            this.lives = 3;
            this.loadLevel(levelNumber);
            this.ui.hideAllScreens();
            this.ui.updateHUD({ lives: this.lives });
            setTimeout(() => {
                this.resumeGame();
            }, 50);
        } catch (error) {
            this.returnToMenu();
        }
    }

    loadLevel(levelNumber) {
        try {
            this.levelData = getLevelData(levelNumber);
            this.ball.reset(this.levelData.start.x, this.levelData.start.y);
            this.renderer.configureLevel(this.levelData);
            this.renderer.render(this.ball);
            this.levelStartTime = 0;
            this.elapsedTime = 0;
            this.ui.updateHUD({
                levelNumber,
                levelName: this.levelData.name,
                timeSeconds: 0,
                lives: this.lives
            });
        } catch (error) {
            throw error;
        }
    }

    restartLevel() {
        this.loadLevel(this.currentLevel);
        this.ui.updateHUD({ lives: this.lives });
        this.resumeGame();
    }

    resumeGame() {
        if (!this.levelData) {
            this.loadLevel(this.currentLevel);
        }
        this.isPaused = false;
        this.isRunning = true;
        if (!this.animationFrame) {
            this.animationFrame = requestAnimationFrame((ts) => this.gameLoop(ts));
        }
    }

    pauseGame() {
        this.isPaused = true;
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    returnToMenu() {
        this.pauseGame();
        this.ui.showScreen('start');
    }

    gameLoop(timestamp) {
        if (!this.isRunning || this.isPaused) {
            this.animationFrame = null;
            return;
        }

        if (!this.levelStartTime) {
            this.levelStartTime = timestamp;
        }
        this.elapsedTime = (timestamp - this.levelStartTime) / 1000;
        this.ui.updateHUD({ timeSeconds: this.elapsedTime });

        const tilt = this.input.getTilt();

        if (this.input.mode === 'keyboard') {
            if (tilt.x !== 0 || tilt.y !== 0) {
                this.ball.applyTilt(tilt.x, tilt.y);
            }
        } else {
            this.ball.applyTilt(tilt.x, tilt.y);
        }
        
        const result = simulatePhysicsStep(this.ball, this.levelData.grid);
        this.renderer.render(this.ball);

        if (result.hitHole) {
            this.handleFall();
        } else if (result.reachedGoal) {
            this.handleWin();
        } else {
            this.animationFrame = requestAnimationFrame((ts) => this.gameLoop(ts));
        }
    }

    handleFall() {
        this.lives -= 1;
        this.ui.updateHUD({ lives: this.lives });
        this.pauseGame();
        
        if (this.lives <= 0) {
            this.lives = 3;
            this.currentLevel = 1;
            this.loadLevel(1);
            this.ui.updateHUD({ lives: this.lives, levelNumber: 1, levelName: this.levelData.name });
            this.ui.showLoseScreen({ allLivesLost: true });
        } else {
            this.loadLevel(this.currentLevel);
            this.ui.showLoseScreen({ allLivesLost: false });
        }
    }

    handleWin() {
        this.pauseGame();
        this.completedLevels.add(this.currentLevel);
        
        // Check if this is a new best time
        const previousBest = this.bestTimes[this.currentLevel];
        const isNewRecord = previousBest === undefined || this.elapsedTime < previousBest;
        
        if (isNewRecord) {
            this.bestTimes[this.currentLevel] = this.elapsedTime;
        }
        
        this.ui.markLevelCompleted(this.currentLevel);
        this.saveProgress();
        const hasNext = this.currentLevel < TOTAL_LEVELS;
        this.ui.showWinScreen({ 
            timeSeconds: this.elapsedTime, 
            bestTime: this.bestTimes[this.currentLevel],
            isNewRecord: isNewRecord,
            showNextButton: hasNext, 
            isFinalLevel: !hasNext 
        });
        if (!hasNext) {
            this.currentLevel = TOTAL_LEVELS;
        }
    }

    advanceToNextLevel() {
        try {
            this.pauseGame();
            if (this.currentLevel < TOTAL_LEVELS) {
                this.currentLevel += 1;
            } else {
                return;
            }
            this.loadLevel(this.currentLevel);
            setTimeout(() => {
                this.resumeGame();
            }, 100);
        } catch (error) {
            this.returnToMenu();
        }
    }

    resetProgress() {
        this.completedLevels.clear();
        this.bestTimes = {};
        localStorage.removeItem('tilt-maze-progress');
        this.ui.resetProgress();
    }

    saveProgress() {
        try {
            const payload = { 
                completed: Array.from(this.completedLevels),
                bestTimes: this.bestTimes
            };
            localStorage.setItem('tilt-maze-progress', JSON.stringify(payload));
        } catch (error) {
        }
    }

    loadProgress() {
        try {
            const stored = localStorage.getItem('tilt-maze-progress');
            if (stored) {
                const data = JSON.parse(stored);
                (data.completed || []).forEach((level) => this.completedLevels.add(level));
                if (data.bestTimes) {
                    this.bestTimes = data.bestTimes;
                }
            }
        } catch (error) {
        }
    }

    syncUIProgress() {
        Array.from(this.completedLevels).sort((a, b) => a - b).forEach((level) => {
            this.ui?.markLevelCompleted(level);
        });
        // Sync best times to UI
        this.ui?.updateBestTimes(this.bestTimes);
    }

    bindSystemEvents() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseGame();
            }
        });
        this.orientationQuery = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
        const updateOrientation = () => {
            this.ui.setOrientationWarning(this.orientationQuery.matches);
        };
        if (typeof this.orientationQuery.addEventListener === 'function') {
            this.orientationQuery.addEventListener('change', updateOrientation);
        } else {
            this.orientationQuery.addListener(updateOrientation);
    }
        window.addEventListener('resize', updateOrientation);
        updateOrientation();
    }
}

new GameEngine();
