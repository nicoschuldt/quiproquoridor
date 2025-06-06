"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAYER_START_POSITIONS = exports.PLAYER_COLORS = exports.MAX_ROOM_IDLE_TIME = exports.MIN_USERNAME_LENGTH = exports.MAX_USERNAME_LENGTH = exports.ROOM_CODE_LENGTH = exports.MAX_WALLS_4P = exports.MAX_WALLS_2P = exports.BOARD_SIZE = exports.isPlayer = exports.isMove = exports.isPosition = void 0;
const isPosition = (obj) => {
    return typeof obj === 'object' &&
        typeof obj.x === 'number' &&
        typeof obj.y === 'number' &&
        obj.x >= 0 && obj.x <= 8 &&
        obj.y >= 0 && obj.y <= 8;
};
exports.isPosition = isPosition;
const isMove = (obj) => {
    return typeof obj === 'object' &&
        typeof obj.type === 'string' &&
        (obj.type === 'pawn' || obj.type === 'wall') &&
        typeof obj.playerId === 'string';
};
exports.isMove = isMove;
const isPlayer = (obj) => {
    return typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.username === 'string' &&
        (0, exports.isPosition)(obj.position) &&
        typeof obj.wallsRemaining === 'number';
};
exports.isPlayer = isPlayer;
exports.BOARD_SIZE = 9;
exports.MAX_WALLS_2P = 10;
exports.MAX_WALLS_4P = 5;
exports.ROOM_CODE_LENGTH = 6;
exports.MAX_USERNAME_LENGTH = 50;
exports.MIN_USERNAME_LENGTH = 3;
exports.MAX_ROOM_IDLE_TIME = 30 * 60 * 1000;
exports.PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'];
exports.PLAYER_START_POSITIONS = {
    2: [
        { x: 4, y: 0 },
        { x: 4, y: 8 }
    ],
    4: [
        { x: 4, y: 0 },
        { x: 8, y: 4 },
        { x: 4, y: 8 },
        { x: 0, y: 4 }
    ]
};
