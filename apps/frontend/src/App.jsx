import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Map, { NavigationControl, ScaleControl, Source } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Play, ChevronDown, Layers as LayersIcon, Code, BarChart2, UserCircle, Search, Activity, ShieldCheck, Lock, Settings, Box, CloudRain, Sun, Wind, Droplets, Thermometer, Cloud, CloudSun, CloudSnow, CloudLightning, CloudDrizzle, Eye } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { supabase, reconnectSupabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'https://roxas-his-api.onrender.com';

const BARANGAYS = {
  tiza: [122.759, 11.574],
  tanque: [122.748, 11.583],
  baybay: [122.730, 11.599],
  libas: [122.768, 11.595],
  lawaan: [122.761, 11.558],
  banago: [122.750, 11.605],
  adlawan: [122.790, 11.540]
};

// --- HIGH FIDELITY MOCK DATA ---
const MOCK_BOUNDARY = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[122.68, 11.53], [122.82, 11.53], [122.82, 11.64], [122.68, 11.64], [122.68, 11.53]]] } }]
};

const MOCK_DRAINAGE = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[122.70, 11.55], [122.73, 11.57], [122.75, 11.58], [122.77, 11.60], [122.80, 11.61]] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[122.75, 11.58], [122.74, 11.60], [122.73, 11.62]] } }
  ]
};

// Transform into Trips format for 3D Flow Animation
const DRAINAGE_TRIPS = MOCK_DRAINAGE.features.map(f => ({
  path: f.geometry.coordinates,
  // Distribute timestamps linearly (e.g. slow flow from start to end)
  timestamps: f.geometry.coordinates.map((_, i) => i * 1500)
}));

// Removed MOCK_FLOOD since we now use dynamically generated realistic flood zones

