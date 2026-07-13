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

// --- 1. CONFIGURATION (MUST BE AT TOP) ---
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

const MOCK_DRAINAGE = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[122.70, 11.55], [122.73, 11.57], [122.75, 11.58], [122.77, 11.60], [122.80, 11.61]] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[122.75, 11.58], [122.74, 11.60], [122.73, 11.62]] } }
  ]
};

const DRAINAGE_TRIPS = MOCK_DRAINAGE.features.map(f => ({
  path: f.geometry.coordinates,
  timestamps: f.geometry.coordinates.map((_, i) => i * 1500)
}));

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
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
    } else {
      let role = data.user?.user_metadata?.role;
      if (!role) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        role = profile?.role || 'user';
      }
      await supabase.from('logs').insert([{ action: 'User Session Login', role: role, details: `Authenticated: ${email}` }]);
      navigate(`/dashboard/${role}`);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) { setError("Please enter your email."); return; }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) setError(resetError.message);
    else { setMessage("Password reset email sent!"); setIsResetMode(false); }
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex items-center justify-center font-gee">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96 border border-slate-200">
        <h1 className="font-bold text-2xl text-slate-700 text-center mb-6">Roxas City HIS Platform</h1>
        {error && <div className="p-2 mb-4 bg-red-50 text-red-700 text-xs text-center rounded border border-red-200 animate-shake">⚠️ {error}</div>}
        {message && <div className="p-2 mb-4 bg-green-50 text-green-700 text-xs text-center rounded border border-green-200">✅ {message}</div>}
        <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-4">
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-2 border rounded bg-slate-50 text-sm outline-none focus:border-blue-500" />
          {!isResetMode && <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-2 border rounded bg-slate-50 text-sm outline-none focus:border-blue-500" />}
          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-colors text-sm uppercase">
            {isResetMode ? 'Send Reset Link' : 'Connect to Database'}
          </button>
          <div className="flex justify-between items-center pt-2">
            <button type="button" onClick={() => navigate('/register')} className="text-xs text-blue-600 font-semibold hover:underline">Register</button>
            <button type="button" onClick={() => setIsResetMode(!isResetMode)} className="text-xs text-slate-500 font-semibold hover:underline">{isResetMode ? 'Back to Login' : 'Forgot Password?'}</button>
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
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) setError(authError.message);
    else { setSuccess(true); setTimeout(() => navigate('/'), 3000); }
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex items-center justify-center font-gee">
      <div className="bg-white p-8 rounded-lg shadow-xl w-96 border border-slate-200">
        <h1 className="font-bold text-2xl text-slate-700 text-center mb-6">Create Account</h1>
        {error && <div className="p-2 mb-4 bg-red-50 text-red-700 text-xs text-center rounded border border-red-200">⚠️ {error}</div>}
        {success && <div className="p-2 mb-4 bg-green-50 text-green-700 text-xs text-center rounded">✅ Registration successful! Redirecting...</div>}
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full p-2 border rounded bg-slate-50 text-sm" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full p-2 border rounded bg-slate-50 text-sm" />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" required className="w-full p-2 border rounded bg-slate-50 text-sm" />
          <button type="submit" className="w-full py-2 bg-green-600 text-white font-bold rounded uppercase text-sm">Create Account</button>
          <button type="button" onClick={() => navigate('/')} className="w-full text-xs text-blue-600 mt-2">Back to Login</button>
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
  const [accraData, setAccraData] = useState(null);
  const [isLoadingAccra, setIsLoadingAccra] = useState(false);
  const [crossSectionPts, setCrossSectionPts] = useState([]);
  const [elevationProfile, setElevationProfile] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let animationFrame;
    const animate = () => { setTime(t => (t + 1) % 100); animationFrame = requestAnimationFrame(animate); };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // OpenWeatherMap Logic
  useEffect(() => {
    const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=11.5853&lon=122.7511&appid=${OWM_KEY}&units=metric`);
        const data = await res.json();
        if (data.cod === 200) setWeather(data);
      } catch (err) { console.error('Weather error:', err); }
      setIsWeatherLoading(false);
    };
    if (OWM_KEY) fetchWeather();
  }, []);

  const getWeatherIcon = (iconCode, size = 'w-5 h-5') => <Cloud className={size} />;

  // Layer & Settings State
  const [layers, setLayers] = useState({ boundary: true, predictedFlood: true, drainageNetwork: true, naturalFlowPaths: false, encroachingBuildings: false });
  const [interventionTypes, setInterventionTypes] = useState({ upland: true, urban: true, delta: true, dredging: true, proposedDrainage: true });
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [selectedDrainage, setSelectedDrainage] = useState(null);
  const [basemap, setBasemap] = useState('satellite');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('hydrology');

  // Hydrology States
  const [manningUpland, setManningUpland] = useState(0.045);
  const [manningUrban, setManningUrban] = useState(0.015);
  const [manningDelta, setManningDelta] = useState(0.035);
  const [infilUpland, setInfilUpland] = useState(1.5);
  const [infilUrban, setInfilUrban] = useState(12.0);
  const [infilDelta, setInfilDelta] = useState(0.2);
  const [popSize, setPopSize] = useState(100);
  const [maxGen, setMaxGen] = useState(250);
  const [weightCost, setWeightCost] = useState(40);
  const [weightMitigation, setWeightMitigation] = useState(60);
  const [settingsLogs, setSettingsLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [settingsUsers, setSettingsUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);

  const [viewState, setViewState] = useState({ longitude: 122.75, latitude: 11.58, zoom: 13, pitch: 0, bearing: 0 });
  const [is3DMode, setIs3DMode] = useState(false);

  const toggle3DMode = () => {
    setIs3DMode(!is3DMode);
    setViewState(vs => ({ ...vs, pitch: !is3DMode ? 65 : 0, bearing: !is3DMode ? 20 : 0 }));
  };

  const toggleLayer = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  // --- CROSS SECTION FETCH ---
  useEffect(() => {
    if (crossSectionPts.length === 2) {
      const [p1, p2] = crossSectionPts;
      fetch(`${API_URL}/api/cross-section?lon_a=${p1[0]}&lat_a=${p1[1]}&lon_b=${p2[0]}&lat_b=${p2[1]}&return_period=${returnPeriod}`)
        .then(res => res.json())
        .then(data => setElevationProfile(data.data))
        .catch(e => { console.error("API error", e); setElevationProfile(null); });
    }
  }, [crossSectionPts, returnPeriod]);

  // --- ACCRA MODEL FETCH ---
  const handleRunAccraModel = async () => {
    setIsLoadingAccra(true);
    try {
      const res = await fetch(`${API_URL}/api/encroachment`);
      const data = await res.json();
      if (data.status === 'success' || data.status === 'fallback') {
        setAccraData(data);
        setCurrentPage(1);
      }
    } catch (e) { console.error("Encroachment error", e); }
    setLayers(prev => ({ ...prev, naturalFlowPaths: true, encroachingBuildings: true }));
    setIsLoadingAccra(false);
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const term = e.target.value.toLowerCase();
      if (BARANGAYS[term]) {
        setViewState({ ...viewState, longitude: BARANGAYS[term][0], latitude: BARANGAYS[term][1], zoom: 15, transitionDuration: 1000 });
      }
    }
  };

  const handleMapClick = (info) => {
    if (info.layer && (info.layer.id.includes('intervention') || info.layer.id.includes('drainage'))) return;
    if (!info.coordinate) return;
    const newPts = crossSectionPts.length === 2 ? [info.coordinate] : [...crossSectionPts, info.coordinate];
    setCrossSectionPts(newPts);
    if (newPts.length === 1) setElevationProfile(null);
  };

  const handleRoleChange = async (userId, newRole) => {
    setSettingsUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
  };

  // --- ASSEMBLE ALL LAYERS ---
  const allLayers = [];

  if (layers.boundary) {
    allLayers.push(new GeoJsonLayer({ id: 'city-boundary', data: '/data/barangay.geojson', stroked: true, getLineColor: [255, 255, 255], getLineWidth: 2 }));
  }

  if (layers.drainageNetwork) {
    allLayers.push(
      new GeoJsonLayer({ id: 'built-drainage', data: '/data/drainage.geojson', stroked: true, getLineColor: [0, 255, 255, 200], getLineWidth: 3, pickable: true, onClick: i => { setSelectedDrainage(i.object.properties); setSelectedIntervention(null); } }),
      new GeoJsonLayer({ id: 'rivers', data: '/data/rivers.geojson', stroked: true, getLineColor: [59, 130, 246, 200], getLineWidth: 5 })
    );
  }

  // NSGA-II Point Interventions
  const INTERVENTIONS = [
    { position: [122.759, 11.571], category: 'upland', type: 'Detention Polder', color: [16, 185, 129] },
    { position: [122.752, 11.581], category: 'urban', type: 'Subsurface Cistern', color: [245, 158, 11] },
    { position: [122.731, 11.599], category: 'delta', type: 'Mangrove Estuary', color: [14, 165, 233] },
    { position: [122.760, 11.560], category: 'dredging', type: 'River Dredging', color: [139, 92, 246] }
  ];

  allLayers.push(new ScatterplotLayer({
    id: 'nsga-interventions',
    data: INTERVENTIONS.filter(i => interventionTypes[i.category]),
    getPosition: d => d.position,
    getFillColor: d => [...d.color, 220],
    getRadius: 250,
    pickable: true,
    onClick: i => setSelectedIntervention(i.object)
  }));

  if (crossSectionPts.length > 0) {
    allLayers.push(new ScatterplotLayer({ id: 'cs-pts', data: crossSectionPts, getPosition: d => d, getFillColor: [249, 115, 22], getRadius: 100 }));
    if (crossSectionPts.length === 2) {
      allLayers.push(new GeoJsonLayer({ id: 'cs-line', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: crossSectionPts } }, stroked: true, getLineColor: [249, 115, 22], getLineWidth: 4 }));
    }
  }

  if (layers.encroachingBuildings) {
    allLayers.push(new GeoJsonLayer({
      id: 'buildings',
      data: accraData?.data || { type: 'FeatureCollection', features: [] },
      extruded: true,
      getElevation: 40,
      getFillColor: [220, 38, 38, 200],
      pickable: true
    }));
  }

  // --- RENDER ---
  return (
    <div className="w-full h-screen flex flex-col font-gee overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-700">Roxas City HIS Digital Twin</span>
          <input onKeyDown={handleSearch} placeholder="Search Barangay..." className="w-64 px-3 py-1 bg-slate-100 border rounded text-xs" />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded uppercase">{role}</span>
          {role === 'Superadmin' && <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 hover:bg-slate-100 rounded-full"><Settings className="w-5 h-5 text-slate-500"/></button>}
          <button onClick={() => navigate('/')} className="text-xs text-slate-400 hover:text-red-500 font-bold">LOGOUT</button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-72 bg-white border-r p-4 flex flex-col gap-4 overflow-y-auto z-20 shadow-md">
            <div className="bg-blue-50 p-3 rounded border border-blue-100">
                <label className="block text-[10px] font-bold text-blue-800 uppercase mb-1">Risk Return Period</label>
                <select value={returnPeriod} onChange={e => setReturnPeriod(e.target.value)} className="w-full p-1 text-sm border rounded">
                    <option value={25}>25 Year Event</option>
                    <option value={50}>50 Year Event</option>
                    <option value={100}>100 Year Event</option>
                </select>
            </div>
            
            <button onClick={handleRunAccraModel} className="w-full py-3 bg-blue-600 text-white rounded font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg">
                {isLoadingAccra ? <Activity className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>}
                {isLoadingAccra ? 'Analyzing GEE...' : 'Run Simulation'}
            </button>

            <div className="border-t pt-4 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Layer Control</h4>
                {Object.keys(layers).map(k => (
                    <label key={k} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} />
                        <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    </label>
                ))}
            </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-slate-900">
          <DeckGL viewState={viewState} onViewStateChange={e => setViewState(e.viewState)} controller={true} layers={allLayers} onClick={handleMapClick}>
            <Map 
              style={{ width: '100%', height: '100%' }} 
              mapStyle={basemap === 'satellite' ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'} 
            />
          </DeckGL>

          {/* 3D Button */}
          <button onClick={toggle3DMode} className="absolute top-4 right-4 bg-white p-3 rounded shadow-md z-10 font-bold text-xs flex items-center gap-2">
             <Box className="w-4 h-4"/> {is3DMode ? '3D' : '2D'}
          </button>

          {/* Analytics Popup */}
          {elevationProfile && (
              <div className="absolute bottom-10 right-10 w-[450px] bg-white/95 backdrop-blur p-4 rounded-lg shadow-2xl border border-slate-200 animate-fade-in z-30">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4"/> Profile: 1m LiDAR</h3>
                      <button onClick={() => { setElevationProfile(null); setCrossSectionPts([]); }} className="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
                  </div>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={elevationProfile}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="distance_m" hide />
                            <YAxis width={30} fontSize={10} />
                            <RechartsTooltip />
                            <Area type="monotone" dataKey="elevation_m" stroke="#f97316" fill="#fed7aa" />
                        </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 uppercase">
                      <div className="p-2 bg-orange-50 text-orange-700 rounded border border-orange-100">MAX ELEV: {Math.max(...elevationProfile.map(p => p.elevation_m)).toFixed(1)}m</div>
                      <div className="p-2 bg-blue-50 text-blue-700 rounded border border-blue-100">MIN ELEV: {Math.min(...elevationProfile.map(p => p.elevation_m)).toFixed(1)}m</div>
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* Settings Modal (Simplified) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[600px] h-[500px] flex flex-col shadow-2xl">
            <div className="bg-slate-900 text-white p-4 flex justify-between rounded-t-xl">
              <span className="font-bold text-xs uppercase tracking-widest">Admin Control Center</span>
              <button onClick={() => setIsSettingsOpen(false)}>&times;</button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
               <h2 className="font-bold text-slate-800 mb-4">Hydrological Parameters (n)</h2>
               <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-3 border rounded">
                    <span className="text-xs font-bold">Upland Clay</span>
                    <input type="range" min="0.01" max="0.08" step="0.001" value={manningUpland} onChange={e => setManningUpland(e.target.value)}/>
                  </div>
                  <div className="flex justify-between items-center bg-white p-3 border rounded">
                    <span className="text-xs font-bold">Urban Core</span>
                    <input type="range" min="0.01" max="0.08" step="0.001" value={manningUrban} onChange={e => setManningUrban(e.target.value)}/>
                  </div>
               </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
               <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
               <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold shadow-md">Save Settings</button>
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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard/:role" element={<DashboardWrapper />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function DashboardWrapper() {
  const path = window.location.pathname;
  let role = 'User';
  if (path.toLowerCase().includes('admin')) role = 'Admin';
  if (path.toLowerCase().includes('superadmin')) role = 'Superadmin';
  return <Dashboard role={role} />;
}
