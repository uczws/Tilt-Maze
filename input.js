/**
 * =============================================================
 * Input Module (Eingabemodul)
 * -------------------------------------------------------------
 * 
 * ZWECK:
 * Dieses Modul verwaltet alle Eingabemethoden für das Tilt Maze Spiel.
 * Es normalisiert Sensordaten (Neigungssensor, Beschleunigungssensor) und
 * bietet Fallback-Methoden (Tastatur, Touch), sodass die Physik-Engine
 * immer Neigungswerte im Bereich [-1, 1] erhält.
 * 
 * EINGABEMETHODEN:
 * 1. DeviceOrientation (Neigungssensor) - Primär für mobile Geräte
 *    - Misst die Neigung des Geräts in Grad (beta = Vor-/Zurückneigung, gamma = Links/Rechts)
 *    - Wird automatisch aktiviert, wenn verfügbar
 *    - Benötigt auf iOS 13+ eine Benutzerberechtigung
 * 
 * 2. DeviceMotion (Beschleunigungssensor) - Alternative für Geräte ohne DeviceOrientation
 *    - Misst die Beschleunigung inkl. Gravitation (m/s²)
 *    - Wird verwendet, wenn DeviceOrientation nicht verfügbar ist
 * 
 * 3. Tastatur (Fallback) - Für Desktop/PC
 *    - Pfeiltasten oder WASD
 *    - Wird automatisch aktiviert, wenn keine Sensoren verfügbar sind
 * 
 * 4. Touch (Fallback) - Für Geräte ohne Sensoren
 *    - Wischen auf dem Canvas steuert die Neigung
 *    - Wird verwendet, wenn weder Sensoren noch Tastatur aktiv sind
 * 
 * KALIBRIERUNG:
 * - Ermöglicht es, die aktuelle Geräteposition als "neutral" zu setzen
 * - Speichert die aktuellen beta/gamma Werte als Offset
 * - Alle nachfolgenden Sensordaten werden um diesen Offset korrigiert
 * 
 * NORMALISIERUNG:
 * - Konvertiert Sensordaten (Grad oder m/s²) in normalisierte Werte [-1, 1]
 * - DeviceOrientation: maxDegrees = 45° (maximale Neigung)
 * - DeviceMotion: maxDegrees = 9.8 m/s² (Erdbeschleunigung)
 * 
 * GLÄTTUNG:
 * - Verwendet lineare Interpolation (Lerp) für sanfte Bewegungen
 * - Sensor-Modus: smoothing = 0.4 (schnellere Reaktion)
 * - Tastatur-Modus: smoothing = 0.75 (langsamere, kontrolliertere Bewegung)
 * 
 * MODI:
 * - 'sensor': Aktive Sensoren (DeviceOrientation oder DeviceMotion)
 * - 'keyboard': Tastatur- oder Touch-Steuerung
 * 
 * =============================================================
 */

const DEFAULT_CALLBACK = () => {};

export class InputController {
    /**
     * Konstruktor - Initialisiert den InputController
     * @param {Object} callbacks - Callback-Funktionen für UI-Updates
     *   - onModeChange: Wird aufgerufen, wenn sich der Eingabemodus ändert
     *   - onSensorStatus: Wird aufgerufen, um Sensor-Status anzuzeigen
     *   - onCalibrationStart: Wird aufgerufen, wenn Kalibrierung startet
     *   - onCalibrationEnd: Wird aufgerufen, wenn Kalibrierung endet
     */
    constructor(callbacks = {}) {
        // Callback-Funktionen für UI-Kommunikation
        this.callbacks = {
            onModeChange: callbacks.onModeChange || DEFAULT_CALLBACK,
            onSensorStatus: callbacks.onSensorStatus || DEFAULT_CALLBACK,
            onCalibrationStart: callbacks.onCalibrationStart || DEFAULT_CALLBACK,
            onCalibrationEnd: callbacks.onCalibrationEnd || DEFAULT_CALLBACK
        };
        
        // Aktuelle Neigungswerte (normalisiert, Bereich [-1, 1])
        this.tilt = { x: 0, y: 0 };
        
        // Aktueller Eingabemodus: 'sensor' oder 'keyboard'
        this.mode = 'sensor';
        
        // Kalibrierungs-Offset (wird von aktuellen Sensordaten abgezogen)
        this.calibration = { beta: 0, gamma: 0 };
        
        // Ob die Kalibrierung aktiv ist
        this.isCalibrated = false;
        
        // Ob DeviceOrientation/DeviceMotion aktiv ist
        this.deviceOrientationActive = false;
        
        // Zustand der Tastaturtasten (für Keyboard-Modus)
        this.keys = { up: false, down: false, left: false, right: false };
        
        // Letzte Sensordaten (für Kalibrierung)
        this.lastOrientation = { beta: 0, gamma: 0 };
        
        // Touch-Steuerung: Startposition beim Wischen
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchActive = false;
        
        // Initialisierung: Event-Listener einrichten
        this.init();
    }

