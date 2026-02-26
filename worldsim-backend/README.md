# WorldSim Backend

FastAPI + Mesa Agent-Based Simulation + WebSocket

## Quick Start

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Run Server

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server will be available at `http://localhost:8000`

### API Documentation

Once server is running:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Architecture

### Simulation Engine (Mesa)

- `app/simulation/models.py` - Data models for regions, resources, and agents
- `app/simulation/agents.py` - Agent behavior and World model

### API Server

- `app/main.py` - FastAPI app with WebSocket support
- `app/api/routes.py` - REST API endpoints

### WebSocket Protocol

#### Client → Server

- `{"type": "start"}` - Start simulation
- `{"type": "stop"}` - Stop simulation
- `{"type": "reset"}` - Reset simulation
- `{"type": "get_state"}` - Request current state
- `{"type": "ping"}` - Ping server

#### Server → Client

- `{"type": "state_update", "data": {...}}` - World state update
- `{"type": "simulation_reset", "data": {...}}` - Reset confirmation
- `{"type": "pong"}` - Pong response

## Simulation Details

### Regions (5)

1. **CBD Core** - High crime, high energy production
2. **Waterfront** - Low crime, water abundance
3. **Industrial Zone** - Food production, moderate crime
4. **Slums** - High crime, resource-constrained
5. **Hilly Suburbs** - Safe, land-rich

### Agent Learning

- Agents learn via simple RL with strategy weights
- Decisions: stay, migrate, trade, hoard, consume
- States: hunger, fear, satisfaction, resources

### Resources

- Water, Food, Energy, Land
- Deplete based on population
- Regenerate based on region capabilities
- Climate events affect availability

### Trade Network

- Regions form trade partnerships based on complementary resources
- Energy trading from high-production to high-demand regions
- Trade increases agent satisfaction

## Project Structure

```
worldsim-backend/
├── app/
│   ├── main.py              # FastAPI server
│   ├── api/
│   │   └── routes.py        # API endpoints
│   └── simulation/
│       ├── models.py        # Data structures
│       └── agents.py        # Agent & World models
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Development

### Testing WebSocket

Use `websocat` or browser DevTools to test WebSocket:

```bash
# Using websocat (https://github.com/vi/websocat)
websocat ws://localhost:8000/ws
# Then send: {"type":"start"}
```

### Monitoring

Check logs and metrics:

```bash
curl http://localhost:8000/health
```

## Next Steps

1. **Enhance Agent Learning** - Implement more sophisticated RL (Q-learning, etc.)
2. **Resource Economics** - Add pricing and market dynamics
3. **Governance** - Implement regional policies affecting resources
4. **Persistence** - Save/load simulation states
5. **Analytics** - Track emergent behaviors and outcomes
