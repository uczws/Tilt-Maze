/**
 * @file game.js
 * @description Application entry point for Tilt Maze.
 *
 * The {@link GameEngine} ties together:
 * - Input ({@link InputController}) using DeviceOrientation/DeviceMotion with keyboard/touch fallbacks
 * - Physics integration ({@link simulatePhysicsStep})
 * - Canvas rendering ({@link Renderer})
 * - UI state + overlays ({@link UIManager})
 *
 * It also persists progress (unlocked levels + best times) in localStorage.
 */

import { InputController } from './input.js';
import { Renderer } from './renderer.js';
import { BallState, simulatePhysicsStep } from './physics.js';
import { UIManager } from './ui.js';
import { getLevelData, TOTAL_LEVELS } from './levels.js';
import { MAX_LIVES, STORAGE_KEY } from './constants.js';

/**
 * @typedef {Object} ProgressSave
 * @property {number} unlockedLevel Highest unlocked level (1-indexed).
 * @property {number[]} completedLevels Array of completed level numbers.
 * @property {Record<string, number>} bestTimes Map: levelNumber -> bestTime (seconds).
 */

/**
 * Main orchestrator for the game.
 *
 * The engine owns the game loop (requestAnimationFrame), level lifecycle,
 * and persistence. It intentionally keeps modules loosely coupled by
 * communicating via small data objects and callbacks.
 */
class GameEngine {
    /**
     * Creates renderer, input controller and UI; then loads saved progress.
     * The engine starts paused and will begin once the user presses Start.
     */
    constructor() {
        this.renderer = new Renderer('game-canvas');
        this.ball = new BallState();
        this.currentLevel = 1;
        this.levelData = null;
        this.lives = MAX_LIVES;
        this.levelStartTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isPaused = true;
        this.animationFrame = null;
        this.completedLevels = new Set();
        this.bestTimes = {}; // { levelNumber: bestTimeInSeconds }
        this.loadProgress();

        this.input = new InputController({
            onSensorStatus: (message) => this.ui?.updateSensorStatus(message),
            onCalibrationStart: () => this.ui?.setCalibrationMessage(true),
            onCalibrationEnd: () => this.ui?.setCalibrationMessage(false)
        });

        this.ui = new UIManager({
            totalLevels: TOTAL_LEVELS,
            onStart: () => this.requestPermissionAndBegin(1),
            onSelectLevel: (level) => this.requestPermissionAndBegin(level),
            onPause: () => this.pauseGame(),
            onResume: () => this.resumeGame(),
            onRestart: () => this.restartLevel(),
            onMenu: () => this.returnToMenu(),
            onNextLevel: () => this.advanceToNextLevel(),
            onRetry: () => this.restartLevel(),
            onCalibrate: async () => {
                if (!this.input.deviceOrientationActive) await this.input.requestPermission();
                this.input.calibrate();
            }
        });

        this.syncUIProgress();
        this.bindSystemEvents();
    }

    /**
     * Requests motion-sensor permissions (iOS 13+) if available, then starts the selected level.
     * If permission is denied, the game continues with keyboard/touch controls.
     *
     * @param {number} levelNumber 1-indexed level number to start.
     */
    async requestPermissionAndBegin(levelNumber) {
        try {
            await this.input.requestPermission();
        } catch {
            /* permission denied or unavailable - continue with keyboard/touch */
        }
        this.beginAdventure(levelNumber, { resetProgress: false });
    }

