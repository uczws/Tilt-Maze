/**
 * @file input.js
 * @description Input abstraction for Tilt Maze.
 *
 * The rest of the game (physics + engine) only needs one thing: a normalized
 * tilt vector in the range [-1, 1] for both axes.
 *
 * This module collects and normalizes input from multiple sources:
 * - DeviceOrientation (preferred on mobile)
 * - DeviceMotion (accelerometer fallback if orientation is unavailable)
 * - Keyboard (WASD / Arrow keys)
 * - Touch swipes (fallback on touch devices without sensors)
 *
 * It also supports:
 * - Calibration (treat current device pose as the neutral position)
 * - Smoothing (lerp) to avoid jitter and create "physical" movement
 */

/**
 * @typedef {{x: number, y: number}} TiltVector
 * A normalized tilt vector. Positive x = tilt right, positive y = tilt down.
 */

/**
 * @typedef {'sensor'|'keyboard'} InputMode
 * Current active input mode.
 */

const DEFAULT_CALLBACK = () => {};

/** Maps key identifiers to { axis: 'x'|'y', direction: 1|-1 } for tilt. */
const KEY_MAP = {
    arrowup: { axis: 'y', direction: -1 },
    w: { axis: 'y', direction: -1 },
    arrowdown: { axis: 'y', direction: 1 },
    s: { axis: 'y', direction: 1 },
    arrowleft: { axis: 'x', direction: -1 },
    a: { axis: 'x', direction: -1 },
    arrowright: { axis: 'x', direction: 1 },
    d: { axis: 'x', direction: 1 }
};

const SUPPORTED_KEYS = Object.keys(KEY_MAP);

/**
 * Normalizes different input sources into a single tilt vector.
 *
 * Public API:
 * - {@link requestPermission} (iOS 13+)
 * - {@link calibrate} (set current pose as neutral)
 * - {@link getTilt} (retrieve normalized tilt vector)
 */
export class InputController {
    /**
     * Constructor - initializes the InputController.
     * @param {Object} callbacks - callback functions for UI updates
     *   - onModeChange: called whenever the input mode changes
     *   - onSensorStatus: called to display sensor status messages
     *   - onCalibrationStart: called when calibration starts
     *   - onCalibrationEnd: called when calibration ends
     */
    constructor(callbacks = {}) {
        // Callback functions used to communicate back to the UI
        this.callbacks = {
            onModeChange: callbacks.onModeChange || DEFAULT_CALLBACK,
            onSensorStatus: callbacks.onSensorStatus || DEFAULT_CALLBACK,
            onCalibrationStart: callbacks.onCalibrationStart || DEFAULT_CALLBACK,
            onCalibrationEnd: callbacks.onCalibrationEnd || DEFAULT_CALLBACK
        };
        
        // Current tilt values (normalized, range [-1, 1])
        this.tilt = { x: 0, y: 0 };
        
        // Current input mode: 'sensor' or 'keyboard'
        this.mode = 'sensor';
        
        // Calibration offset (subtracted from raw sensor values)
        this.calibration = { beta: 0, gamma: 0 };
        
        // Whether calibration has been applied at least once
        this.isCalibrated = false;
        
        // Whether DeviceOrientation/DeviceMotion listeners are active
        this.deviceOrientationActive = false;
        
        // Keyboard key state (for keyboard mode)
        this.keys = { up: false, down: false, left: false, right: false };
        
        // Last raw orientation values (used during calibration)
        this.lastOrientation = { beta: 0, gamma: 0 };
        
        // Touch control: initial finger position for swipe gestures
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchActive = false;
        
        // Initialization: set up all event listeners
        this.init();
    }

    /**
     * Initializes all supported input methods.
     * Detects what is available on the current device and enables it.
     */
    init() {
        this.setupDeviceOrientation();
        this.setupKeyboardControls();
        this.setupTouchControls();
        
        // If no motion sensors are available, immediately fall back to keyboard mode
        if (!window.DeviceOrientationEvent && !window.DeviceMotionEvent) {
            this.switchMode('keyboard');
        } else {
            this.callbacks.onModeChange('Waiting for sensor...');
        }
    }