    /**
     * Initialisierung - Richtet alle Eingabemethoden ein
     * Prüft, welche Eingabemethoden verfügbar sind und aktiviert sie entsprechend
     */
    init() {
        this.setupDeviceOrientation();
        this.setupKeyboardControls();
        this.setupTouchControls();
        
        // Wenn keine Sensoren verfügbar sind, sofort auf Tastatur-Modus wechseln
        if (!window.DeviceOrientationEvent && !window.DeviceMotionEvent) {
            this.switchMode('keyboard');
        } else {
            this.callbacks.onModeChange('Waiting for sensor...');
        }
    }

    /**
     * Richtet DeviceOrientation und DeviceMotion Event-Listener ein
     * 
     * Prüft, welche Sensoren verfügbar sind:
     * - DeviceOrientation: Misst Neigung in Grad (beta, gamma)
     * - DeviceMotion: Misst Beschleunigung in m/s² (Fallback)
     * 
     * Auf iOS 13+ wird eine Benutzerberechtigung benötigt (requestPermission)
     */
    setupDeviceOrientation() {
        const hasOrientation = typeof window.DeviceOrientationEvent !== 'undefined';
        const hasMotion = typeof window.DeviceMotionEvent !== 'undefined';
        
        // Keine Sensoren verfügbar → Tastatur-Modus
        if (!hasOrientation && !hasMotion) {
            this.callbacks.onSensorStatus('Motion sensors not supported. Keyboard mode only.');
            this.switchMode('keyboard');
            return;
        }

        // Prüft, ob eine Berechtigung benötigt wird (iOS 13+)
        const needsPermission = (hasOrientation && typeof DeviceOrientationEvent.requestPermission === 'function') ||
                               (hasMotion && typeof DeviceMotionEvent.requestPermission === 'function');
        
        if (needsPermission) {
            // Benutzer muss Berechtigung erteilen (wird über requestPermission() gemacht)
            this.callbacks.onSensorStatus('Tap "Start Adventure" to enable motion controls.');
        } else {
            // Sensoren sind sofort verfügbar → Event-Listener registrieren
            if (hasOrientation) {
                window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
            }
            if (hasMotion) {
                window.addEventListener('devicemotion', this.handleMotion, { passive: true });
            }
            this.deviceOrientationActive = true;
            this.callbacks.onSensorStatus('Tilt controls ready.');
            this.switchMode('sensor');
        }
    }

