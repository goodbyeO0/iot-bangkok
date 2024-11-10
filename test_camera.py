from picamera2 import Picamera2
import time
import os
from datetime import datetime

def test_camera():
    # Create base images directory
    base_dir = os.path.join(os.path.dirname(__file__), 'images')
    os.makedirs(base_dir, exist_ok=True)
    
    # Create session directory with timestamp
    session_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir = os.path.join(base_dir, f"session_{session_timestamp}")
    os.makedirs(session_dir, exist_ok=True)
    print(f"Created session directory: {session_dir}")
    
    # Initialize camera
    picam2 = Picamera2()
    
    # Configure camera
    config = picam2.create_preview_configuration()
    picam2.configure(config)
    
    # Start camera
    picam2.start()
    print("Camera started successfully")
    
    # Warm-up time (3 seconds)
    print("Warming up camera...")
    time.sleep(3)
    
    seconds_to_record = 4
    
    # Calculate number of pictures for 4 seconds
    num_pictures = int(seconds_to_record / 0.5)  # 8 pictures
    
    # Capture images with 0.5-second interval
    for i in range(num_pictures):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"image_{timestamp}.png"
        filepath = os.path.join(session_dir, filename)
        
        picam2.capture_file(filepath)
        print(f"Image {i+1} captured and saved as '{filename}'")
        
        if i < num_pictures - 1:
            time.sleep(0.5)
    
    # Stop camera
    picam2.stop()
    print("Camera test complete")

if __name__ == "__main__":
    try:
        test_camera()
    except Exception as e:
        print(f"Error: {str(e)}")