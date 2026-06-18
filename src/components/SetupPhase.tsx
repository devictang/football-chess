import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Piece, Team, GamePhase, GameMode } from '../types/game';
import { PIECE_TYPES, PIECE_ORDER, TEAM_COLORS, HALF_VIEW, HALF } from '../game/constants';
import { inPenaltyBox } from '../game/engine';
import Board from './Board';

interface SetupPhaseProps {
  setupPiecesA: Piece[];
  setupPiecesB: Piece[];
  setupTeam: Team;
  phase: GamePhase;
  gameMode: GameMode;
  setupSelectedPieceId: string | null;
  message: string;
  onCellClick: (pos: unknown) => void;
  onPieceClick: (id: string) => void;
  onSelectRosterPiece: (id: string) => void;
  onQuickSetup: () => void;
  onConfirm: () => void;
}

export default function SetupPhase({
  setupPiecesA, setupPiecesB, setupTeam,
  phase, gameMode, setupSelectedPieceId,
  message, onCellClick, onPieceClick,
  onSelectRosterPiece, onQuickSetup, onConfirm,
}: SetupPhaseProps) {
  const currentPieces = setupTeam === 'A' ? setupPiecesA : setupPiecesB;
  const colors = TEAM_COLORS[setupTeam];
  const placed = currentPieces.filter(p => p.active);
  const unplaced = currentPieces.filter(p => !p.active);
  const allPlaced = placed.length === 8;

  // Check if GK is in penalty box
  const gkPlaced = placed.find(p => p.type === 'GK');
  const gkValid = gkPlaced ? inPenaltyBox(gkPlaced.col, gkPlaced.row) : false;

  // Build all active pieces for Board rendering (both teams)
  const allActive = [
    ...setupPiecesA.filter(p => p.active),
    ...setupPiecesB.filter(p => p.active),
  ];

  const viewRows = HALF_VIEW[setupTeam];

  const isPvpAndPlayer2 = gameMode === 'pvp' && phase === 'setup-b';

  return (
    <motion.div
      className="flex flex-col items-center gap-2 w-full max-w-lg mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={`text-sm font-bold ${colors.text}`}>
        {setupTeam === 'A' ? '🔵' : '🔴'} Team {colors.name}
      </div>

      {isPvpAndPlayer2 ? (
        <div className="text-xs text-yellow-400 font-semibold text-center">
          🎮 Pass the device to Team Red!<br />
          <span className="text-white/60 font-normal">Set up your formation on your half.</span>
        </div>
      ) : (
        <div className="text-xs text-white/60 text-center max-w-xs mb-1">
          {message}
        </div>
      )}

      {/* Board (half-field) */}
      <div className="rounded-2xl overflow-hidden border border-white/10">
        <Board
          pieces={allActive}
          selectedPieceId={setupSelectedPieceId}
          selectedAction={null}
          validTargets={[]}
          ballHolderId={null}
          ballPosition={null}
          lastTouch={null}
          turn={setupTeam}
          phase={phase}
          viewRows={viewRows}
          onCellClick={onCellClick}
          onPieceClick={onPieceClick}
          showLabels={true}
        />
      </div>

      {/* Roster bar */}
      <div className="w-full max-w-[480px]">
        <div className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1.5">
          Roster ({placed.length}/8 placed{placed.length === 8 ? '' : ', GK must be in box'})
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {currentPieces.map(piece => {
            const isSelected = setupSelectedPieceId === piece.id;
            const isPlaced = piece.active;
            const type = PIECE_TYPES[piece.type];
            const canSelect = !isPlaced && !isSelected;
            return (
              <motion.button
                key={piece.id}
                className={`
                  relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-medium
                  transition-colors border
                  ${isSelected
                    ? 'bg-white/20 text-white border-white/30 ring-1 ring-white/20'
                    : isPlaced
                      ? 'bg-emerald-900/30 text-emerald-300/60 border-emerald-700/30 cursor-default'
                      : 'bg-white/8 text-white/80 border-white/10 hover:bg-white/15'
                  }
                `}
                onClick={() => canSelect && onSelectRosterPiece(piece.id)}
                whileTap={canSelect ? { scale: 0.95 } : {}}
              >
                <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${type.colorClass} flex items-center justify-center text-[6px] font-bold text-white flex-shrink-0`}>
                  {type.label}
                </div>
                <span className="truncate">{isPlaced ? '✅' : type.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-white/30 text-center leading-relaxed px-2">
        1. Click a piece in the roster to select it<br />
        2. Click on your half to place it<br />
        3. Click a placed piece on the board to return it to roster
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 w-full max-w-[480px]">
        <motion.button
          className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium"
          onClick={onQuickSetup}
          whileTap={{ scale: 0.95 }}
        >
          ⚡ Auto-place
        </motion.button>

        <motion.button
          className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold ${
            allPlaced
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          onClick={allPlaced ? onConfirm : undefined}
          whileTap={allPlaced ? { scale: 0.95 } : {}}
        >
          ✅ Confirm ({placed.length}/8)
        </motion.button>
      </div>
    </motion.div>
  );
}
