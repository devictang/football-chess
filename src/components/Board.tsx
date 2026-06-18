import React from 'react';
import { motion } from 'framer-motion';
import type { Piece, Direction, Position, ValidTarget, MoveTarget, PassTarget, GamePhase, Team } from '../types/game';
import {
  COLS, ROWS, GOAL_START, GOAL_END,
  BOX_TOP, BOX_BOTTOM, PIECE_TYPES, TEAM_COLORS,
  CARDINAL,
} from '../game/constants';
import { isGoal, inPenaltyBox, pieceAt, getBallHolder, isGKVulnerable } from '../game/engine';

/* ─── Types ─── */
interface BoardProps {
  pieces: Piece[];
  selectedPieceId: string | null;
  selectedAction: string | null;
  validTargets: ValidTarget[];
  ballHolderId: string | null;
  ballPosition: Position | null;
  lastTouch: Team | null;
  turn: Team;
  phase: GamePhase;
  onCellClick: (target: unknown) => void;
  onPieceClick: (id: string) => void;
  showLabels?: boolean;
}

interface CellProps {
  col: number;
  row: number;
  isGoalCell: boolean;
  isCenterLine: boolean;
  isPenalty: boolean;
  isTarget: boolean;
  isPassTgt: boolean;
  isTackleTgt: boolean;
  isDirection: boolean;
  isLooseBall: boolean;
  directionIcon: string;
  onClick: () => void;
  children?: React.ReactNode;
}

/* ─── Cell ─── */
function Cell({ col, row, isGoalCell, isCenterLine, isPenalty, isTarget, isPassTgt, isTackleTgt, isDirection, isLooseBall, directionIcon, onClick, children }: CellProps) {
  const isLight = (col + row) % 2 === 0;
  let baseClass = isLight ? 'bg-emerald-700/60' : 'bg-emerald-800/60';
  if (isGoalCell) baseClass = 'goal-zone bg-yellow-600/30';
  if (isPenalty) baseClass = 'bg-blue-900/15';
  const borderClass = isCenterLine ? 'border-t-2 border-t-white/40' : 'border border-emerald-600/15';

  return (
    <motion.div
      className={`relative flex items-center justify-center ${baseClass} ${borderClass} cursor-pointer select-none`}
      style={{ width: 32, height: 32 }}
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Target indicators */}
      {isTarget && !isTackleTgt && (
        <motion.div
          className="absolute inset-1 rounded-full bg-green-400/50 z-10"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        />
      )}
      {isTackleTgt && (
        <motion.div
          className="absolute inset-1 rounded-full bg-red-500/60 z-10"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        />
      )}
      {isPassTgt && (
        <motion.div
          className="absolute inset-0 rounded-full bg-blue-400/30 border-2 border-blue-300/70 z-10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      )}
      {isDirection && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-xs z-10 text-white/40"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
        >
          {directionIcon}
        </motion.div>
      )}

      {isLooseBall && (
        <span className="absolute z-25 text-sm drop-shadow-lg">⚽</span>
      )}

      {children}
    </motion.div>
  );
}

