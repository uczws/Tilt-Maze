/**
 * @file constants.js
 * @description Shared constants used across the Tilt Maze project.
 *
 * Keeping these values in one place makes the rules of the game (cell encoding,
 * lives, and persistence) consistent across modules.
 */

/**
 * Numeric encoding used in the level grid.
 * @readonly
 * @enum {number}
 */
export const CELL_TYPES = {
    /** Walkable/empty space. */
    EMPTY: 0,
    /** Solid wall cell (collision). */
    WALL: 1,
    /** Hole cell (lose condition). */
    HOLE: 2,
    /** Goal cell (win condition). */
    GOAL: 3
};

/**
 * Maximum amount of lives per run.
 * @type {number}
 */
export const MAX_LIVES = 3;

/**
 * localStorage key for saved progress (unlocked levels + best times).
 * @type {string}
 */
export const STORAGE_KEY = 'tilt-maze-progress';
