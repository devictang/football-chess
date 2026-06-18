import React from 'react';
import { motion } from 'framer-motion';
import type { Score } from '../types/game';
import { GOAL_LIMIT } from '../game/constants';

interface GameOverProps {
  score: Score;
  message: string;
  onRestart: () => void;
}

export default function GameOver({ score, message, onRestart }: GameOverProps) {
  const winner = score.A > score.B ? 'Blue' : 'Red';
  const emoji = score.A > score.B ? '🔵' : '🔴';

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 mt-8 px-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="text-5xl"
        animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      >
        🏆
      </motion.div>

      <div className="text-xl sm:text-2xl font-bold text-yellow-400 text-center">
        {emoji} {winner} Wins!
      </div>

      <div className="text-sm text-white/60 text-center max-w-xs">
        {emoji} Team {winner} reached {GOAL_LIMIT} goals first!
      </div>

      <div className="flex items-center gap-6 text-2xl font-bold mt-2">
        <span className="text-blue-400">{score.A}</span>
        <span className="text-white/30 text-lg">-</span>
        <span className="text-red-400">{score.B}</span>
      </div>

      <motion.button
        className="mt-4 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl font-bold text-sm shadow-lg"
        onClick={onRestart}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        🔄 Play Again
      </motion.button>
    </motion.div>
  );
}
