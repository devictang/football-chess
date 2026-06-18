import { useState, useCallback } from 'react';
import type { Piece, Position, Direction, GameState, GamePhase, Action, ValidTarget, Team, Score } from '../types/game';
import {
  COLS, ROWS, PIECE_TYPES, CARDINAL, GOAL_LIMIT,
} from '../game/constants';
import {
  inBounds, isGoal, inPenaltyBox, getTeamBox,
  chebDist, getValidMoves, getValidPassTargets,
  getShotPath, traceLine, pieceAt, teamPieces, getBallHolder,
  isGKVulnerable, isValidSetupPlacement,
  createEmptyPieces, getDefaultFormation,
  hasClearShotToGoal, findVacantAdjacent, oppositeTeam,
  getFurthestForwardPlayer,
} from '../game/engine';

const INITIAL_STATE: GameState = {
  phase: 'menu',
  pieces: [],
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
  lastTackledId: null,
  lastTouch: null,
  setupPiecesA: [],
  setupPiecesB: [],
  setupPieceIndex: 0,
  setupTeam: 'A',
  firstTurn: true,
  gkMustPassOut: false,
};

export default function useGame() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);

  /* ─── Start ─── */
  const startGame = useCallback((quickSetup: boolean = false) => {
    if (quickSetup) {
      const piecesA = getDefaultFormation('A');
      const piecesB = getDefaultFormation('B');
      const allPieces = [...piecesA, ...piecesB];
      const cfA = allPieces.find(p => p.team === 'A' && p.type === 'CF');
      if (cfA) cfA.hasBall = true;

      setState({
        ...INITIAL_STATE,
        phase: 'playing',
        pieces: allPieces,
        ballHolderId: cfA?.id ?? null,
        turn: 'A',
        message: '⚽ Game started! Team Blue goes first.',
      });
    } else {
      setState({
        ...INITIAL_STATE,
        phase: 'setup-a',
        setupPiecesA: createEmptyPieces('A'),
        setupPiecesB: createEmptyPieces('B'),
        setupPieceIndex: 0,
        setupTeam: 'A',
        message: `🔵 Team Blue: Place 1/8 — ${PIECE_TYPES.GK.name} (must be in penalty box)`,
      });
    }
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

      if (!isValidSetupPlacement(team, col, row, allActive)) return prev;

      const idx = prev.setupPieceIndex;
      if (idx >= 8) return prev;
      const piece = setupPieces[idx];
      if (!piece) return prev;

      if (piece.type === 'GK' && !inPenaltyBox(col, row)) {
        return { ...prev, message: 'Goalkeeper must be placed in the penalty box!' };
      }

      const updatedPieces = [...setupPieces];
      updatedPieces[idx] = { ...piece, col, row, active: true };
      const nextIdx = idx + 1;
      const allPlaced = nextIdx >= 8;

      if (team === 'A') {
        if (allPlaced) {
          return {
            ...prev,
            setupPiecesA: updatedPieces,
            setupPieceIndex: 0,
            phase: 'setup-b' as GamePhase,
            setupTeam: 'B' as Team,
            message: `🔴 Team Red: Place 1/8 — ${PIECE_TYPES.GK.name} (must be in penalty box)`,
          };
        }
        return {
          ...prev,
          setupPiecesA: updatedPieces,
          setupPieceIndex: nextIdx,
          message: `🔵 Place ${nextIdx + 1}/8 — ${PIECE_TYPES[setupPieces[nextIdx].type].name}`,
        };
      }

      // Team B
      if (allPlaced) {
        const allActivePieces = [
          ...prev.setupPiecesA.filter(p => p.active),
          ...updatedPieces.filter(p => p.active),
        ];
        const cfA = allActivePieces.find(p => p.team === 'A' && p.type === 'CF');
        if (cfA) cfA.hasBall = true;

        return {
          ...prev,
          setupPiecesB: updatedPieces,
          pieces: allActivePieces,
          ballHolderId: cfA?.id ?? null,
          phase: 'playing' as GamePhase,
          turn: 'A' as Team,
          turnNumber: 1,
          message: '⚽ Game started! Team Blue goes first.',
          firstTurn: true,
        };
      }
      return {
        ...prev,
        setupPiecesB: updatedPieces,
        setupPieceIndex: nextIdx,
        message: `🔴 Place ${nextIdx + 1}/8 — ${PIECE_TYPES[setupPieces[nextIdx].type].name}`,
      };
    });
  }, []);

  /* ─── Quick setup during setup ─── */
  const quickSetupPieces = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'setup-a' && prev.phase !== 'setup-b') return prev;
      const team = prev.phase === 'setup-a' ? 'A' : 'B';
      const formation = getDefaultFormation(team);

      if (team === 'A') {
        return {
          ...prev,
          setupPiecesA: formation,
          setupPieceIndex: 0,
          phase: 'setup-b' as GamePhase,
          setupTeam: 'B' as Team,
          message: `🔴 Team Red: Place your pieces on the bottom half.`,
        };
      }

      const allActive = [...prev.setupPiecesA.filter(p => p.active), ...formation];
      const cfA = allActive.find(p => p.team === 'A' && p.type === 'CF');
      if (cfA) cfA.hasBall = true;

      return {
        ...prev,
        setupPiecesB: formation,
        pieces: allActive,
        ballHolderId: cfA?.id ?? null,
        phase: 'playing' as GamePhase,
        turn: 'A' as Team,
        turnNumber: 1,
        message: '⚽ Game started! Team Blue goes first.',
        firstTurn: true,
      };
    });
  }, []);

  /* ─── Select piece ─── */
  const selectPiece = useCallback((pieceId: string) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      const piece = prev.pieces.find(p => p.id === pieceId);
      if (!piece || !piece.active) return prev;
      if (piece.team !== prev.turn) return prev;

      // GK must-pass-out enforcement: if GK has ball and must pass out,
      // prevent selecting other pieces
      if (prev.gkMustPassOut) {
        const gk = prev.pieces.find(p => p.type === 'GK' && p.team === prev.turn && p.active);
        if (gk && gk.hasBall && piece.id !== gk.id) {
          return { ...prev, message: "🧤 Goalkeeper must pass the ball out of the penalty box this turn!" };
        }
      }

      const type = PIECE_TYPES[piece.type];
      const actions: Action[] = [];

      const moves = getValidMoves(piece, prev.pieces, prev.lastTouch);
      if (moves.length > 0) actions.push('move');

      if (!prev.extraAction && piece.hasBall) {
        const passTargets = getValidPassTargets(piece, prev.pieces);
        if (passTargets.length > 0) actions.push('pass');
      }

      if (type.canShoot && piece.hasBall && !prev.firstTurn) actions.push('shoot');
      if (type.canChip && piece.hasBall && !prev.firstTurn) actions.push('chip');
      if (piece.hasBall && type.canShoot && !prev.firstTurn && !prev.extraAction) actions.push('through-ball');

      // GK pass-out: only allow pass for GK when gkMustPassOut is active
      let filteredActions = actions;
      if (prev.gkMustPassOut && piece.type === 'GK') {
        filteredActions = actions.filter(a => a === 'pass');
      }

      return {
        ...prev,
        selectedPieceId: pieceId,
        validTargets: moves,
        selectedAction: null,
        availableActions: filteredActions,
        message: `Selected ${type.name}. Choose action.`,
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
        return {
          ...prev,
          selectedAction: 'pass',
          validTargets: getValidPassTargets(piece, prev.pieces),
          message: 'Click a teammate to pass to.',
        };
      }

      if (action === 'shoot' || action === 'chip') {
        const isChip = action === 'chip';
        const type = PIECE_TYPES[piece.type];
        const range = isChip ? type.chipRange : type.shootRange;
        const dirs: Direction[] = [];
        for (const d of CARDINAL) {
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
        for (const d of CARDINAL) {
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
            targetPiece.canCounterTackle = false;

            mover.col = targetPiece.col;
            mover.row = targetPiece.row;

            const vacated = findVacantAdjacent(targetPiece, newPieces, piece.col, piece.row);
            if (vacated) { targetPiece.col = vacated.col; targetPiece.row = vacated.row; }

            if (piece.type === 'MF') {
              newExtraAction = true;
              message = `${PIECE_TYPES[piece.type].name} tackled! Extra move.`;
            } else {
              message = `${PIECE_TYPES[piece.type].name} tackled!`;
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

        // Turn switch logic
        if (piece.type === 'MF' && newExtraAction && validTarget.type === 'tackle') {
          // Keep same turn (extra action granted)
        } else if (newExtraAction && piece.type === 'MF' && validTarget.type !== 'tackle') {
          newExtraAction = false;
          nextTurn = oppositeTeam(prev.turn);
          if (nextTurn === 'A') newTurnNumber++;
          newFirstTurn = false;
        } else {
          nextTurn = oppositeTeam(prev.turn);
          if (nextTurn === 'A') newTurnNumber++;
          newFirstTurn = false;
        }
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

        // GK interception along pass path
        const passPath = traceLine(passer.col, passer.row, targetPiece.col, targetPiece.row);
        let intercepted = false;
        for (const cell of passPath) {
          if (cell.col === passer.col && cell.row === passer.row) continue;
          if (cell.col === targetPiece.col && cell.row === targetPiece.row) continue;
          const oppGK = newPieces.find(p =>
            p.type === 'GK' && p.active && p.team !== passer.team
            && chebDist(p, cell) <= 1
          );
          if (oppGK) {
            intercepted = true;
            message = `${PIECE_TYPES[oppGK.type].name} intercepted the pass!`;
            oppGK.hasBall = true;
            newBallHolderId = oppGK.id;
            newLastTouch = oppGK.team;
            break;
          }
        }

        if (intercepted) {
          nextTurn = oppositeTeam(prev.turn);
          if (nextTurn === 'A') newTurnNumber++;
          newFirstTurn = false;
          newExtraAction = false;
          newGkMustPassOut = true; // GK just intercepted
          return produceResult(prev, newPieces, message, nextTurn, newTurnNumber,
            newBallHolderId, newScore, newExtraAction, newLastTackledId, newLastTouch, newFirstTurn, gameOver, newGkMustPassOut, newBallPosition);
        }

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
            nextTurn = oppTeam;
            if (nextTurn === 'A') newTurnNumber++;
            newFirstTurn = false;
            newExtraAction = false;
            return produceResult(prev, newPieces, message, nextTurn, newTurnNumber,
              newBallHolderId, newScore, newExtraAction, newLastTackledId, newLastTouch, newFirstTurn, gameOver, newGkMustPassOut, newBallPosition);
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
                newScore = { ...newScore, [team]: newScore[team] + 1 };
                message = `⚽ GOAL! ${PIECE_TYPES.CF.name} scores!`;
                gameOver = newScore[team] >= GOAL_LIMIT;
                newScore = { ...newScore, [team]: newScore[team] };
                const goaler = newPieces.find(p => p.id === targetPiece.id)!;
                goaler.hasBall = false;
                const oppGK = newPieces.find(p => p.team !== team && p.type === 'GK' && p.active);
                if (oppGK) { oppGK.hasBall = true; newBallHolderId = oppGK.id; }
                newLastTouch = null;
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

          nextTurn = oppositeTeam(prev.turn);
          if (nextTurn === 'A') newTurnNumber++;
          newFirstTurn = false;
          newExtraAction = false;
        } else {
          message = `${PIECE_TYPES[passer.type].name} passed to ${PIECE_TYPES[targetPiece.type].name}.`;
          nextTurn = oppositeTeam(prev.turn);
          if (nextTurn === 'A') newTurnNumber++;
          newFirstTurn = false;
          newExtraAction = false;
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
        }

        nextTurn = oppositeTeam(prev.turn);
        if (nextTurn === 'A') newTurnNumber++;
        newFirstTurn = false;
        newExtraAction = false;
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

        nextTurn = oppositeTeam(prev.turn);
        if (nextTurn === 'A') newTurnNumber++;
        newFirstTurn = false;
        newExtraAction = false;
      }

      // Reset counter-tackle on turn switch
      if (nextTurn !== prev.turn) {
        newPieces.forEach(p => { p.canCounterTackle = true; });
      }

      // GK pass-out tracking: if GK has the ball now (and didn't just pass out), must pass next turn
      if (!newGkMustPassOut) {
        const holder = newPieces.find(p => p.id === newBallHolderId);
        if (holder && holder.type === 'GK') {
          newGkMustPassOut = true;
        }
      }

      // GK pass-out auto-turnover: if GK still has ball and must pass but turn switched
      if (newGkMustPassOut && nextTurn !== prev.turn) {
        const holder = newPieces.find(p => p.id === newBallHolderId);
        if (holder && holder.type === 'GK' && holder.team !== nextTurn) {
          message = '⏰ GK failed to pass out in time! Ball turned over to opponent.';
          holder.hasBall = false;
          const oppTeam = oppositeTeam(holder.team);
          const ffp = getFurthestForwardPlayer(oppTeam, newPieces);
          if (ffp) {
            ffp.hasBall = true;
            newBallHolderId = ffp.id;
          }
          newLastTouch = null;
          newGkMustPassOut = false;
        }
      }

      return produceResult(prev, newPieces, message, nextTurn, newTurnNumber,
        newBallHolderId, newScore, newExtraAction, newLastTackledId, newLastTouch, newFirstTurn, gameOver, newGkMustPassOut, newBallPosition);
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
      message: prev.turn === 'A' ? "🔵 Team Blue's turn." : "🔴 Team Red's turn.",
    }));
  }, []);

  /* ─── Restart ─── */
  const restart = useCallback(() => setState(INITIAL_STATE), []);

  return {
    state,
    startGame,
    setupPlacePiece,
    quickSetupPieces,
    selectPiece,
    selectAction,
    executeAction,
    cancelSelection,
    restart,
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
  newLastTackledId: string | null,
  newLastTouch: Team | null,
  newFirstTurn: boolean,
  gameOver: boolean,
  newGkMustPassOut: boolean = false,
  newBallPosition: Position | null = null,
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
      extraAction: false,
      firstTurn: false,
      gkMustPassOut: false,
    };
  }

  return {
    ...prev,
    phase: 'playing',
    pieces: newPieces,
    ballHolderId: newBallHolderId,
    turn: nextTurn,
    turnNumber: newTurnNumber,
    selectedPieceId: null,
    selectedAction: null,
    validTargets: [],
    availableActions: [],
    extraAction: newExtraAction,
    lastTackledId: newLastTackledId,
    lastTouch: newLastTouch,
    message,
    firstTurn: newFirstTurn,
    gkMustPassOut: newGkMustPassOut,
    ballPosition: newBallPosition,
  };
}
