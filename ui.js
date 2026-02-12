/**
 * =============================================================
 * UI Module
 * -------------------------------------------------------------
 * Manages overlays, HUD updates, level selection, orientation
 * warnings, and calibration messaging.
 * =============================================================
 */

const DEFAULT_HANDLER = () => {};

export class UIManager {
    constructor({
        totalLevels,
        onStart = DEFAULT_HANDLER,
        onSelectLevel = DEFAULT_HANDLER,
        onPause = DEFAULT_HANDLER,
        onResume = DEFAULT_HANDLER,
        onRestart = DEFAULT_HANDLER,
        onMenu = DEFAULT_HANDLER,
        onNextLevel = DEFAULT_HANDLER,
        onRetry = DEFAULT_HANDLER,
        onCalibrate = DEFAULT_HANDLER
    }) {
        this.totalLevels = totalLevels;
        this.handlers = { onStart, onSelectLevel, onPause, onResume, onRestart, onMenu, onNextLevel, onRetry, onCalibrate };
        this.completedLevels = new Set();
        this.currentLevel = 1;
        this.unlockedLevel = 1;
        this.bestTimes = {}; // { levelNumber: bestTimeInSeconds }
        this.confetti = { canvas: null, raf: null, endTime: 0, lastTs: 0, particles: [], resize: null };
        this.cacheElements();
        this.buildLevelGrid();
        this.bindEvents();
        this.showScreen('start');
        this.updateGameScreenPointerEvents();
    }

    formatLives(lives) {
        const maxLives = 3;
        const safeLives = Math.max(0, Math.min(maxLives, Math.floor(lives)));
        return '♥'.repeat(safeLives) + '♡'.repeat(maxLives - safeLives);
    }

    cacheElements() {
        this.screens = {
            start: document.getElementById('start-screen'),
            pause: document.getElementById('pause-screen'),
            win: document.getElementById('win-screen'),
            lose: document.getElementById('lose-screen'),
            burgerMenu: document.getElementById('burger-menu-screen'),
            levelSelectMobile: document.getElementById('level-select-screen-mobile')
        };
        // falls nötig
        this.hud = {
            levelDisplay: document.getElementById('level-display'),
            timeDisplay: document.getElementById('time-display'),
            livesDisplay: document.getElementById('lives-display'),
            controlMode: document.getElementById('control-mode'),
            sensorStatus: document.getElementById('sensor-status')
        };
        this.messages = {
            orientation: document.getElementById('orientation-message'),
            calibration: document.getElementById('calibration-message'),
            winMessage: document.getElementById('win-message'),
            winTime: document.getElementById('win-time'),
            loseMessage: document.getElementById('lose-message')
        };
        this.buttons = {
            start: document.getElementById('start-button'),
            levelSelectHud: document.getElementById('level-select-hud-button'),
            pause: document.getElementById('pause-button'),
            resume: document.getElementById('resume-button'),
            restart: document.getElementById('restart-button'),
            menu: document.getElementById('menu-button'),
            retry: document.getElementById('retry-button'),
            loseMenu: document.getElementById('lose-menu-button'),
            winMenu: document.getElementById('win-menu-button'),
            nextLevel: document.getElementById('next-level-button'),
            calibrate: document.getElementById('calibrate-button'),
            calibrateMobile: document.getElementById('calibrate-button-mobile'),
            burgerMenu: document.getElementById('burger-menu-button'),
            burgerResume: document.getElementById('burger-resume-button'),
            burgerLevels: document.getElementById('burger-levels-button'),
            burgerRestart: document.getElementById('burger-restart-button'),
            burgerMenuMenu: document.getElementById('burger-menu-menu-button'),
            levelSelectBack: document.getElementById('level-select-back-button')
        };
        this.levelGrid = document.getElementById('level-grid-hud');
        this.levelGridMobile = document.getElementById('level-grid-hud-mobile');
        this.levelDropdown = document.getElementById('level-select-dropdown');
        this.levelSelectScreenMobile = document.getElementById('level-select-screen-mobile');
    }