// --- LOGIN PAGE ---
function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
    } else {
      // Resolve role: check user_metadata first, then profiles table, fallback to 'user'
      let role = data.user?.user_metadata?.role;
      if (!role) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        role = profile?.role || 'user';
      }
      // Log login action to Supabase audit log
      await supabase.from('logs').insert([{
        action: 'User Session Login',
        role: role,
        details: `Authenticated via database credentials: ${email}`
      }]);
      navigate(`/dashboard/${role}`);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("Password reset email sent! Please check your inbox.");
      setIsResetMode(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex items-center justify-center font-gee">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96 border border-slate-200">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <h1 className="font-bold text-2xl text-slate-700">Roxas City HIS Platform</h1>
        </div>

        {error && (
          <div className="p-2 mb-4 bg-red-50 text-red-700 text-xs font-semibold rounded border border-red-200 text-center animate-shake">
            ⚠️ {error}
          </div>
        )}
        
        {message && (
          <div className="p-2 mb-4 bg-green-50 text-green-700 text-xs font-semibold rounded border border-green-200 text-center">
            ✅ {message}
          </div>
        )}

        <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email / Username</label>
            <input 
              type="text" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="e.g. admin@roxas.gov.ph"
              className="w-full p-2 border border-slate-300 rounded bg-slate-50 outline-none focus:border-blue-500 text-sm" 
            />
          </div>
          
          {!isResetMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Database Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full pl-9 p-2 border border-slate-300 rounded bg-slate-50 outline-none focus:border-blue-500 text-sm" 
                />
              </div>
            </div>
          )}

          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow transition-colors flex justify-center items-center gap-2 text-sm font-bold uppercase tracking-wider">
            {isResetMode ? 'Send Reset Link' : <><ShieldCheck className="w-4 h-4" /> Connect to Database</>}
          </button>
          
          <div className="flex justify-between items-center pt-2">
            <button type="button" onClick={() => navigate('/register')} className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline">
              Register here
            </button>
            <button 
              type="button" 
              onClick={() => {
                setIsResetMode(!isResetMode);
                setError(null);
                setMessage(null);
              }} 
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold hover:underline"
            >
              {isResetMode ? 'Back to Login' : 'Forgot Password?'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- REGISTER PAGE ---
function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
      // Wait a moment before redirecting
      setTimeout(() => {
        navigate('/');
      }, 3000);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex items-center justify-center font-gee">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96 border border-slate-200">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <h1 className="font-bold text-2xl text-slate-700">Account Registration</h1>
        </div>
        
        <div className="bg-slate-50 p-3 rounded mb-4 text-center border border-slate-200">
          <div className="text-[10px] text-slate-500 font-mono">
            Fill in the details to create a new account.
          </div>
        </div>

        {error && (
          <div className="p-2 mb-4 bg-red-50 text-red-700 text-xs font-semibold rounded border border-red-200 text-center animate-shake">
            ⚠️ {error}
          </div>
        )}
        
        {success && (
          <div className="p-2 mb-4 bg-green-50 text-green-700 text-xs font-semibold rounded border border-green-200 text-center">
            ✅ Registration successful! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email / Username</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="e.g. scientist@roxas.gov.ph"
              required
              className="w-full p-2 border border-slate-300 rounded bg-slate-50 outline-none focus:border-blue-500 text-sm" 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                required
                className="w-full pl-9 p-2 border border-slate-300 rounded bg-slate-50 outline-none focus:border-blue-500 text-sm" 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" 
                required
                className="w-full pl-9 p-2 border border-slate-300 rounded bg-slate-50 outline-none focus:border-blue-500 text-sm" 
              />
            </div>
          </div>
          <button type="submit" disabled={success} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded shadow transition-colors flex justify-center items-center gap-2 text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">
            <ShieldCheck className="w-4 h-4" /> Create Account
          </button>
          
          <div className="text-center pt-2">
            <button type="button" onClick={() => navigate('/')} className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline">
              Already have an account? Login here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MAIN DASHBOARD ---
function Dashboard({ role }) {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [returnPeriod, setReturnPeriod] = useState(50);
  
  // Dynamic API Data
  const [accraData, setAccraData] = useState(null);
  const [isLoadingAccra, setIsLoadingAccra] = useState(false);
  const [crossSectionPts, setCrossSectionPts] = useState([]);
  const [elevationProfile, setElevationProfile] = useState(null);
  
  // OpenWeatherMap state for Roxas City
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);

  // Animation state for rivers
  const [time, setTime] = useState(0);

  useEffect(() => {
    let animationFrame;
    const animate = () => {
      setTime(t => (t + 1) % 100);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // Fetch OpenWeatherMap data for Roxas City, Capiz
  useEffect(() => {
    const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
    const ROXAS_LAT = 11.5853;
    const ROXAS_LON = 122.7511;

    const fetchWeather = async () => {
      setIsWeatherLoading(true);
      try {
        // Current weather
        const currentRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${ROXAS_LAT}&lon=${ROXAS_LON}&appid=${OWM_KEY}&units=metric`
        );
        const currentData = await currentRes.json();
        if (currentData.cod === 200) setWeather(currentData);

        // 5-day / 3-hour forecast
        const forecastRes = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${ROXAS_LAT}&lon=${ROXAS_LON}&appid=${OWM_KEY}&units=metric`
        );
        const forecastData = await forecastRes.json();
        if (forecastData.cod === '200') {
          // Extract one forecast per day (noon entries)
          const dailyMap = {};
          forecastData.list.forEach(item => {
            const date = item.dt_txt.split(' ')[0];
            const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0]);
            if (!dailyMap[date] || Math.abs(hour - 12) < Math.abs(parseInt(dailyMap[date].dt_txt.split(' ')[1].split(':')[0]) - 12)) {
              dailyMap[date] = item;
            }
          });
          setForecast(Object.values(dailyMap).slice(0, 5));
        }
      } catch (err) {
        console.error('OpenWeatherMap fetch failed:', err);
      }
      setIsWeatherLoading(false);
    };

    if (OWM_KEY) {
      fetchWeather();
      // Refresh every 10 minutes
      const interval = setInterval(fetchWeather, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, []);

  // Helper: get weather icon component
  const getWeatherIcon = (iconCode, size = 'w-5 h-5') => {
    if (!iconCode) return <Cloud className={size} />;
    const code = iconCode.substring(0, 2);
    switch (code) {
      case '01': return <Sun className={`${size} text-amber-400`} />;
      case '02': return <CloudSun className={`${size} text-amber-300`} />;
      case '03': return <Cloud className={`${size} text-slate-400`} />;
      case '04': return <Cloud className={`${size} text-slate-500`} />;
      case '09': return <CloudDrizzle className={`${size} text-blue-400`} />;
      case '10': return <CloudRain className={`${size} text-blue-500`} />;
      case '11': return <CloudLightning className={`${size} text-yellow-500`} />;
      case '13': return <CloudSnow className={`${size} text-blue-200`} />;
      default: return <Cloud className={`${size} text-slate-400`} />;
    }
  };

  // Layer Toggles
  const [layers, setLayers] = useState({
    boundary: true,
    predictedFlood: true,
    drainageNetwork: true,
    naturalFlowPaths: false,
    encroachingBuildings: false
  });

  const [interventionTypes, setInterventionTypes] = useState({
    upland: true, urban: true, delta: true, dredging: true, proposedDrainage: true
  });
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [selectedDrainage, setSelectedDrainage] = useState(null);
  const [basemap, setBasemap] = useState('satellite');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Superadmin Settings states
  const [activeSettingsTab, setActiveSettingsTab] = useState('hydrology'); // 'hydrology', 'optimization', 'database', 'logs'
  const [manningUpland, setManningUpland] = useState(0.045);
  const [manningUrban, setManningUrban] = useState(0.015);
  const [manningDelta, setManningDelta] = useState(0.035);
  const [infilUpland, setInfilUpland] = useState(1.5); // mm/hr
  const [infilUrban, setInfilUrban] = useState(12.0); // mm/hr
  const [infilDelta, setInfilDelta] = useState(0.2); // mm/hr
  const [popSize, setPopSize] = useState(100);
  const [maxGen, setMaxGen] = useState(250);
  const [weightCost, setWeightCost] = useState(40);
  const [weightMitigation, setWeightMitigation] = useState(60);

  const [settingsLogs, setSettingsLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [settingsUsers, setSettingsUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [dbUrlInput, setDbUrlInput] = useState(localStorage.getItem('supabase_url') || '');
  const [dbKeyInput, setDbKeyInput] = useState(localStorage.getItem('supabase_key') || '');

  const handleRoleChange = async (userId, newRole) => {
    // Optimistic UI update
    setSettingsUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    
    // Database update
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    
    if (!error) {
      await supabase.from('logs').insert([{
        action: 'User Role Modified',
        role: role, // The active superadmin's role
        details: `Role for user ID ${userId} was changed to ${newRole}`
      }]);
    }
  };

  const toggleLayer = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  const [viewState, setViewState] = useState({
    longitude: 122.75,
    latitude: 11.58,
    zoom: 13,
    pitch: 0,
    bearing: 0
  });

  const [is3DMode, setIs3DMode] = useState(false);

  const toggle3DMode = () => {
    setIs3DMode(prev => {
      const next3D = !prev;
      setViewState(vs => ({
        ...vs,
        pitch: next3D ? 65 : 0,
        bearing: next3D ? 20 : 0
      }));
      return next3D;
    });
  };

  // Re-run API if return period changes (simulating bigger storm)
  useEffect(() => {
    if (layers.encroachingBuildings) {
      handleRunAccraModel();
    }
  }, [returnPeriod]);

  // Dynamically refetch cross-section if points or return period change
// Fix: use the dynamic API_URL variable
  useEffect(() => {
    if (crossSectionPts.length === 2) {
      const [p1, p2] = crossSectionPts;
      fetch(`${API_URL}/api/cross-section?lon_a=${p1[0]}&lat_a=${p1[1]}&lon_b=${p2[0]}&lat_b=${p2[1]}&return_period=${returnPeriod}`)
        .then(res => res.json())
        .then(data => setElevationProfile(data.data))
        .catch(e => {
          console.error("Backend fetch failed", e);
          setElevationProfile(null);
        });
    }
  }, [crossSectionPts, returnPeriod]);

  // Auto-fetch encroachment data when building layer is turned on
  useEffect(() => {
    if (layers.encroachingBuildings && !isPlaying) {
      handleRunAccraModel();
    }
  }, [layers.encroachingBuildings]);

  // Fetch real-time audit logs and users from Supabase when settings modal is open
  useEffect(() => {
    if (isSettingsOpen && activeSettingsTab === 'logs') {
      supabase.from('logs').select('*').order('timestamp', { ascending: false }).then(({ data }) => {
        if (data) setSettingsLogs(data);
      });
    }
    if (isSettingsOpen && activeSettingsTab === 'users' && role === 'Superadmin') {
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
        if (data) setSettingsUsers(data);
      });
    }
  }, [isSettingsOpen, activeSettingsTab, role]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const term = e.target.value.trim().toLowerCase();
      const match = BARANGAYS[term];
      if (match) {
        setViewState({
          longitude: match[0],
          latitude: match[1],
          zoom: 14.5,
          pitch: 50,
          bearing: -10,
          transitionDuration: 1200
        });
        
        // Log action in Supabase
        supabase.from('logs').insert([{
          action: `Search Barangay ${term}`,
          role: role,
          details: `Viewport panned to coordinates [${match[1]}, ${match[0]}]`
        }]);
      } else {
        alert(`Barangay "${term}" is not registered in the GIS database index. Available targets: Tiza, Tanque, Baybay, Libas, Lawaan, Banago.`);
      }
    }
  };

  const handleMapClick = async (info) => {
    if (info.picked && info.layer && (info.layer.id === 'nsga-interventions' || info.layer.id === 'built-drainage' || info.layer.id === 'nsga-drainage')) {
      return; // Ignore layer selections
    }
    if (!info.coordinate) return;
    const [lon, lat] = info.coordinate;
    
    let newPts = [...crossSectionPts];
    if (newPts.length === 2) {
      newPts = [[lon, lat]]; // reset
      setElevationProfile(null);
    } else {
      newPts.push([lon, lat]);
    }
    setCrossSectionPts(newPts);
  };

  const satelliteStyle = {
    version: 8,
    sources: {
      'satellite': {
        type: 'raster',
        tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Esri World Imagery'
      },
      'terrain-source': {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256
      }
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        minzoom: 0,
        maxzoom: 20
      }
    ],
    ...(is3DMode ? { terrain: { source: 'terrain-source', exaggeration: 2.0 } } : {})
  };

  const topoStyle = {
    version: 8,
    sources: {
      'topo': {
        type: 'raster',
        tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: 'OpenTopoMap'
      },
      'terrain-source': {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256
      }
    },
    layers: [
      {
        id: 'topo-layer',
        type: 'raster',
        source: 'topo',
        minzoom: 0,
        maxzoom: 17
      }
    ],
    ...(is3DMode ? { terrain: { source: 'terrain-source', exaggeration: 2.0 } } : {})
  };

  const mapStyle = basemap === 'satellite' ? satelliteStyle : topoStyle;

  // Deck.GL Layers logic
  const deckLayers = [];

  if (layers.boundary) {
    deckLayers.push(
      new GeoJsonLayer({
        id: 'city-boundary',
        data: '/data/barangay.geojson',
        filled: false,
        stroked: true,
        getLineColor: [255, 255, 255, 200],
        getLineWidth: 3,
        lineWidthUnits: 'pixels'
      })
    );
  }

  if (layers.drainageNetwork) {
    deckLayers.push(
      new GeoJsonLayer({
        id: 'built-drainage',
        data: '/data/drainage.geojson',
        stroked: true,
        getLineColor: [0, 255, 255, 150 + Math.sin(time / 10) * 105], // Pulsing Cyan
        getLineWidth: 4,
        lineWidthUnits: 'pixels',
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            setSelectedDrainage(info.object.properties);
            setSelectedIntervention(null);
          }
        }
      }),
      new GeoJsonLayer({
        id: 'rivers-creeks',
        data: '/data/rivers.geojson',
        stroked: true,
        getLineColor: [59, 130, 246, 180 + Math.sin(time / 8) * 75], // Pulsing Blue
        getLineWidth: 6,
        lineWidthUnits: 'pixels'
      })
    );

    // Add animated water flow in 3D mode
    if (is3DMode) {
      deckLayers.push(
        new TripsLayer({
          id: 'drainage-flow',
          data: DRAINAGE_TRIPS,
          getPath: d => d.path,
          getTimestamps: d => d.timestamps,
          getColor: [0, 150, 255],
          opacity: 0.8,
          width: 8,
          trailLength: 200,
          currentTime: time * 100,
        })
      );
    }
  }

  if (interventionTypes.proposedDrainage) {
    deckLayers.push(
      new GeoJsonLayer({
        id: 'nsga-drainage',
        data: '/data/proposed_drainage.geojson',
        stroked: true,
        getLineColor: [34, 197, 94, 220 + Math.sin(time / 6) * 35], // Neon green pulsing
        getLineWidth: 4,
        lineWidthUnits: 'pixels',
        lineDashPattern: [8, 8], // Dotted line pattern (8px dash, 8px gap)
        lineDashJustified: true,
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            setSelectedDrainage(info.object.properties);
            setSelectedIntervention(null);
          }
        }
      })
    );
  }

  if (layers.predictedFlood) {
    if (returnPeriod >= 100) {
      deckLayers.push(
        new GeoJsonLayer({
          id: 'predicted-flood-100yr',
          data: '/data/flood_100yr.geojson',
          filled: true,
          stroked: false,
          getFillColor: [220, 38, 38, 110], // Wide red/purple for 100 year
        })
      );
    }
    // Always render 50-year base if predicted flood is on
    deckLayers.push(
      new GeoJsonLayer({
        id: 'predicted-flood-50yr',
        data: '/data/flood_50yr.geojson',
        filled: true,
        stroked: false,
        getFillColor: [128, 0, 128, 160], // Darker purple for the core 50-year zone
      })
    );
  }

  if (layers.encroachingBuildings) {
    deckLayers.push(
      new GeoJsonLayer({
        id: 'real-open-buildings',
        data: accraData ? accraData.data : {
          type: 'FeatureCollection',
          features: []
        },
        extruded: true,
        getElevation: 40,
        getFillColor: [220, 38, 38, 255], // Bright Red
        getLineColor: [0, 0, 0, 255],
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 2
      })
    );
  }

  // --- NSGA-II Interventions ---
  const INTERVENTION_LOCATIONS = [
    // UPLAND ZONE (HRU 301 - Luisiana Clay) - Detention Polders
    { id: 'upland_1', category: 'upland', type: 'Detention Polder A (Detention Basin)', position: [122.759957, 11.571297], color: [16, 185, 129, 220], capacity: '35,000 m³' }, // Calibration basin
    { id: 'upland_2', category: 'upland', type: 'Detention Polder B (Buffer Site)', position: [122.760798, 11.570203], color: [16, 185, 129, 220], capacity: '45,000 m³' }, // Calibration point
    { id: 'upland_3', category: 'upland', type: 'Detention Polder C (Runoff Catchment)', position: [122.748, 11.545], color: [16, 185, 129, 220], capacity: '40,000 m³' },
    { id: 'upland_4', category: 'upland', type: 'Detention Polder D (Upland Peak Shaver)', position: [122.768, 11.535], color: [16, 185, 129, 220], capacity: '62,000 m³' },
    
    // URBAN CORE (HRU 112 - San Manuel) - Subsurface Cisterns
    { id: 'urban_1', category: 'urban', type: 'Subsurface Cistern A', position: [122.752, 11.581], color: [245, 158, 11, 220], capacity: '12,500 m³' },
    { id: 'urban_2', category: 'urban', type: 'Subsurface Cistern B', position: [122.758, 11.579], color: [245, 158, 11, 220], capacity: '15,000 m³' },
    { id: 'urban_3', category: 'urban', type: 'Subsurface Cistern C', position: [122.744, 11.585], color: [245, 158, 11, 220], capacity: '8,500 m³' },
    { id: 'urban_4', category: 'urban', type: 'Subsurface Cistern D', position: [122.761, 11.583], color: [245, 158, 11, 220], capacity: '10,200 m³' },
    
    // TIDAL DELTA (HRU 135 - Hydrosol) - Mangrove Estuary & Gates
    { id: 'delta_1', category: 'delta', type: 'Mangrove Estuary A', position: [122.731823, 11.599764], color: [14, 165, 233, 220], capacity: 'N/A (Tidal Surge Buffer)' },
    { id: 'delta_2', category: 'delta', type: 'Mangrove Estuary B', position: [122.724088, 11.607581], color: [14, 165, 233, 220], capacity: 'N/A (Tidal Surge Buffer)' },
    { id: 'delta_3', category: 'delta', type: 'Mangrove Estuary C', position: [122.715, 11.595], color: [14, 165, 233, 220], capacity: 'N/A (Tidal Surge Buffer)' },
    { id: 'delta_4', category: 'delta', type: 'Mangrove Estuary D', position: [122.764246, 11.606302], color: [14, 165, 233, 220], capacity: 'N/A (Tidal Surge Buffer)' },
    
    // RIVER CHANNEL (Riverbed Alluvium) - Dredging Sites
    { id: 'dredging_1', category: 'dredging', type: 'Dredging Segment A', position: [122.760, 11.560], color: [139, 92, 246, 220], capacity: '+1.5 m/s flow velocity gain' },
    { id: 'dredging_2', category: 'dredging', type: 'Dredging Segment B', position: [122.759, 11.578], color: [139, 92, 246, 220], capacity: '+1.3 m/s flow velocity gain' },
    { id: 'dredging_3', category: 'dredging', type: 'Dredging Segment C', position: [122.748, 11.565], color: [139, 92, 246, 220], capacity: '+1.1 m/s flow velocity gain' },
    { id: 'dredging_4', category: 'dredging', type: 'Dredging Segment D', position: [122.732, 11.572], color: [139, 92, 246, 220], capacity: '+1.4 m/s flow velocity gain' }
  ];

  const activeInterventions = INTERVENTION_LOCATIONS.filter(inv => interventionTypes[inv.category]);
  
  if (activeInterventions.length > 0) {
    deckLayers.push(
      new ScatterplotLayer({
        id: 'nsga-interventions',
        data: activeInterventions,
        getPosition: d => d.position,
        getFillColor: d => d.color,
        getRadius: 250,
        pickable: true,
        onClick: (info) => {
          if (info.object) setSelectedIntervention(info.object);
        }
      })
    );
  }

  // Cross-Section Line and Points
  if (crossSectionPts.length > 0) {
    deckLayers.push(
      new ScatterplotLayer({
        id: 'cs-points',
        data: crossSectionPts.map(p => ({ position: p })),
        getPosition: d => d.position,
        getFillColor: [249, 115, 22, 255], // Orange
        getRadius: 100
      })
    );
    if (crossSectionPts.length === 2) {
      deckLayers.push(
        new GeoJsonLayer({
          id: 'cs-line',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: crossSectionPts }
          },
          stroked: true,
          getLineColor: [249, 115, 22, 255], // Orange
          getLineWidth: 4,
          lineWidthUnits: 'pixels'
        })
      );
    }
  }

  // --- Dynamic Intervention Math ---
  let interventionReduction = 0;
  if (interventionTypes.upland) interventionReduction += 0.15; // 15% reduction
  if (interventionTypes.urban) interventionReduction += 0.10; // 10% reduction
  if (interventionTypes.delta) interventionReduction += 0.05; // 5% reduction
  if (interventionTypes.dredging) interventionReduction += 0.05; // 5% reduction

  const popMultiplier = 1 - interventionReduction;
  
  const rawPop = returnPeriod == 100 ? 45210 : (returnPeriod == 50 ? 18440 : 5110);
  const rawDamages = returnPeriod == 100 ? 2400 : (returnPeriod == 50 ? 850 : 120); // in Millions
  const rawBuildings = returnPeriod == 100 ? 8450 : 4210;
  const rawBuilt = returnPeriod == 100 ? 3630 : 1845;
  
  const finalPop = Math.floor(rawPop * popMultiplier);
  const finalDamages = Math.floor(rawDamages * popMultiplier);
  const finalBuildings = accraData ? accraData.total_encroaching : Math.floor(rawBuildings * popMultiplier);
  const finalBuilt = accraData ? accraData.built_since_2016 : Math.floor(rawBuilt * popMultiplier);
  // ---------------------------------

  // --- Dynamic Risk Metrics for Cross Section ---
  let minElev = 0, maxElev = 0, totalDist = 0, riskLevel = "N/A";
  let maxWaterDepth = 0, totalPopIntersected = 0, dominantLULC = "Unknown";
  if (elevationProfile && elevationProfile.length > 0) {
    minElev = Math.min(...elevationProfile.map(p => p.elevation_m));
    maxElev = Math.max(...elevationProfile.map(p => p.elevation_m));
    totalDist = Math.max(...elevationProfile.map(p => p.distance_m));
    
    // Max depth and population
    elevationProfile.forEach(p => {
        if (p.water_level_m && p.water_level_m > p.elevation_m) {
            let depth = p.water_level_m - p.elevation_m;
            if (depth > maxWaterDepth) maxWaterDepth = depth;
        }
        // Rough estimate of people over this slice of land
        totalPopIntersected += Math.floor((p.population_density || 0) * (totalDist/elevationProfile.length) / 10000); 
    });
    
    // Mode of LULC
    const lulcCounts = {};
    elevationProfile.forEach(p => {
        if (p.lulc) lulcCounts[p.lulc] = (lulcCounts[p.lulc] || 0) + 1;
    });
    if (Object.keys(lulcCounts).length > 0) {
        dominantLULC = Object.keys(lulcCounts).reduce((a, b) => lulcCounts[a] > lulcCounts[b] ? a : b, "Unknown");
    }
    
    if (maxWaterDepth > 2.0) riskLevel = "Very High";
    else if (maxWaterDepth > 1.0) riskLevel = "High";
    else if (maxWaterDepth > 0.1) riskLevel = "Medium";
    else riskLevel = "Low";
  }
  
  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-slate-200 shadow-md rounded text-xs z-50">
          <p className="font-bold text-slate-800 border-b pb-1 mb-1">Dist: {data.distance_m}m</p>
          <p className="text-slate-600"><span className="font-semibold text-orange-600">Elevation:</span> {data.elevation_m}m</p>
          {data.water_level_m && <p className="text-slate-600"><span className="font-semibold text-blue-600">Flood Water:</span> {data.water_level_m}m</p>}
          <p className="text-slate-600"><span className="font-semibold text-emerald-600">LULC:</span> {data.lulc || "Unknown"}</p>
          <p className="text-slate-600"><span className="font-semibold text-purple-600">Pop Density:</span> {data.population_density || 0} /km²</p>
          {data.drainage_intersect && <p className="text-rose-600 font-bold mt-1">⚠️ Intersects Built Drainage</p>}
        </div>
      );
    }
    return null;
  };

  const handleRunAccraModel = async () => {
    setIsLoadingAccra(true);
    try {
      // Minimum 3 second delay for realistic loading spinner effect
      const start = Date.now();
      
      // Connect to the real Python API!
      const res = await fetch(`${API_URL}/api/encroachment`);
      const data = await res.json();
      
      const elapsed = Date.now() - start;
      if (elapsed < 3000) {
        await new Promise(resolve => setTimeout(resolve, 3000 - elapsed));
      }

      if (data.status === 'success' || data.status === 'fallback') {
        // Multiplier to mock different return periods if needed, 
        // though our backend intersected with 50yr directly.
        setAccraData(data);
        setCurrentPage(1);
      }
    } catch (e) {
      console.error("FastAPI backend not running or threw error", e);
    }
    setLayers(prev => ({ ...prev, naturalFlowPaths: true, encroachingBuildings: true }));
    setIsLoadingAccra(false);
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex flex-col font-gee text-slate-800 overflow-hidden">
      
      {/* TOP BAR */}
      <div className="h-14 bg-white border-b border-slate-300 flex items-center justify-between px-4 shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <span className="font-semibold text-lg text-slate-700">Roxas City HIS Platform</span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Barangay (e.g. Tiza, Baybay)..." 
              onKeyDown={handleSearch}
              className="w-64 pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-colors text-slate-700 font-medium" 
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live Weather Widget - Roxas City */}
          <div className="relative">
            <button
              onClick={() => setShowWeatherPanel(!showWeatherPanel)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-lg hover:shadow-md transition-all cursor-pointer group"
              title="Live Weather - Roxas City, Capiz"
            >
              {isWeatherLoading ? (
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-slate-400 animate-pulse" />
                  <span className="text-[10px] text-slate-400 font-medium">Loading...</span>
                </div>
              ) : weather ? (
                <>
                  {getWeatherIcon(weather.weather[0]?.icon, 'w-5 h-5')}
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-slate-800 leading-tight">
                      {Math.round(weather.main.temp)}°C
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium capitalize leading-tight">
                      {weather.weather[0]?.description}
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 border-l border-sky-200 pl-2 ml-1">
                    <div className="flex items-center gap-0.5">
                      <Droplets className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-slate-600 font-mono font-semibold">{weather.main.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Wind className="w-3 h-3 text-teal-500" />
                      <span className="text-[10px] text-slate-600 font-mono font-semibold">{weather.wind.speed}m/s</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showWeatherPanel ? 'rotate-180' : ''}`} />
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] text-slate-400 font-medium">Weather N/A</span>
                </div>
              )}
            </button>

            {/* Expanded Weather Panel */}
            {showWeatherPanel && weather && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Roxas City, Capiz</h3>
                      <p className="text-[10px] text-sky-100 font-mono">11.5853°N, 122.7511°E</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{Math.round(weather.main.temp)}°C</div>
                      <div className="text-[10px] text-sky-100 capitalize">{weather.weather[0]?.description}</div>
                    </div>
                  </div>
                </div>
                
                {/* Current Conditions Grid */}
                <div className="grid grid-cols-4 gap-0 border-b border-slate-100">
                  <div className="p-2.5 text-center border-r border-slate-100">
                    <Thermometer className="w-4 h-4 mx-auto text-red-400 mb-1" />
                    <div className="text-[10px] text-slate-500 font-medium">Feels Like</div>
                    <div className="text-xs font-bold text-slate-800">{Math.round(weather.main.feels_like)}°C</div>
                  </div>
                  <div className="p-2.5 text-center border-r border-slate-100">
                    <Droplets className="w-4 h-4 mx-auto text-blue-400 mb-1" />
                    <div className="text-[10px] text-slate-500 font-medium">Humidity</div>
                    <div className="text-xs font-bold text-slate-800">{weather.main.humidity}%</div>
                  </div>
                  <div className="p-2.5 text-center border-r border-slate-100">
                    <Wind className="w-4 h-4 mx-auto text-teal-500 mb-1" />
                    <div className="text-[10px] text-slate-500 font-medium">Wind</div>
                    <div className="text-xs font-bold text-slate-800">{weather.wind.speed} m/s</div>
                  </div>
                  <div className="p-2.5 text-center">
                    <Eye className="w-4 h-4 mx-auto text-purple-400 mb-1" />
                    <div className="text-[10px] text-slate-500 font-medium">Visibility</div>
                    <div className="text-xs font-bold text-slate-800">{(weather.visibility / 1000).toFixed(1)} km</div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="px-4 py-2 border-b border-slate-100 flex justify-between text-[10px] text-slate-600">
                  <span>Pressure: <strong className="text-slate-800">{weather.main.pressure} hPa</strong></span>
                  <span>Clouds: <strong className="text-slate-800">{weather.clouds?.all}%</strong></span>
                  <span>Min/Max: <strong className="text-slate-800">{Math.round(weather.main.temp_min)}° / {Math.round(weather.main.temp_max)}°</strong></span>
                </div>

                {/* 5-Day Forecast */}
                {forecast && forecast.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">5-Day Forecast</div>
                    <div className="flex gap-1">
                      {forecast.map((day, idx) => {
                        const date = new Date(day.dt * 1000);
                        const dayName = idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
                        return (
                          <div key={idx} className="flex-1 text-center p-1.5 rounded-lg bg-slate-50 hover:bg-sky-50 transition-colors">
                            <div className="text-[9px] font-bold text-slate-500 uppercase">{dayName}</div>
                            <div className="my-1 flex justify-center">
                              {getWeatherIcon(day.weather[0]?.icon, 'w-5 h-5')}
                            </div>
                            <div className="text-[11px] font-bold text-slate-800">{Math.round(day.main.temp)}°</div>
                            <div className="text-[9px] text-blue-500 font-semibold flex items-center justify-center gap-0.5">
                              <Droplets className="w-2.5 h-2.5" />
                              {Math.round((day.pop || 0) * 100)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rainfall Alert for HIS */}
                {weather.rain && (
                  <div className="mx-4 mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CloudRain className="w-4 h-4 text-amber-600" />
                      <div>
                        <div className="text-[10px] font-bold text-amber-800">Active Rainfall Detected</div>
                        <div className="text-[9px] text-amber-600">
                          {weather.rain['1h'] ? `${weather.rain['1h']} mm/hr (1h)` : ''}
                          {weather.rain['3h'] ? ` ${weather.rain['3h']} mm (3h)` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[9px] text-slate-400 font-mono">OpenWeatherMap API</span>
                  <span className="text-[9px] text-slate-400">
                    Updated: {new Date(weather.dt * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest px-3 py-1 bg-slate-100 border border-slate-200 rounded">
            {role} Dashboard
          </span>
          {role === 'Superadmin' && (
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Enterprise Settings"
            >
              <Settings className="w-5 h-5 animate-pulse" />
            </button>
          )}
          <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-red-600 transition-colors">Logout</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN */}
        <div className="w-72 bg-white border-r border-slate-300 flex flex-col shrink-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
          
          <div className="flex-1 flex flex-col min-h-0 border-b border-slate-300">
            <div className="bg-slate-100 border-b border-slate-300 p-2 flex items-center gap-2">
              <LayersIcon className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-sm text-slate-700">Layers & Physics</span>
            </div>
             <div className="p-2 overflow-y-auto flex-1 text-sm">
              
              <div className="mb-3 bg-slate-50 border border-slate-200 p-2 rounded shadow-sm">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Basemap Style</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setBasemap('satellite');
                      supabase.from('logs').insert([{ action: 'Switch Basemap to Satellite', role: role, details: 'Adjusted visual overlay.' }]);
                    }} 
                    className={`flex-1 py-1 text-[10px] font-bold rounded border uppercase tracking-wider transition-all ${
                      basemap === 'satellite' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Satellite
                  </button>
                  <button 
                    onClick={() => {
                      setBasemap('topo');
                      supabase.from('logs').insert([{ action: 'Switch Basemap to Topographic', role: role, details: 'Adjusted visual overlay.' }]);
                    }} 
                    className={`flex-1 py-1 text-[10px] font-bold rounded border uppercase tracking-wider transition-all ${
                      basemap === 'topo' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Topo
                  </button>
                </div>
              </div>

              <div className="mb-4 bg-blue-50 border border-blue-100 p-2 rounded">
                <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Return Period</label>
                <select 
                  value={returnPeriod} 
                  disabled={role === 'User'}
                  onChange={(e) => {
                    const period = parseInt(e.target.value);
                    setReturnPeriod(period);
                    supabase.from('logs').insert([{
                      action: `Change return period to ${period}Y`,
                      role: role,
                      details: `Triggered dynamic run-off recalculation.`
                    }]);
                  }} 
                  className="w-full p-1 border border-blue-200 rounded text-sm outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value={5}>5 Year Event</option>
                  <option value={25}>25 Year Event</option>
                  <option value={50}>50 Year Event</option>
                  <option value={100}>100 Year Event</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={layers.boundary} onChange={() => toggleLayer('boundary')} className="rounded border-slate-300 text-blue-600" />
                    <span className="text-slate-600 font-medium">City Boundary</span>
                  </div>
                </label>
                
                <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={layers.predictedFlood} onChange={() => toggleLayer('predictedFlood')} className="rounded border-slate-300 text-blue-600" />
                    <span className="text-slate-600 font-medium">Predicted Flood (JAX)</span>
                  </div>
                </label>
                
                <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={layers.drainageNetwork} onChange={() => toggleLayer('drainageNetwork')} className="rounded border-slate-300 text-blue-600" />
                    <span className="text-slate-600 font-medium">Built Drainage</span>
                  </div>
                </label>

                {/* Interventions */}
                <div className="my-2 border-t border-slate-200 pt-2">
                  <span className="px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">NSGA-II Interventions</span>
                  <label className="flex items-center justify-between p-1 mt-1 hover:bg-slate-50 rounded cursor-pointer">
                    <div className="flex items-center gap-2 ml-2">
                      <input type="checkbox" checked={interventionTypes.upland} onChange={() => setInterventionTypes(p => ({...p, upland: !p.upland}))} className="rounded border-slate-300 text-green-600" />
                      <span className="text-slate-600 text-xs flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Upland: Luisiana Clay (HRU 301)</span>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <div className="flex items-center gap-2 ml-2">
                      <input type="checkbox" checked={interventionTypes.urban} onChange={() => setInterventionTypes(p => ({...p, urban: !p.urban}))} className="rounded border-slate-300 text-amber-500" />
                      <span className="text-slate-600 text-xs flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Urban Core: San Manuel (HRU 112)</span>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <div className="flex items-center gap-2 ml-2">
                      <input type="checkbox" checked={interventionTypes.delta} onChange={() => setInterventionTypes(p => ({...p, delta: !p.delta}))} className="rounded border-slate-300 text-sky-500" />
                      <span className="text-slate-600 text-xs flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-sky-500"></div> Tidal Delta: Hydrosol (HRU 135)</span>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <div className="flex items-center gap-2 ml-2">
                      <input type="checkbox" checked={interventionTypes.dredging} onChange={() => setInterventionTypes(p => ({...p, dredging: !p.dredging}))} className="rounded border-slate-300 text-purple-500" />
                      <span className="text-slate-600 text-xs flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Riverbed Alluvium (Dredging)</span>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <div className="flex items-center gap-2 ml-2">
                      <input type="checkbox" checked={interventionTypes.proposedDrainage} onChange={() => setInterventionTypes(p => ({...p, proposedDrainage: !p.proposedDrainage}))} className="rounded border-slate-300 text-green-500" />
                      <span className="text-slate-600 text-xs flex items-center gap-2"><div className="w-2.5 h-0.5 bg-green-500"></div> NSGA-II Drainage Lines</span>
                    </div>
                  </label>
                </div>

                {(role === 'Admin' || role === 'Superadmin') && (
                  <>
                    <div className="my-2 border-t border-slate-200"></div>
                    <div className="px-1 py-1 text-xs font-bold text-red-400 uppercase tracking-wider">Governance (Roxas City Model)</div>

                    <label className="flex items-center justify-between p-1 hover:bg-slate-50 rounded cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={layers.naturalFlowPaths} onChange={() => toggleLayer('naturalFlowPaths')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-slate-600 font-medium">Natural Terrain Flow</span>
                      </div>
                    </label>

                    <label className="flex flex-col p-1.5 hover:bg-slate-50 rounded cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={layers.encroachingBuildings} onChange={() => toggleLayer('encroachingBuildings')} className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
                        <span className="text-slate-600 font-bold text-xs">Encroaching Open Buildings</span>
                      </div>
                      <span className="text-[9px] text-slate-400 ml-5 block mt-0.5 font-medium leading-tight">
                        Queries Google Open Buildings polygons via GEE intersecting 3D flow accumulation.
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>

          {(role === 'Admin' || role === 'Superadmin') && (
            <div className="p-4 bg-slate-50 shrink-0 border-t border-slate-300">
              <button 
                onClick={handleRunAccraModel}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-gee font-medium rounded flex items-center justify-center gap-2 shadow"
              >
                {isPlaying ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Querying Earth Engine...' : 'Run Roxas City Model'}
              </button>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: The Map */}
        <div className="flex-1 relative">
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState }) => setViewState(viewState)}
            controller={true}
            layers={deckLayers}
            onClick={handleMapClick}
          >
            <Map 
              style={{ width: '100%', height: '100%' }}
              mapStyle={mapStyle}
            >
              <ScaleControl position="bottom-right" />
              <NavigationControl position="bottom-right" />
            </Map>
          </DeckGL>

          {/* 3D Mode Toggle Button */}
          <button
            onClick={toggle3DMode}
            className={`absolute top-4 right-4 bg-white/95 backdrop-blur border border-slate-200 rounded shadow-md p-3 z-10 flex items-center gap-2 transition-all hover:shadow-lg ${
              is3DMode ? 'ring-2 ring-blue-500' : ''
            }`}
            title={is3DMode ? 'Switch to 2D Mode' : 'Switch to 3D Mode'}
          >
            <Box className={`w-5 h-5 ${is3DMode ? 'text-blue-600' : 'text-slate-600'}`} />
            <span className={`text-xs font-bold ${is3DMode ? 'text-blue-600' : 'text-slate-600'}`}>
              {is3DMode ? '3D' : '2D'}
            </span>
          </button>

          <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur border border-slate-200 rounded shadow-md p-3 z-10 w-64 pointer-events-none">
            <h4 className="text-xs font-bold text-slate-800 mb-2">Predicted Flood Hazard (m)</h4>
            <div className="space-y-3 text-xs text-slate-600">
              <div>
                <div className="flex justify-between mb-1 font-bold"><span>Depth</span><span>&gt; {returnPeriod > 50 ? '4.5m' : '2.5m'}</span></div>
                <div className="h-2 w-full rounded bg-gradient-to-r from-[#000080] via-[#ffff00] to-[#800080]"></div>
                <div className="flex justify-between mt-0.5 text-[10px]"><span>0.1m</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Analytics (Pops out when a cross section is active or an intervention is clicked) */}
        {((elevationProfile && elevationProfile.length > 0) || selectedIntervention !== null || selectedDrainage !== null) && (
          <div className="w-80 bg-white border-l border-slate-300 flex flex-col shrink-0 z-10 overflow-y-auto relative animate-fade-in">
            <div className="bg-blue-600 text-white p-2 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                <span className="font-semibold text-sm">Analytics & Engineering</span>
              </div>
              <button 
                onClick={() => {
                  setElevationProfile(null);
                  setSelectedIntervention(null);
                  setSelectedDrainage(null);
                  setCrossSectionPts([]);
                }}
                className="text-white hover:text-blue-100 text-xs font-bold px-2 py-0.5 rounded hover:bg-blue-700 transition-colors"
              >
                Close ×
              </button>
            </div>

          <div className="p-4 space-y-4">
            
            {/* 1. DEM Cross Section & Risk */}
            <div className="border border-slate-200 rounded p-3 bg-slate-50 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-slate-800">DEM Elevation Profile</h3>
                {elevationProfile && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-white ${
                    riskLevel === 'Very High' ? 'bg-red-600' : 
                    riskLevel === 'High' ? 'bg-orange-500' : 
                    riskLevel === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}>
                    {riskLevel} Risk
                  </span>
                )}
              </div>
              <div className="h-32 w-full mt-2">
                {elevationProfile ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={elevationProfile}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="distance_m" type="number" tick={{fontSize: 10}} label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
                      <YAxis tick={{fontSize: 10}} width={30} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="elevation_m" stroke="#f97316" fill="#fed7aa" />
                      <Area type="step" dataKey="water_level_m" stroke="#3b82f6" fill="#60a5fa" opacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded text-center px-4">
                     Waiting for Map Selection... (Click two points)
                   </div>
                )}
              </div>
              {elevationProfile && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-600 font-medium grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                      <div className="flex justify-between"><span>Total Dist:</span> <span className="font-bold">{totalDist.toFixed(0)}m</span></div>
                      <div className="flex justify-between"><span>Max Flood Depth:</span> <span className="font-bold text-blue-600">{maxWaterDepth > 0 ? maxWaterDepth.toFixed(1) + "m" : "None"}</span></div>
                      <div className="flex justify-between"><span>Dominant LULC:</span> <span className="font-bold text-emerald-600 text-right max-w-[80px] truncate" title={dominantLULC}>{dominantLULC}</span></div>
                  </div>
                  <div className="space-y-1 border-l pl-2 border-slate-200">
                      <div className="flex justify-between"><span>Min Elev:</span> <span className="font-bold text-orange-600">{minElev.toFixed(1)}m</span></div>
                      <div className="flex justify-between"><span>Max Elev:</span> <span className="font-bold text-orange-600">{maxElev.toFixed(1)}m</span></div>
                      <div className="flex justify-between"><span>Affected Pop:</span> <span className="font-bold text-purple-600">~{totalPopIntersected} people</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. NSGA-II Interventions 2D Shape */}
            <div className="border border-green-200 rounded p-3 bg-green-50 shadow-sm">
              <h3 className="text-sm font-bold text-green-800 mb-2 border-b border-green-200 pb-1 flex justify-between items-center">
                Intervention Design
                <span className="text-[9px] text-slate-500 font-normal">Click a map dot</span>
              </h3>
              {selectedIntervention?.category === 'upland' ? (
                <div className="text-center">
                  <svg viewBox="0 0 200 80" className="w-full h-24 mt-2">
                     <path d="M 10,20 L 40,60 L 160,60 L 190,20" fill="none" stroke="#047857" strokeWidth="2" />
                     <path d="M 40,60 L 160,60 L 180,30 L 20,30 Z" fill="#34d399" opacity="0.3" />
                     <line x1="100" y1="20" x2="100" y2="60" stroke="#047857" strokeDasharray="2,2" />
                     <text x="105" y="45" fontSize="8" fill="#047857">Depth: 4.5m</text>
                     <text x="100" y="75" fontSize="8" fill="#047857" textAnchor="middle">Base Width: 150m</text>
                  </svg>
                  <div className="mt-2 text-[10px] text-left space-y-1 text-green-800">
                     <div className="flex justify-between"><span>HRU Zone:</span> <span className="font-bold">Upland: Luisiana Clay (HRU 301)</span></div>
                     <div className="flex justify-between"><span>Site Type:</span> <span className="font-bold">{selectedIntervention.type}</span></div>
                     <div className="flex justify-between"><span>Coordinates:</span> <span className="font-bold font-mono">[{selectedIntervention.position[1].toFixed(5)}°, {selectedIntervention.position[0].toFixed(5)}°]</span></div>
                     <div className="flex justify-between"><span>Retention Capacity:</span> <span className="font-bold font-mono text-emerald-700">{selectedIntervention.capacity}</span></div>
                  </div>
                </div>
              ) : selectedIntervention?.category === 'urban' ? (
                <div className="text-center">
                  <svg viewBox="0 0 200 80" className="w-full h-24 mt-2">
                     <rect x="60" y="10" width="80" height="60" fill="none" stroke="#1e293b" strokeWidth="2" rx="4" />
                     <rect x="60" y="30" width="80" height="40" fill="#94a3b8" opacity="0.4" rx="4" />
                     <line x1="30" y1="10" x2="170" y2="10" stroke="#475569" strokeWidth="3" />
                     <text x="100" y="45" fontSize="8" fill="#1e293b" textAnchor="middle">Subsurface Tank</text>
                     <text x="150" y="45" fontSize="8" fill="#1e293b">Depth: 5m</text>
                  </svg>
                  <div className="mt-2 text-[10px] text-left space-y-1 text-amber-800">
                     <div className="flex justify-between"><span>HRU Zone:</span> <span className="font-bold">Urban Core: San Manuel (HRU 112)</span></div>
                     <div className="flex justify-between"><span>Site Type:</span> <span className="font-bold">{selectedIntervention.type}</span></div>
                     <div className="flex justify-between"><span>Coordinates:</span> <span className="font-bold font-mono">[{selectedIntervention.position[1].toFixed(5)}°, {selectedIntervention.position[0].toFixed(5)}°]</span></div>
                     <div className="flex justify-between"><span>Retention Capacity:</span> <span className="font-bold font-mono text-amber-700">{selectedIntervention.capacity}</span></div>
                  </div>
                </div>
              ) : selectedIntervention?.category === 'delta' ? (
                <div className="text-center">
                  <svg viewBox="0 0 200 80" className="w-full h-24 mt-2">
                     <path d="M 20,40 Q 60,60 100,40 T 180,40" fill="none" stroke="#0ea5e9" strokeWidth="3" />
                     <rect x="90" y="10" width="20" height="50" fill="#334155" />
                     <line x1="95" y1="10" x2="105" y2="10" stroke="#ef4444" strokeWidth="2" />
                     <text x="120" y="25" fontSize="8" fill="#334155">Smart Flap-Gate</text>
                  </svg>
                  <div className="mt-2 text-[10px] text-left space-y-1 text-sky-800">
                     <div className="flex justify-between"><span>HRU Zone:</span> <span className="font-bold">Tidal Delta: Hydrosol (HRU 135)</span></div>
                     <div className="flex justify-between"><span>Site Type:</span> <span className="font-bold">{selectedIntervention.type}</span></div>
                     <div className="flex justify-between"><span>Coordinates:</span> <span className="font-bold font-mono">[{selectedIntervention.position[1].toFixed(5)}°, {selectedIntervention.position[0].toFixed(5)}°]</span></div>
                     <div className="flex justify-between"><span>Peak Containment:</span> <span className="font-bold font-mono text-sky-700">{selectedIntervention.capacity}</span></div>
                  </div>
                </div>
              ) : selectedIntervention?.category === 'dredging' ? (
                <div className="text-center">
                  <svg viewBox="0 0 200 80" className="w-full h-24 mt-2">
                     <path d="M 30,30 C 60,70 140,70 170,30" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeDasharray="5,5" />
                     <path d="M 40,40 C 80,60 120,60 160,40" fill="none" stroke="#9ca3af" strokeWidth="2" />
                     <line x1="100" y1="30" x2="100" y2="60" stroke="#8b5cf6" />
                     <text x="105" y="45" fontSize="8" fill="#8b5cf6">Excavation: -2.5m</text>
                  </svg>
                  <div className="mt-2 text-[10px] text-left space-y-1 text-purple-800">
                     <div className="flex justify-between"><span>HRU Zone:</span> <span className="font-bold">Riverbed Alluvium (Dredging)</span></div>
                     <div className="flex justify-between"><span>Site Type:</span> <span className="font-bold">{selectedIntervention.type}</span></div>
                     <div className="flex justify-between"><span>Coordinates:</span> <span className="font-bold font-mono">[{selectedIntervention.position[1].toFixed(5)}°, {selectedIntervention.position[0].toFixed(5)}°]</span></div>
                     <div className="flex justify-between"><span>Flow Velocity Gain:</span> <span className="font-bold font-mono text-purple-700">{selectedIntervention.capacity || selectedIntervention.velocityGain}</span></div>
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-[10px] text-green-600/60 font-medium">
                  Click a colored intervention dot on the map.
                </div>
              )}
            </div>

            {/* 3. 2D Engineering Design / Cross-Section Cut (Box Culvert) */}
            <div className="border border-blue-200 rounded p-3 bg-blue-50 shadow-sm">
              <h3 className="text-sm font-bold text-blue-800 mb-2 border-b border-blue-200 pb-1 flex justify-between items-center">
                Recommended Drainage Cut
                {selectedDrainage && <span className="text-[9px] text-blue-500">Linked to Map</span>}
              </h3>
              <div className="text-center">
                {(() => {
                  // Manning Sizing Math
                  let currentWidth = selectedDrainage ? (selectedDrainage.WIDTH || 0.9) : 1.5;
                  let currentType = selectedDrainage ? (selectedDrainage.TYPE || 'RCP') : 'RCP';
                  let name = selectedDrainage ? selectedDrainage.NAME : 'Default Outlet';
                  
                  // Optimize sizing: Proposed box culvert is 1.8x existing width, capped or base min
                  let proposedWidth = Math.max(2.0, parseFloat(currentWidth) * 1.8);
                  let proposedHeight = 2.0;
                  let manningN = 0.013; // Concrete Box Culvert
                  let hydraulicRadius = (proposedWidth * proposedHeight) / (proposedWidth + 2 * proposedHeight);
                  let slope = 0.005; // 0.5% grade slope
                  let dischargeQ = ( (1.0 / manningN) * (proposedWidth * proposedHeight) * Math.pow(hydraulicRadius, 2/3) * Math.sqrt(slope) );
                  
                  // Compute dynamic SVG properties
                  // Base width SVG visual scaling (min 40, max 120 pixels)
                  let visualWidth = Math.min(130, Math.max(50, proposedWidth * 30));
                  let svgX = (200 - visualWidth) / 2;
                  
                  return (
                    <>
                      <svg viewBox="0 0 200 100" className="w-full h-24 mt-2">
                         {/* Dynamic Box Culvert Box */}
                         <rect x={svgX} y="20" width={visualWidth} height="60" fill="none" stroke="#1d4ed8" strokeWidth="4" />
                         <rect x={svgX + 2} y="35" width={visualWidth - 4} height="43" fill="#60a5fa" opacity="0.4" />
                         
                         {/* Water level line */}
                         <line x1={svgX + 2} y1="35" x2={svgX + visualWidth - 2} y2="35" stroke="#2563eb" strokeDasharray="4,2" />
                         <text x="100" y="30" fontSize="7" fill="#1d4ed8" textAnchor="middle">Max Water Level</text>
                         
                         {/* Dimension Labels */}
                         <line x1={svgX} y1="88" x2={svgX + visualWidth} y2="88" stroke="#1e40af" />
                         <text x="100" y="97" fontSize="8" fill="#1e40af" textAnchor="middle">Width: {proposedWidth.toFixed(1)}m</text>
                         
                         <line x1={svgX - 10} y1="20" x2={svgX - 10} y2="80" stroke="#1e40af" />
                         <text x={svgX - 25} y="55" fontSize="8" fill="#1e40af">H: {proposedHeight.toFixed(1)}m</text>
                      </svg>
                      
                      <div className="mt-2 text-[10px] text-left space-y-1 text-blue-800">
                         {selectedDrainage ? (
                           <div className="bg-blue-100/50 p-1.5 rounded mb-2 border border-blue-200/50">
                             <div className="font-bold text-slate-800 truncate">{name}</div>
                             <div className="flex justify-between text-slate-600"><span>Existing Type:</span> <span>{currentType} ({currentWidth}m)</span></div>
                             <div className="flex justify-between text-slate-600"><span>Optimal Upgrade:</span> <span className="font-bold text-blue-700">Box Culvert ({proposedWidth.toFixed(1)}m)</span></div>
                           </div>
                         ) : (
                           <div className="flex justify-between"><span>Design:</span> <span className="font-bold">RC Box Culvert (Road Shoulder)</span></div>
                         )}
                         <div className="flex justify-between"><span>Manning's Coef (n):</span> <span className="font-bold font-mono">{manningN}</span></div>
                         <div className="flex justify-between"><span>Conveyance Cap (Q):</span> <span className="font-bold font-mono">{dischargeQ.toFixed(1)} m³/s</span></div>
                         <div className="flex justify-between"><span>Excavation Volume:</span> <span className="font-bold font-mono">{(proposedWidth * 300).toFixed(0)} m³ /100m</span></div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {(role === 'Admin' || role === 'Superadmin') && layers.encroachingBuildings && (
              <div className="border border-red-200 rounded p-4 bg-red-50 shadow-sm transition-all">
                <h3 className="text-sm font-bold text-red-800 mb-2 border-b border-red-200 pb-2">Drainage Encroachment</h3>
                
                {isLoadingAccra ? (
                  <div className="flex flex-col items-center justify-center py-6 text-red-600">
                    <svg className="animate-spin h-6 w-6 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs font-semibold animate-pulse">Calculating Intersection...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center border-b border-red-100 pb-1">
                      <span className="text-xs text-red-600 font-medium">Total Buildings in ROI:</span>
                      <span className="text-sm font-bold font-mono text-red-700">
                        {accraData ? accraData.total_buildings_in_roi?.toLocaleString() : "..."}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-red-100 pb-1 mt-2">
                      <span className="text-xs text-red-600 font-medium">Buildings in Flow Paths:</span>
                      <span className="text-sm font-bold font-mono text-red-700">
                        {finalBuildings.toLocaleString()} <span className="text-red-500 text-xs">({accraData ? accraData.encroachment_percentage : 0}%)</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-red-100 pb-1">
                      <span className="text-xs text-red-600 font-medium">Population Affected:</span>
                      <span className="text-sm font-bold font-mono text-red-700">
                        {finalPop.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-red-100 pb-1">
                      <span className="text-xs text-red-600 font-medium">Estimated Damages:</span>
                      <span className="text-sm font-bold font-mono text-red-700">
                        {finalDamages >= 1000 ? `₱${(finalDamages/1000).toFixed(1)}B` : `₱${finalDamages}M`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-red-100 pb-1">
                      <span className="text-xs text-red-600 font-medium">Built since 2016:</span>
                      <span className="text-sm font-bold font-mono text-red-700">
                        {finalBuilt.toLocaleString()}
                      </span>
                    </div>
                    <button className="w-full mt-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-sm">
                      Export Coordinates (CSV)
                    </button>

                    {/* Paginated Buildings Inventory */}
                    {accraData?.features && accraData.features.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-red-200">
                        <div className="text-[11px] font-bold text-red-800 mb-2 uppercase tracking-wider">Encroaching Buildings Inventory</div>
                        <div className="overflow-hidden border border-red-200 rounded">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-red-100/80 text-red-800 border-b border-red-200">
                                <th className="p-1.5 font-bold">ID</th>
                                <th className="p-1.5 font-bold">Coordinates (Lat, Lon)</th>
                                <th className="p-1.5 font-bold text-right">Confidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accraData.features.slice((currentPage - 1) * 5, currentPage * 5).map((f, idx) => {
                                const globalIdx = (currentPage - 1) * 5 + idx + 1;
                                const coords = f.geometry?.coordinates?.[0]?.[0] || [122.75, 11.58];
                                const confidence = f.properties?.confidence || 0.90;
                                return (
                                  <tr key={idx} className="border-b border-red-100 hover:bg-red-100/30 transition-colors text-red-900 font-mono">
                                    <td className="p-1.5 font-semibold text-red-700">#{globalIdx}</td>
                                    <td className="p-1.5">[{coords[1].toFixed(5)}°, {coords[0].toFixed(5)}°]</td>
                                    <td className="p-1.5 text-right font-semibold">{(confidence * 100).toFixed(0)}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Pagination Controls */}
                        <div className="flex justify-between items-center mt-3 text-[10px]">
                          <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded disabled:opacity-50"
                          >
                            &larr; Prev
                          </button>
                          <span className="font-semibold text-red-800">
                            Page {currentPage} of {Math.ceil(accraData.features.length / 5)}
                          </span>
                          <button 
                            disabled={currentPage >= Math.ceil(accraData.features.length / 5)}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded disabled:opacity-50"
                          >
                            Next &rarr;
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            


          </div>
        </div>
        )}

      </div>
      {/* ENTERPRISE SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-[680px] border border-slate-200 overflow-hidden flex flex-col h-[560px] max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '8s' }} />
                <div>
                  <span className="font-bold tracking-wide uppercase text-xs block">HIS Admin Console</span>
                  <span className="text-[9px] text-slate-400 font-mono">ROXAS CITY MUNICIPAL HYDROLOGY PARAMETERS</span>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors text-xl font-semibold outline-none"
              >
                &times;
              </button>
            </div>
            
            {/* Modal Tabs */}
            <div className="flex bg-slate-950 border-b border-slate-800 text-[10px] px-5 shrink-0 overflow-x-auto">
              <button 
                onClick={() => setActiveSettingsTab('hydrology')}
                className={`py-3 px-4 font-bold border-b-2 uppercase tracking-wider transition-all outline-none whitespace-nowrap ${
                  activeSettingsTab === 'hydrology' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                💧 Hydrology & Soils
              </button>
              <button 
                onClick={() => setActiveSettingsTab('optimization')}
                className={`py-3 px-4 font-bold border-b-2 uppercase tracking-wider transition-all outline-none whitespace-nowrap ${
                  activeSettingsTab === 'optimization' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                ⚙️ NSGA-II Optimizer
              </button>
              <button 
                onClick={() => setActiveSettingsTab('database')}
                className={`py-3 px-4 font-bold border-b-2 uppercase tracking-wider transition-all outline-none whitespace-nowrap ${
                  activeSettingsTab === 'database' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                🖥️ Service Status
              </button>
              <button 
                onClick={() => setActiveSettingsTab('logs')}
                className={`py-3 px-4 font-bold border-b-2 uppercase tracking-wider transition-all outline-none whitespace-nowrap ${
                  activeSettingsTab === 'logs' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                📋 Audit Trails
              </button>
              {role === 'Superadmin' && (
                <button 
                  onClick={() => setActiveSettingsTab('users')}
                  className={`py-3 px-4 font-bold border-b-2 uppercase tracking-wider transition-all outline-none whitespace-nowrap ${
                    activeSettingsTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  👥 User Access
                </button>
              )}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 min-h-0">
              
              {/* TAB 1: HYDROLOGY & SOILS */}
              {activeSettingsTab === 'hydrology' && (
                <div className="space-y-4 text-xs text-slate-600 animate-fade-in">
                  <div className="bg-blue-50 border border-blue-200/60 rounded-lg p-3 text-blue-900">
                    <span className="font-bold uppercase tracking-wider text-[9px] block text-blue-700">Manning's Equation Model</span>
                    <p className="mt-1 font-mono text-[10px] bg-white/60 p-2 rounded border border-blue-100">
                      Q = (A / n) * R^(2/3) * S^(1/2)
                    </p>
                    <p className="text-[9px] mt-1.5 opacity-80">Adjust coefficients `n` (Roughness) and soil infiltration limits below to change hydrograph calculations dynamically.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Manning's Coefficients */}
                    <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider border-b pb-1 text-[10px]">Manning's Coefficients (n)</h4>
                      
                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>Upland Clay (HRU 301):</span>
                          <span className="font-mono text-blue-600">{manningUpland.toFixed(3)}</span>
                        </div>
                        <input 
                          type="range" min="0.030" max="0.080" step="0.001"
                          value={manningUpland} onChange={(e) => setManningUpland(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>Urban Core (HRU 112):</span>
                          <span className="font-mono text-blue-600">{manningUrban.toFixed(3)}</span>
                        </div>
                        <input 
                          type="range" min="0.010" max="0.025" step="0.001"
                          value={manningUrban} onChange={(e) => setManningUrban(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>Tidal Delta (HRU 135):</span>
                          <span className="font-mono text-blue-600">{manningDelta.toFixed(3)}</span>
                        </div>
                        <input 
                          type="range" min="0.025" max="0.050" step="0.001"
                          value={manningDelta} onChange={(e) => setManningDelta(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>
                    </div>

                    {/* Soil Infiltration Rates */}
                    <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider border-b pb-1 text-[10px]">Soil Infiltration (mm/hr)</h4>
                      
                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>Luisiana Clay (Upland):</span>
                          <span className="font-mono text-blue-600">{infilUpland.toFixed(1)} mm/h</span>
                        </div>
                        <input 
                          type="range" min="0.5" max="5.0" step="0.1"
                          value={infilUpland} onChange={(e) => setInfilUpland(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>San Manuel Soil (Urban):</span>
                          <span className="font-mono text-blue-600">{infilUrban.toFixed(1)} mm/h</span>
                        </div>
                        <input 
                          type="range" min="5.0" max="25.0" step="0.5"
                          value={infilUrban} onChange={(e) => setInfilUrban(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>Hydrosol Soil (Delta):</span>
                          <span className="font-mono text-blue-600">{infilDelta.toFixed(2)} mm/h</span>
                        </div>
                        <input 
                          type="range" min="0.05" max="1.00" step="0.01"
                          value={infilDelta} onChange={(e) => setInfilDelta(parseFloat(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: OPTIMIZATION CONFIG */}
              {activeSettingsTab === 'optimization' && (
                <div className="space-y-4 text-xs text-slate-600 animate-fade-in">
                  <div className="bg-purple-50 border border-purple-200/60 rounded-lg p-3 text-purple-900">
                    <span className="font-bold uppercase tracking-wider text-[9px] block text-purple-700">NSGA-II Multi-Objective Optimizer</span>
                    <p className="text-[10px] mt-1">Configures Pareto-optimal retention capacity weightings for flood containment and city budget minimization.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Genetic Algorithm constraints */}
                    <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider border-b pb-1 text-[10px]">Algorithm Constants</h4>
                      
                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>Population Size:</span>
                          <span className="font-mono text-purple-600 font-bold">{popSize}</span>
                        </div>
                        <input 
                          type="range" min="20" max="300" step="10"
                          value={popSize} onChange={(e) => setPopSize(parseInt(e.target.value))}
                          className="w-full accent-purple-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>Maximum Generations:</span>
                          <span className="font-mono text-purple-600 font-bold">{maxGen}</span>
                        </div>
                        <input 
                          type="range" min="50" max="500" step="10"
                          value={maxGen} onChange={(e) => setMaxGen(parseInt(e.target.value))}
                          className="w-full accent-purple-600"
                        />
                      </div>
                    </div>

                    {/* Objective weight balancing */}
                    <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 uppercase tracking-wider border-b pb-1 text-[10px]">Objective Weightings</h4>
                        
                        <div className="space-y-3 mt-3">
                          <div>
                            <div className="flex justify-between font-semibold text-slate-700 mb-1">
                              <span>Minimize Cost:</span>
                              <span className="font-mono text-purple-600 font-bold">{weightCost}%</span>
                            </div>
                            <input 
                              type="range" min="10" max="90" step="5"
                              value={weightCost} onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setWeightCost(val);
                                setWeightMitigation(100 - val);
                              }}
                              className="w-full accent-purple-600"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between font-semibold text-slate-700 mb-1">
                              <span>Maximize Flood Mitigation:</span>
                              <span className="font-mono text-purple-600 font-bold">{weightMitigation}%</span>
                            </div>
                            <input 
                              type="range" min="10" max="90" step="5"
                              value={weightMitigation} onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setWeightMitigation(val);
                                setWeightCost(100 - val);
                              }}
                              className="w-full accent-purple-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SERVICES STATUS */}
              {activeSettingsTab === 'database' && (
                <div className="space-y-4 text-xs text-slate-600 animate-fade-in">
                  <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1">System Health & APIs</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <span className="font-semibold text-slate-700">Enterprise Database Server</span>
                        <span className="flex items-center gap-1.5 font-bold text-[9px] text-green-700 uppercase bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span>
                          Operational (SSL Secure)
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <span className="font-semibold text-slate-700">Google Earth Engine API</span>
                        <span className="flex items-center gap-1.5 font-bold text-[9px] text-green-700 uppercase bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span>
                          Authenticated
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <span className="font-semibold text-slate-700">Hydrological Model Service</span>
                        <span className="flex items-center gap-1.5 font-bold text-[9px] text-green-700 uppercase bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span>
                          Operational (Port 8000)
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <span className="font-semibold text-slate-700">NSGA-II Genetic Optimizer</span>
                        <span className="flex items-center gap-1.5 font-bold text-[9px] text-green-700 uppercase bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span>
                          Ready
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <span className="font-semibold text-slate-700">OpenWeatherMap API</span>
                        <span className={`flex items-center gap-1.5 font-bold text-[9px] uppercase px-2 py-0.5 rounded border ${
                          weather 
                            ? 'text-green-700 bg-green-50 border-green-200' 
                            : 'text-amber-700 bg-amber-50 border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${
                            weather ? 'bg-green-500' : 'bg-amber-500'
                          }`}></span>
                          {weather ? 'Live (Roxas City)' : 'Connecting...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: AUDIT TRAIL LOGS */}
              {activeSettingsTab === 'logs' && (
                <div className="h-full flex flex-col min-h-0 text-xs text-slate-600 animate-fade-in">
                  <div className="overflow-hidden border border-slate-200 rounded flex-1 bg-white">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <th className="p-2.5 font-bold">Action</th>
                          <th className="p-2.5 font-bold">Operator</th>
                          <th className="p-2.5 font-bold text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settingsLogs.slice((logsPage - 1) * 7, logsPage * 7).map((log, idx) => {
                          return (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-600 font-mono">
                              <td className="p-2.5 font-semibold text-slate-800 truncate max-w-[280px]" title={log.action}>{log.action}</td>
                              <td className="p-2.5"><span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold uppercase">{log.role}</span></td>
                              <td className="p-2.5 text-right font-medium text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                            </tr>
                          );
                        })}
                        {settingsLogs.length === 0 && (
                          <tr>
                            <td colSpan="3" className="p-4 text-center text-slate-400">No logs found in Supabase logs table.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Logs Pagination Controls */}
                  <div className="flex justify-between items-center mt-3 text-[10px] shrink-0">
                    <button 
                      disabled={logsPage === 1}
                      onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Prev
                    </button>
                    <span className="text-slate-600 font-bold">
                      Page {logsPage} of {Math.max(1, Math.ceil(settingsLogs.length / 7))}
                    </span>
                    <button 
                      disabled={logsPage >= Math.ceil(settingsLogs.length / 7)}
                      onClick={() => setLogsPage(p => p + 1)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: USER ACCESS (SUPERADMIN ONLY) */}
              {activeSettingsTab === 'users' && role === 'Superadmin' && (
                <div className="h-full flex flex-col min-h-0 text-xs text-slate-600 animate-fade-in">
                  <div className="overflow-hidden border border-slate-200 rounded flex-1 bg-white">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <th className="p-2.5 font-bold">Email</th>
                          <th className="p-2.5 font-bold">Role</th>
                          <th className="p-2.5 font-bold text-right">Created Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settingsUsers.slice((usersPage - 1) * 7, usersPage * 7).map((user, idx) => {
                          return (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-600 font-mono">
                              <td className="p-2.5 font-semibold text-slate-800 truncate max-w-[200px]" title={user.email}>{user.email}</td>
                              <td className="p-2.5">
                                <select 
                                  value={user.role} 
                                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                  className={`px-1.5 py-1 rounded text-[9px] font-bold uppercase outline-none cursor-pointer border ${
                                    user.role === 'superadmin' ? 'bg-red-50 text-red-700 border-red-200' : 
                                    user.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                    'bg-slate-50 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <option value="user">USER</option>
                                  <option value="admin">ADMIN</option>
                                  <option value="superadmin">SUPERADMIN</option>
                                </select>
                              </td>
                              <td className="p-2.5 text-right font-medium text-slate-400">{new Date(user.created_at).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                        {settingsUsers.length === 0 && (
                          <tr>
                            <td colSpan="3" className="p-4 text-center text-slate-400">No registered users found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Users Pagination Controls */}
                  <div className="flex justify-between items-center mt-3 text-[10px] shrink-0">
                    <button 
                      disabled={usersPage === 1}
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Prev
                    </button>
                    <span className="text-slate-600 font-bold">
                      Page {usersPage} of {Math.max(1, Math.ceil(settingsUsers.length / 7))}
                    </span>
                    <button 
                      disabled={usersPage >= Math.ceil(settingsUsers.length / 7)}
                      onClick={() => setUsersPage(p => p + 1)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="bg-slate-100 px-5 py-3.5 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-300 bg-white rounded shadow-sm hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setIsSettingsOpen(false);
                  await supabase.from('logs').insert([{
                    action: 'Hydrological parameters updated',
                    role: role,
                    details: `Manning's n: [${manningUpland}, ${manningUrban}, ${manningDelta}]. Infiltration: [${infilUpland}, ${infilUrban}, ${infilDelta}]. Optimizer constraints saved.`
                  }]);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard/:role" element={
          <DashboardWrapper />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function DashboardWrapper() {
  const path = window.location.pathname;
  let role = 'User';
  if (path.includes('admin')) role = 'Admin';
  if (path.includes('superadmin')) role = 'Superadmin';
  return <Dashboard role={role} />;
}
