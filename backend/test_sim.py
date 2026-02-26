import json
from simulation import WorldModel
m = WorldModel()
for _ in range(5):
    m.step()
state = m.get_state()
print('Tick:', state['tick'])
print('Climate:', json.dumps(state['climate_event']))
for r in state['regions']:
    res = r['resources']
    print(r['name'], '|', r['last_action'], '| crime:', round(r['crime_rate'],2), '| pop:', r['population'], '| energy:', round(res['energy'],2))