    buildLevelGrid() {
        const grids = [this.levelGrid, this.levelGridMobile].filter(Boolean);
        if (grids.length === 0) return;

        grids.forEach(grid => {
            grid.innerHTML = '';
            for (let level = 1; level <= this.totalLevels; level++) {
                const button = document.createElement('button');
                button.className = 'level-button-hud';
                button.type = 'button';
                button.dataset.level = level;
                
                // Create button content with level number and best time
                const levelNumber = document.createElement('span');
                levelNumber.className = 'level-number';
                levelNumber.textContent = level;
                
                const bestTimeDisplay = document.createElement('span');
                bestTimeDisplay.className = 'level-best-time';
                bestTimeDisplay.textContent = '';
                
                button.appendChild(levelNumber);
                button.appendChild(bestTimeDisplay);
                
                button.addEventListener('click', () => {
                    this.handleLevelSelection(level);
                    this.hideLevelDropdown();
                    if (this.levelSelectScreenMobile) {
                        this.hideScreen('levelSelectMobile');
                    }
                });
                grid.appendChild(button);
            }
        });
        
        this.updateLevelButtonStates();
    }

    bindEvents() {
        if (this.buttons.start) {
            const handleStart = (event) => {
                // Mobile Chrome can preserve a page scroll offset (100vh vs visible viewport).
                // Ensure we always start the game at the top.
                try {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                } catch (e) {
                    // ignore
                }
                this.hideAllScreens();
                this.handlers.onStart(this.currentLevel);
            };
            this.buttons.start.addEventListener('click', handleStart);
        }
        this.buttons.levelSelectHud?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLevelDropdown();
        });
        
        document.addEventListener('click', (e) => {
            const isLevelButton = e.target === this.buttons.levelSelectHud;
            if (this.levelDropdown && !this.levelDropdown.contains(e.target) && !isLevelButton) {
                this.hideLevelDropdown();
            }
        });
        this.buttons.pause?.addEventListener('click', () => {
            this.showScreen('pause');
            this.handlers.onPause();
        });
        this.buttons.resume?.addEventListener('click', () => {
            this.hideScreen('pause');
            this.handlers.onResume();
        });
        this.buttons.restart?.addEventListener('click', () => {
            this.hideScreen('pause');
            this.hideScreen('win');
            this.hideScreen('lose');
            this.handlers.onRestart();
        });
        this.buttons.menu?.addEventListener('click', () => {
            this.hideScreen('pause');
            this.showScreen('start');
            this.handlers.onMenu();
        });
        this.buttons.retry?.addEventListener('click', () => {
            this.hideScreen('lose');
            this.handlers.onRetry();
        });
        this.buttons.loseMenu?.addEventListener('click', () => {
            this.showScreen('start');
            this.handlers.onMenu();
        });
        this.buttons.winMenu?.addEventListener('click', () => {
            this.showScreen('start');
            this.handlers.onMenu();
        });
        this.buttons.nextLevel?.addEventListener('click', () => {
            this.hideScreen('win');
            this.handlers.onNextLevel();
        });
        this.buttons.calibrate?.addEventListener('click', () => {
            this.handlers.onCalibrate();
        });
        this.buttons.calibrateMobile?.addEventListener('click', () => {
            this.handlers.onCalibrate();
        });
        
        // Burger-Menü Event-Handler
        this.buttons.burgerMenu?.addEventListener('click', () => {
            this.showBurgerMenu();
        });
        
        this.buttons.burgerResume?.addEventListener('click', () => {
            this.hideScreen('burgerMenu');
            this.handlers.onResume();
        });
        
        this.buttons.burgerLevels?.addEventListener('click', () => {
            this.hideScreen('burgerMenu');
            this.showScreen('levelSelectMobile');
            this.updateLevelButtonStates();
        });
        
        this.buttons.levelSelectBack?.addEventListener('click', () => {
            this.hideScreen('levelSelectMobile');
            this.showScreen('burgerMenu');
        });
        
        this.buttons.burgerRestart?.addEventListener('click', () => {
            this.hideScreen('burgerMenu');
            this.hideScreen('win');
            this.hideScreen('lose');
            this.handlers.onRestart();
        });
        
        this.buttons.burgerMenuMenu?.addEventListener('click', () => {
            this.hideScreen('burgerMenu');
            this.showScreen('start');
            this.handlers.onMenu();
        });
    }
    
    showBurgerMenu() {
        this.hideLevelDropdown();
        this.showScreen('burgerMenu');
        this.handlers.onPause();
    }

    handleLevelSelection(level) {
        if (level > this.unlockedLevel) {
            return;
        }
        this.hideAllScreens();
        this.hideLevelDropdown();
        this.currentLevel = level;
        this.handlers.onSelectLevel(level);
    }

    toggleLevelDropdown() {
        if (!this.levelDropdown) return;
        const isVisible = this.levelDropdown.classList.contains('active');
        if (isVisible) {
            this.hideLevelDropdown();
        } else {
            this.showLevelDropdown();
        }
    }

    showLevelDropdown() {
        this.updateLevelButtonStates();
        if (this.levelDropdown) {
            this.levelDropdown.classList.add('active');
        }
    }

    hideLevelDropdown() {
        this.levelDropdown?.classList.remove('active');
    }

    showScreen(name) {
        this.hideAllScreens();
        const screen = this.screens[name];
        if (screen) {
            screen.classList.add('active');
        }
        this.updateGameScreenPointerEvents();
    }

    hideScreen(name) {
        const screen = this.screens[name];
        if (screen) {
            screen.classList.remove('active');
        }
        this.updateGameScreenPointerEvents();
    }

    updateGameScreenPointerEvents() {
        const gameScreen = document.getElementById('game-screen');
        const startScreen = this.screens.start;
        if (gameScreen && startScreen) {
            if (startScreen.classList.contains('active')) {
                gameScreen.style.pointerEvents = 'none';
            } else {
                gameScreen.style.pointerEvents = 'auto';
            }
        }
    }

    hideAllScreens() {
        Object.values(this.screens).forEach(screen => screen?.classList.remove('active'));
        this.updateGameScreenPointerEvents();
    }

    updateHUD({ levelNumber, levelName, timeSeconds, lives }) {
        if (typeof levelNumber === 'number') {
            this.currentLevel = levelNumber;
            if (this.hud.levelDisplay) {
            this.hud.levelDisplay.textContent = `${levelNumber} · ${levelName}`;
            }
            this.updateLevelButtonStates();
        }
        if (typeof timeSeconds === 'number' && this.hud.timeDisplay) {
            this.hud.timeDisplay.textContent = `${timeSeconds.toFixed(1)} s`;
        }
        if (typeof lives === 'number' && this.hud.livesDisplay) {
            const hearts = this.formatLives(lives);
            this.hud.livesDisplay.textContent = hearts;
            this.hud.livesDisplay.setAttribute('aria-label', `${lives} lives`);
        }
    }

    updateControlMode(message) {
        if (this.hud.controlMode) {
        this.hud.controlMode.textContent = message;
        }
    }

    updateSensorStatus(message) {
        if (this.hud.sensorStatus) {
        this.hud.sensorStatus.textContent = message;
        }
    }

    setOrientationWarning(visible) {
        if (!this.messages.orientation) return;
        this.messages.orientation.classList.toggle('active', visible);
    }

    setCalibrationMessage(visible) {
        if (!this.messages.calibration) return;
        this.messages.calibration.classList.toggle('active', visible);
    }

    showWinScreen({ timeSeconds, bestTime, isNewRecord = false, showNextButton = true, isFinalLevel = false }) {
        if (this.messages.winMessage) {
            let message = '';
            if (isFinalLevel) {
                message = 'You did it — all levels cleared!';
            } else if (isNewRecord) {
                message = '🎉 New Best Time! 🎉';
            }
            this.messages.winMessage.textContent = message;
            this.messages.winMessage.classList.toggle('final', isFinalLevel);
            this.messages.winMessage.classList.toggle('new-record', isNewRecord);
        }
        if (isFinalLevel) {
            this.launchConfetti();
        } else {
            this.stopConfetti();
        }
        
        // Build time summary with best time
        let summary = `Time: ${timeSeconds.toFixed(1)} s`;
        if (bestTime !== undefined) {
            summary += ` | Best: ${bestTime.toFixed(1)} s`;
        }
        this.messages.winTime.textContent = summary;
        
        if (this.buttons.nextLevel) {
            this.buttons.nextLevel.style.display = showNextButton ? 'inline-block' : 'none';
        }
        this.showScreen('win');
    }

    launchConfetti() {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

        this.stopConfetti();

        const canvas = document.createElement('canvas');
        canvas.className = 'confetti-canvas';
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const resize = () => {
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        (document.body || document.documentElement).appendChild(canvas);
        window.addEventListener('resize', resize, { passive: true });

        const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];
        const count = window.innerWidth < 768 ? 120 : 180;
        const particles = Array.from({ length: count }, (_, i) => {
            const size = 6 + Math.random() * 7;
            return {
                x: Math.random() * window.innerWidth,
                y: -20 - Math.random() * window.innerHeight * 0.3,
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 6,
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.25,
                size,
                color: colors[i % colors.length],
                circle: Math.random() < 0.2
            };
        });

        this.confetti = {
            canvas,
            raf: null,
            endTime: performance.now() + 2600,
            lastTs: 0,
            particles,
            resize
        };

        const tick = (ts) => {
            if (!this.confetti.canvas) return;
            if (!this.confetti.lastTs) this.confetti.lastTs = ts;
            const dt = Math.min(32, ts - this.confetti.lastTs);
            this.confetti.lastTs = ts;

            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            const gravity = 0.012 * dt;
            const wind = Math.sin(ts / 350) * 0.02 * dt;

            for (const p of this.confetti.particles) {
                p.vy += gravity;
                p.vx += wind;
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr * dt;

                if (p.x < -40) p.x = window.innerWidth + 40;
                if (p.x > window.innerWidth + 40) p.x = -40;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                if (p.circle) {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                }
                ctx.restore();
            }

            if (ts < this.confetti.endTime) {
                this.confetti.raf = requestAnimationFrame(tick);
            } else {
                this.stopConfetti();
            }
        };

        this.confetti.raf = requestAnimationFrame(tick);
    }

    stopConfetti() {
        const { canvas, raf, resize } = this.confetti || {};
        if (raf) cancelAnimationFrame(raf);
        if (resize) window.removeEventListener('resize', resize);
        if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
        this.confetti = { canvas: null, raf: null, endTime: 0, lastTs: 0, particles: [], resize: null };
    }

    showLoseScreen({ allLivesLost = false } = {}) {
        if (this.messages.loseMessage) {
            if (allLivesLost) {
                this.messages.loseMessage.textContent = 'All lives lost! Starting over from Level 1.';
            } else {
                this.messages.loseMessage.textContent = 'Gravity won this round — try a different tilt.';
            }
        }
        this.showScreen('lose');
    }

    markLevelCompleted(level) {
        this.completedLevels.add(level);
        if (level === this.unlockedLevel && this.unlockedLevel < this.totalLevels) {
            this.unlockedLevel += 1;
        }
        this.updateLevelButtonStates();
    }

    resetProgress() {
        this.completedLevels.clear();
        this.unlockedLevel = 1;
        this.bestTimes = {};
        this.updateLevelButtonStates();
    }

    updateLevelButtonStates() {
        const allLevelButtons = document.querySelectorAll('.level-button-hud');
        allLevelButtons.forEach(button => {
            const level = Number(button.dataset.level);
            button.classList.toggle('completed', this.completedLevels.has(level));
            button.classList.toggle('current', level === this.currentLevel);
            
            // Update best time display
            const bestTimeDisplay = button.querySelector('.level-best-time');
            if (bestTimeDisplay) {
                const bestTime = this.bestTimes[level];
                if (bestTime !== undefined) {
                    bestTimeDisplay.textContent = `${bestTime.toFixed(1)}s`;
                    bestTimeDisplay.classList.add('has-record');
                } else {
                    bestTimeDisplay.textContent = '';
                    bestTimeDisplay.classList.remove('has-record');
                }
            }
            
            if (level > this.unlockedLevel) {
                button.classList.add('locked');
                button.disabled = true;
            } else {
                button.classList.remove('locked');
                button.disabled = false;
            }
        });
    }
    
    updateBestTimes(bestTimes) {
        this.bestTimes = bestTimes || {};
        this.updateLevelButtonStates();
    }
}
