import os
import geopandas as gpd

def convert():
    shp_path = r"c:\ROXAS HIS\Barangay Boundary LMS 2015\BrgyBoundLine.shp"
    out_path = r"c:\ROXAS HIS\apps\frontend\public\data\barangay.geojson"
    
    print(f"Reading {shp_path}...")
    gdf = gpd.read_file(shp_path)
    if gdf.crs is not None and gdf.crs.to_string() != 'EPSG:4326':
        gdf = gdf.to_crs("EPSG:4326")
    elif gdf.crs is None:
        gdf.set_crs("EPSG:4326", inplace=True)
    gdf.to_file(out_path, driver="GeoJSON")
    print("Saved barangay.geojson")

if __name__ == "__main__":
    convert()