    /**
     * Event-Handler für DeviceOrientation
     * 
     * Verarbeitet Neigungssensordaten:
     * - beta: Vor-/Zurückneigung des Geräts (in Grad, -180 bis 180)
     * - gamma: Links/Rechts-Neigung des Geräts (in Grad, -90 bis 90)
     * 
     * Prozess:
     * 1. Validiert und bereinigt Sensordaten (NaN-Check)
     * 2. Wendet Kalibrierungs-Offset an (falls kalibriert)
     * 3. Normalisiert auf [-1, 1] Bereich (max 45° Neigung)
     * 4. Glättet die Werte für sanfte Bewegung
     * 
     * @param {DeviceOrientationEvent} event - DeviceOrientation Event
     */
    handleOrientation = (event) => {
        let beta = event.beta;   // Vor-/Zurückneigung
        let gamma = event.gamma; // Links/Rechts-Neigung
        
        // Validierung: NaN oder null-Werte abfangen
        if (beta === null || beta === undefined || isNaN(beta)) {
            beta = 0;
        }
        if (gamma === null || gamma === undefined || isNaN(gamma)) {
            gamma = 0;
        }
        
        // Speichere für Kalibrierung
        this.lastOrientation.beta = beta;
        this.lastOrientation.gamma = gamma;
        
        // Kalibrierung anwenden: Subtrahiere Offset von aktuellen Werten
        const calibratedBeta = this.isCalibrated ? beta - this.calibration.beta : beta;
        const calibratedGamma = this.isCalibrated ? gamma - this.calibration.gamma : gamma;
        
        // Normalisiere auf [-1, 1] Bereich (45° = Maximum)
        const normalizedY = this.normalizeTilt(calibratedBeta, 45);
        const normalizedX = this.normalizeTilt(calibratedGamma, 45);
        
        // Glättung anwenden und Neigungswerte aktualisieren
        this.applySmoothedTilt(normalizedX, normalizedY);
        
        // Wechsle zu Sensor-Modus, falls noch nicht aktiv
        if (this.mode !== 'sensor') {
            this.switchMode('sensor');
        }
    };

    /**
     * Event-Handler für DeviceMotion (Beschleunigungssensor)
     * 
     * Verarbeitet Beschleunigungsdaten inkl. Gravitation:
     * - accelerationIncludingGravity.x: Beschleunigung in X-Richtung (m/s²)
     * - accelerationIncludingGravity.y: Beschleunigung in Y-Richtung (m/s²)
     * 
     * Wird als Fallback verwendet, wenn DeviceOrientation nicht verfügbar ist.
     * Die Erdbeschleunigung (9.8 m/s²) wird als Maximum verwendet.
     * 
     * @param {DeviceMotionEvent} event - DeviceMotion Event
     */
    handleMotion = (event) => {
        if (event.accelerationIncludingGravity) {
            let ax = event.accelerationIncludingGravity.x;
            let ay = event.accelerationIncludingGravity.y;
            
            // Validierung
            if (ax === null || ax === undefined || isNaN(ax)) ax = 0;
            if (ay === null || ay === undefined || isNaN(ay)) ay = 0;
            
            // Beschleunigung → Neigung umwandeln
            const beta = ay;   // Y-Beschleunigung = Vor-/Zurückneigung
            const gamma = ax;  // X-Beschleunigung = Links/Rechts-Neigung
            
            // Kalibrierung anwenden
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

        // DeviceOrientation nicht verfügbar → Tastatur-Modus
        if (typeof DeviceOrientationEvent === 'undefined') {
            this.callbacks.onSensorStatus('Using keyboard/touch controls.');
            this.switchMode('keyboard');
            return false;
        }

        try {
            // Prüft, ob requestPermission verfügbar ist (iOS 13+)
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                this.callbacks.onSensorStatus('Tap "Allow" in the popup to enable tilt controls.');
                const permission = await DeviceOrientationEvent.requestPermission();
                
                if (permission === 'granted') {
                    // Berechtigung erteilt → Event-Listener registrieren
                    window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
                    this.deviceOrientationActive = true;
                    this.callbacks.onSensorStatus('Tilt controls enabled! Try tilting your device.');
                    this.switchMode('sensor');
                    return true;
                } else {
                    // Berechtigung verweigert → Tastatur-Modus
                    this.callbacks.onSensorStatus('Using keyboard/touch controls.');
                    this.switchMode('keyboard');
                    return false;
                }
            } else {
                // Keine Berechtigung nötig (ältere iOS-Versionen, Android) → direkt aktivieren
                window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
                this.deviceOrientationActive = true;
                this.callbacks.onSensorStatus('Tilt controls ready (if supported).');
                this.switchMode('sensor');
                return true;
            }
        } catch (error) {
            // Fehler → Fallback auf Tastatur
            this.callbacks.onSensorStatus('Using keyboard/touch controls.');
            this.switchMode('keyboard');
            return false;
        }
    }

