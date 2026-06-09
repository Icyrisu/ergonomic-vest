import { useEffect, useState } from 'react';

const API_URL = '/api/history';

interface HistoryItem {
  id: number;
  topic: string;
  pitch: string | number;
  roll: string | number;
  status: string;
  created_at: string;
}

export default function DataHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        setHistory(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching history:', err);
        setError('Failed to load data');
        setLoading(false);
      });
  }, []);

  return (
    <div className="h-full flex flex-col bg-white p-5 rounded-2xl shadow-sm border border-slate-200 min-h-0">
      <div className="mb-4 shrink-0">
        <h2 className="text-xl font-bold text-slate-800">Sensor History</h2>
        <p className="text-slate-500 text-sm">Last 50 recorded entries from PostgreSQL</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 rounded-xl border border-slate-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Topic</th>
              <th>Pitch</th>
              <th>Roll</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-4">Loading data...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="text-center text-red-500 py-4">{error}</td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-4">No data available</td>
              </tr>
            ) : (
              history.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td className="font-medium text-slate-700">{row.topic}</td>
                  <td>{parseFloat(String(row.pitch)).toFixed(1)}&deg;</td>
                  <td>{parseFloat(String(row.roll)).toFixed(1)}&deg;</td>
                  <td>
                    <span className={`badge ${
                      row.status === 'Safe' ? 'badge-safe' : 
                      row.status === 'Warning' ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
