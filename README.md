# ⚽ Football Chess

A turn-based football strategy game on a 15×19 grid. React + TypeScript + Tailwind CSS + Framer Motion.

## Quick Start

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
npx vercel --prod   # or connect GitHub repo to Vercel
```

## How to Play

- **Quick Start** — jump straight in with default formations
- **Manual Setup** — place 8 pieces per team on your half
- **Turn-based** — 1 action per turn: Move, Pass, Shoot, Chip Shot, or Through Ball
- **First to 5 goals** wins

## Piece Types

| Role | Count | Special |
|------|-------|---------|
| GK Goalkeeper | 1 | Intercepts balls in 1-cell zone; must stay in box |
| DF Defender | 2 | Long pass range (5 cells) |
| MF Midfielder | 2 | High-press tackle (8 cells); extra move after tackle |
| WG Winger | 2 | Moves 2 cells (diagonal OK); can chip shot |
| CF Center Forward | 1 | Shoot range 5; Striker Instinct auto-shot |

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 3
- Framer Motion 12
- Vercel-ready

## Project Structure

```
src/
├── types/game.ts        # All TypeScript interfaces
├── game/
│   ├── constants.ts      # Board config, piece stats, colors
│   └── engine.ts         # Pure game logic functions
├── hooks/
│   └── useGame.ts        # Full state machine (useState)
├── components/
│   ├── Board.tsx          # 15×19 grid + pieces
│   ├── ActionPanel.tsx    # Turn info + action buttons
│   ├── SetupPhase.tsx     # Piece placement UI
│   └── GameOver.tsx       # End screen
├── App.tsx               # Main orchestrator
├── main.tsx              # Entry point
└── index.css             # Tailwind + custom styles
```