    /**
     * Sets up DeviceOrientation and DeviceMotion event listeners.
     *
     * Checks which sensors are available:
     * - DeviceOrientation: measures tilt in degrees (beta, gamma)
     * - DeviceMotion: measures acceleration in m/s² (fallback)
     *
     * On iOS 13+ an explicit permission dialog is required (requestPermission).
     */
    setupDeviceOrientation() {
        const hasOrientation = typeof window.DeviceOrientationEvent !== 'undefined';
        const hasMotion = typeof window.DeviceMotionEvent !== 'undefined';
        const useOrientation = hasOrientation;
        const useMotion = !hasOrientation && hasMotion; // motion is used only as a fallback
        
        // No motion sensors available → enforce keyboard mode
        if (!useOrientation && !useMotion) {
            this.callbacks.onSensorStatus('Motion sensors not supported. Keyboard mode only.');
            this.switchMode('keyboard');
            return;
        }

        // Check whether permission is required (iOS 13+).
        const needsPermission =
            (useOrientation && typeof DeviceOrientationEvent.requestPermission === 'function') ||
            (useMotion && typeof DeviceMotionEvent.requestPermission === 'function');
        
        if (needsPermission) {
            this.callbacks.onSensorStatus('Tap "Start Adventure" to enable motion controls.');
        } else {
            this.registerSensorListeners(useOrientation, useMotion);
            this.deviceOrientationActive = true;
            this.callbacks.onSensorStatus('Tilt controls ready.');
            this.switchMode('sensor');
        }
    }

    /**
     * Registers DeviceOrientation/DeviceMotion event listeners.
     * @param {boolean} useOrientation
     * @param {boolean} useMotion
     */
    registerSensorListeners(useOrientation, useMotion) {
        if (useOrientation) {
            window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
        } else if (useMotion) {
            window.addEventListener('devicemotion', this.handleMotion, { passive: true });
        }
    }

    /**
     * DeviceOrientation event handler.
     *
     * Processes tilt sensor data:
     * - beta: front/back tilt of the device (in degrees, -180 to 180)
     * - gamma: left/right tilt of the device (in degrees, -90 to 90)
     *
     * Steps:
     * 1. Validate and sanitize sensor readings (NaN checks)
     * 2. Apply calibration offset (if calibration is active)
     * 3. Normalize to the range [-1, 1] (using max 45° of tilt)
     * 4. Apply smoothing for visually pleasant motion
     *
     * @param {DeviceOrientationEvent} event - DeviceOrientation Event
     */
    handleOrientation = (event) => {
        let beta = event.beta;   // front/back tilt
        let gamma = event.gamma; // left/right tilt
        
        // Validation: guard against NaN or null values
        if (beta === null || beta === undefined || isNaN(beta)) {
            beta = 0;
        }
        if (gamma === null || gamma === undefined || isNaN(gamma)) {
            gamma = 0;
        }
        
        // Store last raw values for potential calibration
        this.lastOrientation.beta = beta;
        this.lastOrientation.gamma = gamma;
        
        // Apply calibration: subtract the stored offsets from the current values
        const calibratedBeta = this.isCalibrated ? beta - this.calibration.beta : beta;
        const calibratedGamma = this.isCalibrated ? gamma - this.calibration.gamma : gamma;
        
        // Normalize to [-1, 1] (45° is treated as max tilt).
        const normalizedY = this.normalizeTilt(calibratedBeta, 45);
        const normalizedX = this.normalizeTilt(calibratedGamma, 45);
        
        // Apply smoothing and update the normalized tilt
        this.applySmoothedTilt(normalizedX, normalizedY);
        
        // Switch to sensor mode if not active yet.
        if (this.mode !== 'sensor') {
            this.switchMode('sensor');
        }
    };

