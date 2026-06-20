import { useState, useCallback } from 'react';
import type { Piece, Position, Direction, GameState, GamePhase, Action, ValidTarget, Team, Score, GameMode } from '../types/game';
import {
  COLS, ROWS, PIECE_TYPES, CARDINAL, ALL_DIRS, GOAL_LIMIT,
} from '../game/constants';
import {
  inBounds, isGoal, inPenaltyBox, getTeamBox, inOwnHalf,
  chebDist, getValidMoves, getValidPassTargets,
  getShotPath, getPassRangeCells, getOffsideLine, pieceAt, teamPieces, getBallHolder,
  isGKVulnerable, isValidSetupPlacement,
  createEmptyPieces, getDefaultFormation,
  hasClearShotToGoal, findVacantAdjacent, oppositeTeam,
  getFurthestForwardPlayer,
} from '../game/engine';

const INITIAL_STATE: GameState = {
  phase: 'menu',
  pieces: [],
  gameMode: 'quick',
  turn: 'A',
  turnNumber: 1,
  ballHolderId: null,
  ballPosition: null,
  selectedPieceId: null,
  selectedAction: null,
  validTargets: [],
  availableActions: [],
  message: '',
  score: { A: 0, B: 0 },
  extraAction: false,
  actionPoints: 2,
  actedPieces: [],
  extraActionPieceId: null,
  lastTackledId: null,
  lastTouch: null,
  setupPiecesA: [],
  setupPiecesB: [],
  setupPieceIndex: 0,
  setupTeam: 'A',
  setupSelectedPieceId: null,
  offsideLine: null,
  passRangeCells: [],
  goalAnimation: false,
  firstTurn: true,
  gkMustPassOut: false,
};

