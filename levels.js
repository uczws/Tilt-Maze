/**
 * =============================================================
 * Levels Module
 * -------------------------------------------------------------
 * Defines the six handcrafted maze layouts. Each level combines
 * wooden walls, holes, and a glowing goal tile inside a grid.
 * The grid is converted into numeric cells to drive physics and
 * rendering logic:
 *    0 = empty path
 *    1 = wall
 *    2 = hole
 *    3 = goal tile
 * Start and goal coordinates are stored relative to cell centers
 * so the physics engine can work directly in grid units.
 * =============================================================
 */

/**
 * @typedef {Object} RawLevel
 * @property {number} id
 * @property {string} name
 * @property {number} width
 * @property {number} height
 * @property {[number, number]} start
 * @property {[number, number]} goal
 * @property {Array<[number, number]>} walls
 * @property {Array<[number, number]>} holes
 */

/**
 * Raw level definitions. To keep the layout readable we use
 * spread operators with Array.from where long borders repeat.
 */
export const LEVELS = [
    {
        id: 1,
        name: 'Tutorial Run',
        width: 10,
        height: 10,
        start: [1, 1],
        goal: [8, 8],
        walls: [
            ...Array.from({ length: 10 }, (_, i) => [i, 0]),
            ...Array.from({ length: 10 }, (_, i) => [i, 9]),
            ...Array.from({ length: 10 }, (_, i) => [0, i]),
            ...Array.from({ length: 10 }, (_, i) => [9, i]),
            [2, 2], [2, 3],
            [4, 2], [4, 3], [4, 4],
            [6, 3], [6, 4], [6, 5],
            [7, 5], [7, 6],
            [5, 6], [5, 7]
        ],
        holes: [
            [3, 4], [7, 4], [4, 6]
        ]
    },
    {
        id: 2,
        name: 'Forked Paths',
        width: 12,
        height: 12,
        start: [1, 1],
        goal: [10, 10],
        walls: [
            // Außenwände
            ...Array.from({ length: 12 }, (_, i) => [i, 0]),
            ...Array.from({ length: 12 }, (_, i) => [i, 11]),
            ...Array.from({ length: 12 }, (_, i) => [0, i]),
            ...Array.from({ length: 12 }, (_, i) => [11, i]),
            // Innere Wände - neues Design
            [3, 2], [3, 3], [3, 4],
            [1, 5], [5, 1],

            [9, 2], [9, 3],
            [3, 5], [4, 5],
            [7, 5], [8, 5], [9, 5],
            [4, 7], [5, 7], [6, 7],
            [2, 8], [3, 8],
            [7, 8], [8, 8], [9, 8]
        ],
        holes: [
            // Strategisch platzierte Löcher
            [10, 5],
            [4, 3], [7, 3],
            [5, 6],
            [3, 9], [8, 9]
        ]
    },
    {
        id: 3,
        name: 'Labyrinth Loop',
        width: 14,
        height: 14,
        start: [1, 1],
        goal: [12, 12],
        walls: [
            ...Array.from({ length: 14 }, (_, i) => [i, 0]),
            ...Array.from({ length: 14 }, (_, i) => [i, 13]),
            ...Array.from({ length: 14 }, (_, i) => [0, i]),
            ...Array.from({ length: 14 }, (_, i) => [13, i]),
            [2, 2], [2, 3], [2, 4], [2, 5],
            [4, 1], [4, 2],
            [5, 2], [5, 3], [5, 4],
            [8, 2], [8, 4], [8, 5], [8, 6],
            [11, 2], [11, 3], [11, 4],
            [3, 6], [4, 6], [5, 6], [6, 6],
            [9, 6], [10, 6], [11, 6],
            [2, 8], [4, 8], [5, 8],
            [7, 8], [8, 8], [9, 8], [10, 8],
            [5, 10], [6, 10], [7, 10], [8, 10],
            [2, 10], [2, 11], [2, 12],
            [11, 10], [11, 11], [11, 12]
        ],
        holes: [
            [4, 3], [6, 4], [9, 7], [4, 9], [6, 9], [9, 10], [2, 6]
        ]
    },
    {
        id: 4,
        name: 'Narrow Danger',
        width: 16,
        height: 16,
        start: [1, 1],
        goal: [14, 14],
        walls: [
            // Außenwände
            ...Array.from({ length: 16 }, (_, i) => [i, 0]),
            ...Array.from({ length: 16 }, (_, i) => [i, 15]),
            ...Array.from({ length: 16 }, (_, i) => [0, i]),
            ...Array.from({ length: 16 }, (_, i) => [15, i]),
            // Neues Design - Spiral-ähnliches Labyrinth
            // Linke Seite - vertikale Blöcke
            [3, 1], [3, 2], [3, 3],
            [6, 1], [6, 2],
            [9, 1], [9, 2], [9, 3],
            // Obere Mitte - horizontale Blöcke
            [4, 4], [5, 4], [6, 4],
            [10, 4], [11, 4], [12, 4],
            // Mittlere Bereiche - komplexe Struktur
            [2, 6], [3, 6], [4, 6],
            [7, 6], [8, 6], [9, 6],
            [12, 6], [13, 6],
            [1, 8], [2, 8], [3, 8],
            [5, 8], [7, 8],
            [10, 8], [11, 8], [12, 8],
            // Untere Bereiche - mehr Herausforderung
            [4, 10], [5, 10], [6, 10],
            [9, 10], [10, 10], [11, 10],
            [2, 12], [3, 12],
            [7, 12], [8, 12], [9, 12],
            [12, 12], [13, 12],
            [1, 13], [2, 13],
            [5, 13], [6, 13],
            [9, 13], [10, 13],
            [13, 13]
            // [13, 14] und [14, 13] frei für Zugang zum Ziel
        ],
        holes: [
            // Strategisch platzierte Löcher - mehr als Level 3
            [5, 3], [8, 5],
            [4, 7], [11, 7],
            [8, 9], [12, 9],
            [5, 11],
            [4, 13], [11, 13]
        ]
    },
    {
        id: 5,
        name: 'Spiral Drift',
        width: 18,
        height: 18,
        start: [1, 1],
        goal: [16, 16],
        walls: [
            // Außenwände
            ...Array.from({ length: 18 }, (_, i) => [i, 0]),
            ...Array.from({ length: 18 }, (_, i) => [i, 17]),
            ...Array.from({ length: 18 }, (_, i) => [0, i]),
            ...Array.from({ length: 18 }, (_, i) => [17, i]),
            // Komplett neues Design - Zick-Zack Muster
            // Obere linke Ecke - kleine Blöcke
            [2, 1], [2, 2],
            [4, 1],
            [6, 1], [6, 2],
            // Obere rechte Ecke - andere Struktur
            [13, 1], [13, 2], [13, 3],
            [15, 1], [15, 2],
            // Zentrale obere Barrieren
            [4, 3], [5, 3],
            [8, 3], [9, 3], [10, 3],
            [12, 3],
            // Mittlere linke Seite
            [1, 5], [2, 5], [3, 5],
            [5, 5], [6, 5],
            // Mittlere rechte Seite
            [12, 5], [13, 5], [14, 5],
            [16, 5],
            // Zentrale vertikale Barrieren
            [4, 7], [4, 8],
            [7, 7], [7, 8], [7, 9],
            [10, 7], [10, 8],
            [13, 7], [13, 8], [13, 9],
            // Zentrale horizontale Barrieren
            [2, 10], [3, 10], [4, 10],
            [6, 10], [7, 10],
            [9, 10], [10, 10],
            [12, 10], [13, 10], [14, 10],
            // Untere mittlere Barrieren
            [3, 12], [4, 12],
            [6, 12], [7, 12], [8, 12],
            [11, 12], [12, 12],
            [14, 12], [15, 12],
            // Untere Bereiche
            [2, 14], [3, 14],
            [5, 14], [6, 14],
            [9, 14], [10, 14], [11, 14],
            [13, 14], [14, 14],
            [16, 14],
            [2, 15], [3, 15],
            [6, 15], [7, 15],
            [10, 15], [11, 15],
            [14, 15], [15, 15]
            // [15, 16] und [16, 15] frei für Zugang zum Ziel
        ],
        holes: [
            // Komplett neue Lochplatzierung - Zick-Zack Muster
            [5, 2], [11, 2],
            [2, 4], [8, 4], [14, 4],
            [5, 6], [12, 6],
            [3, 9], [9, 9], [15, 9],
            [6, 11], [13, 11],
            [4, 13], [10, 13],
            [7, 15], [14, 15]
        ]
    },
    {
        id: 6,
        name: 'Gridlock',
        width: 20,
        height: 20,
        start: [1, 1],
        goal: [18, 18],
        walls: [
            // Außenwände
            ...Array.from({ length: 20 }, (_, i) => [i, 0]),
            ...Array.from({ length: 20 }, (_, i) => [i, 19]),
            ...Array.from({ length: 20 }, (_, i) => [0, i]),
            ...Array.from({ length: 20 }, (_, i) => [19, i]),
            // Komplett neues Design - Kreuz-Muster
            // Zentrale vertikale Säule
            [1, 8], [2, 8],
            [9, 2], [9, 3], [9, 4],
            [10, 2], [10, 3], [10, 4],
            [9, 6], [9, 7], [9, 8],
            [10, 6], [10, 7], [10, 8],
            [9, 11], [9, 12], [9, 13],
            [10, 11], [10, 12], [10, 13],
            [9, 15], [9, 16], [9, 17],
            [10, 15], [10, 16], [10, 17],
            // Zentrale horizontale Linie
            [2, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [4, 10],
            [11, 9], [12, 9], [13, 9], [14, 9], [15, 9], [16, 9], [17, 9],
            // Linke obere Ecke
            [2, 1], [2, 2],
            [4, 1], [4, 2], [4, 3],
            [6, 1],
            // Rechte obere Ecke
            [15, 1], [15, 2],
            [17, 1], [17, 2], [17, 3],
            [13, 1],
            // Linke untere Ecke
            [2, 17], [2, 18],
            [4, 16], [4, 17], 
            [6, 18],
            // Rechte untere Ecke
            [15, 17], [15, 18],
            [17, 16], [17, 17], [17, 18],
            [13, 18], [12, 10],
            // Mittlere linke Barrieren
            [3, 5], [3, 6],
            [5, 5], [5, 6], [5, 7],
            [7, 4], [7, 5],
            // Mittlere rechte Barrieren
            [14, 5], [14, 6],
            [16, 5], [16, 6], [16, 7],
            [12, 4], [12, 5],
            // Untere mittlere Barrieren
            [3, 13], [3, 14],
            [5, 12], [5, 13], [5, 14],
            [7, 14], [7, 15],
            [12, 14], [12, 15],
            [14, 13], [14, 14],
            [16, 12], [16, 13], [16, 14], [6, 17]
            // [17, 18] und [18, 17] frei für Zugang zum Ziel
        ],
        holes: [
            // Komplett neue Lochplatzierung - Kreuz-Muster
            [3, 3], [7, 3], [13, 3], [16, 3],
            [2, 6], [6, 6], [14, 6], [17, 6],
            [4, 8], [7, 8], [12, 8], [15, 8],
            [3, 11], [6, 11], [13, 11], [16, 11],
            [5, 15], [8, 15], [11, 15], [14, 15],
            [4, 17], [7, 17], [12, 17], [15, 17], [18, 12]
        ]
    }
];

/**
 * Total number of levels.
 */
export const TOTAL_LEVELS = LEVELS.length;

/**
 * Create an empty numeric grid for a given level size.
 */
function createGrid(width, height) {
    return Array.from({ length: height }, () => Array(width).fill(0));
}

/**
 * Deep clone a 2D grid.
 */
function cloneGrid(grid) {
    return grid.map(row => [...row]);
}

/**
 * Convert the raw level definition into a runtime structure for
 * the physics, renderer, and UI subsystems.
 *
 * @param {RawLevel} base
 * @returns {Object} hydrated level info
 */
function hydrateLevel(base) {
    const grid = createGrid(base.width, base.height);
    base.walls.forEach(([x, y]) => {
        if (grid[y] && typeof grid[y][x] !== 'undefined') {
            grid[y][x] = 1;
        }
    });
    base.holes.forEach(([x, y]) => {
        if (grid[y] && typeof grid[y][x] !== 'undefined') {
            grid[y][x] = 2;
        }
    });
    const [goalX, goalY] = base.goal;
    if (grid[goalY] && typeof grid[goalY][goalX] !== 'undefined') {
        grid[goalY][goalX] = 3;
    }

    return {
        id: base.id,
        name: base.name,
        width: base.width,
        height: base.height,
        start: { x: base.start[0] + 0.5, y: base.start[1] + 0.5 },
        goal: { x: goalX + 0.5, y: goalY + 0.5 },
        walls: base.walls,
        holes: base.holes,
        rawStart: [...base.start],
        rawGoal: [...base.goal],
        grid
    };
}

/**
 * Retrieve a specific level definition (1-indexed).
 * @param {number} levelNumber
 */
export function getLevelData(levelNumber) {
    const base = LEVELS[levelNumber - 1];
    if (!base) {
        throw new Error(`Level ${levelNumber} does not exist. Available levels: 1-${LEVELS.length}`);
    }
    const hydrated = hydrateLevel(base);
    hydrated.grid = cloneGrid(hydrated.grid);
    return hydrated;
}

/**
 * Provide lightweight metadata for UI menus without cloning the
 * entire grid each time.
 */
export function listLevelSummaries() {
    return LEVELS.map(level => ({
        id: level.id,
        name: level.name,
        size: `${level.width}×${level.height}`
    }));
}
