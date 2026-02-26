# 🏙️ WorldSim Frontend City Map Guide

## Overview

The frontend has been completely redesigned to display a **2D isometric city simulation** similar to Township and Clash of Clans, with themed regions, unique buildings, and animated human citizens.

## Features Implemented

### 1. **Five Distinct City Zones**

Each zone has its own visual character, buildings, and purpose:

#### 🔴 **CBD Core** (Center)

- **Position:** Center of the map (512, 300)
- **Color Theme:** Red (#ff6b6b) - High energy, high crime
- **Buildings:** Skyscrapers with lit windows
- **Characteristics:**
  - Energy traders thrive
  - High energy production
  - High crime level
  - Tall neon-lit buildings
  - Crowded urban environment

#### 🔵 **Waterfront** (Northwest)

- **Position:** Top-left area (200, 150)
- **Color Theme:** Blue (#4a9eff) - Safe haven
- **Buildings:** Water, trees, and nature
- **Characteristics:**
  - Water tribe flourishes
  - Abundant water resources
  - Low crime (safe area)
  - Lakeside homes
  - Green fields and natural features

#### 🟡 **Industrial** (Northeast)

- **Position:** Top-right area (824, 150)
- **Color Theme:** Gold (#ffd700) - Food processing
- **Buildings:** Factories with smokestacks and smoke
- **Characteristics:**
  - Food processing plants
  - Food abundance
  - Moderate crime (machinery noise)
  - Warehouses
  - Rail lines and smokestacks

#### 🔴 **Slums** (Southwest)

- **Position:** Bottom-left area (200, 500)
- **Color Theme:** Dark Red (#cc0000) - High crime
- **Buildings:** Dilapidated buildings with graffiti
- **Characteristics:**
  - High crime, low resources
  - Gangs
  - Citizens panic-migrate out
  - Broken windows
  - Graffiti-covered walls

#### 🟤 **Suburbs** (Southeast)

- **Position:** Bottom-right area (824, 500)
- **Color Theme:** Brown (#8b6f47) - Balanced
- **Buildings:** Spacious houses on hills
- **Characteristics:**
  - Land-rich
  - Low crime
  - Balanced resources
  - Spacious but isolated
  - Large residential houses

### 2. **Dynamic Sprite-Based Graphics**

All visuals are procedurally generated as sprites:

#### Citizens

- **Male Citizens:** Orange/brown outfit, animated walking motion
- **Female Citizens:** Pink dress, animated walking motion
- Randomly spawn throughout regions
- Animated bobbing motion for life-like feel
- Scale: 2.5x for visibility

#### Buildings

- **Skyscraper:** Dark gray with yellow lit windows
- **Factory:** Brown building with multiple smokestacks and smoke effects
- **Tree:** Green foliage with brown trunk
- **Water:** Blue water tiles with wave patterns
- **House:** Brown house with pink windows and door (suburbs)
- **Slum:** Gray dilapidated building with red danger indicators and graffiti

### 3. **Real-Time Information Display**

Each region displays:

```
Region Name (bold, top)
├── Population
├── Crime Level
├── Water Resources
├── Food Resources
└── Energy Resources
```

### 4. **Dynamic Region Coloring**

- **Base Color:** Set by region theme
- **Crime-Based Intensity:** Color shifts based on crime level
  - Low crime: Original color
  - High crime: Increased red tint, decreased green/blue tint

### 5. **Citizen Animations**

- Citizens spawn in regions automatically
- Gentle vertical bobbing animation (1-2 second loop)
- Random positioning within region bounds
- Removed and re-spawned when world state updates

### 6. **Sky Blue Background**

- Sky gradient background for natural game environment
- Decorative white clouds
- Depth sorting for proper layering

## Technical Architecture

### GameScene.ts Structure

```typescript
// Sprite Generation (preload)
generateAssets() {
  - Creates 8 different sprite types using Graphics
  - Caches as textures for reuse
  - citizen, citizen-female, skyscraper, factory, tree, water, house, slum
}

// Region Creation (create)
createRegions() {
  - Creates 5 containers for regions
  - Adds background graphics with rounded corners
  - Draws buildings for each region type
  - Adds region name and info text
  - Stores all graphics for updates
}

// Building Renderer
drawBuildingsForRegion() {
  - Places 2-3 buildings per region
  - Scales and positions based on region type
  - Uses sprite textures created in preload

// State Updates
updateWorldState() {
  - Receives world state from backend
  - Updates each region display
  - Updates citizen positions

updateRegionDisplay() {
  - Updates info text with current stats
  - Changes region color based on crime level
  - Redraws background with new color

updateCitizens() {
  - Removes old citizen sprites
  - Creates new citizens based on agents in world state
  - Adds bobbing animation to each citizen
}
```

### Data Flow

```
Backend WebSocket
        ↓
  World State JSON
        ↓
  App.tsx (receives via WebSocket)
        ↓
  GameCanvas (passes to GameScene)
        ↓
  GameScene.updateWorldState()
        ↓
  ├─ updateRegionDisplay() × 5
  ├─ updateCitizens()
  └─ Render all graphics
```

## Visual Design Philosophy

### Color Scheme

- **Primary Colors:** By region (red, blue, gold, dark red, brown)
- **Secondary Colors:** Natural elements (greens, grays, yellows)
- **Accent Colors:** Sky blue background, white text

### Isometric Feel

- **Depth Sorting:** Container depth = Y position (lower Y = rendered first)
- **Layering:** Citizens rendered above buildings
- **Spacing:** Regions positioned to avoid overlap while showing layout

### Game Feel

- Similarity to **Township** and **Clash of Clans**:
  - Multiple themed zones
  - Semi-isometric perspective
  - Animated units (citizens)
  - Real-time resource display
  - Color-coded danger/safety levels

## Usage

### Starting the Frontend

```bash
cd c:\Users\Dell\Desktop\overclocked\worldsim-frontend
npm start
```

Access at: `http://localhost:3000`

### Backend Requirements

- Backend should be running on `ws://localhost:8000/ws`
- Should send `state_update` messages with `WorldState` data
- Should include agents array and regions data

### WorldState Format Expected

```typescript
{
  step: number,
  regions: {
    [regionId: string]: {
      region_id: string,
      resources: { water, food, energy, land },
      population: number,
      crime_level: number,
      morale: number,
      // ... other fields
    }
  },
  agents: {
    [agentId: string]: {
      agent_id: string,
      region_id: string,
      // ... other fields
    }
  },
  // ... other fields
}
```

## Performance Considerations

1. **Sprite Generation:** Done once during preload
2. **Citizen Updates:** Destroyed and recreated each state update
3. **Graphics Redraws:** Only regions with changed stats are updated
4. **Depth Sorting:** Automatic based on Y position

## Future Enhancements

- [ ] Isometric tile-based grid system
- [ ] Animated weather effects
- [ ] Trade route visualization (lines between regions)
- [ ] Building animations (smoke puffs, lights flickering)
- [ ] Click-to-inspect region details popup
- [ ] Zoom and pan controls
- [ ] Sound effects for region events
- [ ] Particle effects for population migration

## File Structure

```
worldsim-frontend/
├── src/
│   ├── scenes/
│   │   └── GameScene.ts          ← Main city map logic
│   ├── components/
│   │   ├── GameCanvas.tsx        ← Phaser container
│   │   ├── GameCanvas.css        ← Updated styling
│   │   ├── ControlPanel.tsx
│   │   └── InfoPanel.tsx
│   ├── services/
│   │   ├── WebSocketService.ts
│   │   └── SimulationStateService.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## Credits

Created for WorldSim - Adaptive Resource Scarcity & Agent Strategy Simulator using **Phaser 3** game engine.
