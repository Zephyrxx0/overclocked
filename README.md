# WorldSim

**Adaptive Resource Scarcity & Agent Strategy Simulator**

WorldSim is an agent-based simulation engine where autonomous AI agents govern distinct world regions, each with finite natural resources. Agents learn survival strategies through Q-learning reinforcement learning as the world evolves — resources deplete, climate events reshape availability, and populations grow, migrate, or perish.

![System Design](system-design.png)

---

## Architecture

```
Browser (Full-window Phaser 3 game)
  ├── IsometricWorldScene (64×64 grid, pan/zoom camera)
  ├── HUD overlay (tick, population, selected tile info)
  └── Native WebSocket client
         │
         │ ws://localhost:8000/ws
         │
FastAPI Backend
  ├── REST API (/api/v1/*)
  ├── WebSocket (state broadcast @ 1 Hz)
  └── Simulation Engine
       ├── WorldModel (64×64 procedural terrain grid)
       ├── GovernorAgent (Q-learning RL, 6 actions)
       ├── Population (birth/death/health/migration)
       ├── ClimateSystem (drought, flood, heatwave, frost, storm)
       └── Resources (Food, Water with terrain multipliers)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Phaser 3 + TypeScript |
| Build | Vite |
| Backend | FastAPI + Uvicorn |
| Simulation | Mesa-style model + Q-learning RL |
| Data | NumPy, Pydantic 2 |
| Communication | Native WebSocket |

## Project Structure

```
worldsim/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── config.py                  # Centralized simulation config
│   ├── requirements.txt
│   ├── api/
│   │   ├── routes.py              # REST endpoints
│   │   └── websocket.py           # WebSocket handler + broadcast
│   ├── simulation/
│   │   ├── world.py               # WorldModel orchestrator
│   │   ├── agents.py              # GovernorAgent with Q-learning
│   │   ├── resources.py           # Food/Water resource system
│   │   ├── terrain.py             # Procedural terrain generation
│   │   ├── population.py          # Birth/death/migration model
│   │   └── climate.py             # Climate events system
│   ├── models/
│   │   └── schemas.py             # Pydantic response models
│   └── static/                    # Built frontend (production)
│
├── frontend/
│   ├── index.html                 # Phaser game container
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.ts                # Phaser boot
│       ├── game/
│       │   ├── WorldScene.ts      # Main isometric scene
│       │   ├── IsometricMap.ts    # Tile grid renderer
│       │   ├── CameraController.ts # Pan/zoom controls
│       │   └── HUDScene.ts        # UI overlay
│       ├── network/
│       │   └── WebSocketClient.ts # WebSocket connection
│       └── types/
│           └── simulation.ts      # TypeScript interfaces
│
├── assets/                        # Sprite assets
├── style.json                     # Terrain/climate/art style config
├── PROBLEM_STATEMENT.md
└── README.md
```

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Development)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend proxies API/WebSocket calls to port 8000.

### Production (Single Server)

```bash
cd frontend && npm run build
cp -r dist/* ../backend/static/
cd ../backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`.

## Controls

| Input | Action |
|---|---|
| WASD / Arrow keys | Pan camera |
| Right-click drag | Pan camera |
| Scroll wheel | Zoom in/out |
| Left-click tile | Select tile (shows info panel) |
| ▶ Start button | Start simulation |
| ⏸ Pause button | Pause simulation |
| ↻ Reset button | Reset world |

## Simulation Model

### World (64×64 Grid)

- **7 terrain types**: Mountains, Hilly, Plains, Desert, Swamp, River, Lake
- **5 climate zones**: Tropical, Arid, Temperate, Continental, Polar
- Terrain generated procedurally with value noise, modulated by climate zones

### Resources

| Resource | Max | Regen/tick | Terrain Effect |
|---|---|---|---|
| Food | 1000 | 5.0 | Plains 1.2×, Desert 0.2×, Mountains 0.3× |
| Water | 1000 | 5.0 | Lake 2.5×, River 2.0×, Desert 0.1× |

### Population

Each region has a population with:
- **Health** (0–1): decays without food/water, regenerates when fed
- **Birth rate**: modulated by health and resource availability
- **Death rate**: increases with starvation, dehydration, low health
- **Migration**: triggered when health drops below 30% — people move to better-resourced neighbors
- **Carrying capacity**: terrain-dependent (plains 1.2×, desert 0.2×)

### AI Governors (Q-Learning)

20 governor agents placed across the grid, each managing one region:

| Action | Effect |
|---|---|
| `focus_food` | Boost food regen ×1.3, reduce water regen ×0.9 |
| `focus_water` | Boost water regen ×1.3, reduce food regen ×0.9 |
| `balance_resources` | Normalize regen multipliers toward 1.0 |
| `trade` | Convert surplus resource to deficit (70% efficiency) |
| `migrate_out` | Signal population to emigrate to better regions |
| `stockpile` | Gain extra resources, slight health penalty |

**Reward function**: population growth + health improvement + alive bonus

### Climate Events

5% chance per tick per region. Events weighted by climate zone:

| Event | Food | Water | Duration |
|---|---|---|---|
| Drought | -40% | -80% | 3–12 ticks |
| Flood | -30% | +50% | 3–12 ticks |
| Heatwave | -50% | -60% | 3–12 ticks |
| Frost | -70% | -20% | 3–12 ticks |
| Storm | -20% | +20% | 3–12 ticks |

### End Condition

Simulation ends when ≥80% of regions have zero population (collapse).

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/status` | Simulation summary |
| GET | `/api/v1/state` | Full world state |
| POST | `/api/v1/start` | Start simulation |
| POST | `/api/v1/pause` | Pause simulation |
| POST | `/api/v1/reset` | Reset world |
| GET | `/api/v1/agents` | List all governors |
| GET | `/api/v1/regions/{key}` | Get specific region |

### WebSocket

Connect to `ws://localhost:8000/ws`.

**Server → Client**: `{ "type": "initial_state", "data": WorldState }` on connect, then `{ "type": "state_update", "data": CompactState }` every tick.

**Client → Server**: `{ "type": "control", "action": "start|pause|reset" }` or `{ "type": "request_state" }`.
