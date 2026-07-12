"""
Cartography Module - Roxas City HIS
===================================
Responsibility:
  Demonstrates SOLID principles by separating Map Visualization logic from 
  the physics solver. Translates JAX Tensors and GEE bounds into a robust 
  Folium (Leaflet.js) interactive map.
"""

import folium
import numpy as np
import base64
from io import BytesIO
from PIL import Image

def create_base_map(lat: float = 11.58, lon: float = 122.75, zoom: int = 14) -> folium.Map:
    """
    Initializes the base Folium Map using CartoDB Dark Matter for true scientific contrast.
    """
    m = folium.Map(
        location=[lat, lon],
        zoom_start=zoom,
        tiles="CartoDB dark_matter",
        control_scale=True
    )
    
    # Add a marker for the City Center
    folium.Marker(
        [lat, lon],
        popup="Roxas City Digital Twin Origin",
        icon=folium.Icon(color="blue", icon="info-sign")
    ).add_to(m)
    
    return m

def overlay_jax_tensor(m: folium.Map, tensor: np.ndarray, bounds: list):
    """
    Overlays a 2D JAX output tensor (Flood Depth) onto the Folium Map.
    bounds: [[lat_min, lon_min], [lat_max, lon_max]]
    """
    # Color mapping:
    # 0.0 -> transparent
    # 0.5 -> yellow
    # 1.5 -> orange
    # 3.0+ -> red
    
    h, w = tensor.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    
    # Simple color classification based on depth
    # Yellow for shallow
    shallow = (tensor > 0.1) & (tensor <= 1.0)
    rgba[shallow] = [255, 235, 59, 180] 
    
    # Orange for moderate
    moderate = (tensor > 1.0) & (tensor <= 2.5)
    rgba[moderate] = [255, 152, 0, 200]
    
    # Red for severe
    severe = (tensor > 2.5)
    rgba[severe] = [244, 67, 54, 220]
    
    # Convert numpy array to PNG image in memory
    img = Image.fromarray(rgba, 'RGBA')
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    # Overlay onto map
    folium.raster_layers.ImageOverlay(
        image=f"data:image/png;base64,{img_str}",
        bounds=bounds,
        opacity=0.8,
        name="JAX Flood Inundation"
    ).add_to(m)
    
    folium.LayerControl().add_to(m)
    return m
