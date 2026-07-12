"""
Weather API Integration - Roxas City HIS
========================================
Responsibility:
  Fetches live rainfall intensity and tide data to feed into the JAX SPINN engine.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# Roxas City Coordinates
LAT = 11.58
LON = 122.75

def get_live_rainfall() -> float:
    """
    Returns live rainfall intensity in mm/hr from OpenWeather.
    """
    if not OPENWEATHER_API_KEY:
        return 0.0
        
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={LAT}&lon={LON}&appid={OPENWEATHER_API_KEY}&units=metric"
    try:
        res = requests.get(url)
        if res.status_code == 200:
            data = res.json()
            # OpenWeather returns 'rain' block with '1h' volume in mm
            if "rain" in data and "1h" in data["rain"]:
                return float(data["rain"]["1h"])
    except Exception as e:
        print(f"Weather API Error: {e}")
        
    return 0.0 # Return 0.0 mm/hr if no rain or error
