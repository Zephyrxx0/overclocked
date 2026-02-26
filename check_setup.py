#!/usr/bin/env python3
"""
Quick demo script to verify WorldSim installation
Run this to test if everything is set up correctly
"""

import subprocess
import sys
import time
import os
from pathlib import Path


def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")


def check_python():
    """Check Python version"""
    print_header("Checking Python Installation")
    version = sys.version_info
    print(f"✓ Python {version.major}.{version.minor}.{version.micro}")
    if version.major < 3 or (version.major == 3 and version.minor < 10):
        print("⚠ Warning: Python 3.10+ recommended")
        return False
    return True


def check_node():
    """Check Node.js installation"""
    print_header("Checking Node.js Installation")
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        print(f"✓ {result.stdout.strip()}")
        return True
    except FileNotFoundError:
        print("✗ Node.js not found. Install from nodejs.org")
        return False


def check_port(port):
    """Check if port is available"""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(("127.0.0.1", port))
    sock.close()
    return result != 0  # True if port is free


def check_ports():
    """Check required ports"""
    print_header("Checking Port Availability")
    ports = {8000: "Backend (FastAPI)", 3000: "Frontend (React)"}
    for port, service in ports.items():
        if check_port(port):
            print(f"✓ Port {port} available ({service})")
        else:
            print(f"✗ Port {port} in use ({service})")
            return False
    return True


def check_backend_deps():
    """Check Python dependencies"""
    print_header("Checking Backend Dependencies")
    try:
        import fastapi
        import mesa
        import numpy
        import uvicorn
        print("✓ FastAPI installed")
        print("✓ Mesa installed")
        print("✓ NumPy installed")
        print("✓ Uvicorn installed")
        return True
    except ImportError as e:
        print(f"✗ Missing: {e}")
        print("\nTo install: cd worldsim-backend && pip install -r requirements.txt")
        return False


def check_directories():
    """Check project structure"""
    print_header("Checking Project Structure")
    dirs = [
        "worldsim-backend/app",
        "worldsim-backend/app/simulation",
        "worldsim-backend/app/api",
        "worldsim-frontend/src",
        "worldsim-frontend/src/components",
        "worldsim-frontend/src/scenes",
        "worldsim-frontend/src/services",
    ]
    
    all_exist = True
    for d in dirs:
        if Path(d).exists():
            print(f"✓ {d}/")
        else:
            print(f"✗ Missing: {d}/")
            all_exist = False
    
    return all_exist


def print_next_steps():
    """Print setup instructions"""
    print_header("Next Steps")
    print("""
1. BACKEND SETUP (Terminal 1):
   cd worldsim-backend
   python -m venv venv
   # Windows: venv\\Scripts\\activate
   # macOS/Linux: source venv/bin/activate
   pip install -r requirements.txt
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

2. FRONTEND SETUP (Terminal 2):
   cd worldsim-frontend
   npm install
   npm run dev

3. ACCESS APPLICATION:
   Open your browser: http://localhost:3000

4. RUN SIMULATION:
   - Wait for "Connected" indicator (green dot)
   - Click "▶ Start" button
   - Watch regions interact!

For detailed instructions, see QUICKSTART.md
""")


def main():
    print("\n" + "="*60)
    print("  WorldSim Installation Checker")
    print("="*60)
    
    checks = [
        ("Python", check_python),
        ("Node.js", check_node),
        ("Ports", check_ports),
        ("Directories", check_directories),
        ("Backend Dependencies", check_backend_deps),
    ]
    
    results = {}
    for name, check_fn in checks:
        try:
            results[name] = check_fn()
        except Exception as e:
            print(f"⚠ Error checking {name}: {e}")
            results[name] = False
    
    # Summary
    print_header("Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, passed_check in results.items():
        status = "✓" if passed_check else "✗"
        print(f"{status} {name}")
    
    print(f"\n{passed}/{total} checks passed")
    
    if passed == total:
        print("\n✅ System ready! Your WorldSim installation is complete.")
        print_next_steps()
        return 0
    else:
        print("\n⚠ Some checks failed. Please review above and install missing dependencies.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
