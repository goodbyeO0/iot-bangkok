from picamera2 import Picamera2
import time
import os
from datetime import datetime
import requests
import json
import gpiozero

# Setup LED monitoring
red_led = gpiozero.LED(27)  # Red LED on GPIO 27

def is_red_light():
    """Check if the red light is on"""
    return red_led.value == 1

def wait_for_red_light():
    """Wait until the red light is on before proceeding"""
    while not is_red_light():
        time.sleep(0.1)  # Check every 100ms
    print("Red light detected - starting camera sequence")

def get_location():
    """Get device location coordinates using ipinfo.io API"""
    try:
        print("Getting location coordinates...")
        response = requests.get('https://ipinfo.io', timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            loc = data['loc'].split(',')
            coords = {
                "latitude": float(loc[0]),
                "longitude": float(loc[1])
            }
            print(f"Coordinates: {coords['latitude']}, {coords['longitude']}")
            return coords
        else:
            print(f"Error: Status code {response.status_code}")
            return None
    except Exception as e:
        print(f"Location error: {str(e)}")
        return None

def test_camera():
    while True:  # Continuous monitoring
        try:
            # Wait for red light before starting
            wait_for_red_light()
            
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
            config = picam2.create_preview_configuration()
            picam2.configure(config)
            
            # Start camera
            picam2.start()
            print("Camera started successfully")
            
            # Warm-up time
            print("Warming up camera...")
            time.sleep(3)
            
            # Only proceed if still red light
            if not is_red_light():
                print("Red light ended during warmup - aborting sequence")
                picam2.stop()
                continue
            
            # Capture images
            seconds_to_record = 4
            num_pictures = int(seconds_to_record / 1)
            
            for i in range(num_pictures):
                if not is_red_light():
                    print("Red light ended - stopping capture sequence")
                    break
                    
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                filename = f"image_{timestamp}.png"
                filepath = os.path.join(session_dir, filename)
                
                picam2.capture_file(filepath)
                print(f"Image {i+1} captured and saved as '{filename}'")
                
                if i < num_pictures - 1:
                    time.sleep(0.5)
            
            # Stop camera
            picam2.stop()
            print("Camera sequence complete")
            
            # Process captured images if any were taken
            if os.listdir(session_dir):
                try:
                    # Send location data
                    location = get_location()
                    location_response = requests.post(
                        'http://localhost:3005/api/location',
                        json=location
                    )
                    print(f"Location sent to API: {location}")

                    # Get car data
                    if location_response.status_code == 200:
                        print("Getting car data from API...")
                        car_data_response = requests.get('http://localhost:3005/api/carData')
                        
                        if car_data_response.status_code == 200:
                            car_data = car_data_response.json()
                            print("\nCar Data Response:")
                            print(json.dumps(car_data, indent=2))
                        else:
                            print(f"Error getting car data. Status code: {car_data_response.status_code}")
                            print(f"Response: {car_data_response.text}")
                
                except Exception as e:
                    print(f"Error in API communication: {str(e)}")
            
            # Wait a bit before checking for next red light
            time.sleep(1)
            
        except Exception as e:
            print(f"Error in camera sequence: {str(e)}")
            time.sleep(1)  # Wait before retrying

if __name__ == "__main__":
    try:
        test_camera()
    except KeyboardInterrupt:
        print("\nProgram stopped by user")
    except Exception as e:
        print(f"Fatal error: {str(e)}")