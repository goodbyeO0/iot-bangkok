import geocoder

def get_location():
    g = geocoder.ip('me')
    print(f"City: {g.city}")
    print(f"State: {g.state}")
    print(f"Country: {g.country}")
    print(f"Latitude: {g.lat}")
    print(f"Longitude: {g.lng}")

get_location()