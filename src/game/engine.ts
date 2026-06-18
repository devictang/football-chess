import type { Piece, Position, Direction, MoveTarget, PassTarget, PathCell } from '../types/game';
import {
  COLS, ROWS, GOAL_START, GOAL_END,
  BOX_TOP, BOX_BOTTOM, HALF,
  PIECE_TYPES, PIECE_ORDER, CARDINAL, ALL_DIRS,
} from './constants';

/* ─── Bounds ─── */
export const inBounds = (c: number, r: number): boolean =>
  c >= 0 && c < COLS && r >= 0 && r < ROWS;

export const isGoal = (c: number, r: number): boolean =>
  (r === 0 || r === ROWS - 1) && c >= GOAL_START && c <= GOAL_END;

/* ─── Penalty Box ─── */
export const inPenaltyBox = (c: number, r: number): boolean =>
  (r >= BOX_TOP.rowMin && r <= BOX_TOP.rowMax && c >= BOX_TOP.colMin && c <= BOX_TOP.colMax) ||
  (r >= BOX_BOTTOM.rowMin && r <= BOX_BOTTOM.rowMax && c >= BOX_BOTTOM.colMin && c <= BOX_BOTTOM.colMax);

export const getTeamBox = (team: string) => team === 'A' ? BOX_BOTTOM : BOX_TOP;

/* ─── Team Half ─── */
export const inOwnHalf = (team: string, r: number): boolean => {
  const half = HALF[team];
  return r >= half.rowMin && r <= half.rowMax;
};

/* ─── Distance ─── */
export const chebDist = (a: Position, b: Position): number =>
  Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

export const manhattan = (a: Position, b: Position): number =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

/* ─── Trace straight cardinal line ─── */
export function traceLine(fromCol: number, fromRow: number, toCol: number, toRow: number): Position[] {
  const cells: Position[] = [];
  const dc = Math.sign(toCol - fromCol);
  const dr = Math.sign(toRow - fromRow);
  if (dc !== 0 && dr !== 0) return cells;
  let c = fromCol, r = fromRow;
  while (true) {
    cells.push({ col: c, row: r });
    if (c === toCol && r === toRow) break;
    c += dc;
    r += dr;
  }
  return cells;
}

/* ─── Get neighbors within Chebyshev range ─── */
export function getNeighbors(col: number, row: number, range: number): Position[] {
  const cells: Position[] = [];
  for (let c = col - range; c <= col + range; c++) {
    for (let r = row - range; r <= row + range; r++) {
      if (c === col && r === row) continue;
      if (inBounds(c, r)) cells.push({ col: c, row: r });
    }
  }
  return cells;
}

/* ─── Find piece at cell ─── */
export function pieceAt(pieces: Piece[], col: number, row: number): Piece | null {
  return pieces.find(p => p.col === col && p.row === row && p.active) ?? null;
}

/* ─── Team pieces ─── */
export const teamPieces = (pieces: Piece[], team: string): Piece[] =>
  pieces.filter(p => p.team === team && p.active);

/* ─── Ball holder ─── */
export const getBallHolder = (pieces: Piece[]): Piece | null =>
  pieces.find(p => p.hasBall && p.active) ?? null;

/* ─── GK vulnerability ─── */
export const isGKVulnerable = (gkPiece: Piece, lastTouch: string | null): boolean =>
  lastTouch === gkPiece.team;