    /**
     * Resets runtime state and loads a level.
     *
     * @param {number} levelNumber 1-indexed level number.
     * @param {{resetProgress?: boolean}} [options]
     */
    beginAdventure(levelNumber, { resetProgress } = { resetProgress: false }) {
        try {
            this.pauseGame();
            if (resetProgress) {
                this.resetProgress();
            }
            this.currentLevel = levelNumber;
            this.lives = MAX_LIVES;
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

    /**
     * Loads level data and resets the ball and HUD.
     * @param {number} levelNumber 1-indexed level number.
     */
    loadLevel(levelNumber) {
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
    }

    /** Restarts the current level while keeping remaining lives. */
    restartLevel() {
        this.loadLevel(this.currentLevel);
        this.ui.updateHUD({ lives: this.lives });
        this.resumeGame();
    }

    /**
     * Resumes the animation loop.
     * If no level is loaded yet, it will load the current level first.
     */
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

    /** Pauses the animation loop (stops requestAnimationFrame). */
    pauseGame() {
        this.isPaused = true;
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /** Returns to the main menu (start screen) and pauses the game. */
    returnToMenu() {
        this.pauseGame();
        this.ui.showScreen('start');
    }

    /**
     * Main loop driven by requestAnimationFrame.
     * - Updates timer
     * - Reads normalized tilt input
     * - Advances physics and renders
     * - Triggers win/lose handling when needed
     *
     * @param {number} timestamp High resolution timestamp provided by requestAnimationFrame.
     */
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
        this.ball.applyTilt(tilt.x, tilt.y);
        
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

    /**
     * Handles the lose condition (ball fell into a hole).
     * Decrements a life and shows the lose overlay; resets the run on 0 lives.
     */
    handleFall() {
        this.lives -= 1;
        this.ui.updateHUD({ lives: this.lives });
        this.pauseGame();
        
        if (this.lives <= 0) {
            this.lives = MAX_LIVES;
            this.currentLevel = 1;
            this.loadLevel(1);
            this.ui.updateHUD({ lives: this.lives, levelNumber: 1, levelName: this.levelData.name });
            this.ui.showLoseScreen({ allLivesLost: true });
        } else {
            this.loadLevel(this.currentLevel);
            this.ui.showLoseScreen({ allLivesLost: false });
        }
    }

    /**
     * Handles the win condition (ball reached the goal).
     * Stores best time, unlocks next level, and shows the win overlay.
     */
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

    /** Loads the next level if available. */
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

    /**
     * Clears locally stored progress and resets unlocked levels/best times.
     * This does not remove runtime state (like the current ball position).
     */
    resetProgress() {
        this.completedLevels.clear();
        this.bestTimes = {};
        localStorage.removeItem(STORAGE_KEY);
        this.ui.resetProgress();
    }

    /** Persists current progress (unlocked level, completed levels, best times) to localStorage. */
    saveProgress() {
        try {
            const payload = { 
                completed: Array.from(this.completedLevels),
                bestTimes: this.bestTimes
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            /* localStorage may be full or disabled */
        }
    }

    /**
     * Loads progress from localStorage.
     * Safe to call on fresh installs; uses defaults when no save exists.
     */
    loadProgress() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                (data.completed || []).forEach((level) => this.completedLevels.add(level));
                if (data.bestTimes) {
                    this.bestTimes = data.bestTimes;
                }
            }
        } catch {
            /* localStorage may be corrupted or disabled */
        }
    }

    /**
     * Synchronizes persisted progress state to the UI (completed markers, best times, unlocked level).
     */
    syncUIProgress() {
        Array.from(this.completedLevels).sort((a, b) => a - b).forEach((level) => {
            this.ui?.markLevelCompleted(level);
        });
        // Sync best times to UI
        this.ui?.updateBestTimes(this.bestTimes);
    }

    /**
     * Hooks into browser/system events:
     * - Pause the game when the tab is hidden
     * - Show an orientation warning on small screens in portrait
     * - Keep CSS --app-height in sync with VisualViewport for mobile browsers
     */
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

        const syncAppHeight = () => {
            const h = window.visualViewport?.height || window.innerHeight;
            document.documentElement.style.setProperty('--app-height', `${h}px`);

            // Resize the canvas when the visible viewport height changes (mobile browser UI).
            this.renderer?.resizeCanvas?.();
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncAppHeight, { passive: true });
            window.visualViewport.addEventListener('scroll', syncAppHeight, { passive: true });
        }

        window.addEventListener('resize', syncAppHeight, { passive: true });
        syncAppHeight();
    }
}

new GameEngine();
