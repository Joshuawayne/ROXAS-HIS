"""
Engineering Design Generator - Roxas City HIS
=============================================
Responsibility:
  Generates 2D CAD-style specifications for open trapezoidal channels
  and closed box culverts based on Manning's Equation.
"""

import math
from typing import Dict, Any

def estimate_q100(catchment_area_km2: float) -> float:
    """Estimates Q100 using Rational Method (C=0.6, I=104.5 mm/hr)"""
    return 0.167 * 0.60 * 104.5 * catchment_area_km2

def generate_channel_design(peak_discharge_m3_s: float, slope_m_m: float, channel_type: str = "auto") -> Dict[str, Any]:
    """
    Computes optimal channel dimensions.
    """
    if channel_type == "auto":
        channel_type = "trapezoidal" if peak_discharge_m3_s > 10.0 else "box_culvert"

    if channel_type == "trapezoidal":
        v_target = 2.0 # m/s
        A_req = peak_discharge_m3_s / v_target
        d_design = max(1.5, math.sqrt(A_req / 4.0))
        b_design = max(2.0, (A_req / d_design) - 1.5 * d_design)
        freeboard = 0.5
        
        return {
            "type": "Open Trapezoidal Channel",
            "design_q": peak_discharge_m3_s,
            "velocity_m_s": v_target,
            "manning_n": 0.015, # Concrete lined
            "slope_m_m": slope_m_m,
            "bottom_width_m": round(b_design, 2),
            "depth_m": round(d_design, 2),
            "freeboard_m": freeboard,
            "drawing": {
                "type": "trapezoidal",
                "canvas_width": 300,
                "canvas_height": 100,
                "sections": [
                    {"shape": "polygon", "points": "50,20 100,80 200,80 250,20", "fill": "#334155", "label": "Concrete Channel"},
                    {"shape": "polygon", "points": "60,40 110,80 190,80 240,40", "fill": "#38bdf8", "label": "Water Surface"}
                ],
                "labels": [
                    {"x": 150, "y": 95, "text": f"Bottom Width: {b_design:.1f}m"},
                    {"x": 150, "y": 55, "text": f"Design Depth: {d_design:.1f}m"}
                ]
            }
        }
    else:
        v_box = 2.5 # m/s
        A_box = peak_discharge_m3_s / v_box
        barrels = max(1, math.ceil(A_box / 6.0))
        
        return {
            "type": "Closed Box Culvert",
            "design_q": peak_discharge_m3_s,
            "velocity_m_s": v_box,
            "manning_n": 0.013,
            "slope_m_m": slope_m_m,
            "width_m": 3.0,
            "height_m": 2.0,
            "n_cells": barrels,
            "drawing": {
                "type": "box_culvert",
                "canvas_width": 300,
                "canvas_height": 100,
                "sections": [
                    {"shape": "rect", "x": 150 - (barrels * 40)/2, "y": 30, "w": barrels * 40, "h": 60, "fill": "#334155", "label": "Concrete Box"},
                ],
                "labels": [
                    {"x": 150, "y": 20, "text": f"Cells: {barrels} x (3m x 2m)"}
                ]
            }
        }
