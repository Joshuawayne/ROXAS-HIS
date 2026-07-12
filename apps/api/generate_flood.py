import os
import geopandas as gpd

def generate():
    base_dir = r"c:\ROXAS HIS\apps\frontend\public\data"
    rivers_path = os.path.join(base_dir, "rivers.geojson")
    
    print("Loading rivers...")
    gdf = gpd.read_file(rivers_path)
    
    # Reproject to metric (UTM Zone 51N for Philippines) for accurate meter buffering
    gdf_metric = gdf.to_crs(epsg=32651)
    
    print("Buffering 50-year flood (150m)...")
    # Buffer rivers by 150 meters, then dissolve into a single continuous polygon
    flood_50 = gdf_metric.buffer(150).unary_union
    flood_50_gdf = gpd.GeoDataFrame(geometry=[flood_50], crs=gdf_metric.crs).to_crs(epsg=4326)
    flood_50_gdf.to_file(os.path.join(base_dir, "flood_50yr.geojson"), driver="GeoJSON")
    
    print("Buffering 100-year flood (350m)...")
    flood_100 = gdf_metric.buffer(350).unary_union
    flood_100_gdf = gpd.GeoDataFrame(geometry=[flood_100], crs=gdf_metric.crs).to_crs(epsg=4326)
    flood_100_gdf.to_file(os.path.join(base_dir, "flood_100yr.geojson"), driver="GeoJSON")
    
    print("Done.")

if __name__ == "__main__":
    generate()
