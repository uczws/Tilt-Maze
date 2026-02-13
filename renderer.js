/**
 * @file renderer.js
 * @description Canvas renderer for Tilt Maze.
 *
 * Rendering is intentionally kept separate from physics and UI logic.
 * The renderer draws:
 * - Board background + grid
 * - Walls, holes, and the goal tile
 * - The ball (with subtle shading)
 *
 * The canvas automatically resizes to its container and compensates for
 * devicePixelRatio for crisp visuals on high-DPI screens.
 */

import { CELL_TYPES } from './constants.js';

/**
 * Responsible for all drawing on the <canvas>.
 */
export class Renderer {
    /**
     * @param {string} canvasId DOM id of the <canvas> element.
     */
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas with id "${canvasId}" not found.`);
        }
        this.ctx = this.canvas.getContext('2d');
        this.level = null;
        this.cellSize = 40;
        this.animationTime = 0;
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Stores the active level and triggers a resize + first render.
     * @param {Object} level Hydrated level data (grid, width/height, holes, goal).
     */
    configureLevel(level) {
        this.level = level;
        this.resizeCanvas();
        this.renderPlaceholder();
    }

    /**
     * Resizes the canvas to match the container while preserving aspect ratio.
     * Uses devicePixelRatio scaling so graphics stay sharp.
     */
    resizeCanvas() {
        if (!this.level) return;
        const parent = this.canvas.parentElement || document.body;
        const rect = parent.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        const padding = isMobile ? 0 : 20;
        const maxWidth = Math.max(200, rect.width - padding);
        const maxHeight = Math.max(200, rect.height - padding);
        const scale = Math.min(maxWidth / this.level.width, maxHeight / this.level.height);
        const canvasWidth = this.level.width * scale;
        const canvasHeight = this.level.height * scale;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cellSize = scale;
    }

    /**
     * Draws one full frame (background, obstacles, goal, ball).
     * @param {Object} ball Current ball state (x, y, radius).
     */
    render(ball) {
        if (!this.level) return;
        this.animationTime += 0.015;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoardBase();
        this.drawMaze();
        this.drawHoles();
        this.drawGoal();
        this.drawBall(ball);
    }

    drawBoardBase() {
        const width = this.level.width * this.cellSize;
        const height = this.level.height * this.cellSize;
        this.ctx.fillStyle = '#e3f2f9';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.strokeStyle = '#d0e5f0';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += this.cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= height; y += this.cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    drawMaze() {
        const rows = this.level.grid.length;
        const cols = this.level.grid[0].length;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (this.level.grid[row][col] === CELL_TYPES.WALL) {
                    this.drawWallCell(col, row);
                }
            }
        }
    }

    drawWallCell(col, row) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;
        const size = this.cellSize;
        const offset = size * 0.1;
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(x + offset, y + offset, size - offset * 2, size - offset * 2);
        this.ctx.strokeStyle = '#34495e';
        this.ctx.lineWidth = Math.max(1, size * 0.03);
        this.ctx.strokeRect(x + offset, y + offset, size - offset * 2, size - offset * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.fillRect(x + offset, y + offset, size - offset * 2, size * 0.2);
    }

    drawHoles() {
        this.level.holes.forEach(([col, row]) => {
            const centerX = (col + 0.5) * this.cellSize;
            const centerY = (row + 0.5) * this.cellSize;
            const radius = this.cellSize * 0.3;
            const pulse = Math.sin(this.animationTime * 2) * 0.05 + 1;
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#c0392b';
            this.ctx.lineWidth = Math.max(2, radius * 0.1);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.fillStyle = '#ecf0f1';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius * 0.3 * pulse, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawGoal() {
        const goal = this.level.goal;
        const centerX = goal.x * this.cellSize;
        const centerY = goal.y * this.cellSize;
        const size = this.cellSize * 0.38;
        const pulse = Math.sin(this.animationTime * 2.5) * 0.06 + 1;
        const r = size * pulse;
        // Subtle glow
        const outerGlow = this.ctx.createRadialGradient(centerX, centerY, r * 0.5, centerX, centerY, r * 2);
        outerGlow.addColorStop(0, 'rgba(46, 204, 113, 0.25)');
        outerGlow.addColorStop(0.6, 'rgba(39, 174, 96, 0.1)');
        outerGlow.addColorStop(1, 'rgba(34, 153, 84, 0)');
        this.ctx.fillStyle = outerGlow;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, r * 2, 0, Math.PI * 2);
        this.ctx.fill();
        // Goal tile (green circle)
        const gradient = this.ctx.createRadialGradient(centerX - r * 0.3, centerY - r * 0.3, 0, centerX, centerY, r);
        gradient.addColorStop(0, '#2ecc71');
        gradient.addColorStop(0.5, '#27ae60');
        gradient.addColorStop(1, '#1e8449');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#1a6b38';
        this.ctx.lineWidth = Math.max(1.5, this.cellSize * 0.035);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, r * 0.9, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawBall(ball) {
        const x = ball.x * this.cellSize;
        const y = ball.y * this.cellSize;
        const radius = ball.radius * this.cellSize;
        this.ctx.fillStyle = '#3498db';
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#2980b9';
        this.ctx.lineWidth = Math.max(2, radius * 0.1);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.beginPath();
        this.ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
        this.ctx.fill();
    }

    renderPlaceholder() {
        if (!this.level) return;
        this.render({ x: this.level.start.x, y: this.level.start.y, radius: 0.35 });
    }
}
