import React from 'react';
import { motion } from 'framer-motion';
import type { Piece, Team, GamePhase } from '../types/game';
import { PIECE_TYPES, PIECE_ORDER, TEAM_COLORS } from '../game/constants';
import Board from './Board';

interface SetupPhaseProps {
  setupPiecesA: Piece[];
  setupPiecesB: Piece[];
  setupPieceIndex: number;
  setupTeam: Team;
  phase: GamePhase;
  message: string;
  onCellClick: (pos: unknown) => void;
  onQuickSetup: () => void;
}

export default function SetupPhase({
  setupPiecesA, setupPiecesB, setupPieceIndex, setupTeam,
  phase, message, onCellClick, onQuickSetup,
}: SetupPhaseProps) {
  const allActive = [
    ...setupPiecesA.filter(p => p.active),
    ...setupPiecesB.filter(p => p.active),
  ];
  const currentPieces = setupTeam === 'A' ? setupPiecesA : setupPiecesB;
  const nextType = setupPieceIndex < 8 ? currentPieces[setupPieceIndex]?.type : null;
  const colors = TEAM_COLORS[setupTeam];

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`text-sm font-bold ${colors.text}`}>
        {setupTeam === 'A' ? '🔵' : '🔴'} Team {colors.name}
      </div>

      <div className="text-xs text-white/60 text-center max-w-xs mb-1">
        {message}
      </div>

      {/* Next piece indicator */}
      {nextType && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full text-xs">
          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${PIECE_TYPES[nextType].colorClass} flex items-center justify-center text-[8px] font-bold text-white`}>
            {PIECE_TYPES[nextType].label}
          </div>
          <span>Placing: <strong>{PIECE_TYPES[nextType].name}</strong></span>
          <span className="text-white/40">({setupPieceIndex + 1}/8)</span>
        </div>
      )}

      <Board
        pieces={allActive}
        selectedPieceId={null}
        selectedAction={null}
        validTargets={[]}
        ballHolderId={null}
        turn={setupTeam}
        phase={phase}
        onCellClick={onCellClick}
        onPieceClick={() => {}}
        showLabels={true}
      />

      <motion.button
        className="mt-1 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium"
        onClick={onQuickSetup}
        whileTap={{ scale: 0.95 }}
      >
        ⚡ Auto-place
      </motion.button>
    </motion.div>
  );
}
