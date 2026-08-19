import { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
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
  status?: string;
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
  s1_pitch: number | null; s1_status: string;
  s4_pitch: number | null; s4_status: string;
  s5_pitch: number | null; s5_status: string;
  s6_pitch: number | null; s6_status: string;
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
          
          let s1Pitch = null, s4Pitch = null, s5Pitch = null, s6Pitch = null;
          let s1Status = 'Neutral Pose', s4Status = 'Neutral Pose', s5Status = 'Neutral Pose', s6Status = 'Neutral Pose';
          
          if (row.sensors) {
             s1Pitch = row.sensors['UMJ/EV/S1']?.pitch ?? null;
             s1Status = row.sensors['UMJ/EV/S1']?.status ?? 'Neutral Pose';
             s4Pitch = row.sensors['UMJ/EV/S4']?.pitch ?? null;
             s4Status = row.sensors['UMJ/EV/S4']?.status ?? 'Neutral Pose';
             s5Pitch = row.sensors['UMJ/EV/S5']?.pitch ?? null;
             s5Status = row.sensors['UMJ/EV/S5']?.status ?? 'Neutral Pose';
             s6Pitch = row.sensors['UMJ/EV/S6']?.pitch ?? null;
             s6Status = row.sensors['UMJ/EV/S6']?.status ?? 'Neutral Pose';
          }
          
          return {
            time: timeStr,
            raw_time: timeObj.toISOString(),
            s1_pitch: s1Pitch, s1_status: s1Status,
            s4_pitch: s4Pitch, s4_status: s4Status,
            s5_pitch: s5Pitch, s5_status: s5Status,
            s6_pitch: s6Pitch, s6_status: s6Status,
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
      
      let rowCsv = `${ts},${status},`;
      
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

  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    if (cx === undefined || cy === undefined) return null;
    
    let status = 'Neutral Pose';
    if (dataKey === 's1_pitch') status = payload.s1_status;
    else if (dataKey === 's4_pitch') status = payload.s4_status;
    else if (dataKey === 's5_pitch') status = payload.s5_status;
    else if (dataKey === 's6_pitch') status = payload.s6_status;
    
    let fill = '#22c55e'; // green (Neutral)
    if (status === 'Bad Pose' || status === 'Danger') fill = '#ef4444'; // red (Bad)
    else if (status === 'Working Pose' || status === 'Warning') fill = '#eab308'; // yellow (Working)
    
    return (
      <circle cx={cx} cy={cy} r={4} strokeWidth={0} fill={fill} />
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-md rounded-xl">
          <p className="text-sm font-bold text-slate-800 mb-1">{label}</p>
          {dataPoint.status === 'OFFLINE' && (
            <p className="text-sm font-bold text-red-500 mb-2 border-b border-slate-100 pb-1">WRENCH OFF</p>
          )}
          <div className="flex flex-col gap-1 text-sm">
             <p className="text-blue-900">S1 (Neck): <span className="font-bold">{dataPoint.s1_pitch ?? '-'}°</span> ({dataPoint.s1_status})</p>
             <p className="text-blue-700">S4 (Upper Back): <span className="font-bold">{dataPoint.s4_pitch ?? '-'}°</span> ({dataPoint.s4_status})</p>
             <p className="text-blue-500">S5 (Waist): <span className="font-bold">{dataPoint.s5_pitch ?? '-'}°</span> ({dataPoint.s5_status})</p>
             <p className="text-blue-400">S6 (Pelvis): <span className="font-bold">{dataPoint.s6_pitch ?? '-'}°</span> ({dataPoint.s6_status})</p>
          </div>
        </div>
      );
    }
    // Tooltip for offline ranges
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
          <p className="text-slate-500 text-sm">Analyze multi-sensor pitch and export raw sensor data.</p>
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
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
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
              />
            ))}
            
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}/>
            <Line type="monotone" name="S1 (Neck)" dataKey="s1_pitch" stroke="#1e3a8a" strokeWidth={2} dot={<CustomDot dataKey="s1_pitch" />} activeDot={<CustomDot dataKey="s1_pitch" />} connectNulls={true} />
            <Line type="monotone" name="S4 (Upper Back)" dataKey="s4_pitch" stroke="#1d4ed8" strokeWidth={2} dot={<CustomDot dataKey="s4_pitch" />} activeDot={<CustomDot dataKey="s4_pitch" />} connectNulls={true} />
            <Line type="monotone" name="S5 (Waist)" dataKey="s5_pitch" stroke="#3b82f6" strokeWidth={2} dot={<CustomDot dataKey="s5_pitch" />} activeDot={<CustomDot dataKey="s5_pitch" />} connectNulls={true} />
            <Line type="monotone" name="S6 (Pelvis)" dataKey="s6_pitch" stroke="#60a5fa" strokeWidth={2} dot={<CustomDot dataKey="s6_pitch" />} activeDot={<CustomDot dataKey="s6_pitch" />} connectNulls={true} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