    /**
     * DeviceMotion event handler (accelerometer).
     *
     * Processes acceleration including gravity:
     * - accelerationIncludingGravity.x: acceleration on the X axis (m/s²)
     * - accelerationIncludingGravity.y: acceleration on the Y axis (m/s²)
     *
     * Used only as a fallback when DeviceOrientation is not available.
     * Earth gravity (9.8 m/s²) is used as the maximum magnitude.
     *
     * @param {DeviceMotionEvent} event - DeviceMotion Event
     */
    handleMotion = (event) => {
        if (event.accelerationIncludingGravity) {
            let ax = event.accelerationIncludingGravity.x;
            let ay = event.accelerationIncludingGravity.y;
            
            // Validation
            if (ax === null || ax === undefined || isNaN(ax)) ax = 0;
            if (ay === null || ay === undefined || isNaN(ay)) ay = 0;
            
            // Map acceleration values into pseudo tilt values
            const beta = ay;   // Y acceleration ≈ front/back tilt
            const gamma = ax;  // X acceleration ≈ left/right tilt
            
            // Apply calibration
            const calibratedBeta = this.isCalibrated ? beta - this.calibration.beta : beta;
            const calibratedGamma = this.isCalibrated ? gamma - this.calibration.gamma : gamma;
            
            // Normalize to [-1, 1] (9.8 m/s² ≈ earth gravity, used as max).
            const normalizedY = this.normalizeTilt(calibratedBeta, 9.8);
            const normalizedX = this.normalizeTilt(calibratedGamma, 9.8);
            
            // Apply smoothing.
            this.applySmoothedTilt(normalizedX, normalizedY);
            if (this.mode !== 'sensor') {
                this.switchMode('sensor');
            }
        }
    };

    /**
     * Requests permission for motion sensors (iOS 13+).
     * 
     * On iOS 13+ users must explicitly grant permission for
     * DeviceOrientation/DeviceMotion erteilen. Diese Methode zeigt
     * einen nativen Dialog an.
     * 
     * @returns {Promise<boolean>} true if permission was granted, otherwise false
     */
    async requestPermission() {
        // Already active → no action required.
        if (this.deviceOrientationActive) {
            return true;
        }

        const hasOrientation = typeof DeviceOrientationEvent !== 'undefined';
        const hasMotion = typeof DeviceMotionEvent !== 'undefined';
        const useOrientation = hasOrientation;
        const useMotion = !hasOrientation && hasMotion; // motion only as a fallback
        // Neither orientation nor motion available → keyboard/touch mode only
        if (!useOrientation && !useMotion) {
            this.callbacks.onSensorStatus('Using keyboard/touch controls.');
            this.switchMode('keyboard');
            return false;
        }

        try {
            // Check whether requestPermission is available (iOS 13+)
            const needsOriPermission = useOrientation && typeof DeviceOrientationEvent.requestPermission === 'function';
            const needsMotPermission = useMotion && typeof DeviceMotionEvent.requestPermission === 'function';

            if (needsOriPermission || needsMotPermission) {
                this.callbacks.onSensorStatus('Tap "Allow" in the popup to enable tilt controls.');
                const ori = needsOriPermission ? await DeviceOrientationEvent.requestPermission() : 'denied';
                const mot = needsMotPermission ? await DeviceMotionEvent.requestPermission() : 'denied';
                const granted = (ori === 'granted') || (mot === 'granted');

                if (granted) {
                    this.registerSensorListeners(useOrientation, useMotion);
                    this.deviceOrientationActive = true;
                    this.callbacks.onSensorStatus('Tilt controls enabled! Try tilting your device.');
                    this.switchMode('sensor');
                    return true;
                }

                // Permission denied → fall back to keyboard mode
                this.callbacks.onSensorStatus('Using keyboard/touch controls.');
                this.switchMode('keyboard');
                return false;
            } else {
                this.registerSensorListeners(useOrientation, useMotion);
                this.deviceOrientationActive = true;
                this.callbacks.onSensorStatus('Tilt controls ready (if supported).');
                this.switchMode('sensor');
                return true;
            }
        } catch (error) {
            // Error → fall back to keyboard mode
            this.callbacks.onSensorStatus('Using keyboard/touch controls.');
            this.switchMode('keyboard');
            return false;
        }
    }

