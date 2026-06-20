import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useGame from './hooks/useGame';
import Board from './components/Board';
import ActionPanel from './components/ActionPanel';
import SetupPhase from './components/SetupPhase';
import GameOver from './components/GameOver';
import { PIECE_TYPES, TEAM_COLORS, GOAL_LIMIT } from './game/constants';

export default function App() {
  const {
    state,
    startGame,
    startSetup,
    setupSelectPiece,
    setupPlacePiece,
    quickSetupPieces,
    setupConfirm,
    selectPiece,
    selectAction,
    executeAction,
    cancelSelection,
    endTurn,
    restart,
    clearGoalAnimation,
  } = useGame();

  const {
    phase, pieces, turn, turnNumber, ballHolderId, ballPosition,
    selectedPieceId, selectedAction, validTargets, availableActions,
    message, score, extraAction, firstTurn, actionPoints, actedPieces,
    setupPiecesA, setupPiecesB, setupTeam, lastTouch, gameMode,
    setupSelectedPieceId, passRangeCells, goalAnimation, offsideLine,
  } = state;

  const selectedPiece = selectedPieceId
    ? pieces.find(p => p.id === selectedPieceId) ?? null
    : null;

  // Auto-clear goal animation after 1.5s
  useEffect(() => {
    if (goalAnimation) {
      const timer = setTimeout(() => clearGoalAnimation(), 1800);
      return () => clearTimeout(timer);
    }
  }, [goalAnimation, clearGoalAnimation]);

  /* ─── Unified click handler ─── */
  const handleCellClick = (target: unknown) => {
    if (phase === 'setup-a' || phase === 'setup-b') {
      const pos = target as { col: number; row: number };
      setupPlacePiece(pos.col, pos.row);
      return;
    }

    if (phase === 'playing' && selectedAction && selectedPieceId) {
      if (selectedAction === 'shoot' || selectedAction === 'chip' || selectedAction === 'through-ball') {
        executeAction(target);
      } else if (selectedAction === 'pass') {
        if (typeof target === 'string') {
          executeAction(target);
        }
      } else {
        executeAction(target);
      }
    }
  };

  const handlePieceClick = (pieceId: string) => {
    if (phase === 'playing') selectPiece(pieceId);
  };

  /* ─── Menu screen ─── */
  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
        <motion.div
          className="flex flex-col items-center gap-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
            ⚽ Football Chess
          </h1>

          <p className="text-sm text-white/50 text-center max-w-xs leading-relaxed">
            A turn-based football strategy game on a 15×19 grid.
            Control your team, pass, tackle, and score!
          </p>

          <div className="flex flex-col gap-3 w-full max-w-[260px] mt-2">
            <motion.button
              className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl font-bold text-sm shadow-lg"
              onClick={startGame}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              ⚡ Quick Start
            </motion.button>
            <motion.button
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-semibold text-sm"
              onClick={() => startSetup('ai')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              🤖 vs AI · Manual Setup
            </motion.button>
            <motion.button
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-semibold text-sm"
              onClick={() => startSetup('pvp')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              👥 vs Player · Manual Setup
            </motion.button>
          </div>

          {/* Team info */}
          <div className="grid grid-cols-2 gap-3 mt-4 w-full max-w-[300px]">
            {(['A', 'B'] as const).map(team => (
              <div key={team} className={`${TEAM_COLORS[team].bg} rounded-xl p-3 text-xs`}>
                <div className={`font-bold mb-1.5 ${TEAM_COLORS[team].text}`}>
                  {team === 'A' ? '🔵' : '🔴'} Team {TEAM_COLORS[team].name}
                </div>
                <div className="space-y-0.5 text-white/60">
                  {Object.entries(PIECE_TYPES).map(([key, cfg]) => (
                    <div key={key} className="flex justify-between">
                      <span>{cfg.label}</span>
                      <span>×{cfg.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  /* ─── Setup phases ─── */
  if (phase === 'setup-a' || phase === 'setup-b') {
    // For vs AI with Team B setup (shouldn't happen since AI auto-placed)
    // For PvP, show setup for current team
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-start py-3 px-2">
        <SetupPhase
          setupPiecesA={setupPiecesA}
          setupPiecesB={setupPiecesB}
          setupTeam={setupTeam}
          phase={phase}
          gameMode={gameMode}
          setupSelectedPieceId={setupSelectedPieceId}
          message={message}
          onCellClick={handleCellClick}
          onPieceClick={(id) => {
            // In setup, clicking a placed piece returns it to roster
            // But we need the cell coords for that — handled in setupPlacePiece
            // For roster selection:
            const team = phase === 'setup-a' ? 'A' : 'B';
            const pieces = team === 'A' ? setupPiecesA : setupPiecesB;
            const p = pieces.find(pp => pp.id === id);
            if (p && !p.active) {
              setupSelectPiece(id);
            }
          }}
          onSelectRosterPiece={setupSelectPiece}
          onQuickSetup={quickSetupPieces}
          onConfirm={setupConfirm}
        />
      </div>
    );
  }

  /* ─── Playing phase ─── */
  if (phase === 'playing') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-start py-2 px-1">
        {/* GOAL Animation Overlay */}
        <AnimatePresence>
          {goalAnimation && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-6xl sm:text-8xl font-black text-yellow-400 drop-shadow-[0_0_40px_rgba(250,204,21,0.7)]"
                initial={{ scale: 0.3, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12, mass: 1.5 }}
              >
                ⚽ GOAL!
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent mb-1">
          ⚽ Football Chess
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-3xl">
          <div className="flex-1 flex justify-center overflow-hidden">
            <Board
              pieces={pieces}
              selectedPieceId={selectedPieceId}
              selectedAction={selectedAction}
              validTargets={validTargets}
              ballHolderId={ballHolderId}
              ballPosition={ballPosition}
              lastTouch={lastTouch}
              turn={turn}
              phase={phase}
              passRangeCells={passRangeCells}
              offsideLine={offsideLine}
              onCellClick={handleCellClick}
              onPieceClick={handlePieceClick}
            />
          </div>
          <div className="w-full sm:w-52 flex-shrink-0">
            <ActionPanel
              selectedPiece={selectedPiece}
              availableActions={availableActions as any}
              selectedAction={selectedAction}
              extraAction={extraAction}
              actionPoints={actionPoints}
              actedPiecesCount={actedPieces.length}
              firstTurn={firstTurn}
              onSelectAction={selectAction}
              onCancel={cancelSelection}
              onEndTurn={endTurn}
              turn={turn}
              turnNumber={turnNumber}
              message={message}
              score={score}
            />
            {/* Mini legend */}
            <div className="mt-2 mx-2 px-3 py-2 bg-white/5 rounded-xl text-[10px] text-white/40">
              <div className="font-medium text-white/60 mb-1">Piece Guide</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <span>🧤 GK</span><span>Goalkeeper</span>
                <span>🛡️ DF</span><span>Defender</span>
                <span>🔗 MF</span><span>Midfielder</span>
                <span>⚡ WG</span><span>Winger</span>
                <span>🎯 CF</span><span>Center Forward</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Game over ─── */
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <GameOver score={score} message={message} onRestart={restart} />
    </div>
  );
}
