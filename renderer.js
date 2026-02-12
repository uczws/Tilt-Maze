/**
 * =============================================================
 * Renderer Module - Minimalist Modern Design
 * -------------------------------------------------------------
 * Clean, flat design with geometric shapes and modern colors.
 * Isometric-style rendering with clear visual hierarchy.
 * =============================================================
 */

const CELL_TYPES = {
    EMPTY: 0,
    WALL: 1,
    HOLE: 2,
    GOAL: 3
};

export class Renderer {
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

    configureLevel(level) {
        this.level = level;
        this.resizeCanvas();
        this.renderPlaceholder();
    }

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
        const radius = this.cellSize * 0.35;
        const pulse = Math.sin(this.animationTime * 2.5) * 0.08 + 1;
        const outerGlow = this.ctx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius * 2.2 * pulse);
        outerGlow.addColorStop(0, 'rgba(39, 174, 96, 0.25)');
        outerGlow.addColorStop(0.6, 'rgba(34, 153, 84, 0.1)');
        outerGlow.addColorStop(1, 'rgba(27, 142, 60, 0)');
        this.ctx.fillStyle = outerGlow;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 2.2 * pulse, 0, Math.PI * 2);
        this.ctx.fill();
        const goalGradient = this.ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.15, centerX, centerY, radius);
        goalGradient.addColorStop(0, '#2ecc71');
        goalGradient.addColorStop(0.4, '#27ae60');
        goalGradient.addColorStop(1, '#229954');
        this.ctx.fillStyle = goalGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#1e8449';
        this.ctx.lineWidth = Math.max(1.5, this.cellSize * 0.04);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 0.85, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.font = `bold ${Math.max(18, radius * 0.9)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('✓', centerX, centerY);
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
