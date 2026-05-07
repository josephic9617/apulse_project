import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, ServerCrash, CheckCircle2, AlertTriangle, Plus, Trash2, PauseCircle, PlayCircle, CheckSquare, ChevronDown, ChevronUp, X, Play, Pause, LogOut, Lock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import clsx from 'clsx';

interface Service {
  id: number;
  name: string;
  url: string;
  method: string;
  expected_status: number;
  is_active: boolean;
}

interface Alert {
  id: number;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface Stats {
  total_services: number;
  open_alerts: number;
  uptime_percentage: number;
}

interface Ping {
  id: number;
  latency_ms: number;
  timestamp: string;
  is_up: boolean;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('apulse_token'));
  const [stats, setStats] = useState<Stats | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  
  // Auth Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Add API Form state
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcUrl, setNewSvcUrl] = useState('');
  const [newSvcMethod, setNewSvcMethod] = useState('GET');
  const [newSvcStatus, setNewSvcStatus] = useState<number>(200);

  const [expandedSvc, setExpandedSvc] = useState<number | null>(null);
  const [metricsData, setMetricsData] = useState<Record<number, Ping[]>>({});

  const api = axios.create({
    baseURL: '',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  api.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) {
        setToken(null);
        localStorage.removeItem('apulse_token');
      }
      return Promise.reject(err);
    }
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      const newToken = res.data.access_token;
      setToken(newToken);
      localStorage.setItem('apulse_token', newToken);
      setAuthError('');
    } catch (err: any) {
      setAuthError(err.response?.data?.detail || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('apulse_token');
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const [statsRes, svcRes, alertRes] = await Promise.all([
        api.get('/api/stats'),
        api.get('/api/services'),
        api.get('/api/alerts')
      ]);
      setStats(statsRes.data);
      setServices(svcRes.data);
      setAlerts(alertRes.data);
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  const fetchMetrics = async (serviceId: number) => {
    if (!token) return;
    try {
      const res = await api.get(`/api/services/${serviceId}/metrics`);
      setMetricsData(prev => ({ ...prev, [serviceId]: res.data }));
    } catch (e) {
      console.error("Failed to fetch metrics", e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    if (!isAutoRefresh || !token) return;
    const interval = setInterval(() => {
      fetchData();
      if (expandedSvc !== null) {
        fetchMetrics(expandedSvc);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [expandedSvc, isAutoRefresh, token]);

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/services', { 
        name: newSvcName, 
        url: newSvcUrl, 
        method: newSvcMethod,
        expected_status: newSvcStatus,
        is_active: true 
      });
      setShowAddModal(false);
      setNewSvcName('');
      setNewSvcUrl('');
      setNewSvcMethod('GET');
      setNewSvcStatus(200);
      fetchData();
    } catch (e) {
      console.error("Failed to add service", e);
    }
  };

  const deleteService = async (id: number) => {
    try {
      await api.delete(`/api/services/${id}`);
      fetchData();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const toggleService = async (id: number, currentStatus: boolean) => {
    try {
      await api.patch(`/api/services/${id}`, { is_active: !currentStatus });
      fetchData();
    } catch (e) {
      console.error("Failed to toggle", e);
    }
  };

  const resolveAlert = async (id: number) => {
    try {
      await api.patch(`/api/alerts/${id}/resolve`);
      fetchData();
    } catch (e) {
      console.error("Failed to resolve alert", e);
    }
  };

  const handleExpand = (id: number) => {
    if (expandedSvc === id) {
      setExpandedSvc(null);
    } else {
      setExpandedSvc(id);
      fetchMetrics(id);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-devops-bg font-mono p-4">
        <div className="w-full max-w-md bg-devops-panel/60 backdrop-blur-xl border border-devops-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="p-8">
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="p-4 bg-devops-accent/10 border border-devops-accent/20 rounded-full">
                <Lock className="w-8 h-8 text-devops-accent" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">APulse Secure Access</h1>
              <p className="text-devops-muted text-sm text-center">Enter your credentials to access the monitoring dashboard</p>
            </div>
            
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs uppercase tracking-widest text-devops-muted mb-2 font-bold">Username</label>
                <input 
                  type="text" required value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full bg-devops-bg/50 border border-devops-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-devops-accent transition-all duration-300"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-devops-muted mb-2 font-bold">Password</label>
                <input 
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-devops-bg/50 border border-devops-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-devops-accent transition-all duration-300"
                  placeholder="••••••••"
                />
              </div>
              {authError && <p className="text-red-400 text-xs text-center animate-pulse">{authError}</p>}
              <button type="submit" className="w-full bg-devops-accent text-devops-bg font-bold py-4 rounded-lg hover:bg-emerald-400 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transform hover:-translate-y-0.5">
                Authorize
              </button>
            </form>
          </div>
          <div className="p-4 bg-black/20 border-t border-devops-border text-center">
            <p className="text-[10px] text-devops-muted tracking-widest uppercase">Powered by APulse Infrastructure</p>
          </div>
        </div>
      </div>
    );
  }

  const openAlerts = alerts.filter(a => !a.resolved);
  const uptime = stats?.uptime_percentage ?? 100;

  return (
    <div className={clsx("min-h-screen p-6 font-mono selection:bg-devops-accent selection:text-white bg-devops-bg transition-all duration-1000", openAlerts.length > 0 ? "shadow-[inset_0_0_150px_rgba(239,68,68,0.05)]" : "")}>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-4 border-b border-devops-border gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 glow-text" />
          <h1 className="text-2xl font-bold tracking-tight">API Monitoring Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={clsx("flex items-center gap-2 text-sm font-bold py-2 px-3 rounded transition-all duration-300", isAutoRefresh ? "text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20" : "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20")}
          >
            {isAutoRefresh ? <><Pause className="w-4 h-4" /> Auto-Refresh ON</> : <><Play className="w-4 h-4" /> Auto-Refresh OFF</>}
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-devops-accent hover:bg-emerald-400 text-devops-bg font-bold py-2 px-4 rounded transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)]"
          >
            <Plus className="w-4 h-4" /> Add API
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 text-devops-muted hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Advanced Add API Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-devops-panel border border-devops-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-devops-border bg-devops-bg/50">
              <h2 className="font-bold text-lg">Add New API Monitor</h2>
              <button onClick={() => setShowAddModal(false)} className="text-devops-muted hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={addService} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-devops-muted mb-1 font-semibold">Service Name</label>
                <input 
                  type="text" required value={newSvcName} onChange={e => setNewSvcName(e.target.value)}
                  className="w-full bg-devops-bg border border-devops-border text-white px-3 py-2 rounded focus:outline-none focus:border-devops-accent transition-colors"
                  placeholder="e.g. Authentication Service"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-devops-muted mb-1 font-semibold">Endpoint URL</label>
                <input 
                  type="url" required value={newSvcUrl} onChange={e => setNewSvcUrl(e.target.value)}
                  className="w-full bg-devops-bg border border-devops-border text-white px-3 py-2 rounded focus:outline-none focus:border-devops-accent transition-colors"
                  placeholder="https://api.example.com/health"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wider text-devops-muted mb-1 font-semibold">Method</label>
                  <select 
                    value={newSvcMethod} onChange={e => setNewSvcMethod(e.target.value)}
                    className="w-full bg-devops-bg border border-devops-border text-white px-3 py-2 rounded focus:outline-none focus:border-devops-accent transition-colors appearance-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wider text-devops-muted mb-1 font-semibold">Expected Status</label>
                  <input 
                    type="number" required value={newSvcStatus} onChange={e => setNewSvcStatus(parseInt(e.target.value))}
                    className="w-full bg-devops-bg border border-devops-border text-white px-3 py-2 rounded focus:outline-none focus:border-devops-accent transition-colors"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded text-devops-muted hover:text-white hover:bg-devops-border transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-devops-accent text-devops-bg font-bold py-2 px-6 rounded hover:bg-emerald-400 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_20px_rgba(16,185,129,0.6)]">
                  Save Monitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-devops-panel/40 backdrop-blur-sm p-6 rounded-lg border border-devops-border flex items-center gap-4 hover:border-devops-accent/50 transition-colors">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-devops-muted uppercase tracking-wider font-semibold">Total APIs</p>
            <h2 className="text-3xl font-bold">{stats?.total_services || 0}</h2>
          </div>
        </div>
        
        <div className="bg-devops-panel/40 backdrop-blur-sm p-6 rounded-lg border border-devops-border flex items-center gap-4 hover:border-emerald-500/50 transition-colors relative overflow-hidden">
          <div className="z-10 flex-1">
            <p className="text-xs text-devops-muted uppercase tracking-wider font-semibold">24h Global Uptime</p>
            <h2 className={clsx("text-3xl font-bold", uptime < 95 ? "text-amber-400" : "text-emerald-400")}>{uptime}%</h2>
          </div>
          <div className="absolute right-[-20px] top-4 w-32 h-24 opacity-60 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: uptime }, { value: 100 - uptime }]}
                  cx="50%" cy="100%" startAngle={180} endAngle={0}
                  innerRadius={30} outerRadius={40} dataKey="value" stroke="none"
                >
                  <Cell fill={uptime < 95 ? "#fbbf24" : "#10b981"} />
                  <Cell fill="#334155" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={clsx("bg-devops-panel/40 backdrop-blur-sm p-6 rounded-lg border flex items-center gap-4 transition-all duration-300", openAlerts.length > 0 ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]" : "border-devops-border hover:border-red-500/30")}>
          <div className={clsx("p-3 rounded-lg border", openAlerts.length > 0 ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse" : "bg-red-500/5 border-red-500/10 text-red-400/50")}>
            <ServerCrash className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-devops-muted uppercase tracking-wider font-semibold">Open Alerts</p>
            <h2 className={clsx("text-3xl font-bold", openAlerts.length > 0 ? "text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "text-devops-muted")}>{stats?.open_alerts || 0}</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-devops-panel/60 backdrop-blur-md rounded-lg border border-devops-border overflow-hidden">
          <div className="p-4 border-b border-devops-border/50 flex justify-between items-center bg-devops-bg/30">
            <h3 className="font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400"/> Monitored Services</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-devops-bg/50 text-devops-muted text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Endpoint</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {services.map(svc => (
                  <React.Fragment key={svc.id}>
                    <tr className="border-b border-devops-border/30 hover:bg-devops-bg/40 transition-colors group">
                      <td className="p-4 w-16">
                        {!svc.is_active ? (
                          <span className="flex h-3 w-3 bg-gray-500 rounded-full" title="Paused"></span>
                        ) : (
                          <span className="flex h-3 w-3 relative" title="Active">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded", 
                            svc.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                            svc.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' :
                            svc.method === 'DELETE' ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'
                          )}>{svc.method}</span>
                          <span className="font-bold text-devops-text text-base">{svc.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-devops-muted">
                          <span className="truncate max-w-[200px] sm:max-w-xs">{svc.url}</span>
                          <span className="opacity-50">•</span>
                          <span>Expect: {svc.expected_status}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleService(svc.id, svc.is_active)}
                            className="p-1.5 text-devops-muted hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                            title={svc.is_active ? "Pause Monitoring" : "Resume Monitoring"}
                          >
                            {svc.is_active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => deleteService(svc.id)}
                            className="p-1.5 text-devops-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            title="Delete API"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleExpand(svc.id)}
                            className={clsx("p-1.5 rounded transition-colors", expandedSvc === svc.id ? "text-emerald-400 bg-emerald-400/10" : "text-devops-muted hover:text-devops-text hover:bg-devops-border")}
                            title="View Metrics"
                          >
                            {expandedSvc === svc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedSvc === svc.id && (
                      <tr className="bg-black/30 border-b border-devops-border/30">
                        <td colSpan={3} className="p-6">
                          <div className="h-64 w-full relative">
                            {metricsData[svc.id] && metricsData[svc.id].length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={metricsData[svc.id]}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                  <XAxis 
                                    dataKey="timestamp" 
                                    tickFormatter={(t) => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickMargin={10}
                                  />
                                  <YAxis 
                                    stroke="#94a3b8" 
                                    fontSize={12} 
                                    tickFormatter={(v) => `${v}ms`}
                                    width={60}
                                  />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                                    itemStyle={{ color: '#10b981' }}
                                    labelFormatter={(l) => new Date(l).toLocaleString()}
                                  />
                                  <Line 
                                    type="stepAfter" 
                                    dataKey="latency_ms" 
                                    stroke="#10b981" 
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 6, fill: '#10b981', stroke: '#1e293b', strokeWidth: 2 }}
                                    animationDuration={300}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-devops-muted flex-col gap-2">
                                <Activity className="w-6 h-6 animate-pulse opacity-50" />
                                <span className="text-xs tracking-widest uppercase">Waiting for ping data...</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-16 text-center text-devops-muted border-b border-devops-border/30">
                      <div className="flex flex-col items-center gap-3">
                        <ServerCrash className="w-10 h-10 opacity-20" />
                        <p>No endpoints configured for monitoring.</p>
                        <button onClick={() => setShowAddModal(true)} className="text-emerald-400 text-sm hover:underline mt-2">Add your first API</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-devops-panel/60 backdrop-blur-md rounded-lg border border-devops-border overflow-hidden flex flex-col max-h-[600px]">
          <div className="p-4 border-b border-devops-border/50 flex items-center gap-2 bg-devops-bg/30">
            <AlertTriangle className={clsx("w-4 h-4", openAlerts.length > 0 ? "text-amber-500" : "text-devops-muted")} />
            <h3 className="font-bold">Recent Alerts</h3>
            {openAlerts.length > 0 && (
              <span className="ml-auto bg-red-500/20 text-red-400 text-xs py-0.5 px-2 rounded-full font-bold">
                {openAlerts.length} OPEN
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {openAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-devops-muted opacity-50 py-12">
                <CheckCircle2 className="w-12 h-12 mb-2" />
                <p className="text-sm">All systems operational</p>
              </div>
            ) : openAlerts.map(alert => (
              <div key={alert.id} className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm flex flex-col gap-2 hover:bg-red-500/15 transition-colors group animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-red-400 tracking-wider">SYSTEM ALERT</span>
                    <span className="text-devops-text leading-snug">{alert.message}</span>
                    <span className="text-xs text-devops-muted mt-1">{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={() => resolveAlert(alert.id)}
                    className="shrink-0 p-1.5 bg-devops-bg/50 text-devops-muted hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Mark as Resolved"
                  >
                    <CheckSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