    /**
     * Sets up touch-based control (swiping on the canvas).
     *
     * Behaviour:
     * - touchstart: stores the starting finger position
     * - touchmove: computes movement delta and converts it into tilt
     * - touchend: slowly returns tilt back to 0 (smooth fade-out)
     *
     * The swipe distance is mapped into normalized tilt values [-1, 1]:
     * - 100px movement = full tilt (1.0)
     * - Only used while no motion sensors are actively driving the input
     */
    setupTouchControls() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;

        // Touch start: remember the starting finger position
        canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            const touch = event.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchActive = true;
        }, { passive: false });

        // Touch move: convert swipe movement into tilt
        canvas.addEventListener('touchmove', (event) => {
            if (!this.touchActive) return;
            event.preventDefault();
            const touch = event.touches[0];
            
            // Delta between current and starting finger position
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            
            // Normalize: 100px = full tilt (1.0)
            const maxDelta = 100;
            const targetX = Math.max(-1, Math.min(1, deltaX / maxDelta));
            const targetY = Math.max(-1, Math.min(1, deltaY / maxDelta));
            
            // Apply tilt with smoothing
            this.applySmoothedTilt(targetX, targetY);
            
            // Switch to keyboard/touch mode if sensors are not active.
            if (!this.deviceOrientationActive) {
                this.switchMode('keyboard');
            }
        }, { passive: false });

        // Touch end: gently fade tilt back to zero
        canvas.addEventListener('touchend', (event) => {
            event.preventDefault();
            this.touchActive = false;
            
            // Only reset manually if no motion sensors are active
            if (!this.deviceOrientationActive) {
                // Smooth fade-out: gradually reduce tilt back to 0
                const loop = () => {
                    if (this.tilt.x !== 0 || this.tilt.y !== 0) {
                        this.applySmoothedTilt(0, 0);
                        // Weiter ausklingen lassen, bis fast bei 0
                        if (Math.abs(this.tilt.x) > 0.01 || Math.abs(this.tilt.y) > 0.01) {
                            requestAnimationFrame(loop);
                        }
                    }
                };
                loop();
            }
        }, { passive: false });
    }

    /**
     * Sets up keyboard controls (arrow keys or WASD).
     *
     * Supported keys:
     * - Arrow keys or WASD
     * - W/↑ = up (tilt.y = -1)
     * - S/↓ = down (tilt.y = +1)
     * - A/← = left (tilt.x = -1)
     * - D/→ = right (tilt.x = +1)
     *
     * Behaviour:
     * - keydown/keyup: updates the key state
     * - animation loop: continuously converts key state into tilt values
     * - combinations are possible (e.g. W + D = diagonal up-right)
     */
    setupKeyboardControls() {
        const updateKeyFromEvent = (key, pressed) => {
            const mapping = KEY_MAP[key];
            if (!mapping) return;
            if (mapping.axis === 'x') {
                this.keys[mapping.direction === 1 ? 'right' : 'left'] = pressed;
            } else {
                this.keys[mapping.direction === 1 ? 'down' : 'up'] = pressed;
            }
        };

        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (!SUPPORTED_KEYS.includes(key)) return;
            event.preventDefault();
            updateKeyFromEvent(key, true);
            if (!this.deviceOrientationActive) this.switchMode('keyboard');
        });

        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (!SUPPORTED_KEYS.includes(key)) return;
            event.preventDefault();
            updateKeyFromEvent(key, false);
            if (!this.keys.up && !this.keys.down && !this.keys.left && !this.keys.right) {
                this.tilt.x = 0;
                this.tilt.y = 0;
            }
        });

        // Continuous loop: convert current key state into tilt values
        const loop = () => {
            const hasKeyPressed = this.keys.up || this.keys.down || this.keys.left || this.keys.right;
            
            if (hasKeyPressed) {
                // Compute target tilt based on currently pressed keys
                // Combinations are supported: e.g. right + up = (1, -1)
                const targetX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
                const targetY = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
                
                // Apply smoothed tilt
                this.applySmoothedTilt(targetX, targetY);
                
                if (this.mode !== 'keyboard') {
                    this.switchMode('keyboard');
                }
            } else {
                // No key pressed → reset tilt to 0 (only in keyboard mode)
                if (this.mode === 'keyboard' && !this.deviceOrientationActive) {
                    this.tilt.x = 0;
                    this.tilt.y = 0;
                }
            }
            
            // Next frame
            requestAnimationFrame(loop);
        };
        loop();
    }

    /**
     * Switches the active input mode and notifies the UI.
     * @param {string} mode - 'sensor' oder 'keyboard'
     */
    switchMode(mode) {
        if (this.mode === mode) return; // No change needed
        this.mode = mode;
        const message = mode === 'sensor'
            ? 'Tilt your device to play'
            : 'Keyboard mode active (Arrow keys or WASD)';
        this.callbacks.onModeChange(message);
    }

    /**
     * Normalizes a sensor value into the range [-1, 1].
     *
     * @param {number} value - raw sensor value (degrees or m/s²)
     * @param {number} maxDegrees - maximum value for full tilt (e.g. 45° or 9.8 m/s²)
     * @returns {number} normalized value in the range [-1, 1], or 0 if very small (< 0.01)
     *
     * Examples:
     * - normalizeTilt(22.5, 45) → 0.5 (half of the maximum tilt)
     * - normalizeTilt(45, 45) → 1.0 (full tilt)
     * - normalizeTilt(0.1, 45) → 0 (too small, treated as no movement)
     */
    normalizeTilt(value, maxDegrees) {
        // Begrenze Wert auf [-maxDegrees, maxDegrees]
        const clamped = Math.max(-maxDegrees, Math.min(maxDegrees, value));
        
        // Normalize to [-1, 1]
        const normalized = clamped / maxDegrees;
        
        // Runde sehr kleine Werte auf 0 (verhindert Zittern)
        return Math.abs(normalized) < 0.01 ? 0 : normalized;
    }

    /**
     * Applies smoothed tilt using linear interpolation.
     *
     * Uses linear interpolation (lerp) for smooth movements:
     * newValue = oldValue * (1 - smoothing) + targetValue * smoothing
     * 
     * Different smoothing values per mode:
     * - Keyboard: smoothing = 0.75 (slower, more controlled movement)
     * - Sensor: smoothing = 0.4 (faster, more responsive movement)
     *
     * @param {number} targetX - target tilt on X axis [-1, 1]
     * @param {number} targetY - target tilt on Y axis [-1, 1]
     */
    applySmoothedTilt(targetX, targetY) {
        const smoothing = this.mode === 'keyboard' ? 0.75 : 0.4;
        if (this.mode === 'keyboard' && targetX === 0 && targetY === 0) {
            this.tilt.x = 0;
            this.tilt.y = 0;
        } else {
            this.tilt.x = this.tilt.x * (1 - smoothing) + targetX * smoothing;
            this.tilt.y = this.tilt.y * (1 - smoothing) + targetY * smoothing;
        }
    }

    /**
     * Calibrates all active motion sensors.
     *
     * Treats the current device orientation as the neutral position (0° tilt).
     * All subsequent sensor readings are corrected using this offset.
     *
     * Steps:
     * 1. Store the current beta/gamma values as calibration offsets
     * 2. Reset tilt values back to 0
     * 3. Mark calibration as active
     * 4. Notify the UI when calibration starts and finishes
     */
    calibrate() {
        this.callbacks.onCalibrationStart();
        
        if (this.deviceOrientationActive) {
            // Speichere aktuelle Sensordaten als Offset
            this.calibration.beta = this.lastOrientation.beta;
            this.calibration.gamma = this.lastOrientation.gamma;
            this.isCalibrated = true;
            this.tilt.x = 0;
            this.tilt.y = 0;
        } else {
            // No motion sensors → simply reset tilt values
            this.tilt.x = 0;
            this.tilt.y = 0;
        }
        
        // Notify the UI after 600ms that calibration has completed
        setTimeout(() => {
            this.callbacks.onCalibrationEnd();
        }, 600);
    }

    /**
     * Returns the current normalized tilt values.
     *
     * @returns {Object} copy of the current tilt values { x: number, y: number }
     *                   both in the range [-1, 1]
     */
    getTilt() {
        return { ...this.tilt }; // Return a copy (prevents external mutation)
    }
}

