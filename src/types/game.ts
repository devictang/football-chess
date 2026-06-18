/* ─── Position & Direction ─── */
export interface Position {
  col: number;
  row: number;
}

export interface Direction {
  dc: number;
  dr: number;
}

/* ─── Teams ─── */
export type Team = 'A' | 'B';

/* ─── Piece Types ─── */
export type PieceType = 'GK' | 'DF' | 'MF' | 'WG' | 'CF';

/* ─── Piece ─── */
export interface Piece {
  id: string;
  team: Team;
  type: PieceType;
  col: number;
  row: number;
  active: boolean;
  hasBall: boolean;
  stunned: boolean;
  index: number;
}

/* ─── Piece Type Config ─── */
export interface PieceTypeConfig {
  label: string;
  name: string;
  count: number;
  moveRange: number;
  passRange: number;
  shootRange: number;
  chipRange: number;
  canMoveDiag: boolean;
  canShoot: boolean;
  canChip: boolean;
  tackleRange: number;
  interceptZone: number;
  colorClass: string;
  highPressRange?: number;
  extraActionAfterTackle?: boolean;
  extraActionRestriction?: string;
  strikerInstinct?: boolean;
}

/* ─── Move / Target Types ─── */
export interface MoveTarget extends Position {
  type: 'move' | 'tackle';
  targetId?: string;
}

export interface PassTarget extends Position {
  pieceId: string;
  dist: number;
}

export type Action = 'move' | 'pass' | 'shoot' | 'chip' | 'through-ball';

export type ValidTarget = MoveTarget | PassTarget | Direction;

/* ─── Game Phase ─── */
export type GamePhase = 'menu' | 'setup-a' | 'setup-b' | 'playing' | 'gameover';

export type GameMode = 'quick' | 'ai' | 'pvp';

/* ─── Score ─── */
export interface Score {
  A: number;
  B: number;
}

/* ─── Full Game State ─── */
export interface GameState {
  phase: GamePhase;
  pieces: Piece[];
  gameMode: GameMode;
  turn: Team;
  turnNumber: number;
  ballHolderId: string | null;
  ballPosition: Position | null;
  selectedPieceId: string | null;
  selectedAction: Action | null;
  validTargets: ValidTarget[];
  availableActions: Action[];
  message: string;
  score: Score;
  extraAction: boolean;
  actionPoints: number;
  actedPieces: string[];
  extraActionPieceId: string | null;
  lastTackledId: string | null;
  lastTouch: Team | null;
  setupPiecesA: Piece[];
  setupPiecesB: Piece[];
  setupPieceIndex: number;
  setupTeam: Team;
  setupSelectedPieceId: string | null;
  passRangeCells: Position[];
  goalAnimation: boolean;
  firstTurn: boolean;
  gkMustPassOut: boolean;
}

/* ─── Team Colors ─── */
export interface TeamColorConfig {
  primary: string;
  secondary: string;
  bg: string;
  name: string;
  text: string;
}

/* ─── Penalty Box ─── */
export interface BoxBounds {
  rowMin: number;
  rowMax: number;
  colMin: number;
  colMax: number;
}

/* ─── Half ─── */
export interface HalfBounds {
  rowMin: number;
  rowMax: number;
}

/* ─── Path Cell ─── */
export interface PathCell extends Position {
  occupant: Piece | null;
}