/* ─── Piece View ─── */
function PieceView({ piece, isSelected, isBallHolder, isGkInvincible, cannotTackle, onClick }: {
  piece: Piece;
  isSelected: boolean;
  isBallHolder: boolean;
  isGkInvincible: boolean;
  cannotTackle: boolean;
  onClick: () => void;
}) {
  const type = PIECE_TYPES[piece.type];
  const teamGrad = piece.team === 'A'
    ? 'from-blue-500 to-blue-700'
    : 'from-red-500 to-red-700';
  const borderRing = isSelected ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-gray-900' : '';
  const gkShield = isGkInvincible ? 'ring-1 ring-yellow-400/60' : '';

  return (
    <motion.div
      className={`absolute inset-0.5 rounded-full bg-gradient-to-br ${teamGrad} ${borderRing} ${gkShield} flex items-center justify-center z-20 cursor-pointer ${cannotTackle ? 'opacity-60' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 25, mass: 0.8 }}
      whileTap={{ scale: 0.9 }}
    >
      <span className="text-[9px] sm:text-[10px] font-bold text-white drop-shadow-md leading-none">
        {type.label}
      </span>
      {isBallHolder && <span className="absolute -top-1 -right-1 text-[10px] z-30">⚽</span>}
      {isGkInvincible && <span className="absolute -bottom-1 text-[8px] z-30 drop-shadow-md">🛡️</span>}
      {cannotTackle && <span className="absolute -bottom-1 text-[8px] z-30 drop-shadow-md">🔒</span>}
    </motion.div>
  );
}

/* ─── Main Board ─── */
export default function Board({
  pieces, selectedPieceId, selectedAction, validTargets,
  ballHolderId, ballPosition, lastTouch, turn, phase, onCellClick, onPieceClick, showLabels = true,
}: BoardProps) {
  const ballHolder = getBallHolder(pieces);

  const handleCellClick = (col: number, row: number) => {
    const p = pieceAt(pieces, col, row);

    if (phase === 'setup-a' || phase === 'setup-b') {
      onCellClick({ col, row });
      return;
    }
    if (phase !== 'playing') return;

    // Direction actions take priority
    if (selectedAction === 'shoot' || selectedAction === 'chip' || selectedAction === 'through-ball') {
      const selPiece = pieces.find(pp => pp.id === selectedPieceId);
      if (selPiece) {
        const dc = col - selPiece.col;
        const dr = row - selPiece.row;
        if ((dc === 0 || dr === 0) && !(dc === 0 && dr === 0)) {
          const dir: Direction = { dc: Math.sign(dc), dr: Math.sign(dr) };
          const matches = (validTargets as Direction[]).some(t => t.dc === dir.dc && t.dr === dir.dr);
          if (matches) {
            // Only fire if within piece's range
            const ptype = PIECE_TYPES[selPiece.type];
            const range = selectedAction === 'chip' ? ptype.chipRange : ptype.shootRange;
            if (Math.abs(dc) + Math.abs(dr) <= range) {
              onCellClick(dir);
              return;
            }
          }
        }
      }
    }

    // Pass: click on teammate
    if (selectedAction === 'pass' && p && p.active) {
      const matches = (validTargets as PassTarget[]).some(t => t.pieceId === p.id);
      if (matches) { onCellClick(p.id); return; }
    }

    // Move: click on valid target
    if (selectedAction === 'move') {
      const matches = (validTargets as MoveTarget[]).some(t => t.col === col && t.row === row);
      if (matches) { onCellClick({ col, row } as MoveTarget); return; }
    }

    // Select own piece
    if (p && p.active && p.team === turn) {
      onPieceClick(p.id);
    }
  };

  /* ─── Helpers ─── */
  const isTargetCell = (col: number, row: number): boolean =>
    selectedAction === 'move' && (validTargets as MoveTarget[]).some(t => t.col === col && t.row === row);

  const isTackleCell = (col: number, row: number): boolean =>
    selectedAction === 'move' && (validTargets as MoveTarget[]).some(t => t.col === col && t.row === row && t.type === 'tackle');

  const isPassTargetCell = (col: number, row: number): boolean =>
    selectedAction === 'pass' && (validTargets as PassTarget[]).some(t => t.col === col && t.row === row);

  const getDirectionInfo = (col: number, row: number): { active: boolean; icon: string } => {
    if (selectedAction !== 'shoot' && selectedAction !== 'chip' && selectedAction !== 'through-ball')
      return { active: false, icon: '' };
    const selPiece = pieces.find(pp => pp.id === selectedPieceId);
    if (!selPiece) return { active: false, icon: '' };
    const dc = col - selPiece.col;
    const dr = row - selPiece.row;
    if ((dc === 0 || dr === 0) && !(dc === 0 && dr === 0)) {
      const dir: Direction = { dc: Math.sign(dc), dr: Math.sign(dr) };
      const active = (validTargets as Direction[]).some(t => t.dc === dir.dc && t.dr === dir.dr);
      if (!active) return { active: false, icon: '' };
      // Only show dots within piece's range
      const ptype = PIECE_TYPES[selPiece.type];
      const range = selectedAction === 'chip' ? ptype.chipRange : ptype.shootRange;
      const dist = Math.abs(dc) + Math.abs(dr);
      return { active: dist <= range, icon: '·' };
    }
    return { active: false, icon: '' };
  };
  return (
    <div className="board-container inline-block">
      <div className="board-scroll overflow-x-auto overflow-y-auto">
        {/* Column labels */}
        {showLabels && (
          <div className="flex ml-5" style={{ width: COLS * 32 }}>
            {Array.from({ length: COLS }, (_, c) => (
              <div key={`cl-${c}`} className="flex items-center justify-center text-[8px] text-white/30"
                   style={{ width: 32, height: 16 }}>{c}</div>
            ))}
          </div>
        )}

        <div className="flex">
          {/* Row labels */}
          {showLabels && (
            <div className="flex flex-col flex-shrink-0">
              {Array.from({ length: ROWS }, (_, r) => (
                <div key={`rl-${r}`} className={`flex items-center justify-center text-[8px] ${r === 9 ? 'text-white/60 font-bold' : 'text-white/30'}`}
                     style={{ width: 20, height: 32 }}>{r === 9 ? '—' : r}</div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 32px)`,
              gridTemplateRows: `repeat(${ROWS}, 32px)`,
              minWidth: COLS * 32,
            }}
          >
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => {
                const p = pieceAt(pieces, c, r);
                const dirInfo = getDirectionInfo(c, r);

                return (
                  <Cell
                    key={`${c}-${r}`}
                    col={c} row={r}
                    isGoalCell={isGoal(c, r)}
                    isCenterLine={r === 9}
                    isPenalty={inPenaltyBox(c, r)}
                    isTarget={isTargetCell(c, r)}
                    isPassTgt={isPassTargetCell(c, r)}
                    isTackleTgt={isTackleCell(c, r)}
                    isDirection={dirInfo.active}
                    isLooseBall={ballPosition !== null && ballPosition.col === c && ballPosition.row === r}
                    directionIcon={dirInfo.icon}
                    onClick={() => handleCellClick(c, r)}
                  >
                    {p && p.active && (
                      <PieceView
                        piece={p}
                        isSelected={p.id === selectedPieceId}
                        isBallHolder={p.id === ballHolderId}
                        isGkInvincible={p.type === 'GK' && !isGKVulnerable(p, lastTouch)}
                        cannotTackle={!p.canCounterTackle}
                        onClick={() => handleCellClick(c, r)}
                      />
                    )}
                  </Cell>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
