"""
WorldSim RL Agent System
- 1 PresidentAgent per region (Mesa Agent)
- PPO inference via stable-baselines3 (or fallback heuristic if not installed)
- 4-resource observation space
- 4 discrete actions: hold/trade/expand/steal
- Sustainability-focused reward shaping
"""
from mesa import Agent, Model
from mesa.time import RandomActivation
from mesa.datacollection import DataCollector
from typing import Dict, List, Optional, Tuple
import numpy as np
import logging
import os

from .models import (
    RegionConfig, RegionState, Resources, ClimateEvent,
    ActionType, WeatherEvent, REGION_CONFIGS,
)

logger = logging.getLogger(__name__)

# ─── Observation / Action constants ───────────────────────────────────────────
OBS_DIM    = 24   # 4 resources × 5 regions + 4 weather flags
ACTION_DIM = 4    # hold, trade, expand, steal


# ─── PPO Inference Wrapper ─────────────────────────────────────────────────────

class PPOStrategyEngine:
    """
    Wraps stable-baselines3 PPO for inference.
    Falls back to a weighted heuristic if SB3 is not installed or no model file exists.
    """

    ACTION_LABELS = ["hold_conserve", "propose_trade", "expand_infra", "steal_conflict"]

    def __init__(self, model_path: Optional[str] = None):
        self._sb3_model = None
        self._use_heuristic = True

        if model_path and os.path.exists(model_path):
            try:
                from stable_baselines3 import PPO
                self._sb3_model = PPO.load(model_path)
                self._use_heuristic = False
                logger.info(f"Loaded PPO model from {model_path}")
            except ImportError:
                logger.warning("stable-baselines3 not installed — using heuristic RL")
            except Exception as e:
                logger.warning(f"Could not load PPO model: {e} — using heuristic")
        else:
            logger.info("No PPO model file — using heuristic RL with tabular Q-update")

    def predict(self, obs: np.ndarray) -> int:
        """Return action index [0‥3]."""
        if self._sb3_model is not None:
            action, _ = self._sb3_model.predict(obs, deterministic=True)
            return int(action)
        return self._heuristic_action(obs)

    def _heuristic_action(self, obs: np.ndarray) -> int:
        """
        Behaviour-based heuristic that mimics what a sustainability-trained PPO
        would learn:
          - If ANY resource < 30 → trade (secure supply)
          - If all resources > 120 → expand (invest surplus)
          - If a neighbour has < 40 in something we have > 150 → steal (opportunistic)
          - Default → hold (conserve)
        """
        my_w, my_f, my_e, my_l = obs[0], obs[1], obs[2], obs[3]
        neigh = obs[4:20].reshape(4, 4)   # 4 neighbours × 4 resources

        if min(my_w, my_f, my_e, my_l) < 30:
            return ActionType.PROPOSE_TRADE.value

        if min(my_w, my_f, my_e, my_l) > 120:
            return ActionType.EXPAND_INFRA.value

        # opportunistic steal: only if we have large surplus and neighbour is weak
        my_max   = max(my_w, my_f, my_e, my_l)
        neigh_min = neigh.min()
        if my_max > 160 and neigh_min < 40:
            return ActionType.STEAL_CONFLICT.value

        return ActionType.HOLD_CONSERVE.value


# shared engine instance (singleton)
_ppo_engine = PPOStrategyEngine(
    model_path=os.path.join(os.path.dirname(__file__), "ppo_worldsim.zip")
)


# ─── President Agent ───────────────────────────────────────────────────────────

