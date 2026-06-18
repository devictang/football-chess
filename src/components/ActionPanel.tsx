import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Piece, Action, Score, Team } from '../types/game';
import { PIECE_TYPES, ACTION_LABELS } from '../game/constants';

interface ActionPanelProps {
  selectedPiece: Piece | null;
  availableActions: Action[];
  selectedAction: string | null;
  extraAction: boolean;
  actionPoints: number;
  actedPiecesCount: number;
  firstTurn: boolean;
  onSelectAction: (action: Action) => void;
  onCancel: () => void;
  onEndTurn: () => void;
  turn: Team;
  turnNumber: number;
  message: string;
  score: Score;
}

export default function ActionPanel({
  selectedPiece, availableActions, selectedAction,
  extraAction, actionPoints, actedPiecesCount, firstTurn,
  onSelectAction, onCancel, onEndTurn,
  turn, turnNumber, message, score,
}: ActionPanelProps) {
  const maxAP = 2;

  return (
    <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-2xl text-xs sm:text-sm">
      {/* Score + Turn */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-blue-400">🔵 {score.A}</span>
          <span className="text-white/30">-</span>
          <span className="font-bold text-red-400">{score.B} 🔴</span>
        </div>
        <div className="text-right">
          <div className="text-white/60 font-semibold">
            {turn === 'A' ? '🔵 BLUE' : '🔴 RED'}
          </div>
          <div className="text-[10px] text-white/30">Turn {turnNumber}</div>
        </div>
      </div>

      {/* Action Points bar */}
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
        <span className="text-white/50 text-[10px] font-semibold">AP</span>
        <div className="flex gap-1">
          {Array.from({ length: maxAP }, (_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border ${
                i < actionPoints
                  ? 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400/30'
                  : 'bg-gray-700/50 border-gray-600'
              }`}
            />
          ))}
        </div>
        {extraAction && (
          <motion.span
            className="text-yellow-300 text-[10px] font-bold"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            +FREE
          </motion.span>
        )}
        {actedPiecesCount > 0 && (
          <span className="text-[9px] text-white/40 ml-auto">{actedPiecesCount} acted</span>
        )}
      </div>

      {/* Message */}
      <div className="text-white/70 text-[11px] leading-relaxed min-h-[2.5em] px-1">
        {message}
      </div>

      {/* Actions */}
      <AnimatePresence mode="wait">
        {selectedPiece && availableActions.length > 0 && (
          <motion.div
            className="flex flex-col gap-1.5"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
              {PIECE_TYPES[selectedPiece.type].name}
            </div>
            {availableActions.map(action => {
              const isSelected = selectedAction === action;
              const isDisabled = firstTurn && (action === 'shoot' || action === 'chip' || action === 'through-ball');
              return (
                <motion.button
                  key={action}
                  className={`w-full px-3 py-2 rounded-xl text-left font-medium text-[11px] transition-colors
                    ${isSelected
                      ? 'bg-white/20 text-white ring-1 ring-white/30'
                      : isDisabled
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-white/8 hover:bg-white/15 text-white/80'
                    }`}
                  onClick={() => !isDisabled && onSelectAction(action)}
                  whileTap={!isDisabled ? { scale: 0.97 } : {}}
                >
                  {ACTION_LABELS[action]}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons row */}
      <div className="flex gap-2 mt-1">
        {(selectedPiece || selectedAction) && (
          <motion.button
            className="flex-1 px-3 py-2 bg-white/8 hover:bg-white/15 rounded-xl text-[11px] text-white/60"
            onClick={onCancel}
            whileTap={{ scale: 0.97 }}
          >
            ✕ Cancel
          </motion.button>
        )}
        {!selectedPiece && (
          <motion.button
            className="flex-1 px-3 py-2 bg-white/8 hover:bg-white/15 rounded-xl text-[11px] text-white/60"
            onClick={onEndTurn}
            whileTap={{ scale: 0.97 }}
          >
            ⏭️ End Turn
          </motion.button>
        )}
      </div>
    </div>
  );
}
