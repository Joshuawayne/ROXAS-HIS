"""
JAX SWE Physics Engine - Roxas City HIS
=========================================
Responsibility:
  True JAX-accelerated 2D Shallow Water Equations solver.
  Uses jax.jit for Just-In-Time XLA compilation.
"""

import jax
import jax.numpy as jnp
from functools import partial
from typing import Dict, Any, Tuple

# Enable 64-bit precision for stable physics
jax.config.update("jax_enable_x64", True)

class SPINNHydraulicSolver:
    """
    JAX-based Shallow Water Equations Solver.
    """
    
    @staticmethod
    @partial(jax.jit, static_argnames=['steps', 'dx', 'dy'])
    def _solve_swe_jit(
        dem: jnp.ndarray,
        manning_n: jnp.ndarray,
        rain_m_s: float,
        dt_sim: float,
        storm_surge: float,
        clogging_ratio: float,
        drainage_mask: jnp.ndarray,
        steps: int,
        dx: float,
        dy: float
    ) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray]:
        """
        Pure JAX function that compiles via XLA for maximum performance.
        Uses jax.lax.fori_loop to iterate over time steps without unrolling.
        """
        g = 9.81
        k_sat = 1e-6 # Soil hydraulic conductivity (m/s)

        # Initial state
        h_init = jnp.zeros_like(dem, dtype=jnp.float64)
        u_init = jnp.zeros_like(dem, dtype=jnp.float64)
        v_init = jnp.zeros_like(dem, dtype=jnp.float64)
        
        def step_fn(i, state):
            h, u, v = state
            
            # 1. Mass Conservation
            hu = h * u
            hv = h * v
            
            # Central differences using array slicing (pad with zeros for boundaries)
            flux_x = jnp.zeros_like(h)
            flux_y = jnp.zeros_like(h)
            
            flux_x = flux_x.at[:, 1:-1].set((hu[:, 2:] - hu[:, :-2]) / (2.0 * dx))
            flux_y = flux_y.at[1:-1, :].set((hv[2:, :] - hv[:-2, :]) / (2.0 * dy))
            
            # Boundary Conditions: Storm Surge at northern edge (row 0)
            h = h.at[0, :].set(jnp.maximum(0.0, storm_surge - dem[0, :]))
            
            # Sinks: Infiltration and Drainage
            infiltration = jnp.minimum(h, k_sat * dt_sim)
            drainage_capacity = (1.0 - clogging_ratio) * 0.005 * dt_sim
            drainage = jnp.minimum(h - infiltration, drainage_mask * drainage_capacity)
            
            # Update Depth
            h_new = h - dt_sim * (flux_x + flux_y) + (rain_m_s * dt_sim) - infiltration - drainage
            h_new = jnp.clip(h_new, 0.0, 10.0)
            
            # 2. Momentum Conservation
            dh_dx = jnp.zeros_like(h)
            dh_dy = jnp.zeros_like(h)
            dz_dx = jnp.zeros_like(dem)
            dz_dy = jnp.zeros_like(dem)
            
            dh_dx = dh_dx.at[:, 1:-1].set((h_new[:, 2:] - h_new[:, :-2]) / (2.0 * dx))
            dh_dy = dh_dy.at[1:-1, :].set((h_new[2:, :] - h_new[:-2, :]) / (2.0 * dy))
            
            dz_dx = dz_dx.at[:, 1:-1].set((dem[:, 2:] - dem[:, :-2]) / (2.0 * dx))
            dz_dy = dz_dy.at[1:-1, :].set((dem[2:, :] - dem[:-2, :]) / (2.0 * dy))
            
            # Friction
            h_safe = jnp.where(h_new > 0.01, h_new, 0.01)
            vel_mag = jnp.sqrt(u**2 + v**2 + 1e-6)
            sf_x = (manning_n ** 2) * u * vel_mag / (h_safe ** (4.0/3.0))
            sf_y = (manning_n ** 2) * v * vel_mag / (h_safe ** (4.0/3.0))
            
            # Update Velocity
            u_new = u - dt_sim * (g * (dh_dx + dz_dx) + g * sf_x)
            v_new = v - dt_sim * (g * (dh_dy + dz_dy) + g * sf_y)
            
            # Damp on dry cells
            dry_mask = h_new < 0.005
            u_new = jnp.where(dry_mask, 0.0, u_new)
            v_new = jnp.where(dry_mask, 0.0, v_new)
            
            u_new = jnp.clip(u_new, -10.0, 10.0)
            v_new = jnp.clip(v_new, -10.0, 10.0)
            
            return (h_new, u_new, v_new)

        final_h, final_u, final_v = jax.lax.fori_loop(0, steps, step_fn, (h_init, u_init, v_init))
        return final_h, final_u, final_v

    def solve_swe(
        self,
        dem_tensor: jnp.ndarray,
        manning_tensor: jnp.ndarray,
        rainfall_rate: float,
        duration_sec: float,
        dt_sim: float,
        storm_surge: float,
        clogging_ratio: float,
        drainage_mask: jnp.ndarray,
        dx: float = 1.0,
        dy: float = 1.0
    ) -> Dict[str, Any]:
        """
        Public wrapper to call the JIT-compiled SWE solver.
        """
        steps = int(max(1, duration_sec / dt_sim))
        rain_m_s = (rainfall_rate / 1000.0) / 3600.0
        
        h, u, v = self._solve_swe_jit(
            dem=dem_tensor,
            manning_n=manning_tensor,
            rain_m_s=rain_m_s,
            dt_sim=dt_sim,
            storm_surge=storm_surge,
            clogging_ratio=clogging_ratio,
            drainage_mask=drainage_mask,
            steps=steps,
            dx=dx,
            dy=dy
        )
        
        # Calculate Peak Q and CFL
        discharge_field = h * jnp.sqrt(u**2 + v**2) * dx
        peak_q = float(jnp.max(discharge_field))
        
        wave_speed = jnp.sqrt(9.81 * h) + jnp.sqrt(u**2 + v**2) + 1e-5
        dt_limit = float(jnp.min(jnp.minimum(dx / wave_speed, dy / wave_speed)))
        cfl_limit = max(0.01, min(dt_limit, 5.0))
        
        return {
            "water_depth": np.array(h),  # Cast back to host numpy for JSON serialization
            "velocity_x": np.array(u),
            "velocity_y": np.array(v),
            "cfl_limit": cfl_limit,
            "peak_discharge": peak_q
        }