class PresidentAgent(Agent):
    """
    One autonomous president per region.
    Uses PPO (or heuristic fallback) to decide its strategy each tick.
    No agents migrate between regions — each president is sovereign.
    """

    def __init__(self, unique_id: str, model: "WorldSimModel", region_id: str):
        super().__init__(model)
        self.unique_id   = unique_id
        self.region_id   = region_id

        # Simple tabular Q-table for online heuristic refinement
        self._q = np.ones(ACTION_DIM, dtype=np.float64) * 5.0
        self._lr     = 0.05   # learning rate
        self._gamma  = 0.95   # discount
        self._eps    = 0.10   # ε-greedy exploration
        self._last_action: Optional[int] = None
        self._last_reward: float = 0.0
        self._total_reward: float = 0.0

    # ── Observation builder ───────────────────────────────────────────────────

    def _build_obs(self) -> np.ndarray:
        """
        24-dim observation vector:
          [0:4]   = own resources (water, food, energy, land) / 300
          [4:20]  = neighbour resources (4 neighbours × 4) / 300
          [20:24] = one-hot weather flags (drought, solar_flare, blight, rain)
        """
        vec = np.zeros(OBS_DIM, dtype=np.float32)
        states = self.model.region_states

        # own resources
        r = states[self.region_id].resources
        vec[0:4] = r.as_array() / 300.0

        # neighbour resources (all other 4 regions in fixed order)
        neighbours = [rid for rid in states if rid != self.region_id]
        for i, nid in enumerate(neighbours[:4]):
            nr = states[nid].resources
            vec[4 + i*4 : 4 + i*4 + 4] = nr.as_array() / 300.0

        # active weather
        weather = self.model.active_weather.value if self.model.active_weather else "none"
        weather_map = {"drought": 20, "solar_flare": 21, "blight": 22, "rain": 23}
        if weather in weather_map:
            vec[weather_map[weather]] = 1.0

        return vec

    # ── Reward function ───────────────────────────────────────────────────────

    def _compute_reward(self) -> float:
        """
        Sustainability-shaped reward:
        +  high reward for keeping ALL 4 resources > baseline (80)
        +  bonus for successful trades (positive diplomacy)
        -  heavy penalty when any resource → 0 (collapse)
        -  penalty for conflict (destabilises world)
        """
        state = self.model.region_states[self.region_id]
        r     = state.resources
        arr   = r.as_array()

        # survival bonus
        baseline  = 80.0
        surpluses  = arr - baseline
        reward     = float(np.sum(np.clip(surpluses, -10, 10))) * 0.05

        # collapse penalty
        collapses  = (arr < 5.0).sum()
        reward    -= collapses * 30.0

        # trade bonus
        reward    += len(state.trade_partners) * 2.0

        # conflict penalty
        reward    -= state.total_conflicts * 1.0

        # morale bonus
        reward    += state.morale * 10.0

        return reward

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self):
        obs    = self._build_obs()

        # ε-greedy: sometimes explore, else use PPO/heuristic
        if np.random.random() < self._eps:
            action = int(np.random.randint(ACTION_DIM))
        else:
            action = _ppo_engine.predict(obs)

        # Q-table online update
        if self._last_action is not None:
            reward = self._compute_reward()
            td     = reward + self._gamma * np.max(self._q) - self._q[self._last_action]
            self._q[self._last_action] += self._lr * td
            self._total_reward         += reward
            self._last_reward           = reward

        self._last_action = action
        self._execute_action(action)

    # ── Action executors ──────────────────────────────────────────────────────

    def _execute_action(self, action: int):
        state   = self.model.region_states[self.region_id]
        all_ids = list(self.model.region_states.keys())

        if action == ActionType.HOLD_CONSERVE.value:
            state.president_strategy = "hold_conserve"
            # reduce consumption 10 %
            state.resources.water  *= 0.98
            state.resources.food   *= 0.98
            state.resources.energy *= 0.98
            state.resources.land   *= 0.999

        elif action == ActionType.PROPOSE_TRADE.value:
            state.president_strategy = "propose_trade"
            self._execute_trade()

        elif action == ActionType.EXPAND_INFRA.value:
            state.president_strategy = "expand_infra"
            # invest energy → boost infrastructure multiplier
            cost = 8.0
            if state.resources.energy >= cost:
                state.resources.energy  -= cost
                state.infrastructure    += 0.02
                state.infrastructure     = min(state.infrastructure, 2.5)

        elif action == ActionType.STEAL_CONFLICT.value:
            state.president_strategy = "steal_conflict"
            self._execute_steal()

        state.president_action = action

    def _execute_trade(self):
        """Find best complementary partner and exchange surplus for deficit."""
        my_state = self.model.region_states[self.region_id]
        my_res   = my_state.resources.as_array()
        best_gain = -1
        best_rid  = None
        best_send_idx = -1
        best_recv_idx = -1

        for rid, other in self.model.region_states.items():
            if rid == self.region_id:
                continue
            o_res = other.resources.as_array()
            # I give what I have surplus of, I get what I'm short on
            send_idx = int(np.argmax(my_res))    # my biggest surplus
            recv_idx = int(np.argmin(my_res))    # my biggest deficit

            gain = o_res[send_idx] > 80 and my_res[recv_idx] < 100
            if gain and o_res[recv_idx] > 30:
                score = o_res[recv_idx] - my_res[recv_idx]
                if score > best_gain:
                    best_gain    = score
                    best_rid     = rid
                    best_send_idx = send_idx
                    best_recv_idx = recv_idx

        if best_rid is not None:
            trade_vol = 12.0
            other_state = self.model.region_states[best_rid]
            send_arr = my_state.resources.as_array()
            recv_arr = other_state.resources.as_array()

            if send_arr[best_send_idx] >= trade_vol:
                # transfer
                setattr(my_state.resources,    ["water","food","energy","land"][best_send_idx],
                        send_arr[best_send_idx] - trade_vol)
                setattr(other_state.resources, ["water","food","energy","land"][best_send_idx],
                        recv_arr[best_send_idx] + trade_vol)
                # receive
                setattr(my_state.resources,    ["water","food","energy","land"][best_recv_idx],
                        send_arr[best_recv_idx] + trade_vol * 0.8)
                setattr(other_state.resources, ["water","food","energy","land"][best_recv_idx],
                        recv_arr[best_recv_idx] - trade_vol * 0.8)

                my_state.total_trades   += 1
                other_state.total_trades += 1
                if best_rid not in my_state.trade_partners:
                    my_state.trade_partners.append(best_rid)
                if self.region_id not in other_state.trade_partners:
                    other_state.trade_partners.append(self.region_id)

    def _execute_steal(self):
        """Take resources from the weakest neighbour — costly for relations."""
        my_state = self.model.region_states[self.region_id]
        weakest  = min(
            [rid for rid in self.model.region_states if rid != self.region_id],
            key=lambda rid: self.model.region_states[rid].resources.total()
        )
        victim = self.model.region_states[weakest]

        # Steal from victim's weakest resource
        vic_arr = victim.resources.as_array()
        steal_idx = int(np.argmin(vic_arr))
        steal_vol = min(10.0, vic_arr[steal_idx] * 0.15)

        names = ["water", "food", "energy", "land"]
        setattr(victim.resources, names[steal_idx],
                vic_arr[steal_idx] - steal_vol)
        my_arr = my_state.resources.as_array()
        setattr(my_state.resources, names[steal_idx],
                my_arr[steal_idx] + steal_vol * 0.7)

        my_state.total_conflicts  += 1
        victim.total_conflicts    += 1
        victim.morale             -= 0.05

        # Remove this region from victim's trade partners
        if self.region_id in victim.trade_partners:
            victim.trade_partners.remove(self.region_id)
        if weakest in my_state.trade_partners:
            my_state.trade_partners.remove(weakest)

    def to_dict(self) -> Dict:
        state = self.model.region_states.get(self.region_id)
        return {
            "agent_id":        self.unique_id,
            "region_id":       self.region_id,
            "action":          self._last_action or 0,
            "strategy":        state.president_strategy if state else "hold",
            "total_reward":    round(self._total_reward, 2),
            "last_reward":     round(self._last_reward, 2),
            "q_values":        [round(q, 3) for q in self._q.tolist()],
            "tribe":           "president",
            "resources_held":  0,
            "hunger":          0,
            "fear":            0,
            "satisfaction":    state.morale if state else 0.5,
        }


