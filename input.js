/**
 * =============================================================
 * Input Module
 * -------------------------------------------------------------
 *
 * PURPOSE:
 * Central module that manages all input methods for the Tilt Maze game.
 * It normalizes sensor data (orientation and motion) and exposes
 * keyboard/touch fallbacks so that the physics engine always receives
 * tilt values in the range [-1, 1].
 *
 * INPUT METHODS:
 * 1. DeviceOrientation (tilt sensor) – primary for mobile devices
 *    - Measures device tilt in degrees (beta = front/back tilt, gamma = left/right tilt)
 *    - Is used automatically when available
 *    - Requires explicit user permission on iOS 13+
 *
 * 2. DeviceMotion (accelerometer) – alternative when DeviceOrientation is not available
 *    - Measures acceleration including gravity (m/s²)
 *    - Is only used as a fallback if DeviceOrientation cannot be used
 *
 * 3. Keyboard (fallback) – for desktop / laptops
 *    - Arrow keys or WASD
 *    - Is used automatically when no motion sensors are available
 *
 * 4. Touch (fallback) – for devices without motion sensors
 *    - Swiping on the canvas controls the tilt direction
 *    - Is used when neither sensors nor keyboard input are active
 *
 * CALIBRATION:
 * - Allows treating the current device orientation as the neutral position
 * - Stores the current beta/gamma values as offsets
 * - All subsequent sensor readings are corrected by this offset
 *
 * NORMALIZATION:
 * - Converts sensor readings (degrees or m/s²) into normalized values [-1, 1]
 * - DeviceOrientation: maxDegrees = 45° (maximum considered tilt)
 * - DeviceMotion: maxDegrees = 9.8 m/s² (gravity on Earth)
 *
 * SMOOTHING:
 * - Uses linear interpolation (lerp) for smooth movement
 * - Sensor mode: smoothing = 0.4 (faster reactions)
 * - Keyboard mode: smoothing = 0.75 (slower, more controlled motion)
 *
 * MODES:
 * - 'sensor': active motion sensors (DeviceOrientation or DeviceMotion)
 * - 'keyboard': keyboard- or touch-driven control
 *
 * =============================================================
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

        // Prüft, ob eine Berechtigung benötigt wird (iOS 13+)
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
     * Registriert DeviceOrientation/DeviceMotion Event-Listener
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
        
        // Normalisiere auf [-1, 1] Bereich (45° = Maximum)
        const normalizedY = this.normalizeTilt(calibratedBeta, 45);
        const normalizedX = this.normalizeTilt(calibratedGamma, 45);
        
        // Apply smoothing and update the normalized tilt
        this.applySmoothedTilt(normalizedX, normalizedY);
        
        // Wechsle zu Sensor-Modus, falls noch nicht aktiv
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
            
            // Normalisiere auf [-1, 1] Bereich (9.8 m/s² = Maximum = Erdbeschleunigung)
            const normalizedY = this.normalizeTilt(calibratedBeta, 9.8);
            const normalizedX = this.normalizeTilt(calibratedGamma, 9.8);
            
            // Glättung anwenden
            this.applySmoothedTilt(normalizedX, normalizedY);
            if (this.mode !== 'sensor') {
                this.switchMode('sensor');
            }
        }
    };

    /**
     * Fordert Berechtigung für Sensoren an (iOS 13+)
     * 
     * Auf iOS 13+ müssen Benutzer explizit die Berechtigung für
     * DeviceOrientation/DeviceMotion erteilen. Diese Methode zeigt
     * einen nativen Dialog an.
     * 
     * @returns {Promise<boolean>} true wenn Berechtigung erteilt wurde, sonst false
     */
    async requestPermission() {
        // Bereits aktiv → keine Aktion nötig
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
            
            // Wechsle zu Keyboard-Modus, falls keine Sensoren aktiv
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
            
            // Nächster Frame
            requestAnimationFrame(loop);
        };
        loop();
    }

    /**
     * Switches the active input mode and notifies the UI.
     * @param {string} mode - 'sensor' oder 'keyboard'
     */
    switchMode(mode) {
        if (this.mode === mode) return; // Keine Änderung nötig
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
        
        // Normalisiere auf [-1, 1]
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
        return { ...this.tilt }; // Kopie zurückgeben (verhindert externe Manipulation)
    }
}

