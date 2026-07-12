import os

try:
    import geopandas as gpd
except ImportError:
    print("geopandas not found. Please install it with 'pip install geopandas'.")
    exit(1)

def convert():
    base_dir = r"c:\ROXAS HIS"
    out_dir = r"c:\ROXAS HIS\apps\frontend\public\data"
    os.makedirs(out_dir, exist_ok=True)
    
    rivers_shp = os.path.join(base_dir, "Rivers and Creeks", "Rivers_and_Creeks.shp")
    drainage_shp = os.path.join(base_dir, "Existing Drainage Network SHP", "ROXAS_DRAINAGE_NETWORK.shp")
    
    print(f"Reading {rivers_shp}...")
    gdf_rivers = gpd.read_file(rivers_shp)
    # Ensure WGS84 for web mapping
    if gdf_rivers.crs is not None and gdf_rivers.crs.to_string() != 'EPSG:4326':
        gdf_rivers = gdf_rivers.to_crs("EPSG:4326")
    elif gdf_rivers.crs is None:
        gdf_rivers.set_crs("EPSG:4326", inplace=True)
    gdf_rivers.to_file(os.path.join(out_dir, "rivers.geojson"), driver="GeoJSON")
    print("Saved rivers.geojson")
    
    print(f"Reading {drainage_shp}...")
    gdf_drain = gpd.read_file(drainage_shp)
    if gdf_drain.crs is not None and gdf_drain.crs.to_string() != 'EPSG:4326':
        gdf_drain = gdf_drain.to_crs("EPSG:4326")
    elif gdf_drain.crs is None:
        gdf_drain.set_crs("EPSG:4326", inplace=True)
    gdf_drain.to_file(os.path.join(out_dir, "drainage.geojson"), driver="GeoJSON")
    print("Saved drainage.geojson")

if __name__ == "__main__":
    convert()