# ─── Weather Engine ────────────────────────────────────────────────────────────

class WeatherEngine:
    """
    Numpy-driven climate event generator.
    Triggers a random event every N ticks (configurable probability).
    """

    EVENT_CHANCE = 0.06   # 6 % per tick

    def __init__(self):
        self.active_event:  WeatherEvent = WeatherEvent.NONE
        self.affected_region: Optional[str] = None
        self.ticks_remaining: int = 0
        self.history: List[ClimateEvent] = []

    def tick(
        self, step: int, region_states: Dict[str, RegionState]
    ) -> Optional[ClimateEvent]:
        """Apply ongoing weather effects and maybe trigger a new one."""
        # Decay current event
        if self.ticks_remaining > 0:
            self.ticks_remaining -= 1
            self._apply_ongoing(region_states)
            if self.ticks_remaining == 0:
                self.active_event      = WeatherEvent.NONE
                self.affected_region   = None
            return None

        # Possibly trigger new event
        if np.random.random() < self.EVENT_CHANCE:
            return self._trigger_new(step, region_states)
        return None

    def _apply_ongoing(self, region_states: Dict[str, RegionState]):
        """Mild per-tick effect while event is active."""
        if self.active_event == WeatherEvent.DROUGHT:
            for s in region_states.values():
                s.resources.water *= 0.98
        elif self.active_event == WeatherEvent.SOLAR_FLARE:
            for s in region_states.values():
                s.resources.energy *= 1.005
        elif self.active_event == WeatherEvent.BLIGHT:
            if self.affected_region and self.affected_region in region_states:
                region_states[self.affected_region].resources.food *= 0.97
        elif self.active_event == WeatherEvent.RAIN:
            if self.affected_region and self.affected_region in region_states:
                region_states[self.affected_region].resources.water *= 1.01

    def _trigger_new(
        self, step: int, region_states: Dict[str, RegionState]
    ) -> ClimateEvent:
        """Select and apply a new climate event."""
        events = [
            WeatherEvent.DROUGHT,
            WeatherEvent.SOLAR_FLARE,
            WeatherEvent.BLIGHT,
            WeatherEvent.RAIN,
            WeatherEvent.CALM,
        ]
        event  = np.random.choice(events)
        region = np.random.choice(list(region_states.keys()))

        self.active_event      = event
        self.affected_region   = region
        self.ticks_remaining   = np.random.randint(4, 10)

        desc = self._apply_initial(event, region, region_states)

        record = ClimateEvent(step=step, type=event.value, region=region, description=desc)
        self.history.append(record)
        logger.info(f"Climate event: {event.value} in {region} — {desc}")
        return record

    def _apply_initial(
        self, event: WeatherEvent, region: str, states: Dict[str, RegionState]
    ) -> str:
        if event == WeatherEvent.DROUGHT:
            for s in states.values():
                s.resources.water *= 0.80
            return "Drought: –20% Water globally"

        elif event == WeatherEvent.SOLAR_FLARE:
            for s in states.values():
                s.resources.energy *= 1.20
                s.resources.food   *= 0.90
            return "Solar Flare: +20% Energy, –10% Food globally"

        elif event == WeatherEvent.BLIGHT:
            if region in states:
                states[region].resources.food *= 0.70
            return f"Blight: –30% Food in {region}"

        elif event == WeatherEvent.RAIN:
            if region in states:
                states[region].resources.water *= 1.15
            return f"Rain: +15% Water in {region}"

        elif event == WeatherEvent.CALM:
            for s in states.values():
                s.morale = min(1.0, s.morale + 0.05)
            return "Calm period: morale +5% globally"

        return ""

    @property
    def active_event_name(self) -> str:
        return self.active_event.value if self.active_event else "none"