export default function useGame() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);

  /* ─── Quick Start ─── */
  const startGame = useCallback(() => {
    let piecesA = getDefaultFormation('A');
    let piecesB = getDefaultFormation('B');
    let allPieces = [...piecesA, ...piecesB];

    // Set kickoff: Team A's closest piece to center
    const teamAPieces = allPieces.filter(p => p.team === 'A');
    const closest = teamAPieces.reduce((a, b) =>
      Math.abs(a.row - 9) <= Math.abs(b.row - 9) ? a : b
    );
    const kickoffer = allPieces.find(p => p.id === closest.id)!;
    kickoffer.col = 7;
    kickoffer.row = 9;
    kickoffer.hasBall = true;

    setState({
      ...INITIAL_STATE,
      gameMode: 'quick',
      phase: 'playing',
      pieces: allPieces,
      ballHolderId: kickoffer.id,
      turn: 'A',
      actionPoints: 2,
      actedPieces: [],
      message: '⚽ Game started! Team Blue goes first.',
    });
  }, []);

  /* ─── Start Manual Setup ─── */
  const startSetup = useCallback((mode: GameMode) => {
    setState({
      ...INITIAL_STATE,
      gameMode: mode,
      phase: 'setup-a',
      setupPiecesA: createEmptyPieces('A'),
      setupPiecesB: createEmptyPieces('B'),
      setupSelectedPieceId: null,
      setupTeam: 'A',
      message: `🔵 Team Blue: Click a piece in the roster, then click your half to place it.`,
    });
  }, []);

  /* ─── Setup: select piece from roster ─── */
  const setupSelectPiece = useCallback((pieceId: string) => {
    setState(prev => {
      if (prev.phase !== 'setup-a' && prev.phase !== 'setup-b') return prev;
      return { ...prev, setupSelectedPieceId: pieceId, validTargets: [], message: `Selected ${PIECE_TYPES[pieceId.split('-')[1]].name} — click on your half to place.` };
    });
  }, []);

  /* ─── Setup: place piece ─── */
  const setupPlacePiece = useCallback((col: number, row: number) => {
    setState(prev => {
      if (prev.phase !== 'setup-a' && prev.phase !== 'setup-b') return prev;

      const team = prev.phase === 'setup-a' ? 'A' : 'B';
      const setupPieces = team === 'A' ? prev.setupPiecesA : prev.setupPiecesB;
      const allActive = [
        ...prev.setupPiecesA.filter(p => p.active),
        ...prev.setupPiecesB.filter(p => p.active),
      ];

      // If clicking on own placed piece → return it to roster
      const clickedOwn = allActive.find(p => p.col === col && p.row === row && p.team === team);
      if (clickedOwn) {
        const updatedPieces = setupPieces.map(p =>
          p.id === clickedOwn.id ? { ...p, col: -1, row: -1, active: false } : p
        );
        const result: any = { setupSelectedPieceId: null };
        if (team === 'A') result.setupPiecesA = updatedPieces;
        else result.setupPiecesB = updatedPieces;
        result.message = `${PIECE_TYPES[clickedOwn.type].name} returned to roster.`;
        return { ...prev, ...result };
      }

      // If no piece selected from roster, ignore
      if (!prev.setupSelectedPieceId) return { ...prev, message: 'Click a piece in the roster first!' };

      const piece = setupPieces.find(p => p.id === prev.setupSelectedPieceId);
      if (!piece) return prev;

      // GK must be in penalty box
      if (piece.type === 'GK' && !inPenaltyBox(col, row)) {
        return { ...prev, message: '🧤 Goalkeeper must be placed in the penalty box!' };
      }

      // Must be in own half
      if (!inOwnHalf(team, row)) {
        return { ...prev, message: 'Pieces must be placed in your own half!' };
      }

      // Cell must be empty
      if (pieceAt(allActive, col, row)) {
        return { ...prev, message: 'That cell is already occupied!' };
      }

      const updatedPieces = setupPieces.map(p =>
        p.id === prev.setupSelectedPieceId ? { ...p, col, row, active: true } : p
      );

      const result: any = { setupSelectedPieceId: null };
      if (team === 'A') result.setupPiecesA = updatedPieces;
      else result.setupPiecesB = updatedPieces;
      result.message = `${PIECE_TYPES[piece.type].name} placed at (${col}, ${row}). Click another piece or adjust.`;

      return { ...prev, ...result };
    });
  }, []);

  /* ─── Setup: auto-place ─── */
  const quickSetupPieces = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'setup-a' && prev.phase !== 'setup-b') return prev;
      const team = prev.phase === 'setup-a' ? 'A' : 'B';
      const formation = getDefaultFormation(team);

      if (team === 'A') {
        return {
          ...prev,
          setupPiecesA: formation,
          setupSelectedPieceId: null,
          message: '🔵 Team Blue auto-placed! Click Confirm if ready.',
        };
      }

      return {
        ...prev,
        setupPiecesB: formation,
        setupSelectedPieceId: null,
        message: '🔴 Team Red auto-placed! Click Confirm if ready.',
      };
    });
  }, []);

  /* ─── Setup: confirm formation ─── */
  const setupConfirm = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'setup-a' && prev.phase !== 'setup-b') return prev;
      const team = prev.phase === 'setup-a' ? 'A' : 'B';
      const setupPieces = team === 'A' ? prev.setupPiecesA : prev.setupPiecesB;
      const placedCount = setupPieces.filter(p => p.active).length;

      if (placedCount < 8) {
        return { ...prev, message: `Place all 8 pieces first (${placedCount}/8 placed)!` };
      }

      if (prev.gameMode === 'pvp') {
        // PvP: move to opponent's setup
        if (team === 'A') {
          return {
            ...prev,
            phase: 'setup-b' as GamePhase,
            setupTeam: 'B' as Team,
            setupSelectedPieceId: null,
            message: '🔴 Team Red: Click a piece in the roster, then click your half to place it.',
          };
        }
        // Both teams placed: start game
        return startGameAfterSetup(prev);
      }

      // vs AI: Player A placed, auto-place AI (Team B), start game
      if (team === 'A') {
        const aiPieces = getDefaultFormation('B');
        return startGameAfterSetup({
          ...prev,
          setupPiecesB: aiPieces,
        });
      }

      // Fallback (shouldn't reach here for vs AI with team B, since AI auto-placed)
      return startGameAfterSetup(prev);
    });
  }, []);

  /* ─── Helper: transition from setup to playing ─── */
  function startGameAfterSetup(prev: GameState): GameState {
    let allActive = [
      ...prev.setupPiecesA.filter(p => p.active),
      ...prev.setupPiecesB.filter(p => p.active),
    ].map(p => ({ ...p }));

    // Set kickoff: Team A's closest piece to center
    const teamAPieces = allActive.filter(p => p.team === 'A');
    const closest = teamAPieces.reduce((a, b) =>
      Math.abs(a.row - 9) <= Math.abs(b.row - 9) ? a : b
    );
    const kickoffer = allActive.find(p => p.id === closest.id)!;
    kickoffer.col = 7;
    kickoffer.row = 9;
    kickoffer.hasBall = true;

    return {
      ...prev,
      pieces: allActive,
      ballHolderId: kickoffer.id,
      phase: 'playing' as GamePhase,
      turn: 'A' as Team,
      turnNumber: 1,
      firstTurn: true,
      selectedPieceId: null,
      selectedAction: null,
      validTargets: [],
      availableActions: [],
      setupSelectedPieceId: null,
      message: '⚽ Game started! Team Blue goes first.',
    };
  }

  /* ─── Select piece ─── */
  const selectPiece = useCallback((pieceId: string) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      const piece = prev.pieces.find(p => p.id === pieceId);
      if (!piece || !piece.active) return prev;
      if (piece.team !== prev.turn) return prev;

      // Stunned check: tackled players skip their next turn
      if (piece.stunned) {
        return {
          ...prev,
          selectedPieceId: null,
          selectedAction: null,
          validTargets: [],
          availableActions: [],
          message: `💫 ${PIECE_TYPES[piece.type].name} is stunned and cannot act this turn!`,
        };
      }

      // Already acted check
      if (prev.actedPieces.includes(piece.id) && !prev.extraAction) {
        return {
          ...prev,
          selectedPieceId: null,
          selectedAction: null,
          validTargets: [],
          availableActions: [],
          message: `⛔ ${PIECE_TYPES[piece.type].name} already acted this turn.`,
        };
      }

      // GK must-pass-out enforcement
      if (prev.gkMustPassOut) {
        const gk = prev.pieces.find(p => p.type === 'GK' && p.team === prev.turn && p.active);
        if (gk && gk.hasBall && piece.id !== gk.id) {
          return { ...prev, message: "🧤 Goalkeeper must pass the ball out of the penalty box this turn!" };
        }
      }

      const type = PIECE_TYPES[piece.type];
      const isExtraAction = prev.extraAction;
      const hasAP = prev.actionPoints > 0;
      const effectivelyExtraAction = isExtraAction && !hasAP;
      const cost = piece.hasBall ? 2 : 1;

      // Check AP (skip if free extra action and no AP left)
      if (!effectivelyExtraAction && prev.actionPoints < cost) {
        return {
          ...prev,
          selectedPieceId: null,
          selectedAction: null,
          validTargets: [],
          availableActions: [],
          message: `Not enough AP (need ${cost}, have ${prev.actionPoints}).`,
        };
      }

      const moves = getValidMoves(piece, prev.pieces, prev.lastTouch);
      const actions: Action[] = [];
      if (moves.length > 0) actions.push('move');

      // Compute offside line
      const ballHolder = getBallHolder(prev.pieces);
      const offsideLine = getOffsideLine(prev.pieces, ballHolder, prev.turn);

      if (effectivelyExtraAction) {
        // Extra action from tackle: only move, unless ball-holding MF
        if (piece.type === 'MF' && piece.hasBall) {
          // Ball-holding MF can use full actions during extra action
          if (piece.hasBall) {
            const passTargets = getValidPassTargets(piece, prev.pieces);
            if (passTargets.length > 0) actions.push('pass');
          }
          if (type.canShoot && piece.hasBall && !prev.firstTurn) actions.push('shoot');
          if (piece.hasBall && type.canShoot && !prev.firstTurn) actions.push('through-ball');
        }
      } else {
        // Normal action
        if (piece.hasBall) {
          const passTargets = getValidPassTargets(piece, prev.pieces);
          if (passTargets.length > 0) actions.push('pass');
          if (type.canShoot && !prev.firstTurn) actions.push('shoot');
          if (type.canChip && !prev.firstTurn) actions.push('chip');
          if ((type.canShoot || piece.type === 'GK') && !prev.firstTurn) actions.push('through-ball');
        }
      }

      // GK pass-out filter
      let filteredActions = actions;
      if (prev.gkMustPassOut && piece.type === 'GK') {
        if (actions.includes('pass')) {
          filteredActions = actions.filter(a => a === 'pass');
        }
      }

      const apMsg = isExtraAction ? ' (FREE extra action)' : ` (${cost} AP)`;
      return {
        ...prev,
        selectedPieceId: pieceId,
        validTargets: moves,
        selectedAction: null,
        availableActions: filteredActions,
        offsideLine,
        message: `Selected ${type.name}.${apMsg}`,
      };
    });
  }, []);

  /* ─── Select action ─── */
  const selectAction = useCallback((action: Action) => {
    setState(prev => {
      if (!prev.selectedPieceId) return prev;
      const piece = prev.pieces.find(p => p.id === prev.selectedPieceId);
      if (!piece) return prev;

      if (action === 'move') {
        return {
          ...prev,
          selectedAction: 'move',
          validTargets: getValidMoves(piece, prev.pieces, prev.lastTouch),
          message: 'Click a highlighted cell to move/tackle.',
        };
      }

      if (action === 'pass') {
        const passCells = getPassRangeCells(piece);
        const ballHolder = getBallHolder(prev.pieces);
        const offsideLine = getOffsideLine(prev.pieces, ballHolder, prev.turn);
        return {
          ...prev,
          selectedAction: 'pass',
          validTargets: getValidPassTargets(piece, prev.pieces, offsideLine),
          passRangeCells: passCells,
          offsideLine,
          message: offsideLine !== null
            ? '🎯 Click a teammate to pass (yellow line = offside, no pass beyond it).'
            : 'Click a highlighted teammate to pass.',
        };
      }

      if (action === 'shoot' || action === 'chip') {
        const isChip = action === 'chip';
        const type = PIECE_TYPES[piece.type];
        const range = isChip ? type.chipRange : type.shootRange;
        const dirs: Direction[] = [];
        for (const d of ALL_DIRS) {
          const path = getShotPath(piece.col, piece.row, d, prev.pieces, range);
          if (path.length > 1) dirs.push({ ...d });
        }
        return {
          ...prev,
          selectedAction: action,
          validTargets: dirs,
          message: `Click a direction to ${action}${isChip ? ' (lofted)' : ''}.`,
        };
      }

      if (action === 'through-ball') {
        const type = PIECE_TYPES[piece.type];
        const range = type.shootRange;
        const dirs: Direction[] = [];
        for (const d of ALL_DIRS) {
          const path = getShotPath(piece.col, piece.row, d, prev.pieces, range);
          if (path.length > 1) dirs.push({ ...d });
        }
        return {
          ...prev,
          selectedAction: 'through-ball',
          validTargets: dirs,
          message: 'Click a direction for through ball.',
        };
      }

      return prev;
    });
  }, []);

  /* ─── Execute action ─── */
  const executeAction = useCallback((target: unknown) => {
    setState(prev => {
      if (prev.phase !== 'playing' || !prev.selectedPieceId || !prev.selectedAction) return prev;
      const piece = prev.pieces.find(p => p.id === prev.selectedPieceId);
      if (!piece) return prev;

      const action = prev.selectedAction;
      let newPieces = prev.pieces.map(p => ({ ...p }));
      let message = '';
      let nextTurn: Team = prev.turn;
      let newTurnNumber = prev.turnNumber;
      let newBallHolderId = prev.ballHolderId;
      let newScore: Score = { ...prev.score };
      let newExtraAction = prev.extraAction;
      let newExtraActionPieceId = prev.extraActionPieceId;
      let newActionPoints = prev.actionPoints;
      let newActedPieces: string[] = [...prev.actedPieces];
      let newGoalKickoff = false;
      let newGoalScoringTeam: Team | null = null;
      let newGoalAnimation = false;
      let newLastTackledId = prev.lastTackledId;
      let newLastTouch = prev.lastTouch;
      let newFirstTurn = prev.firstTurn;
      let newGkMustPassOut = prev.gkMustPassOut;
      let newBallPosition: Position | null = prev.ballPosition;
      let gameOver = false;

      /* ── MOVE / TACKLE ── */
      if (action === 'move') {
        const t = target as Position;
        const validTarget = (prev.validTargets as Array<Position & { type?: string; targetId?: string }>)
          .find(v => v.col === t.col && v.row === t.row);
        if (!validTarget) return prev;

        const mover = newPieces.find(p => p.id === piece.id)!;

        if (validTarget.type === 'tackle' && validTarget.targetId) {
          const targetPiece = newPieces.find(p => p.id === validTarget.targetId);
          if (targetPiece && targetPiece.hasBall) {
            targetPiece.hasBall = false;
            mover.hasBall = true;
            newBallHolderId = mover.id;
            newLastTouch = mover.team;
            newLastTackledId = targetPiece.id;
            targetPiece.stunned = true;

            // If moving INTO the opponent's cell, displace them; otherwise (adjacent tackle) they stay
            if (t.col === targetPiece.col && t.row === targetPiece.row) {
              mover.col = targetPiece.col;
              mover.row = targetPiece.row;
              const vacated = findVacantAdjacent(targetPiece, newPieces, piece.col, piece.row);
              if (vacated) { targetPiece.col = vacated.col; targetPiece.row = vacated.row; }
            } else {
              mover.col = t.col;
              mover.row = t.row;
            }

            if (piece.type === 'MF') {
              newExtraAction = true;
              message = `${PIECE_TYPES[piece.type].name} tackled! Extra action! 🎯`;
            } else {
              newExtraAction = true;
              message = `${PIECE_TYPES[piece.type].name} tackled! Extra action! 🎯`;
            }
          } else {
            return prev;
          }
        } else {
          mover.col = t.col;
          mover.row = t.row;
          message = `Moved to (${t.col}, ${t.row}).`;
        }

        // Auto-pick up loose ball if moving onto ballPosition
        if (newBallPosition && mover.col === newBallPosition.col && mover.row === newBallPosition.row) {
          if (!mover.hasBall) {
            mover.hasBall = true;
            newBallHolderId = mover.id;
            newLastTouch = mover.team;
            newBallPosition = null;
            message += ' ⚽ Picked up loose ball!';
          }
        }

        // Turn switch will be handled centrally below
        nextTurn = prev.turn;
      }

      /* ── PASS ── */
      if (action === 'pass') {
        const targetPieceId = target as string;
        const validTarget = (prev.validTargets as Array<{ pieceId: string }>)
          .find(v => v.pieceId === targetPieceId);
        if (!validTarget) return prev;

        const targetPiece = newPieces.find(p => p.id === targetPieceId);
        const passer = newPieces.find(p => p.id === piece.id);
        if (!targetPiece || !passer || !passer.hasBall) return prev;

        passer.hasBall = false;
        targetPiece.hasBall = true;
        newBallHolderId = targetPiece.id;
        newLastTouch = passer.team;

        // GK must-pass-out enforcement
        if (prev.gkMustPassOut && piece.type === 'GK') {
          if (inPenaltyBox(targetPiece.col, targetPiece.row)) {
            // Violation: GK passed to someone still in the box → turnover
            message = '⚠️ GK pass-out violation! Ball turned over to opponent.';
            passer.hasBall = false;
            targetPiece.hasBall = false;
            const oppTeam = oppositeTeam(passer.team);
            const ffp = getFurthestForwardPlayer(oppTeam, newPieces);
            if (ffp) {
              ffp.hasBall = true;
              newBallHolderId = ffp.id;
            }
            newLastTouch = null;
            newGkMustPassOut = false;
            newExtraAction = false;
            message += ' ⚠️ Turnover!';
            return produceResult(prev, newPieces, message, nextTurn, newTurnNumber,
              newBallHolderId, newScore, newExtraAction, newExtraActionPieceId, newLastTackledId, newLastTouch, newFirstTurn, gameOver, newGkMustPassOut, newBallPosition);
          }
          newGkMustPassOut = false; // GK successfully passed out
        }

        // CF Striker Instinct
        if (targetPiece.type === 'CF' && hasClearShotToGoal(targetPiece, newPieces)) {
          message = `⚡ Striker Instinct! ${PIECE_TYPES.CF.name} auto-shoots!`;
          const team = targetPiece.team;
          const goalDir = team === 'A' ? CARDINAL[0] : CARDINAL[1]; // A(bottom)→up, B(top)→down
          const range = PIECE_TYPES.CF.shootRange;
          let c = targetPiece.col, r = targetPiece.row;
          let scored = false;

          for (let step = 1; step <= range; step++) {
            c += goalDir.dc; r += goalDir.dr;
            if (!inBounds(c, r)) {
              if (isGoal(c - goalDir.dc, r - goalDir.dr)) {
                scored = true;
                newGoalAnimation = true;
                newScore = { ...newScore, [team]: newScore[team] + 1 };
                message = `⚽ GOAL! ${PIECE_TYPES.CF.name} scores!`;
                gameOver = newScore[team] >= GOAL_LIMIT;
                newScore = { ...newScore, [team]: newScore[team] };
                const goaler = newPieces.find(p => p.id === targetPiece.id)!;
                goaler.hasBall = false;
                const oppGK = newPieces.find(p => p.team !== team && p.type === 'GK' && p.active);
                if (oppGK) { oppGK.hasBall = true; newBallHolderId = oppGK.id; }
                newLastTouch = null;
                if (!gameOver) { newGoalKickoff = true; newGoalScoringTeam = team; }
              } else {
                message = 'Shot missed!';
              }
              break;
            }
            const gk = newPieces.find(p => p.type === 'GK' && p.active && p.team !== team && chebDist(p, { col: c, row: r }) <= 1);
            if (gk) {
              message = `${PIECE_TYPES.GK.name} saved!`;
              gk.hasBall = true; newBallHolderId = gk.id; newLastTouch = gk.team;
              const shooter = newPieces.find(p => p.id === targetPiece.id)!;
              shooter.hasBall = false;
              break;
            }
            const interceptor = newPieces.find(p => p.active && p.team !== team && p.col === c && p.row === r);
            if (interceptor) {
              message = 'Shot blocked!';
              const shooter = newPieces.find(p => p.id === targetPiece.id)!;
              shooter.hasBall = false;
              interceptor.hasBall = true;
              newBallHolderId = interceptor.id;
              newLastTouch = interceptor.team;
              break;
            }
          }

          nextTurn = prev.turn;
        } else {
          message = `${PIECE_TYPES[passer.type].name} passed to ${PIECE_TYPES[targetPiece.type].name}.`;
          nextTurn = prev.turn;
        }
      }

      /* ── SHOOT / CHIP ── */
      if (action === 'shoot' || action === 'chip') {
        if (!piece.hasBall) return prev;
        const isChip = action === 'chip';
        const type = PIECE_TYPES[piece.type];
        const range = isChip ? type.chipRange : type.shootRange;
        const dir = target as Direction;
        if (!dir) return prev;

        const shooter = newPieces.find(p => p.id === piece.id)!;
        shooter.hasBall = false;
        let scored = false;
        let shotMsg = `${isChip ? 'Chip shot' : 'Shot'} by ${type.name}!`;
        let c = piece.col, r = piece.row;

        for (let step = 1; step <= range; step++) {
          c += dir.dc; r += dir.dr;
          if (!inBounds(c, r)) {
            if (isGoal(c - dir.dc, r - dir.dr)) {
              scored = true;
              newGoalAnimation = true;
              shotMsg = `⚽ GOAL! ${type.name} scores!`;
              newScore = { ...newScore, [piece.team]: newScore[piece.team] + 1 };
            } else {
              shotMsg = 'Shot missed!';
            }
            break;
          }

          if (!isChip || true) {
            const gk = newPieces.find(p =>
              p.type === 'GK' && p.active && p.team !== piece.team
              && chebDist(p, { col: c, row: r }) <= 1
            );
            if (gk) {
              shotMsg = `${PIECE_TYPES.GK.name} saved the ${isChip ? 'chip' : 'shot'}!`;
              gk.hasBall = true; newBallHolderId = gk.id; newLastTouch = gk.team;
              break;
            }
          }

          if (!isChip) {
            const interceptor = newPieces.find(p =>
              p.active && p.team !== piece.team && p.col === c && p.row === r
            );
            if (interceptor) {
              shotMsg = 'Shot blocked!';
              interceptor.hasBall = true;
              newBallHolderId = interceptor.id;
              newLastTouch = interceptor.team;
              break;
            }
          }
        }

        message = shotMsg;
        if (scored) {
          gameOver = newScore[piece.team] >= GOAL_LIMIT;
          const oppGK = newPieces.find(p => p.team !== piece.team && p.type === 'GK' && p.active);
          if (oppGK) { oppGK.hasBall = true; newBallHolderId = oppGK.id; }
          newLastTouch = null;
          if (!gameOver) { newGoalKickoff = true; newGoalScoringTeam = piece.team; }
        }

        nextTurn = prev.turn;
      }

      /* ── THROUGH BALL ── */
      if (action === 'through-ball') {
        if (!piece.hasBall) return prev;
        const dir = target as Direction;
        if (!dir) return prev;

        const kicker = newPieces.find(p => p.id === piece.id)!;
        kicker.hasBall = false;
        let c = piece.col, r = piece.row;
        let claimedBy: Piece | null = null;
        let lastInBounds: Position = { col: piece.col, row: piece.row };
        const tbRange = PIECE_TYPES[piece.type].shootRange;

        for (let step = 1; step <= tbRange; step++) {
          c += dir.dc; r += dir.dr;
          if (!inBounds(c, r)) break;
          lastInBounds = { col: c, row: r };

          const oppGK = newPieces.find(p =>
            p.type === 'GK' && p.active && p.team !== kicker.team
            && chebDist(p, { col: c, row: r }) <= 1
          );
          if (oppGK) {
            claimedBy = oppGK;
            oppGK.hasBall = true; newBallHolderId = oppGK.id; newLastTouch = oppGK.team;
            message = `${PIECE_TYPES.GK.name} intercepted the through ball!`;
            break;
          }

          const occ = newPieces.find(p => p.active && p.col === c && p.row === r);
          if (occ) {
            claimedBy = occ;
            occ.hasBall = true; newBallHolderId = occ.id; newLastTouch = occ.team;
            message = occ.team !== kicker.team
              ? `Through ball intercepted by ${PIECE_TYPES[occ.type].name}!`
              : `${PIECE_TYPES[occ.type].name} runs onto the through ball!`;
            break;
          }
        }

        if (!claimedBy) {
          // Check if any GK is within 1 cell of landing position
          const nearbyGK = newPieces.find(p =>
            p.type === 'GK' && p.active && p.team !== kicker.team
            && chebDist(p, lastInBounds) <= 1
          );
          if (nearbyGK) {
            nearbyGK.hasBall = true; newBallHolderId = nearbyGK.id; newLastTouch = nearbyGK.team;
            message = `${PIECE_TYPES.GK.name} collected the loose ball!`;
          } else {
            // Ball stops at the last traversed position
            newBallHolderId = null;
            newBallPosition = lastInBounds;
            message = `⚽ Through ball stops at (${lastInBounds.col}, ${lastInBounds.row}).`;
          }
        }

        nextTurn = prev.turn;
      }

      /* ── GOAL KICKOFF: reset to default formation ── */
      if (newGoalKickoff && newGoalScoringTeam) {
        const concedingTeam = oppositeTeam(newGoalScoringTeam);
        const formA = getDefaultFormation('A');
        const formB = getDefaultFormation('B');
        newPieces = [...formA, ...formB];

        // Find conceding team's piece closest to center (row 9)
        const concedingPieces = newPieces.filter(p => p.team === concedingTeam);
        const closest = concedingPieces.reduce((a, b) =>
          Math.abs(a.row - 9) <= Math.abs(b.row - 9) ? a : b
        );
        const kickoffer = newPieces.find(p => p.id === closest.id)!;
        kickoffer.col = 7;
        kickoffer.row = 9;
        kickoffer.hasBall = true;

        newBallHolderId = kickoffer.id;
        newLastTouch = null;
        newGkMustPassOut = false;
        newBallPosition = null;
        nextTurn = concedingTeam;
        newExtraAction = false;
        newExtraActionPieceId = null;
        newGoalKickoff = false;
        newGoalScoringTeam = null;

        message += ' 🔄 Kickoff!';
      }

      /* ── ACTION ECONOMY: AP & acted tracking (no auto turn switch) ── */
      if (!newGoalKickoff && !gameOver) {
        const isExtraAction = prev.extraAction;
        const wasTackle = action === 'move' && (target as any)?.type === 'tackle';

        if (isExtraAction && prev.actionPoints <= 0) {
          // Free extra action consumed (only when AP is exhausted)
          newExtraAction = false;
        } else {
          // Deduct AP (takes priority over free action when AP available)
          const actedPiece = prev.pieces.find(p => p.id === prev.selectedPieceId);
          const cost = actedPiece?.hasBall ? 2 : 1;
          newActionPoints = prev.actionPoints - cost;

          // Track acted piece
          if (prev.selectedPieceId && !prev.actedPieces.includes(prev.selectedPieceId)) {
            newActedPieces = [...prev.actedPieces, prev.selectedPieceId];
          }

          // Tackle grants extra action
          if (wasTackle) {
            newExtraAction = true;
          }
        }

        // Stay on same turn — player must click End Turn manually
        newTurnNumber = prev.turnNumber;
        newFirstTurn = prev.firstTurn;
        nextTurn = prev.turn;
      } else if (newGoalKickoff) {
        // Goal kickoff resets the turn for conceding team
        newActionPoints = 2;
        newActedPieces = [];
        newExtraAction = false;
        newExtraActionPieceId = null;
        newFirstTurn = false; // Not first turn anymore
        // nextTurn is already set to concedingTeam by kickoff block
        // Don't increment turnNumber — conceding team kicks off within the same game period
      }

      // GK pass-out tracking: if GK has the ball now (and didn't just pass out), must pass next turn
      if (!newGkMustPassOut) {
        const holder = newPieces.find(p => p.id === newBallHolderId);
        if (holder && holder.type === 'GK') {
          newGkMustPassOut = true;
        }
      }

      return produceResult(prev, newPieces, message, nextTurn, newTurnNumber,
        newBallHolderId, newScore, newExtraAction, newExtraActionPieceId, newLastTackledId, newLastTouch, newFirstTurn, gameOver, newGkMustPassOut, newBallPosition, newActionPoints, newActedPieces, newGoalAnimation);
    });
  }, []);

  /* ─── Cancel selection ─── */
  const cancelSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedPieceId: null,
      selectedAction: null,
      validTargets: [],
      availableActions: [],
      passRangeCells: [],
      offsideLine: null,
      message: prev.turn === 'A' ? "🔵 Team Blue's turn." : "🔴 Team Red's turn.",
    }));
  }, []);

  /* ─── End turn (manual) ─── */
  const endTurn = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      const next = oppositeTeam(prev.turn);
      let message = `⏭️ Turn ended. ${next === 'A' ? "🔵 Team Blue" : "🔴 Team Red"}'s turn.`;

      // Clear stun for the team that just finished
      let updatedPieces = prev.pieces.map(p =>
        p.stunned && p.team === prev.turn ? { ...p, stunned: false } : p
      );

      // GK pass-out timeout: if GK still has ball when turn ends, turnover
      let newBallHolderId = prev.ballHolderId;
      let newGkMustPassOut = prev.gkMustPassOut;
      let newBallPosition = prev.ballPosition;
      let newLastTouch = prev.lastTouch;
      if (prev.gkMustPassOut) {
        const holder = updatedPieces.find(p => p.id === prev.ballHolderId);
        if (holder && holder.type === 'GK' && holder.team === prev.turn) {
          message = '⏰ GK failed to pass out in time! Ball turned over to opponent.';
          holder.hasBall = false;
          const oppTeam = oppositeTeam(holder.team);
          const ffp = getFurthestForwardPlayer(oppTeam, updatedPieces);
          if (ffp) {
            ffp.hasBall = true;
            newBallHolderId = ffp.id;
          } else {
            newBallHolderId = null;
          }
          newLastTouch = null;
          newGkMustPassOut = false;
        }
      }

      return {
        ...prev,
        pieces: updatedPieces,
        ballHolderId: newBallHolderId,
        ballPosition: newBallPosition,
        lastTouch: newLastTouch,
        gkMustPassOut: newGkMustPassOut,
        selectedPieceId: null,
        selectedAction: null,
        validTargets: [],
        availableActions: [],
        passRangeCells: [],
        offsideLine: null,
        turn: next,
        turnNumber: next === 'A' ? prev.turnNumber + 1 : prev.turnNumber,
        firstTurn: false,
        actionPoints: 2,
        actedPieces: [],
        extraAction: false,
        extraActionPieceId: null,
        message,
      };
    });
  }, []);

  /* ─── Restart ─── */
  const restart = useCallback(() => setState(INITIAL_STATE), []);

  const clearGoalAnimation = useCallback(() => {
    setState(prev => ({ ...prev, goalAnimation: false }));
  }, []);

  return {
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
  };
}

