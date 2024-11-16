
import requests
import json

def test_location_service():
    try:
        print("Testing location services...")
        response = requests.get('https://ipinfo.io')
        
        if response.status_code == 200:
            data = response.json()
            print("\nLocation info:")
            print(f"IP Address: {data.get('ip', 'Not available')}")
            print(f"City: {data.get('city', 'Not available')}")
            print(f"Region: {data.get('region', 'Not available')}")
            print(f"Country: {data.get('country', 'Not available')}")
            print(f"Location: {data.get('loc', 'Not available')}")
            return True
        else:
            print(f"Error: Service returned status code {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Connection error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    test_location_service()
