import os
import geopandas as gpd

def generate():
    base_dir = r"c:\ROXAS HIS\apps\frontend\public\data"
    rivers_path = os.path.join(base_dir, "rivers.geojson")
    
    print("Loading rivers...")
    gdf = gpd.read_file(rivers_path)
    
    # Reproject to metric (UTM Zone 51N for Philippines) for accurate meter buffering
    gdf_metric = gdf.to_crs(epsg=32651)
    
    periods = [
        (5, 50),     # 5-Year Event: 50m buffer (Minor riverbank overflow / nuisance flooding)
        (25, 100),   # 25-Year Event: 100m buffer (Moderate inundation)
        (50, 180),   # 50-Year Event: 180m buffer (Major severe storm inundation)
        (100, 350)   # 100-Year Event: 350m buffer (Extreme catastrophic disaster inundation)
    ]
    
    for yr, buffer_m in periods:
        print(f"Buffering {yr}-year flood ({buffer_m}m)...")
        flood = gdf_metric.buffer(buffer_m).unary_union
        flood_gdf = gpd.GeoDataFrame(geometry=[flood], crs=gdf_metric.crs).to_crs(epsg=4326)
        out_file = os.path.join(base_dir, f"flood_{yr}yr.geojson")
        flood_gdf.to_file(out_file, driver="GeoJSON")
        print(f"  Saved {out_file}")
    
    print("All return period flood datasets successfully generated.")

if __name__ == "__main__":
    generate()