/* ─── Valid Move Targets ─── */
export function getValidMoves(piece: Piece, pieces: Piece[], lastTouch: string | null = null): MoveTarget[] {
  const type = PIECE_TYPES[piece.type];
  const maxRange = type.moveRange;
  const results: MoveTarget[] = [];
  const dirs = type.canMoveDiag ? ALL_DIRS : CARDINAL;

  for (const { dc, dr } of dirs) {
    for (let step = 1; step <= maxRange; step++) {
      const nc = piece.col + dc * step;
      const nr = piece.row + dr * step;
      if (!inBounds(nc, nr)) break;

      const occupant = pieceAt(pieces, nc, nr);

      // GK constraint
      if (piece.type === 'GK' && !inPenaltyBox(nc, nr)) continue;

      if (!occupant) {
        // Check if moving here puts us adjacent (cardinal) to a ball carrier → tackle
        let adjTarget: Piece | null = null;
        for (const { dc: ndc, dr: ndr } of CARDINAL) {
          const adj = pieceAt(pieces, nc + ndc, nr + ndr);
          if (adj && adj.team !== piece.team && adj.hasBall) {
            if (adj.type === 'GK' && !isGKVulnerable(adj, lastTouch)) continue;
            adjTarget = adj;
            break;
          }
        }
        if (adjTarget) {
          results.push({ col: nc, row: nr, type: 'tackle', targetId: adjTarget.id });
        } else {
          results.push({ col: nc, row: nr, type: 'move' });
        }
        continue;
      }

      if (occupant.team !== piece.team && occupant.hasBall) {
        // GK invincibility: cannot tackle GK unless vulnerable
        if (occupant.type === 'GK' && !isGKVulnerable(occupant, lastTouch)) {
          // GK is invincible, can't tackle
        } else {
          results.push({ col: nc, row: nr, type: 'tackle', targetId: occupant.id });
        }
      }
      break;
    }
  }

  // MF High-Press
  if (piece.type === 'MF' && type.highPressRange) {
    const zone = getNeighbors(piece.col, piece.row, type.highPressRange);
    for (const cell of zone) {
      const occupant = pieceAt(pieces, cell.col, cell.row);
      if (occupant && occupant.team !== piece.team && occupant.hasBall) {
        // GK invincibility applies to high-press too
        if (occupant.type === 'GK' && !isGKVulnerable(occupant, lastTouch)) continue;
        if (!results.some(r => r.col === cell.col && r.row === cell.row)) {
          results.push({ col: cell.col, row: cell.row, type: 'tackle', targetId: occupant.id });
        }
      }
    }
  }

  return results;
}

/* ─── Valid Pass Targets ─── */
export function getValidPassTargets(piece: Piece, pieces: Piece[]): PassTarget[] {
  const type = PIECE_TYPES[piece.type];
  const maxRange = type.passRange;
  const targets: PassTarget[] = [];

  for (const { dc, dr } of CARDINAL) {
    for (let step = 1; step <= maxRange; step++) {
      const nc = piece.col + dc * step;
      const nr = piece.row + dr * step;
      if (!inBounds(nc, nr)) break;

      const occ = pieceAt(pieces, nc, nr);
      if (occ) {
        if (occ.team === piece.team && occ.id !== piece.id) {
          targets.push({ pieceId: occ.id, col: nc, row: nr, dist: step });
        }
        break;
      }
    }
  }
  return targets;
}

/* ─── Shot path ─── */
export function getShotPath(fromCol: number, fromRow: number, dir: Direction, pieces: Piece[], range: number): PathCell[] {
  const path: PathCell[] = [];
  let c = fromCol, r = fromRow;
  for (let step = 0; step <= range; step++) {
    if (step > 0) { c += dir.dc; r += dir.dr; }
    if (!inBounds(c, r)) break;
    const occ = pieceAt(pieces, c, r);
    path.push({ col: c, row: r, occupant: occ });
  }
  return path;
}

/* ─── Has clear shot to goal (CF Striker Instinct) ─── */
export function hasClearShotToGoal(piece: Piece, pieces: Piece[]): boolean {
  const type = PIECE_TYPES[piece.type];
  const range = type.shootRange;
  const dirs: Direction[] = piece.team === 'A'
    ? [CARDINAL[0]]  // A at bottom → attacks upward
    : [CARDINAL[1]]; // B at top → attacks downward

  for (const d of dirs) {
    let c = piece.col, r = piece.row;
    let steps = 0;
    let pathClear = true;
    let reachedGoal = false;

    while (steps < range) {
      c += d.dc; r += d.dr;
      steps++;
      if (!inBounds(c, r)) {
        if (isGoal(c - d.dc, r - d.dr)) reachedGoal = true;
        break;
      }
      const occ = pieceAt(pieces, c, r);
      if (occ) { pathClear = false; break; }
    }

    if (pathClear && reachedGoal) {
      // Check no GK in intercept zone along path
      for (const p of pieces) {
        if (p.type === 'GK' && p.active && p.team !== piece.team) {
          let cc = piece.col, rr = piece.row;
          let gkBlocks = false;
          for (let s = 0; s <= steps; s++) {
            if (chebDist(p, { col: cc, row: rr }) <= 1) { gkBlocks = true; break; }
            cc += d.dc; rr += d.dr;
          }
          if (!gkBlocks) return true;
        }
      }
      return true;
    }
  }
  return false;
}

