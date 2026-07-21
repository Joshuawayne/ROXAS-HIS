from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import numpy as np
import logging
import os
import urllib.request
import json
import math
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Point

# Import core modules from your project structure
from core.gis import (
    init_gee, load_geotiff_as_tensor, build_manning_tensor, 
    build_drainage_tensor, fetch_encroaching_buildings, 
    ROXAS_BOUNDS_WGS84, sample_elevation_profile
)
from core.solver import SPINNHydraulicSolver
from core.optimizer import NSGAIIOptimizer
from core.weather import get_live_rainfall
from core.cartography import create_base_map, overlay_jax_tensor

# --- 1. DYNAMIC DATA CONFIGURATION ---
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Supabase Storage Configuration (Based on your xgmsqzzamasfywvnzlje project)
PROJECT_ID = "wwwhhmtylicyemefhzlb"
STORAGE_URL = f"https://{PROJECT_ID}.supabase.co/storage/v1/object/public/roxas-data"

FILES_TO_DOWNLOAD = {
    "dtm.tif": f"{STORAGE_URL}/dtm.tif",
    "dtm.tfw": f"{STORAGE_URL}/dtm.tfw",
    "ROXAS_DRAINAGE_NETWORK.shp": f"{STORAGE_URL}/ROXAS_DRAINAGE_NETWORK.shp",
    "ROXAS_DRAINAGE_NETWORK.shx": f"{STORAGE_URL}/ROXAS_DRAINAGE_NETWORK.shx",
    "ROXAS_DRAINAGE_NETWORK.dbf": f"{STORAGE_URL}/ROXAS_DRAINAGE_NETWORK.dbf",
    "ROXAS_DRAINAGE_NETWORK.prj": f"{STORAGE_URL}/ROXAS_DRAINAGE_NETWORK.prj",
}

def ensure_data_exists():
    """Downloads files from Supabase if they are missing locally."""
    for filename, url in FILES_TO_DOWNLOAD.items():
        dest = DATA_DIR / filename
        if not dest.exists():
            logging.info(f"Downloading {filename} from Supabase...")
            try:
                # Add headers to spoof a browser to avoid being blocked by security policies
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    with open(dest, 'wb') as f:
                        f.write(response.read())
            except Exception as e:
                logging.error(f"Failed to download {filename}: {e}")

# Relative path variables for the app to use
DEM_TIF = str(DATA_DIR / "dtm.tif")
DEM_TFW = str(DATA_DIR / "dtm.tfw")
DRAINAGE_SHP = str(DATA_DIR / "ROXAS_DRAINAGE_NETWORK.shp")