# ─── WorldSim Mesa Model ───────────────────────────────────────────────────────

class WorldSimModel(Model):
    """
    Mesa Model — one PresidentAgent per sovereign region.
    Background asyncio thread calls step(); results put on asyncio.Queue.
    """

    def __init__(self, region_configs: Dict[str, RegionConfig] = None):
        super().__init__()
        if region_configs is None:
            region_configs = REGION_CONFIGS

        self.region_configs: Dict[str, RegionConfig] = region_configs
        self.region_states:  Dict[str, RegionState]  = {}
        self.presidents:     Dict[str, PresidentAgent] = {}
        self.schedule        = RandomActivation(self)
        self.weather_engine  = WeatherEngine()
        self.active_weather  = WeatherEvent.NONE
        self.climate_events: List[Dict] = []
        self.step_count      = 0

        self._init_regions()

        self.datacollector = DataCollector(
            model_reporters={
                "avg_morale":       lambda m: round(np.mean([s.morale for s in m.region_states.values()]), 3),
                "total_resources":  lambda m: round(sum(s.resources.total() for s in m.region_states.values()), 1),
            }
        )

    def _init_regions(self):
        for rid, cfg in self.region_configs.items():
            self.region_states[rid] = RegionState(
                region_id    = rid,
                name         = cfg.name,
                visual_theme = cfg.visual_theme,
                resources    = Resources(
                    water  = cfg.initial_resources.water,
                    food   = cfg.initial_resources.food,
                    energy = cfg.initial_resources.energy,
                    land   = cfg.initial_resources.land,
                ),
                morale = cfg.base_morale,
            )

            president = PresidentAgent(
                unique_id = f"president_{rid}",
                model     = self,
                region_id = rid,
            )
            self.presidents[rid] = president
            self.schedule.add(president)

    # ── Mesa step ─────────────────────────────────────────────────────────────

    def step(self):
        self.step_count += 1

        # 1. Presidents decide actions
        self.schedule.step()

        # 2. Natural resource regeneration (with infrastructure multiplier)
        for rid, state in self.region_states.items():
            cfg  = self.region_configs[rid]
            mult = state.infrastructure
            state.resources.water  += cfg.regen_rates.water  * mult
            state.resources.food   += cfg.regen_rates.food   * mult
            state.resources.energy += cfg.regen_rates.energy * mult
            state.resources.land   += cfg.regen_rates.land   * mult
            state.resources.clamp(0, 300)

        # 3. Baseline consumption (living costs)
        for state in self.region_states.values():
            state.resources.water  -= 0.8
            state.resources.food   -= 0.8
            state.resources.energy -= 0.6
            state.resources.clamp(0, 300)

        # 4. Climate events
        event = self.weather_engine.tick(self.step_count, self.region_states)
        self.active_weather = self.weather_engine.active_event
        if event:
            self.climate_events.append(event.to_dict())
            # propagate active weather to region states
            for state in self.region_states.values():
                state.active_weather = event.type

        # 5. Morale update
        for rid, state in self.region_states.items():
            r    = state.resources.as_array() / 200.0
            morale = float(np.clip(np.mean(r) * 0.7 + state.morale * 0.3, 0, 1))
            state.morale = round(morale, 3)

        # 6. Active weather tag (clear if none)
        if self.active_weather == WeatherEvent.NONE:
            for state in self.region_states.values():
                state.active_weather = "none"

        # 7. Data collection
        self.datacollector.collect(self)

    # ── State serialisation ────────────────────────────────────────────────────

    def get_world_state(self) -> Dict:
        return {
            "step":           self.step_count,
            "regions":        {rid: s.to_dict() for rid, s in self.region_states.items()},
            "agents":         {rid: p.to_dict() for rid, p in self.presidents.items()},
            "climate_events": self.climate_events[-15:],
            "trade_network":  {rid: s.trade_partners for rid, s in self.region_states.items()},
            "active_weather": self.weather_engine.active_event_name,
            "weather_region": self.weather_engine.affected_region or "global",
        }
