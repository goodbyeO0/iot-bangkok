import time
import os
from datetime import datetime

base_dir = os.path.join(os.path.dirname(__file__), 'images')
os.makedirs(base_dir, exist_ok=True)
session_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
session_dir = os.path.join(base_dir, f"session_{session_timestamp}")
os.makedirs(session_dir, exist_ok=True)
print(f"Created session directory: {session_dir}")