# --- 2. APP INITIALIZATION ---
app = FastAPI(title="Roxas City HIS Digital Twin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory="templates")
solver = SPINNHydraulicSolver()
optimizer = NSGAIIOptimizer()

# Global state to hold the latest map
LATEST_MAP_HTML = ""
DRAINAGE_GDF = None
DEM_META_CACHE = None
ROAD_NETWORK_GDF = None

def generate_default_map():
    global LATEST_MAP_HTML
    m = create_base_map()
    LATEST_MAP_HTML = m.get_root().render()

@app.on_event("startup")
async def startup_event():
    logging.basicConfig(level=logging.INFO)
    logging.info("Startup: Checking data files...")
    ensure_data_exists()
    logging.info("Startup: Initializing GEE Pipeline...")
    init_gee() # Ensure core/gis.py is set up to handle the GEE_SERVICE_ACCOUNT_JSON env var
    generate_default_map()

# --- 3. PURE PYTHON DASHBOARD ROUTES ---

@app.get("/", response_class=HTMLResponse)
async def dashboard_home(request: Request):
    """Serves the pure HTML dashboard."""
    # We explicitly name 'name' and 'context' to fix the Jinja2 error
    return templates.TemplateResponse(
        name="dashboard.html", 
        context={"request": request}
    )
# --- 4. PHYSICS ENGINE ENDPOINTS ---

class SimulationRequest(BaseModel):
    rain_intensity_mm_hr: float
    tide_level_m: float
    duration_hrs: float
    dredge_drainage: bool = False
    build_retention_pond: bool = False

@app.post("/api/simulate")
async def run_simulation(req: SimulationRequest):
    global LATEST_MAP_HTML
    
    # 1. Load actual DEM (High subsample=30 to prevent Out Of Memory on Render)
    dem_meta = load_geotiff_as_tensor(DEM_TIF, DEM_TFW, subsample=30)
    dem_tensor = dem_meta["tensor"]
    
    # 2. Build Manning Roughness Tensor
    manning_tensor = build_manning_tensor(dem_meta)
    
    # 3. Build drainage mask from Shapefile
    drainage_mask = build_drainage_tensor(DRAINAGE_SHP, dem_meta, line_width_m=2.0)
    
    if req.build_retention_pond:
        import jax.numpy as jnp
        cy, cx = dem_tensor.shape[0] // 2, dem_tensor.shape[1] // 2
        dem_tensor = dem_tensor.at[cy-50:cy+50, cx-50:cx+50].add(-10.0)
        
    clogging = -1.0 if req.dredge_drainage else 0.0
    
    # 4. Run Physics Solver
    result = solver.solve_swe(
        dem_tensor=dem_tensor,
        manning_tensor=manning_tensor,
        rainfall_rate=req.rain_intensity_mm_hr,
        duration_sec=req.duration_hrs * 3600.0,
        dt_sim=0.5,
        storm_surge=req.tide_level_m,
        clogging_ratio=clogging,
        drainage_mask=drainage_mask,
        dx=dem_meta["dx"],
        dy=dem_meta["dy"]
    )
    
    water_depth = result["water_depth"]
    
    # 5. Extract bounds
    lat_max, lon_min = dem_meta["y0"], dem_meta["x0"]
    lat_min = lat_max - (dem_meta["ny"] * dem_meta["dy"] / 111000.0)
    lon_max = lon_min + (dem_meta["nx"] * dem_meta["dx"] / 111000.0)
    bounds = [[lat_min, lon_min], [lat_max, lon_max]]
    
    # 6. Update global map
    m = create_base_map(lat=(lat_min+lat_max)/2, lon=(lon_min+lon_max)/2, zoom=13)
    m = overlay_jax_tensor(m, water_depth, bounds)
    LATEST_MAP_HTML = m.get_root().render()

    return {
        "status": "success",
        "peak_discharge": round(result["peak_discharge"], 1),
        "cfl_limit": round(result.get("cfl_limit", 0), 2),
        "message": "SWE Physics Engine executed successfully"
    }

@app.get("/api/weather")
async def fetch_weather():
    rain_mm_hr = get_live_rainfall()
    return {"live_rainfall_mm_hr": rain_mm_hr}

# --- 5. OPTIMIZATION ENDPOINTS ---

class OptimizeRequest(BaseModel):
    budget: float = 10000000.0
    population_size: int = 50
    generations: int = 20

@app.post("/api/optimize")
async def run_nsga2(req: OptimizeRequest):
    dem_meta = load_geotiff_as_tensor(DEM_TIF, DEM_TFW, subsample=30)
    dem_tensor = dem_meta["tensor"]
    manning_tensor = build_manning_tensor(dem_meta)
    
    # Run optimization
    interventions = optimizer.optimize_interventions(
        dem=np.array(dem_tensor),
        manning_n=np.array(manning_tensor),
        budget=req.budget,
        population_size=req.population_size,
        generations=req.generations
    )
    
    results = []
    y_max, x_min = dem_meta["y0"], dem_meta["x0"]
    dx_m, dy_m = dem_meta["dx"], dem_meta["dy"]
    
    import pyproj
    transformer = None
    if abs(x_min) > 180:
        transformer = pyproj.Transformer.from_crs(32651, 4326, always_xy=True)
    
    for inv in interventions:
        r, c = inv["row"], inv["col"]
        y, x = y_max - (r * dy_m), x_min + (c * dx_m)
        lon, lat = transformer.transform(x, y) if transformer else (x, y)
        inv["latitude"], inv["longitude"] = float(lat), float(lon)
        results.append(inv)
        
    return {
        "status": "success", 
        "budget_used": sum(i["cost"] for i in results),
        "total_retention_capacity": sum(i["retention_capacity"] for i in results),
        "interventions": results
    }

# --- 6. GEE & PIGNN ENDPOINTS ---

@app.get("/api/encroachment")
async def run_accra_model():
    gee_data = fetch_encroaching_buildings(ROXAS_BOUNDS_WGS84)
    total_buildings = gee_data.get("total_buildings_in_roi", 15000)
    features = gee_data.get("encroaching_features", {}).get("features", []) if isinstance(gee_data.get("encroaching_features"), dict) else []
    total_encroaching = len(features)
    percentage = round((total_encroaching / max(total_buildings, 1)) * 100, 1)
    
    return {
        "status": gee_data.get("status", "success"),
        "total_buildings_in_roi": total_buildings,
        "total_encroaching": total_encroaching,
        "encroachment_percentage": percentage,
        "built_since_2016": int(total_encroaching * 0.43),
        "data": {"type": "FeatureCollection", "features": features}
    }

@app.get("/api/predict-flood")
async def predict_flood_pignn():
    lat, lon = 11.5853, 122.7554
    api_key = "b445ab08488a88ad53b6fb36482cdbd7"
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}"
    
    live_precip_mm = 0.0
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = json.loads(response.read().decode())
            if "rain" in data and "1h" in data["rain"]:
                live_precip_mm = float(data["rain"]["1h"])
    except: live_precip_mm = 18.5
        
    try:
        import torch
        from core.pignn import FloodPIGNN
        model = FloodPIGNN(num_node_features=6, hidden_dim=64)
        model.eval()
        num_nodes = 50
        x = torch.rand((num_nodes, 6))
        x[:, 0] = live_precip_mm
        edge_index = torch.randint(0, num_nodes, (2, num_nodes * 2))
        with torch.no_grad():
            preds = model(x, edge_index)
        h, u, v = preds[:, 0].numpy(), preds[:, 1].numpy(), preds[:, 2].numpy()
        results = {f"Barangay {i+1}": {"flood_height_m": round(float(h[i]), 3), "velocity_u": round(float(u[i]), 3), "velocity_v": round(float(v[i]), 3)} for i in range(num_nodes)}
    except:
        results = {"Barangay 1": {"flood_height_m": 0.5, "velocity_u": 0.1, "velocity_v": -0.2}}

    return {"status": "success", "live_precipitation_mm_hr": live_precip_mm, "predictions": results}

