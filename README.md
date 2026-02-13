# Tilt Maze – HTML5 Tilt-Controlled Labyrinth Game

## Overview

Tilt Maze is an HTML5-based browser game where you guide a ball through a maze. The main interaction is **tilting the device** using motion sensors (DeviceOrientation / DeviceMotion) on mobile, with **keyboard** and **touch gestures** as fallbacks on desktop or devices without sensors.

The project was created for the *Mobile Computing* course and demonstrates modern web APIs, responsive UI design and a non-trivial game implementation (physics, level system, persistent progress).

---

## Table of Contents

- [Overview](#overview)
- [Table of Contents](#table-of-contents)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation & Running Locally](#installation--running-locally)
- [Controls](#controls)
- [Responsive Behavior](#responsive-behavior)
- [Technical Aspects](#technical-aspects)
- [Possible Future Extensions / Bonus Ideas](#possible-future-extensions--bonus-ideas)
- [License](#license)

---

## Features

- **HTML5 Motion & Orientation Sensors**
  - Uses `DeviceOrientationEvent` / `DeviceMotionEvent` to read tilt and acceleration.
  - Calibration feature to treat the current device pose as neutral (zero tilt).
  - Graceful fallback to keyboard (WASD / arrow keys) and touch swipes when sensors are not available or permission is denied.

- **Canvas Rendering**
  - The maze and ball are drawn on an HTML `<canvas>`.
  - Grid-based rendering of walls, holes and the goal socket.
  - Smooth animation loop powered by `requestAnimationFrame`.

- **Custom Physics Engine (`physics.js`)**
  - **Circle-to-AABB collision handling**: detects collisions between the ball (circle) and wall cells (axis-aligned rectangles) by computing the closest point on each wall cell and resolving the overlap.
  - **Dynamic response**: uses an elastic collision response (reflection of the velocity vector along the collision normal) so the ball bounces realistically off walls.
  - **Friction & inertia**: applies a friction coefficient of approximately \(0.96\) per frame to create "ice-physics" where the ball gradually comes to rest, mimicking a heavy marble on a smooth surface.
  - **Sensor integration**: translates normalized tilt vectors from the input system into acceleration forces, clamped to a configured `maxSpeed` to keep the game controllable and fun.

- **Multiple Levels & Progress Tracking**
  - Level layouts are defined in `levels.js` as 2D grids.
  - Finished levels are marked as completed; best times per level are stored.
  - Progress (completed levels and best times) is persisted using **`localStorage`**.

- **Responsive UI & Mobile Optimization**
  - Layout adapts to different screen sizes (phone, tablet, laptop/desktop).
  - Mobile-only UI elements:
    - burger menu,
    - separate level selection overlay,
    - bottom action buttons such as the calibrate button,
    - orientation hint for rotating to landscape.
  - Uses `meta viewport` and a dynamic CSS variable `--app-height` to handle changing viewport heights in mobile browsers (browser UI chrome, address bar).

- **User-Friendly Interface**
  - Start screen with a short explanation for mobile and desktop controls.
  - HUD with hearts/lives, level title, elapsed time and actions (Pause, Restart, Levels, Main Menu).
  - Overlay screens for pause, win and lose, including best-time information.
  - Accessibility considerations: ARIA labels and `aria-live` regions for status updates.

---

## Project Structure

- `index.html`  
  Root document that sets up the canvas, HUD and the different overlay screens (start, pause, win, lose, level selection, burger menu) and loads the JavaScript modules.

- `styles.css`  
  Global styles for layout, typography, HUD, buttons, overlays and responsive breakpoints.

- `game.js`  
  Application entry point and main game engine:
  - wires together input, physics, rendering and UI,
  - implements the game loop via `requestAnimationFrame`,
  - loads level data,
  - handles win/lose conditions, lives and level transitions,
  - saves and loads progress from `localStorage`.

- `input.js`  
  Input abstraction:
  - processes DeviceOrientation / DeviceMotion sensor data,
  - keyboard controls (WASD and arrow keys),
  - touch swipe controls on the canvas,
  - implements calibration and smoothing of the tilt values.

- `physics.js`  
  Physics module:
  - `BallState` class with position, velocity, radius, friction and maximum speed,
  - per-frame update: integration, friction, wall collisions, hole and goal detection.

- `renderer.js`  
  Canvas renderer responsible for drawing the grid-based maze and the ball.

- `ui.js`  
  UI state manager:
  - shows/hides screens and overlays,
  - updates HUD (time, lives, level title),
  - displays sensor and calibration messages,
  - manages level-selection grids and completed markers,
  - exposes callbacks that the game engine can hook into (start, pause, restart, next level, etc.).

- `levels.js`  
  Contains level definitions (2D arrays, start/goal positions, level names) and helper functions to retrieve individual levels.

- `constants.js`  
  Shared constants such as `CELL_TYPES`, `MAX_LIVES`, `STORAGE_KEY` and other configuration values.

---

## Installation & Running Locally

1. **Clone or download the repository**

   ```bash
   git clone <REPO_URL>
   cd Tilt-MAZE/Tilt-Maze
   ```

2. **Start the project locally**

   **Option A – Open directly in the browser**  
   This may work for some browsers, but sensor APIs often require a proper origin:
   - Open `index.html` in your browser (double-click or drag & drop into the browser).

   **Option B – Use a local web server (recommended)**  
   For sensor APIs and consistent behavior, run a small HTTP server, for example:

   ```bash
   npx serve .
   ```

   Then open the URL shown in the terminal (for example `http://localhost:3000`) in your browser.

3. **Allow motion sensor access (mobile devices)**
   - On iOS/Android browsers:
     - The first time you start the game, the browser may show a permission dialog asking for access to motion and orientation sensors.
     - Choose “Allow” so that tilt controls work.
   - If you deny permission or your browser does not support these APIs, you can still play using the keyboard or touch swipe controls.

---

## Controls

- **Mobile (phone/tablet)**
  - Tilt the device gently to roll the ball through the maze.
  - Alternatively, swipe on the canvas to move the ball when sensors are not active.
  - Use the **Calibrate** button to set the current device orientation as the neutral reference.

- **Desktop**
  - Use arrow keys or WASD to simulate tilting the board.
  - Use the HUD buttons or the appropriate keys (depending on the browser) to pause, restart or return to the main menu.

---

## Responsive Behavior

- The layout scales from small phone screens to large desktop displays.
- Breakpoints and mobile-only components ensure that:
  - essential actions are always reachable,
  - the game suggests switching to landscape orientation on small screens,
  - the canvas and HUD adapt to available space.

---

## Technical Aspects 

- **HTML5 Feature Usage**
  - Motion and orientation sensors via `DeviceOrientationEvent` / `DeviceMotionEvent`.
  - `<canvas>` element for rendering the maze and ball.
  - `localStorage` for persisting progress and best times.

- **Code Quality**
  - Clear separation of concerns between HTML, CSS and JavaScript.
  - Further modularization within JavaScript: `game.js`, `input.js`, `physics.js`, `renderer.js`, `ui.js`, `levels.js`, `constants.js`.
  - Modern ES modules and class-based design.
  - JSDoc comments in important modules describe responsibilities and data structures.

- **Technical Sophistication**
  - Processing of real sensor data and a robust fallback strategy.
  - Custom physics simulation with friction, inertia and collision detection.
  - Progress tracking and best-time management using persistent storage.
  - Multiple UI states and overlays driven by a central game engine.

- **Responsiveness**
  - Designed for different form factors (phones, tablets, laptops/desktop).
  - Dynamic viewport height handling on mobile, plus orientation-specific hints.

---

## Possible Future Extensions / Bonus Ideas

- Additional, more complex levels (moving obstacles, dynamic tiles).
- Sound effects and background music.
- Online high score board with a backend service.
- Additional accessibility options (alternative control schemes, high-contrast themes).

---

## License

This project is intended for educational purposes in the context of a university course.  
You can adapt this section to your preferred license (e.g. MIT) if needed.

