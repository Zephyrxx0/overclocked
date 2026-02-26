WorldSim —

Adaptive Resource Scarcity & Agent Strategy Simulator

Design

a simulation engine representing a set of regions, each with distinct and

finite resources — water, food, energy, land. Autonomous AI agents governing

each region must learn strategies for survival, growth, and inter-region

negotiation through reinforcement learning, without being pre-programmed with

fixed rules. The world must evolve meaningfully over simulation cycles:

resources deplete, climatic events alter availability, trade relationships form

and break. Teams must go beyond building the simulation — they must analyze

which emergent strategies proved sustainable, which collapsed and why, and what

the simulation reveals about real-world resource conflict dynamics. The

visualization of the evolving world state is as important as the underlying

model.

### TECH STACK
Frontend: React 18 + TypeScript + Phaser 3 + Socket.io-client
Backend: FastAPI + Native WebSockets + asyncio
Simulation: Mesa (agent-based modeling)
Data: NumPy for resource calculations
Deployment: Uvicorn + React build