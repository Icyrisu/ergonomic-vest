import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea
} from 'recharts';
import { Download } from 'lucide-react';
import { useSessions } from '../hooks/useSessions';
interface Session {
  session_name: string;
  worker_name: string;
  worker_id: string;
  group_name: string;
  created_at: string;
  ended_at: string | null;
}

interface SensorData {
  pitch: number;
  roll: number;
}

interface RawSessionData {
  id: number;
  recorded_at: string;
  wrench_status: string;
  curve_angle: string | number | null;
  sensors: Record<string, SensorData> | null;
}

interface ChartPoint {
  time: string;
  raw_time: string;
  curve_angle: number | null;
  status: string;
  raw_data: RawSessionData;
}

export default function DataHistory() {
  const { sessions, fetchSessions, fetchSessionData } = useSessions();
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false));
  }, [fetchSessions]);

  // Filter sessions by date
  const filteredSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    return sessions.filter(s => {
      const sDate = new Date(s.created_at).toISOString().split('T')[0];
      return sDate === selectedDate;
    });
  }, [sessions, selectedDate]);

  // When date changes, auto-select first available session if current isn't in list
  useEffect(() => {
    if (filteredSessions.length > 0) {
      const currentExists = filteredSessions.find(s => s.session_name === selectedSession);
      if (!currentExists) {
        setSelectedSession(filteredSessions[0].session_name);
      }
    } else {
      setSelectedSession('');
      setChartData([]);
    }
  }, [filteredSessions, selectedSession]);

  useEffect(() => {
    if (!selectedSession) return;
    
    setLoading(true);
    fetchSessionData(selectedSession)
      .then((data: RawSessionData[] | null) => {
        if (!data) {
          setError('Failed to fetch session data');
          setLoading(false);
          return;
        }
        // Format data for Recharts
        const formattedData: ChartPoint[] = data.map(row => {
          const timeObj = new Date(row.recorded_at);
          const timeStr = timeObj.toLocaleTimeString();
          return {
            time: timeStr,
            raw_time: timeObj.toISOString(),
            // If offline, we drop to 0 degrees
            curve_angle: row.wrench_status === 'ONLINE' ? parseFloat(String(row.curve_angle)) : 0,
            status: row.wrench_status,
            raw_data: row
          };
        });
        setChartData(formattedData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch session data');
        setLoading(false);
      });
  }, [selectedSession, fetchSessionData]);

  // Calculate offline ranges for ReferenceArea
  const offlineRanges = useMemo(() => {
    const ranges: { start: string, end: string, durationStr: string }[] = [];
    let currentStart: string | null = null;
    let count = 0;

    for (let i = 0; i < chartData.length; i++) {
      const point = chartData[i];
      if (point.status === 'OFFLINE') {
        if (!currentStart) {
          currentStart = point.time;
          count = 1;
        } else {
          count++;
        }
      } else {
        if (currentStart) {
          // Found end of an offline block
          ranges.push({ start: currentStart, end: chartData[i - 1].time, durationStr: `${count}s` });
          currentStart = null;
          count = 0;
        }
      }
    }
    // If it ends while offline
    if (currentStart && chartData.length > 0) {
      ranges.push({ start: currentStart, end: chartData[chartData.length - 1].time, durationStr: `${count}s` });
    }
    return ranges;
  }, [chartData]);

  const exportToCSV = () => {
    if (chartData.length === 0) return;

    const sensorCols = [
      { id: 'UMJ/EV/S1', label: 'A (Neck)' },
      { id: 'UMJ/EV/S2', label: 'B (Right Shoulder)' },
      { id: 'UMJ/EV/S3', label: 'C (Left Shoulder)' },
      { id: 'UMJ/EV/S4', label: 'D (Upper Back)' },
      { id: 'UMJ/EV/S5', label: 'E (Mid Back)' },
      { id: 'UMJ/EV/S6', label: 'F (Pelvis)' }
    ];

    let csvContent = "Timestamp,Wrench Status,Curve Angle";
    sensorCols.forEach(col => {
      csvContent += `,${col.label} Pitch,${col.label} Roll`;
    });
    csvContent += "\n";

    chartData.forEach(point => {
      const row = point.raw_data;
      
      // Format timestamp to YYYY-MM-DD HH:MM:SS
      const d = new Date(point.raw_time);
      const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      
      const status = point.status === 'ONLINE' ? 'ON' : 'OFF';
      const curve = row.curve_angle !== null ? row.curve_angle : "";
      
      let rowCsv = `${ts},${status},${curve}`;
      
      const sensors = row.sensors || {};
      sensorCols.forEach(col => {
        const sData = sensors[col.id];
        if (sData) {
          rowCsv += `,${sData.pitch},${sData.roll}`;
        } else {
          rowCsv += `,,"`;
        }
      });
      
      csvContent += rowCsv + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedSession}_Data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-md rounded-xl">
          <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
          {dataPoint.status === 'OFFLINE' ? (
            <p className="text-sm font-bold text-red-500">WRENCH OFF</p>
          ) : (
            <p className="text-sm text-blue-600">
              Curve Angle: <span className="font-bold">{dataPoint.curve_angle}&deg;</span>
            </p>
          )}
        </div>
      );
    }
    // Tooltip for offline ranges (if hovering directly over empty line space)
    if (active && !payload?.length) {
       return (
        <div className="bg-white p-3 border border-slate-200 shadow-md rounded-xl">
          <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-sm font-bold text-red-500">WRENCH OFF</p>
        </div>
       );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 min-h-0">
      
      {/* Header Section */}
      <div className="mb-6 shrink-0 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Session Data Report</h2>
          <p className="text-slate-500 text-sm">Analyze curve angle and export raw sensor data.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Filter</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
            />
          </div>
          
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Session</label>
            <select 
              value={selectedSession} 
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
              disabled={filteredSessions.length === 0}
            >
              {filteredSessions.map(s => (
                <option key={s.session_name} value={s.session_name}>
                  {s.session_name} ({s.worker_name})
                </option>
              ))}
              {filteredSessions.length === 0 && <option value="">No sessions found</option>}
            </select>
          </div>

          <button 
            onClick={exportToCSV}
            disabled={chartData.length === 0}
            className="mt-1 sm:mt-5 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all active:scale-95 shadow-md shadow-blue-500/20 text-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Data
          </button>
        </div>
      </div>

      {/* Chart Section */}
      <div className="flex-1 min-h-0 w-full relative bg-slate-50/50 rounded-xl border border-slate-100 p-2">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-xl">
            <div className="text-blue-500 font-bold flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Loading data...
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="text-red-500 font-medium bg-red-50 px-4 py-2 rounded-xl border border-red-100">{error}</div>
          </div>
        )}

        {!loading && !error && chartData.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="text-slate-400 font-medium bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-100">
              No data recorded for this date or session.
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorCurve" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="time" 
              tickMargin={10} 
              interval="preserveStartEnd" 
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} 
              domain={['auto', 'auto']}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Render red reference areas for offline segments */}
            {offlineRanges.map((range, i) => (
              <ReferenceArea 
                key={i} 
                x1={range.start} 
                x2={range.end} 
                fill="#ef4444" 
                fillOpacity={0.05} 
                label={{ position: 'insideTop', value: `OFF (${range.durationStr})`, fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }}
              />
            ))}
            
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}/>
            <Area 
              type="monotone" 
              name="Curve Angle (Chest - Pelvis)"
              dataKey="curve_angle" 
              stroke="#3b82f6" 
              strokeWidth={3} 
              fill="url(#colorCurve)"
              activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
              connectNulls={true} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
