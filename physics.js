/**
 * =============================================================
 * Physics Module
 * -------------------------------------------------------------
 * Handles numeric integration of the ball, collision response,
 * and detection of holes and goals. The game board is expressed
 * in grid units, so the physics runs entirely in cell space.
 * =============================================================
 */

import { CELL_TYPES } from './constants.js';
export { CELL_TYPES };

/**
 * Represents the brass ball rolling around the wooden maze.
 * Velocity values are stored in grid units per frame.
 */
export class BallState {
    constructor(radius = 0.35) {
        this.radius = radius;
        
        // ============================================================
        // ICE-PHYSICS PARAMETERS
        // ============================================================
        // Maximum speed: how fast the ball is allowed to get
        this.maxSpeed = 0.25;
        
        // Friction factor: how quickly the ball slows down (0.95 = slower stop, 0.99 = very slippery)
        // Higher values = less friction = longer sliding distance (ice-like feeling)
        this.friction = 0.96;
        
        // Acceleration: how quickly the ball accelerates in response to input
        // Higher values = stronger acceleration
        this.acceleration = 0.012;
        
        this.reset(1.5, 1.5);
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
    }

    /**
     * Apply normalized tilt or keyboard input to influence
     * acceleration. Inputs are clamped to [-1, 1].
     */
    applyTilt(ax, ay) {
        const clampedX = Math.max(-1, Math.min(1, ax));
        const clampedY = Math.max(-1, Math.min(1, ay));
        this.vx += clampedX * this.acceleration;
        this.vy += clampedY * this.acceleration;
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > this.maxSpeed) {
            const scale = this.maxSpeed / speed;
            this.vx *= scale;
            this.vy *= scale;
        }
    }

    /**
     * Integrate velocity into position with friction applied.
     * Simulates realistic friction: the ball gradually rolls out and comes
     * to rest, similar to a marble on a smooth surface.
     */
    integrate() {
        // Apply friction: reduce velocity every frame.
        // friction = 0.96 means ~4% speed loss per frame, which creates
        // a natural looking roll-out.
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        // Stop at very small velocities (prevents endless micro-sliding).
        // Threshold is small enough to still look like a natural roll-out.
        if (Math.abs(this.vx) < 0.001) this.vx = 0;
        if (Math.abs(this.vy) < 0.001) this.vy = 0;
        
        // Aktualisiere Position basierend auf Geschwindigkeit
        this.x += this.vx;
        this.y += this.vy;
    }
}

/**
 * Update the physics state for one frame.
 * @param {BallState} ball
 * @param {number[][]} grid
 * @returns {{hitHole: boolean, reachedGoal: boolean}}
 */
export function simulatePhysicsStep(ball, grid) {
    ball.integrate();
    resolveWallCollisions(ball, grid);
    clampToBounds(ball, grid);
    const hitHole = checkHoleCollision(ball, grid);
    const reachedGoal = !hitHole && isBallInCellType(ball, grid, CELL_TYPES.GOAL, 0.45);
    return { hitHole, reachedGoal };
}

function resolveWallCollisions(ball, grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const cellCol = Math.floor(ball.x);
    const cellRow = Math.floor(ball.y);
    const candidates = [];
    for (let row = cellRow - 1; row <= cellRow + 1; row++) {
        for (let col = cellCol - 1; col <= cellCol + 1; col++) {
            if (row >= 0 && row < rows && col >= 0 && col < cols) {
                if (grid[row][col] === CELL_TYPES.WALL) {
                    candidates.push({ row, col });
                }
            }
        }
    }

    candidates.forEach(cell => {
        const left = cell.col;
        const right = cell.col + 1;
        const top = cell.row;
        const bottom = cell.row + 1;
        const closestX = Math.max(left, Math.min(ball.x, right));
        const closestY = Math.max(top, Math.min(ball.y, bottom));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        const distance = Math.hypot(dx, dy);
        if (distance < ball.radius && distance !== 0) {
            const overlap = ball.radius - distance;
            const nx = dx / distance;
            const ny = dy / distance;
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx -= 1.8 * dot * nx;
                ball.vy -= 1.8 * dot * ny;
            }
        }
    });
}

function clampToBounds(ball, grid) {
    const minX = ball.radius;
    const maxX = grid[0].length - ball.radius;
    const minY = ball.radius;
    const maxY = grid.length - ball.radius;
    ball.x = Math.max(minX, Math.min(maxX, ball.x));
    ball.y = Math.max(minY, Math.min(maxY, ball.y));
}

function checkHoleCollision(ball, grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    const cellRow = Math.floor(ball.y);
    const cellCol = Math.floor(ball.x);
    const holeRadius = 0.35;
    const checkRadius = holeRadius + ball.radius;
    for (let row = cellRow - 1; row <= cellRow + 1; row++) {
        for (let col = cellCol - 1; col <= cellCol + 1; col++) {
            if (row >= 0 && row < rows && col >= 0 && col < cols) {
                if (grid[row][col] === CELL_TYPES.HOLE) {
                    const centerX = col + 0.5;
                    const centerY = row + 0.5;
                    const dx = ball.x - centerX;
                    const dy = ball.y - centerY;
                    const distance = Math.hypot(dx, dy);
                    if (distance < checkRadius) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function isBallInCellType(ball, grid, type, radiusFactor) {
    const row = Math.floor(ball.y);
    const col = Math.floor(ball.x);
    if (!grid[row] || typeof grid[row][col] === 'undefined') {
        return false;
    }
    if (grid[row][col] !== type) {
        return false;
    }
    const centerX = col + 0.5;
    const centerY = row + 0.5;
    const dx = ball.x - centerX;
    const dy = ball.y - centerY;
    const distance = Math.hypot(dx, dy);
    return distance < radiusFactor;
}