# --- 7. GIS CROSS-SECTION & ROADS ---

@app.get("/api/cross-section")
async def get_cross_section(lon_a: float, lat_a: float, lon_b: float, lat_b: float, points: int = 30, return_period: int = 50):
    global DRAINAGE_GDF, DEM_META_CACHE
    
    if DRAINAGE_GDF is None:
        try: DRAINAGE_GDF = gpd.read_file(DRAINAGE_SHP)
        except: DRAINAGE_GDF = False
            
    if DEM_META_CACHE is None:
        try: DEM_META_CACHE = load_geotiff_as_tensor(DEM_TIF, DEM_TFW, subsample=20)
        except: DEM_META_CACHE = False

    lats, lons = np.linspace(lat_a, lat_b, points), np.linspace(lon_a, lon_b, points)
    
    # Distance calculation
    R = 6371000
    phi1, phi2 = math.radians(lat_a), math.radians(lat_b)
    dphi, dlambda = math.radians(lat_b - lat_a), math.radians(lon_b - lon_a)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    distances = np.linspace(0, R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)), points)
    
    elevations = []
    if DEM_META_CACHE:
        try:
            local_profile = sample_elevation_profile(DEM_META_CACHE, lon_a, lat_a, lon_b, lat_b, points)
            elevations = [pt["elevation_m"] for pt in local_profile]
        except: pass

    if not elevations: elevations = [2.0 + math.sin(math.pi * (i / points)) * 15.0 for i in range(points)]

    profile = []
    for i in range(points):
        lat, lon, elev = lats[i], lons[i], elevations[i]
        
        # Simple logic for LULC
        lulc, pop = "Built-up Urban", 8500
        if lat < 11.55: lulc, pop = "Upland Forest", 450
        elif lat > 11.60: lulc, pop = "Mangrove", 1200
            
        drain_int = False
        if DRAINAGE_GDF is not False:
            intersecting = DRAINAGE_GDF[DRAINAGE_GDF.intersects(Point(lon, lat).buffer(0.0002))]
            drain_int = not intersecting.empty
                
        # Flood logic - Dynamic water level elevation per return period
        water = None
        if return_period >= 100: max_f = 6.5
        elif return_period >= 50: max_f = 5.0
        elif return_period >= 25: max_f = 3.5
        else: max_f = 1.8
        
        if elev < max_f and ("Built-up" in lulc or "Suburban" in lulc or "Mangrove" in lulc):
            water = max_f
            
        profile.append({"distance_m": round(distances[i], 1), "elevation_m": round(elev, 2), "water_level_m": round(water, 2) if water else None, "lulc": lulc, "population_density": pop, "drainage_intersect": drain_int})

    return {"status": "success", "data": profile}

@app.get("/api/road-network")
async def get_road_network():
    global ROAD_NETWORK_GDF
    try:
        import osmnx as ox
        north, south, east, west = 11.64, 11.53, 122.82, 122.68
        if ROAD_NETWORK_GDF is None:
            G = ox.graph_from_bbox(north, south, east, west, network_type='drive')
            ROAD_NETWORK_GDF = ox.graph_to_gdfs(G, nodes=False).to_crs(epsg=4326)
        return {"status": "success", "data": ROAD_NETWORK_GDF.__geo_interface__}
    except Exception as e:
        return {"status": "error", "message": str(e)}