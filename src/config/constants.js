// Game Constants
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const PIXELATION_SCALE_FACTOR = 0.25;
export const ROUND_DURATION_SECONDS = 120;

// Physics Constants
export const BALL_RADIUS = 15;
export const PLAYER_SIZE = 40;
export const PLAYER_WIDTH = PLAYER_SIZE;
export const PLAYER_HEIGHT = PLAYER_SIZE;
export const JUMP_FORCE = 0.18;
export const MOVE_FORCE = 0.015;
export const AIR_MOVE_FORCE_MULTIPLIER = 0.1;

// Field Constants
export const GROUND_Y = 580;
export const GROUND_THICKNESS = 40;
export const WALL_THICKNESS = 40;
export const GOAL_HEIGHT = 120;
export const GOAL_WIDTH = 30;
export const GOAL_POST_WIDTH = 6;

// Player Physics
export const PLAYER_FRICTION = 0.8;
export const PLAYER_RESTITUTION = 0.1;
export const PLAYER_DENSITY = 0.003;

// Collision Categories
export const COLLISION_CATEGORIES = {
    PLAYER: 0x0001,
    GOAL_POST: 0x0002,
    BALL: 0x0004,
    WORLD: 0x0008,
    POWER_UP: 0x0010
};

// Power-up Types
export const POWER_UP_TYPES = [
    { type: 'speed', color: '#FFD700', duration: 5000, effect: 'سرعت بالا' },
    { type: 'strength', color: '#FF4500', duration: 4000, effect: 'شوت قوی' },
    { type: 'shield', color: '#00CED1', duration: 6000, effect: 'محافظت' },
    { type: 'magnet', color: '#FF69B4', duration: 3000, effect: 'آهنربا' }
];

// Weather Effects
export const WEATHER_EFFECTS = {
    clear: { name: 'صاف', particles: 0, windForce: 0, friction: 1 },
    rain: { name: 'باران', particles: 50, windForce: 0.5, friction: 0.8 },
    snow: { name: 'برف', particles: 30, windForce: 0.3, friction: 0.6 },
    storm: { name: 'طوفان', particles: 80, windForce: 1.2, friction: 0.7 }
};

// Field Types
export const FIELD_TYPES = {
    normal: { friction: 0.05, frictionAir: 0.01, gravityY: 1.5, name: 'معمولی' },
    ice: { friction: 0.01, frictionAir: 0.001, gravityY: 1.5, name: 'یخ' },
    sand: { friction: 0.5, frictionAir: 0.05, gravityY: 1.5, name: 'شن' },
    moon: { friction: 0.1, frictionAir: 0.01, gravityY: 0.3, name: 'ماه' }
};

// Colors
export const COLORS = {
    SKY_BLUE: '#87CEEB',
    GRASS_DARK: '#228B22',
    GRASS_LIGHT: '#32CD32',
    PLAYER_1: '#D9534F',
    PLAYER_2: '#428BCA',
    WHITE: '#FFFFFF',
    BLACK: '#000000',
    GRAY: '#666666'
};