import type { PieceTypeConfig, BoxBounds, HalfBounds, TeamColorConfig, Direction } from '../types/game';

/* ─── Board Dimensions ─── */
export const COLS = 15;
export const ROWS = 19;

/* ─── Goal (centered, 7 cells wide) ─── */
export const GOAL_START = 4;
export const GOAL_END = 10;

/* ─── Penalty Boxes ─── */
export const BOX_TOP: BoxBounds = { rowMin: 0, rowMax: 3, colMin: GOAL_START, colMax: GOAL_END };
export const BOX_BOTTOM: BoxBounds = { rowMin: 15, rowMax: 18, colMin: GOAL_START, colMax: GOAL_END };

/* ─── Team Sides ─── */
export const HALF: Record<string, HalfBounds> = {
  A: { rowMin: 10, rowMax: 18 },  // Team Blue (己隊) at bottom
  B: { rowMin: 0, rowMax: 8 },    // Team Red at top
};

/* ─── Piece Type Definitions ─── */
export const PIECE_TYPES: Record<string, PieceTypeConfig> = {
  GK: {
    label: 'GK', name: 'Goalkeeper', count: 1,
    moveRange: 1, passRange: 4, shootRange: 0, chipRange: 0,
    canMoveDiag: false, canShoot: false, canChip: false,
    tackleRange: 1, interceptZone: 1,
    colorClass: 'from-yellow-400 to-yellow-600',
  },
  DF: {
    label: 'DF', name: 'Defender', count: 2,
    moveRange: 1, passRange: 5, shootRange: 0, chipRange: 0,
    canMoveDiag: false, canShoot: false, canChip: false,
    tackleRange: 1, interceptZone: 0,
    colorClass: 'from-blue-400 to-blue-600',
  },
  MF: {
    label: 'MF', name: 'Midfielder', count: 2,
    moveRange: 1, passRange: 3, shootRange: 0, chipRange: 0,
    canMoveDiag: false, canShoot: false, canChip: false,
    tackleRange: 1, interceptZone: 0,
    colorClass: 'from-green-400 to-green-600',
    highPressRange: 8,
    extraActionAfterTackle: true,
    extraActionRestriction: 'move-only',
  },
  WG: {
    label: 'WG', name: 'Winger', count: 2,
    moveRange: 2, passRange: 3, shootRange: 5, chipRange: 3,
    canMoveDiag: true, canShoot: true, canChip: true,
    tackleRange: 1, interceptZone: 0,
    colorClass: 'from-orange-400 to-orange-600',
  },
  CF: {
    label: 'CF', name: 'Center Forward', count: 1,
    moveRange: 1, passRange: 3, shootRange: 5, chipRange: 3,
    canMoveDiag: false, canShoot: true, canChip: true,
    tackleRange: 1, interceptZone: 0,
    colorClass: 'from-red-400 to-red-600',
    strikerInstinct: true,
  },
};

/* ─── Piece Order for Setup ─── */
export const PIECE_ORDER = ['GK', 'DF', 'DF', 'MF', 'MF', 'WG', 'WG', 'CF'] as const;

/* ─── Team Colors ─── */
export const TEAM_COLORS: Record<string, TeamColorConfig> = {
  A: { primary: '#3b82f6', secondary: '#1d4ed8', bg: 'bg-blue-900/40', name: 'Blue', text: 'text-blue-300' },
  B: { primary: '#ef4444', secondary: '#b91c1c', bg: 'bg-red-900/40', name: 'Red', text: 'text-red-300' },
};

/* ─── Directions ─── */
export const CARDINAL: Direction[] = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
];

export const ALL_DIRS: Direction[] = [
  { dc: 0, dr: -1 }, { dc: 1, dr: -1 }, { dc: 1, dr: 0 },
  { dc: 1, dr: 1 },  { dc: 0, dr: 1 },  { dc: -1, dr: 1 },
  { dc: -1, dr: 0 }, { dc: -1, dr: -1 },
];

/* ─── Action Labels ─── */
export const ACTION_LABELS: Record<string, string> = {
  move: '🚶 Move',
  pass: '⚡ Pass',
  shoot: '⚽ Shoot',
  chip: '🏐 Chip Shot',
  'through-ball': '💨 Through Ball',
};

/* ─── Win Condition ─── */
export const GOAL_LIMIT = 5;