    /**
     * Richtet Touch-Steuerung ein (Wischen auf dem Canvas)
     * 
     * Funktionsweise:
     * - touchstart: Speichert Startposition des Fingers
     * - touchmove: Berechnet Delta (Bewegung) und konvertiert zu Neigung
     * - touchend: Setzt Neigung langsam auf 0 zurück (sanftes Ausklingen)
     * 
     * Die Wischbewegung wird in Neigungswerte [-1, 1] umgewandelt:
     * - 100px Wisch = maximale Neigung (1.0)
     * - Wird nur verwendet, wenn keine Sensoren aktiv sind
     */
    setupTouchControls() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;

        // Touch-Start: Speichere Startposition
        canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            const touch = event.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchActive = true;
        }, { passive: false });

        // Touch-Bewegung: Konvertiere Wischbewegung zu Neigung
        canvas.addEventListener('touchmove', (event) => {
            if (!this.touchActive) return;
            event.preventDefault();
            const touch = event.touches[0];
            
            // Berechne Delta (Bewegung seit touchstart)
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            
            // Normalisiere: 100px = maximale Neigung (1.0)
            const maxDelta = 100;
            const targetX = Math.max(-1, Math.min(1, deltaX / maxDelta));
            const targetY = Math.max(-1, Math.min(1, deltaY / maxDelta));
            
            // Wende Neigung an
            this.applySmoothedTilt(targetX, targetY);
            
            // Wechsle zu Keyboard-Modus, falls keine Sensoren aktiv
            if (!this.deviceOrientationActive) {
                this.switchMode('keyboard');
            }
        }, { passive: false });

        // Touch-Ende: Setze Neigung sanft auf 0 zurück
        canvas.addEventListener('touchend', (event) => {
            event.preventDefault();
            this.touchActive = false;
            
            // Nur zurücksetzen, wenn keine Sensoren aktiv sind
            if (!this.deviceOrientationActive) {
                // Sanftes Ausklingen: Reduziere Neigung schrittweise auf 0
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
     * Richtet Tastatur-Steuerung ein (Pfeiltasten oder WASD)
     * 
     * Unterstützte Tasten:
     * - Pfeiltasten oder WASD
     * - W/↑ = nach oben (tilt.y = -1)
     * - S/↓ = nach unten (tilt.y = +1)
     * - A/← = nach links (tilt.x = -1)
     * - D/→ = nach rechts (tilt.x = +1)
     * 
     * Funktionsweise:
     * - keydown/keyup: Aktualisiert Tastenstatus
     * - Animation-Loop: Konvertiert Tastenstatus kontinuierlich zu Neigungswerten
     * - Kombinationen möglich (z.B. W+D = diagonal oben-rechts)
     */
    setupKeyboardControls() {
        // Tastendruck: Setze Tastenstatus auf true
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            // Nur relevante Tasten verarbeiten
            if (!['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
                return;
            }
            event.preventDefault();
            
            // Aktualisiere Tastenstatus
            switch (key) {
                case 'arrowup':
                case 'w':
                    this.keys.up = true;
                    break;
                case 'arrowdown':
                case 's':
                    this.keys.down = true;
                    break;
                case 'arrowleft':
                case 'a':
                    this.keys.left = true;
                    break;
                case 'arrowright':
                case 'd':
                    this.keys.right = true;
                    break;
            }
            
            // Wechsle zu Keyboard-Modus, falls keine Sensoren aktiv
            if (!this.deviceOrientationActive) {
                this.switchMode('keyboard');
            }
        });

        // Tastenloslassen: Setze Tastenstatus auf false
        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (!['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
                return;
            }
            event.preventDefault();
            
            // Aktualisiere Tastenstatus
            switch (key) {
                case 'arrowup':
                case 'w':
                    this.keys.up = false;
                    break;
                case 'arrowdown':
                case 's':
                    this.keys.down = false;
                    break;
                case 'arrowleft':
                case 'a':
                    this.keys.left = false;
                    break;
                case 'arrowright':
                case 'd':
                    this.keys.right = false;
                    break;
            }
            
            // Wenn keine Taste mehr gedrückt, Neigung auf 0 setzen
            if (!this.keys.up && !this.keys.down && !this.keys.left && !this.keys.right) {
                this.tilt.x = 0;
                this.tilt.y = 0;
            }
        });

        // Kontinuierliche Loop: Konvertiert Tastenstatus zu Neigungswerten
        const loop = () => {
            const hasKeyPressed = this.keys.up || this.keys.down || this.keys.left || this.keys.right;
            
            if (hasKeyPressed) {
                // Berechne Ziel-Neigung basierend auf gedrückten Tasten
                // Kombinationen möglich: z.B. rechts + oben = (1, -1)
                const targetX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
                const targetY = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
                
                // Wende glättete Neigung an
                this.applySmoothedTilt(targetX, targetY);
                
                if (this.mode !== 'keyboard') {
                    this.switchMode('keyboard');
                }
            } else {
                // Keine Taste gedrückt → Neigung auf 0 (nur im Keyboard-Modus)
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
     * Wechselt den Eingabemodus und benachrichtigt UI
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
     * Normalisiert einen Sensormesswert auf den Bereich [-1, 1]
     * 
     * @param {number} value - Roher Sensormesswert (Grad oder m/s²)
     * @param {number} maxDegrees - Maximaler Wert für volle Neigung (z.B. 45° oder 9.8 m/s²)
     * @returns {number} Normalisierter Wert im Bereich [-1, 1], oder 0 wenn zu klein (< 0.01)
     * 
     * Beispiel:
     * - normalizeTilt(22.5, 45) → 0.5 (halb maximale Neigung)
     * - normalizeTilt(45, 45) → 1.0 (maximale Neigung)
     * - normalizeTilt(0.1, 45) → 0 (zu klein, wird zu 0 gerundet)
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
     * Wendet glättete Neigung an (Lineare Interpolation)
     * 
     * Verwendet lineare Interpolation (Lerp) für sanfte Bewegungen:
     * newValue = oldValue * (1 - smoothing) + targetValue * smoothing
     * 
     * Unterschiedliche Glättung je nach Modus:
     * - Keyboard: smoothing = 0.75 (langsamere, kontrolliertere Bewegung)
     * - Sensor: smoothing = 0.4 (schnellere Reaktion auf Sensordaten)
     * 
     * @param {number} targetX - Ziel-Neigung X-Achse [-1, 1]
     * @param {number} targetY - Ziel-Neigung Y-Achse [-1, 1]
     */
    applySmoothedTilt(targetX, targetY) {
        if (this.mode === 'keyboard') {
            // Keyboard-Modus: Sofort auf 0 setzen, wenn keine Eingabe
            if (targetX === 0 && targetY === 0) {
                this.tilt.x = 0;
                this.tilt.y = 0;
            } else {
                // Langsamere Glättung für präzisere Tastatursteuerung
                const smoothing = 0.75;
                this.tilt.x = this.tilt.x * (1 - smoothing) + targetX * smoothing;
                this.tilt.y = this.tilt.y * (1 - smoothing) + targetY * smoothing;
            }
        } else {
            // Sensor-Modus: Schnellere Glättung für natürlichere Bewegung
            const smoothing = 0.4;
            this.tilt.x = this.tilt.x * (1 - smoothing) + targetX * smoothing;
            this.tilt.y = this.tilt.y * (1 - smoothing) + targetY * smoothing;
        }
    }

    /**
     * Kalibriert die Sensoren
     * 
     * Setzt die aktuelle Geräteposition als "neutral" (0° Neigung).
     * Alle nachfolgenden Sensordaten werden um diesen Offset korrigiert.
     * 
     * Prozess:
     * 1. Speichert aktuelle beta/gamma Werte als Kalibrierungs-Offset
     * 2. Setzt Neigungswerte auf 0
     * 3. Aktiviert Kalibrierungs-Flag
     * 4. Benachrichtigt UI (Start/Ende)
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
            // Keine Sensoren → einfach Neigung zurücksetzen
            this.tilt.x = 0;
            this.tilt.y = 0;
        }
        
        // Benachrichtige UI nach 600ms, dass Kalibrierung abgeschlossen ist
        setTimeout(() => {
            this.callbacks.onCalibrationEnd();
        }, 600);
    }

    /**
     * Gibt die aktuellen Neigungswerte zurück
     * 
     * @returns {Object} Kopie der aktuellen Neigungswerte { x: number, y: number }
     *                   Werte sind im Bereich [-1, 1]
     */
    getTilt() {
        return { ...this.tilt }; // Kopie zurückgeben (verhindert externe Manipulation)
    }
}

