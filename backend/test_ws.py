"""Quick WS test: connect, receive one frame, print it."""
import asyncio, json

async def main():
    try:
        import websockets
        async with websockets.connect('ws://localhost:8000/ws/world-state') as ws:
            raw = await asyncio.wait_for(ws.recv(), timeout=4)
            data = json.loads(raw)
            print("=== WS FRAME ===")
            print("Tick    :", data['tick'])
            print("Climate :", data['climate_event'])
            for r in data['regions']:
                res = r['resources']
                print(f"  {r['name']:12s} tribe={r['tribe']:5s} action={r['last_action']:9s} "
                      f"crime={r['crime_rate']:.2f} "
                      f"W={res['water']:.2f} F={res['food']:.2f} E={res['energy']:.2f} L={res['land']:.2f}")
    except ImportError:
        print("websockets not installed, checking via HTTP health endpoint...")
        import urllib.request
        with urllib.request.urlopen('http://localhost:8000/health') as r:
            print("Health:", json.loads(r.read()))
    except Exception as e:
        print("Error:", e)

asyncio.run(main())
