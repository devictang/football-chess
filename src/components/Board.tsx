import React from 'react';
import { motion } from 'framer-motion';
import type { Piece, Direction, ValidTarget, MoveTarget, PassTarget, GamePhase, Team } from '../types/game';
import {
  COLS, ROWS, GOAL_START, GOAL_END,
  BOX_TOP, BOX_BOTTOM, PIECE_TYPES, TEAM_COLORS,
  CARDINAL,
} from '../game/constants';
import { isGoal, inPenaltyBox, pieceAt, getBallHolder } from '../game/engine';

/* ─── Types ─── */
interface BoardProps {
  pieces: Piece[];
  selectedPieceId: string | null;
  selectedAction: string | null;
  validTargets: ValidTarget[];
  ballHolderId: string | null;
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
  directionIcon: string;
  onClick: () => void;
  children?: React.ReactNode;
}

/* ─── Cell ─── */
function Cell({ col, row, isGoalCell, isCenterLine, isPenalty, isTarget, isPassTgt, isTackleTgt, isDirection, directionIcon, onClick, children }: CellProps) {
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
          className="absolute inset-1 rounded-full bg-blue-400/60 border-2 border-blue-300 z-10"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        />
      )}
      {isDirection && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-lg z-10"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
        >
          {directionIcon}
        </motion.div>
      )}

      {children}
    </motion.div>
  );
}

/* ─── Piece View ─── */
function PieceView({ piece, isSelected, isBallHolder, onClick }: {
  piece: Piece;
  isSelected: boolean;
  isBallHolder: boolean;
  onClick: () => void;
}) {
  const type = PIECE_TYPES[piece.type];
  const teamGrad = piece.team === 'A'
    ? 'from-blue-500 to-blue-700'
    : 'from-red-500 to-red-700';
  const borderRing = isSelected ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-gray-900' : '';

  return (
    <motion.div
      className={`absolute inset-0.5 rounded-full bg-gradient-to-br ${teamGrad} ${borderRing} flex items-center justify-center z-20 cursor-pointer`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 25, mass: 0.8 }}
      whileTap={{ scale: 0.9 }}
    >
      <span className="text-[9px] sm:text-[10px] font-bold text-white drop-shadow-md leading-none">
        {type.label}
      </span>
      {isBallHolder && <span className="absolute -top-1 -right-1 text-[10px] z-30">⚽</span>}
    </motion.div>
  );
}

/* ─── Main Board ─── */
export default function Board({
  pieces, selectedPieceId, selectedAction, validTargets,
  ballHolderId, turn, phase, onCellClick, onPieceClick, showLabels = true,
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
          if (matches) { onCellClick(dir); return; }
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
      const icon = selectedAction === 'shoot' ? '⚡' : selectedAction === 'chip' ? '🏐' : '💨';
      return { active, icon };
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
                    directionIcon={dirInfo.icon}
                    onClick={() => handleCellClick(c, r)}
                  >
                    {p && p.active && (
                      <PieceView
                        piece={p}
                        isSelected={p.id === selectedPieceId}
                        isBallHolder={p.id === ballHolderId}
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
