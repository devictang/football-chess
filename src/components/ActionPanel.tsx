import React from 'react';
import { motion } from 'framer-motion';
import type { Piece, Action, Score, Team } from '../types/game';
import { PIECE_TYPES, TEAM_COLORS, ACTION_LABELS } from '../game/constants';

interface ActionPanelProps {
  selectedPiece: Piece | null;
  availableActions: Action[];
  selectedAction: Action | null;
  extraAction: boolean;
  firstTurn: boolean;
  onSelectAction: (action: Action) => void;
  onCancel: () => void;
  turn: Team;
  turnNumber: number;
  message: string;
  score: Score;
}

export default function ActionPanel({
  selectedPiece, availableActions, selectedAction,
  extraAction, firstTurn, onSelectAction, onCancel,
  turn, turnNumber, message, score,
}: ActionPanelProps) {
  const colors = TEAM_COLORS[turn];

  const isLocked = (action: Action): boolean => {
    if (firstTurn && (action === 'shoot' || action === 'chip' || action === 'through-ball')) return true;
    if (extraAction && action !== 'move') return true;
    return false;
  };

  return (
    <div className="flex flex-col gap-2 p-2 sm:p-3 w-full max-w-xs mx-auto">
      {/* Score bar */}
      <div className="flex items-center justify-between text-xs sm:text-sm px-1">
        <span className="font-bold text-blue-400">🔵 {score.A}</span>
        <span className="text-white/40 text-xs">Turn {turnNumber}</span>
        <span className="font-bold text-red-400">{score.B} 🔴</span>
      </div>

      {/* Turn banner */}
      <div className={`px-3 py-2 rounded-xl text-center text-sm font-bold ${colors.bg} ${colors.text}`}>
        {turn === 'A' ? '🔵' : '🔴'} Team {colors.name}
      </div>

      {/* Message */}
      <div className="text-xs text-white/70 text-center min-h-[24px] px-1 leading-relaxed">
        {message}
      </div>

      {/* Selected piece info */}
      {selectedPiece && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${
            selectedPiece.team === 'A' ? 'from-blue-500 to-blue-700' : 'from-red-500 to-red-700'
          } flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
            {PIECE_TYPES[selectedPiece.type].label}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white/90 truncate">
              {PIECE_TYPES[selectedPiece.type].name}
            </div>
            <div className="text-[10px] text-white/50">
              ({selectedPiece.col}, {selectedPiece.row})
              {selectedPiece.hasBall && ' ⚽'}
            </div>
          </div>
          {extraAction && (
            <span className="text-[10px] text-green-400 font-medium whitespace-nowrap">+1 Move</span>
          )}
        </div>
      )}

      {/* Action buttons */}
      {availableActions.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {availableActions.map(action => {
            const locked = isLocked(action);
            return (
              <motion.button
                key={action}
                className={`text-xs sm:text-sm px-2 py-2 rounded-xl font-medium transition-colors ${
                  selectedAction === action
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg'
                    : locked
                      ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 active:bg-white/30'
                }`}
                onClick={() => !locked && onSelectAction(action)}
                whileTap={locked ? {} : { scale: 0.95 }}
              >
                {ACTION_LABELS[action]}
                {locked && firstTurn && (action === 'shoot' || action === 'chip') && (
                  <div className="text-[8px] text-yellow-500">🔒 1st turn</div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Cancel */}
      {selectedPiece && (
        <motion.button
          className="text-[11px] text-white/40 hover:text-white/70 py-1"
          onClick={onCancel}
          whileTap={{ scale: 0.95 }}
        >
          ✕ Cancel
        </motion.button>
      )}
    </div>
  );
}
