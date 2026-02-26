# WorldSim

**Adaptive Resource Scarcity & Agent Strategy Simulator**

WorldSim is an agent-based simulation engine where autonomous AI agents govern distinct world regions, each endowed with finite natural resources. Agents learn survival, growth, and negotiation strategies through reinforcement learning as the world evolves — resources deplete, climate events reshape availability, and inter-region trade relationships form and collapse. The simulation serves as both a research tool and an interactive visualization for studying emergent strategies in the face of resource conflict dynamics.

![System Design](system-design.png)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Running the Full Stack](#running-the-full-stack)
- [Simulation Model](#simulation-model)
  - [World & Regions](#world--regions)
  - [Resources](#resources)
  - [AI Agents & Strategies](#ai-agents--strategies)
  - [Climate Events](#climate-events)
  - [Simulation Loop](#simulation-loop)
- [API Reference](#api-reference)
  - [REST Endpoints](#rest-endpoints)
  - [WebSocket Protocol](#websocket-protocol)
- [Frontend](#frontend)
  - [Grid Visualizer](#grid-visualizer)
  - [Analytics Panel](#analytics-panel)
  - [Controls](#controls)
- [Configuration](#configuration)
- [Analysis & Research Insights](#analysis--research-insights)

---

## Features

- **Grid-based world** — configurable N×M map of regions, each with independent resource pools
- **Four resource types** — Water, Food, Energy, and Land with distinct depletion and regeneration dynamics
- **Autonomous AI agents** — four competing strategies (Defensive, Expansive, Negotiator, Extractive) that self-adjust based on performance scores
- **Stochastic climate events** — droughts, floods, heatwaves, frosts, and storms that randomly affect resource availability across regions
- **Real-time WebSocket streaming** — the simulation state is broadcast to all connected frontends every tick
- **REST control API** — start, pause, and reset the simulation via HTTP
- **Canvas-based visualization** — live grid rendering with per-cell resource indicators and color-coded agent strategy rings
- **Analytics dashboard** — aggregate statistics, per-agent resource health bars, and a running tick counter

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (React)                   │
│  ┌──────────────────┐   ┌──────────────────────────┐│
│  │  GridVisualizer  │   │     AnalyticsPanel       ││
│  │  (Canvas/Phaser) │   │  (Stats + Agent Cards)   ││
│  └────────┬─────────┘   └────────────┬─────────────┘│
│           └──────────┬───────────────┘              │
│              ┌───────▼────────┐                     │
│              │ useSimulation  │  (Zustand store)    │
│              │  + useWebSocket│                     │
│              └───────┬────────┘                     │
└──────────────────────┼──────────────────────────────┘
                       │  WS /ws/subscribe
                       │  HTTP /api/v1/*
┌──────────────────────▼──────────────────────────────┐
│                  FastAPI Backend                     │
│  ┌──────────────┐   ┌──────────────────────────────┐│
│  │  REST Routes │   │   WebSocket Handler          ││
│  │  /api/v1/*   │   │   broadcast_tick_loop (1 Hz) ││
│  └──────┬───────┘   └────────────┬─────────────────┘│
│         └──────────┬─────────────┘                  │
│              ┌─────▼──────┐                         │
│              │ WorldModel │  (Mesa AgentBasedModel)  │
│              │  5×5 grid  │                         │
│              └──┬──────┬──┘                         │
│          ┌──────┘      └──────┐                     │
│    ┌─────▼──────┐      ┌──────▼──────┐              │
│    │  Regions   │      │  AI Agents  │              │
│    │ Resources  │      │  Strategies │              │
│    └────────────┘      └─────────────┘              │
└─────────────────────────────────────────────────────┘
```

See also: [`logic-flowchart.png`](logic-flowchart.png) for the simulation step flow.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Game/canvas rendering | Phaser 3 |
| Real-time client | Socket.io-client 4 |
| Frontend state | Zustand 5 |
| Frontend build | Vite + TypeScript |
| Backend framework | FastAPI 0.115 |
| ASGI server | Uvicorn |
| Agent-based modeling | Mesa 2.2 |
| Numerical computing | NumPy 2.1 |
| Data validation | Pydantic 2 |
| WebSockets | Python `websockets` 13 |

---

## Project Structure

```
worldsim/
├── backend/
│   ├── main.py                  # FastAPI app entry point, lifespan management
│   ├── requirements.txt         # Python dependencies
│   ├── api/
│   │   ├── routes.py            # REST API routes (/api/v1/*)
│   │   └── websocket.py         # WebSocket handler + broadcast loop
│   ├── simulation/
│   │   ├── world.py             # WorldModel, Region, ClimateEvent
│   │   ├── agents.py            # AIAgent, AgentStrategy, AgentFactory
│   │   └── resources.py         # Resource, ResourceManager
│   ├── models/                  # Pydantic request/response models
│   ├── services/                # Business logic services
│   └── static/                  # Served React production build
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.tsx             # React entry point
│       ├── App.tsx              # Root component, layout, controls
│       ├── types/index.ts       # Shared TypeScript interfaces
│       ├── hooks/
│       │   ├── useSimulation.ts # Zustand store + simulation actions
│       │   └── useWebSocket.ts  # WebSocket connection management
│       └── components/
│           ├── GridVisualizer.tsx   # Canvas grid renderer
│           └── AnalyticsPanel.tsx   # Stats dashboard + agent cards
│
├── system-design.png            # High-level architecture diagram
├── logic-flowchart.png          # Simulation step flowchart
└── PROBLEM_STATEMENT.md         # Original project brief
```

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and **npm**

### Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The UI will be available at `http://localhost:3000`.

### Running the Full Stack

Start both servers in separate terminals as described above. The frontend connects to the backend WebSocket at `ws://localhost:8000/ws/subscribe` and polls the REST API at `http://localhost:8000/api/v1/*`.

To build the frontend for production and serve it through FastAPI:

```bash
# Build React app
cd frontend && npm run build

# Copy build output to backend static dir
cp -r dist/* ../backend/static/

# Start the backend (serves frontend + API together)
cd ../backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Simulation Model

### World & Regions

The world is represented as a `WorldModel` (extending Mesa's `AgentBasedModel`) containing an N×M grid of `Region` objects. By default the grid is **5×5** (25 regions) with **5 AI agents** placed at initialization.

Each `Region`:
- Holds its own `ResourceManager` tracking Water, Food, Energy, and Land levels
- Can be occupied by at most one `AIAgent`
- Accumulates `ClimateEvent` objects that modify resource values over multiple ticks

### Resources

Every region and every agent manages four resources via `ResourceManager`:

| Resource | Default Max | Regen Rate/tick | Notes |
|---|---|---|---|
| Water | 1000 | 5.0 | Critical below 200 (20%) |
| Food | 1000 | 5.0 | Critical below 200 |
| Energy | 1000 | 5.0 | Critical below 200 |
| Land | 100 | 0.1 | Slower regeneration; consumed by Expansive agents |

`Resource` objects expose:
- `consume(amount)` — bounded draw-down
- `regenerate()` — automatic per-tick replenishment up to `max_value`
- `apply_event(change)` — climate-driven arbitrary deltas (clamped to `[0, max]`)
- `is_critical` — `True` when below 20% capacity
- `is_empty` — `True` when fully depleted

### AI Agents & Strategies

Each `AIAgent` governs one region and executes a **decision cycle** every tick:

1. **Assess** — inventory current resources; identify critical shortages
2. **Decide** — select an action based on active strategy
3. **Execute** — modify resource levels accordingly
4. **Record** — append decision to history
5. **Regenerate** — resources tick upward

Four strategies are implemented (assigned randomly at initialization; agents can self-adjust based on cumulative strategy scores):

| Strategy | Agent Name Pattern | Behaviour |
|---|---|---|
| **Defensive** | `Guardian-N` | Conserves resources when any are critical; otherwise maintains energy baseline. Minimizes consumption. |
| **Expansive** | `Pioneer-N` | Continuously develops land, consuming land units but increasing all regeneration rates over time. |
| **Negotiator** | `Diplomat-N` | Initiates trades across the network, receiving resource inflows in exchange for outflows. |
| **Extractive** | `Industrialist-N` | Aggressively extracts water, food, or energy regardless of current levels — maximum short-term yield at the cost of long-term sustainability. |

Strategy scores accumulate per-action and are used by `adjust_strategy()` to switch the agent's active strategy toward whichever has performed best.

Agent archetypes are created via `AgentFactory.create_agent()` which automatically names them after their strategy archetype (e.g., `Diplomat-3`).

### Climate Events

With a default **10% probability per tick**, a `ClimateEvent` is generated and applied to one or more randomly selected regions. Events have the following attributes:

| Field | Type | Description |
|---|---|---|
| `name` | str | One of: `drought`, `flood`, `heatwave`, `frost`, `storm` |
| `severity` | float [0.3–0.8] | Scales the resource impact per tick |
| `affected_resources` | list | 1–3 resources chosen from {water, food, energy, land} |
| `duration` | int [5–15] | Remaining ticks the event remains active |

The impact **decreases linearly** as `duration` counts down toward 0, modelling a natural tapering of the climate effect.

### Simulation Loop

Each call to `WorldModel.step()`:

1. **Mesa scheduler** activates all agents in random order (`RandomActivation`)
2. **Region step** — each region processes active climate events and regenerates resources
3. **Climate check** — stochastic roll to possibly spawn a new `ClimateEvent`
4. **Tick counter** increments
5. **End condition** — simulation halts when ≥ 80% of regions have total resources below 10 (full resource collapse)

The WebSocket broadcast loop (`broadcast_tick_loop`) runs at **1 Hz** by default, pushing the full serialized world state to all connected clients.

---

## API Reference

### REST Endpoints

Base URL: `http://localhost:8000/api/v1`

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Backend liveness check |
| `GET` | `/status` | Current tick, running flag, grid dimensions, agent count |
| `GET` | `/state` | Full world state (regions + agents) — same payload as WebSocket updates |
| `POST` | `/start` | Resume the simulation |
| `POST` | `/pause` | Pause the simulation |
| `POST` | `/reset` | Reinitialize the world to tick 0 |
| `GET` | `/regions` | List all regions with their current resource levels |
| `GET` | `/agents` | List all agents with strategy, resources, and history length |

**Example — get full state:**

```bash
curl http://localhost:8000/api/v1/state
```

**Example — start/pause simulation:**

```bash
curl -X POST http://localhost:8000/api/v1/start
curl -X POST http://localhost:8000/api/v1/pause
```

### WebSocket Protocol

Connect to: `ws://localhost:8000/ws/subscribe`

**Server → Client messages:**

```jsonc
// Sent once on connection
{ "type": "initial_state", "data": { /* SimulationState */ } }

// Broadcast every ~1 second
{ "type": "state_update",  "data": { /* SimulationState */ } }

// On error
{ "type": "error", "message": "..." }
```

**Client → Server messages:**

```jsonc
// Request an immediate state snapshot
{ "type": "request_state" }

// Control the simulation
{ "type": "control", "action": "start"  }
{ "type": "control", "action": "pause"  }
{ "type": "control", "action": "reset"  }
```

**`SimulationState` shape** (TypeScript):

```ts
interface SimulationState {
  tick: number
  running: boolean
  width: number
  height: number
  num_agents: number
  regions: Record<string, RegionState>  // key: "x-y"
  agents: AgentState[]
}
```

---

## Frontend

### Grid Visualizer

`GridVisualizer` renders an 800×600 HTML5 `<canvas>` element. Each cell in the grid displays:

- **Four resource indicator squares** (corners) whose opacity scales with the resource level relative to its maximum:
  - 🔵 Top-left — Water (blue)
  - 🟢 Top-right — Food (green)
  - 🟡 Bottom-left — Energy (gold)
  - 🟤 Bottom-right — Land (brown)
- **Agent indicator** (white circle) when a region is occupied
- **Strategy ring** (colored outline) identifying the occupying agent's current strategy:
  - Blue — Defensive
  - Teal — Expansive
  - Orange — Negotiator
  - Red — Extractive

The canvas re-renders reactively whenever the Zustand store receives a new state update from the WebSocket.

### Analytics Panel

`AnalyticsPanel` shows:

- **Aggregate stats** — total resources across all regions, average resources per region, count of critical regions (any resource below 20%), and active agent count
- **Agent cards** — one card per agent showing name, strategy color, a resource health bar (% of total capacity), and assigned region ID
- **Tick counter** — current simulation tick displayed prominently

### Controls

The `Controls` component in `App.tsx` provides:

- **Start / Pause** toggle button — calls `POST /api/v1/start` or `POST /api/v1/pause`
- **Reset** button — calls `POST /api/v1/reset`, re-initializing the world
- **Status indicator** — shows connection state (connecting / running / paused / error) and current tick

---

## Configuration

The simulation is initialized in `main.py` with the following defaults that can be adjusted directly:

```python
world_model = WorldModel(
    width=5,        # Grid columns
    height=5,       # Grid rows
    num_agents=5,   # AI agents to place (capped at width × height)
)
```

Resource defaults per region (defined in `ResourceManager.__init__`):

```python
{
    "water":  { "initial": 1000, "max": 1000, "regeneration_rate": 5.0  },
    "food":   { "initial": 1000, "max": 1000, "regeneration_rate": 5.0  },
    "energy": { "initial": 1000, "max": 1000, "regeneration_rate": 5.0  },
    "land":   { "initial":  100, "max":  100, "regeneration_rate": 0.1  },
}
```

Climate event frequency is controlled by `WorldModel.climate_event_rate` (default `0.1` — 10% per tick).

The WebSocket broadcast interval is set in `broadcast_tick_loop(interval=1.0)` (seconds).

---

## Analysis & Research Insights

WorldSim is designed to surface the following analytical questions:

- **Which strategies prove sustainable over long runs?** Defensive agents tend to preserve resources during climate shocks; Extractive agents accumulate quickly but risk regional collapse.
- **What conditions trigger strategy switching?** Agents self-adjust when competing strategies accumulate higher scores, allowing observation of emergent behavioral shifts.
- **How do climate events cascade?** A single severe drought can affect multiple regions simultaneously, creating resource scarcity that pressures nearby Negotiator agents to initiate trade.
- **When does collapse become inevitable?** The simulation ends when 80% of regions fall below a minimum resource threshold, providing a measurable collapse boundary for comparative runs.

These dynamics mirror real-world resource conflict patterns: overextraction, the tragedy of the commons, adaptive diplomacy under scarcity, and the compounding effects of climate disruption on interdependent economies.