/* ─── Helper to produce the final state after an action ─── */
function produceResult(
  prev: GameState,
  newPieces: Piece[],
  message: string,
  nextTurn: Team,
  newTurnNumber: number,
  newBallHolderId: string | null,
  newScore: Score,
  newExtraAction: boolean,
  newExtraActionPieceId: string | null,
  newLastTackledId: string | null,
  newLastTouch: Team | null,
  newFirstTurn: boolean,
  gameOver: boolean,
  newGkMustPassOut: boolean = false,
  newBallPosition: Position | null = null,
  newActionPoints: number = 2,
  newActedPieces: string[] = [],
  newGoalAnimation: boolean = false,
): GameState {
  if (gameOver) {
    return {
      ...prev,
      phase: 'gameover',
      pieces: newPieces,
      ballHolderId: newBallHolderId,
      ballPosition: null,
      score: newScore,
      message: `🏆 GAME OVER! Team ${newScore.A > newScore.B ? 'Blue (A)' : 'Red (B)'} wins!`,
      turn: nextTurn,
      turnNumber: newTurnNumber,
      selectedPieceId: null,
      selectedAction: null,
      validTargets: [],
      availableActions: [],
      passRangeCells: [],
      goalAnimation: false,
      offsideLine: null,
      extraAction: false,
      extraActionPieceId: null,
      actionPoints: 2,
      actedPieces: [],
      firstTurn: false,
      gkMustPassOut: false,
    };
  }

  return {
    ...prev,
    phase: 'playing',
    pieces: newPieces,
    ballHolderId: newBallHolderId,
    score: newScore,
    turn: nextTurn,
    turnNumber: newTurnNumber,
    selectedPieceId: null,
    selectedAction: null,
    validTargets: [],
    availableActions: [],
    passRangeCells: [],
    offsideLine: null,
    goalAnimation: newGoalAnimation,
    extraAction: newExtraAction,
    extraActionPieceId: newExtraActionPieceId,
    actionPoints: newActionPoints,
    actedPieces: newActedPieces,
    lastTackledId: newLastTackledId,
    lastTouch: newLastTouch,
    message,
    firstTurn: newFirstTurn,
    gkMustPassOut: newGkMustPassOut,
    ballPosition: newBallPosition,
  };
}