/* ─── Default formation ─── */
export function getDefaultFormation(team: string): Piece[] {
  const isA = team === 'A';
  const r: Record<string, number> = isA
    ? { GK: 16, DF: 14, MF: 12, WG: 10, CF: 10 }  // A at bottom half
    : { GK: 2, DF: 4, MF: 6, WG: 8, CF: 8 };      // B at top half

  // Pieces aligned on columns 4/7/10 for horizontal + vertical passes:
  // GK(7) → MF(7) vertical line; CF(7) ↔ WG(4/10) horizontal; DF(6/8) ↔ MF(7/8)
  const colOffset = isA ? 0 : 0; // same cols for both teams
  const template: Array<{ type: string; col: number }> = [
    { type: 'GK', col: 7 },
    { type: 'DF', col: 6 }, { type: 'DF', col: 8 },
    { type: 'MF', col: 7 }, { type: 'MF', col: 8 },
    { type: 'WG', col: 4 }, { type: 'WG', col: 10 },
    { type: 'CF', col: 7 },
  ];

  return template.map((t, idx) => ({
    id: `${team}-${t.type}-${idx}`,
    team: team as 'A' | 'B',
    type: t.type as Piece['type'],
    col: t.col,
    row: r[t.type],
    active: true,
    hasBall: false,
    canCounterTackle: true,
    index: idx,
  }));
}

/* ─── Create empty pieces for setup ─── */
export function createEmptyPieces(team: string): Piece[] {
  return PIECE_ORDER.map((type, idx) => ({
    id: `${team}-${type}-${idx}`,
    team: team as 'A' | 'B',
    type: type as Piece['type'],
    col: -1,
    row: -1,
    active: false,
    hasBall: false,
    canCounterTackle: true,
    index: idx,
  }));
}

/* ─── Setup placement validity ─── */
export function isValidSetupPlacement(team: string, col: number, row: number, pieces: Piece[]): boolean {
  if (!inBounds(col, row)) return false;
  if (!inOwnHalf(team, row)) return false;
  if (pieceAt(pieces, col, row)) return false;
  return true;
}

/* ─── Find vacant adjacent cell (for tackle displacement) ─── */
export function findVacantAdjacent(piece: Piece, pieces: Piece[], excludeCol: number, excludeRow: number): Position | null {
  const checkDirs: Direction[] = [
    { dc: -1, dr: 0 }, { dc: 1, dr: 0 }, { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
    { dc: -1, dr: -1 }, { dc: 1, dr: -1 }, { dc: -1, dr: 1 }, { dc: 1, dr: 1 },
  ];
  for (const { dc, dr } of checkDirs) {
    const nc = piece.col + dc;
    const nr = piece.row + dr;
    if (nc === excludeCol && nr === excludeRow) continue;
    if (!inBounds(nc, nr)) continue;
    if (!pieceAt(pieces, nc, nr)) return { col: nc, row: nr };
  }
  return null;
}

/* ─── Opposite team ─── */
export const oppositeTeam = (t: string): 'A' | 'B' => t === 'A' ? 'B' : 'A';

/* ─── Furthest forward player (for GK pass-out turnover) ─── */
export function getFurthestForwardPlayer(team: string, pieces: Piece[]): Piece | null {
  const teamP = pieces.filter(p => p.team === team && p.active);
  if (teamP.length === 0) return null;
  // Team A attacks upward (smaller row = more forward), Team B attacks downward (larger row = more forward)
  return team === 'A'
    ? teamP.reduce((a, b) => a.row < b.row ? a : b)
    : teamP.reduce((a, b) => a.row > b.row ? a : b);
}
