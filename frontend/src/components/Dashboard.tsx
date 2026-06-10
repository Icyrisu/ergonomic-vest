import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Activity } from 'lucide-react';
import ThreeModel from './ThreeModel';

interface DashboardProps {
  socket: Socket | null;
}

export default function Dashboard({ socket }: DashboardProps) {
  const [wrenchStatus, setWrenchStatus] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState<boolean>(false);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [redThreshold, setRedThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('curveRedThreshold');
    return saved ? parseInt(saved, 10) : 20;
  });
  
  // Form States
  const [sessionName, setSessionName] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // We can track individual sensor data if needed, but three-setup handles the 3D model directly
  // We'll just manage the Socket connection here

  useEffect(() => {
    // @ts-ignore
    window.curveRedThreshold = redThreshold;
    localStorage.setItem('curveRedThreshold', redThreshold.toString());
  }, [redThreshold]);

  // Listen for threshold changes from other devices
  useEffect(() => {
    if (!socket) return;
    const handleThresholdSync = (val: number) => {
      setRedThreshold(val);
      // @ts-ignore
      window.curveRedThreshold = val;
      localStorage.setItem('curveRedThreshold', val.toString());
    };
    socket.on('threshold_sync', handleThresholdSync);
    return () => { socket.off('threshold_sync', handleThresholdSync); };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    // MQTT Topic to internal ID mapping (based on user's new S1-S6 convention)
    const topicToInternalId: Record<string, string> = {
      'UMJ/EV/S1': 's2', // Left Arm (lShoulder)
      'UMJ/EV/S2': 's3', // Right Arm (rShoulder)
      'UMJ/EV/S3': 's5', // Chest (spine3)
      'UMJ/EV/S4': 's7', // Mid Back (spine2)
      'UMJ/EV/S5': 's8', // Low Back (spine1)
      'UMJ/EV/S6': 's9'  // Pelvis
    };

    const bonesMap: Record<string, string> = {
      's9': 'pelvis',    // Pelvis
      's8': 'spine1',    // Lower Back
      's7': 'spine2',    // Mid Back
      's5': 'chest',     // Chest
      's2': 'lShoulder', // Left Arm
      's3': 'rShoulder'  // Right Arm
    };

    // Store latest pitch per spine sensor (absolute bow angle)
    // bow = pitch + 90  →  upright(-90)=0°, bow90°(0)=90°
    const spinePitch: Record<string, number> = {
      s5: -90, s7: -90, s8: -90, s9: -90   // default: upright
    };

    const updateSpineBones = () => {
      if (!window.boneTargets) return;
      const t = window.boneTargets;

      // Convert absolute sensor pitch to bow angle:
      //   pitch -90° (upright) → bow 0°
      //   pitch   0° (bow 90°) → bow 90°
      const bowS9 = spinePitch.s9 + 90;  // pelvis
      const bowS8 = spinePitch.s8 + 90;  // lower back
      const bowS7 = spinePitch.s7 + 90;  // mid back
      const bowS5 = spinePitch.s5 + 90;  // chest

      const toRad = (deg: number) => deg * (Math.PI / 180);

      // Write targets — the animate() loop lerps smoothly toward these each frame
      // Differential: pelvis gets full base bow, upper bones get the increment
      if (t.pelvis) t.pelvis.x = toRad(bowS9);
      if (t.spine1) t.spine1.x = toRad(bowS8 - bowS9);
      if (t.spine2) t.spine2.x = toRad(bowS7 - bowS8);
      if (t.chest)  t.chest.x  = toRad(bowS5 - bowS7);
    };

    const handleSensorData = (data: any) => {
      const sid = topicToInternalId[data.topic];
      if (!sid) return;

      // Update UI labels
      const uiLabel = document.getElementById(`val-${sid}`);
      if (uiLabel) {
        uiLabel.innerHTML = `P:${data.pitch.toFixed(1)}&deg;<br/>R:${data.roll.toFixed(1)}&deg;`;
      }

      if (sid === 's2' || sid === 's3') {
        // Shoulders: write to boneTargets for lerp smoothing
        if (window.boneTargets) {
          const boneName = bonesMap[sid]; // 'lShoulder' or 'rShoulder'
          const t = window.boneTargets[boneName];
          if (t) {
            // S2/S3 absolute bow: data.pitch (0 = upright, 90 = bent forward)
            const bowArm = data.pitch;
            // Parent (chest S5) absolute bow:
            const bowChest = spinePitch.s5 !== undefined ? spinePitch.s5 + 90 : 0;
            // The difference is the local rotation relative to the chest
            t.x = (bowArm - bowChest) * (Math.PI / 180);
            t.z = -data.roll  * (Math.PI / 180);
          }
        }
      } else {
        // Spine sensors: store pitch then recalculate differential targets
        spinePitch[sid] = data.pitch;
        updateSpineBones();
        
        // Update Total Curve Angle (S5 Chest - S9 Pelvis)
        if (sid === 's5' || sid === 's9') {
          const curve = Math.abs(spinePitch['s5'] - spinePitch['s9']);
          const uiCurve = document.getElementById('val-curve');
          if (uiCurve) uiCurve.innerHTML = `${curve.toFixed(2)}&deg;`;
        }
      }
    };

    const handleWrenchStatus = (isOn: boolean) => {
      setWrenchStatus(isOn);
      if (window.updateWrenchState) {
        window.updateWrenchState(isOn);
      }
    };

    const handleSessionStatus = (isActive: boolean) => {
      setIsSessionActive(isActive);
    };

    socket.on('sensor_data', handleSensorData);
    socket.on('wrench_status', handleWrenchStatus);
    socket.on('session_status', handleSessionStatus);

    // Request initial status when component mounts
    socket.emit('request_session_status');

    return () => {
      socket.off('sensor_data', handleSensorData);
      socket.off('wrench_status', handleWrenchStatus);
      socket.off('session_status', handleSessionStatus);
    };
  }, [socket]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_name: sessionName,
          name: workerName,
          id: workerId,
          group: groupName
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start session');
      }
      
      setIsModalOpen(false);
      setSessionName('');
      setWorkerName('');
      setWorkerId('');
      setGroupName('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopSession = async () => {
    try {
      await fetch('/api/sessions/stop', { method: 'POST' });
      setIsStopModalOpen(false);
    } catch (err) {
      console.error('Failed to stop session', err);
    }
  };

  const turnWrenchOn = () => {
    if (socket) socket.emit('wrench_control', { value: 'ON' });
  };

  const turnWrenchOff = () => {
    if (socket) socket.emit('wrench_control', { value: 'OFF' });
  };

  return (
    /* Mobile: scrollable. Desktop lg+: fixed height flex-row */
    <div className="flex flex-col lg:flex-row gap-3 md:gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
      
      {/* 3D Model Section */}
      <div className="lg:flex-[2] min-w-0 flex flex-col bg-white p-3 rounded-2xl shadow-sm border border-slate-200 lg:min-h-0 lg:overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Posture Detection</h2>
            <p className="text-slate-500 text-xs">Turn ON the impact wrench to start monitoring</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
              <input type="checkbox" id="toggle-model" defaultChecked className="w-4 h-4 rounded text-brand focus:ring-brand" />
              Show Character
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
              <input
                type="checkbox"
                id="toggle-sensors"
                defaultChecked
                className="w-4 h-4 rounded text-brand focus:ring-brand"
                onChange={(e) => {
                  if (window.toggleSensors) window.toggleSensors(e.target.checked);
                }}
              />
              Show Sensors
            </label>
          </div>
        </div>

        {/* 3D canvas: fixed 300px on mobile, fills space on desktop */}
        <div className="relative h-[300px] sm:h-[380px] lg:flex-1 lg:min-h-0 bg-white rounded-xl overflow-hidden border border-slate-200">
          <ThreeModel />
        </div>
      </div>

      {/* Controls Section (Right Side) */}
      <div className="lg:flex-1 min-w-0 flex flex-col bg-white p-4 rounded-2xl shadow-sm border border-slate-200 lg:min-h-0 lg:overflow-hidden">
        {/* Inner: mobile = stacked with gap, desktop = fills height via justify-between */}
        <div className="flex flex-col gap-4 lg:h-full lg:justify-between">

          {/* Action Button */}
          {!isSessionActive ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 lg:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/30 text-base tracking-wide shrink-0"
            >
              START SESSION
            </button>
          ) : (
            <button
              onClick={() => setIsStopModalOpen(true)}
              className="w-full py-3 lg:py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-red-500/30 text-base tracking-wide shrink-0 flex items-center justify-center gap-2 animate-pulse"
            >
              <div className="w-3 h-3 bg-white rounded-full"></div>
              STOP SESSION
            </button>
          )}

          {/* Angle Values — flex-1 on desktop fills remaining space */}
          <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0 lg:gap-1.5">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Angle Values</h3>

            <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-md shrink-0">
              <div>
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-0.5">Total Curve Angle</p>
                <p id="val-curve" className="text-xl font-bold text-green-400 leading-tight">0.00°</p>
              </div>
              <div className="p-2.5 bg-slate-700 rounded-lg shadow-inner border border-slate-600/50">
                <Activity className="w-5 h-5 text-sky-400" />
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Danger Limit</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const val = Math.max(10, redThreshold - 5);
                    setRedThreshold(val);
                    // @ts-ignore
                    window.curveRedThreshold = val;
                    localStorage.setItem('curveRedThreshold', val.toString());
                    if (socket) socket.emit('threshold_change', val);
                  }}
                  className="w-7 h-7 rounded-md bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all font-bold"
                >-</button>
                <span className="text-sm font-bold w-8 text-center text-red-500">{redThreshold}&deg;</span>
                <button
                  onClick={() => {
                    const val = Math.min(90, redThreshold + 5);
                    setRedThreshold(val);
                    // @ts-ignore
                    window.curveRedThreshold = val;
                    localStorage.setItem('curveRedThreshold', val.toString());
                    if (socket) socket.emit('threshold_change', val);
                  }}
                  className="w-7 h-7 rounded-md bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all font-bold"
                >+</button>
              </div>
            </div>

            {/* Sensor grid: 2 col mobile, 3 col desktop. On desktop flex-1 + auto-rows-fr fills space */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-1.5 lg:flex-1 lg:auto-rows-fr">
              {[
                {id: 's2', label: 'Left Arm'}, {id: 's3', label: 'Right Arm'},
                {id: 's5', label: 'Chest'},    {id: 's7', label: 'Mid Back'},
                {id: 's8', label: 'Low Back'}, {id: 's9', label: 'Pelvis'}
              ].map(s => (
                <div key={s.id} className="bg-slate-50 py-2.5 px-2 lg:py-0 rounded-xl border border-slate-100 text-center flex flex-col justify-center">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                  <p id={`val-${s.id}`} className="text-xs font-mono font-bold text-slate-800 mt-0.5 lg:mt-1">--</p>
                </div>
              ))}
            </div>
          </div>

          {/* Impact Wrench */}
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Impact Wrench</h3>
            <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-md">
              <div>
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-0.5">Current Status</p>
                <p className={`text-xl font-bold leading-tight ${wrenchStatus ? 'text-green-400' : 'text-red-400'}`}>
                  {wrenchStatus ? 'ON' : 'OFF'}
                </p>
              </div>
              <div className="p-2.5 bg-slate-700 rounded-lg shadow-inner border border-slate-600/50 flex items-center justify-center">
                <div className={`w-4 h-4 rounded-full ${wrenchStatus ? 'bg-green-400' : 'bg-red-400'}`}></div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Start New Session</h2>
              <p className="text-sm text-slate-500 mt-1">Please fill in the session details below.</p>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleStartSession}>
                {formError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                    {formError}
                  </div>
                )}
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">SESSION NAME</label>
                    <input 
                      type="text" 
                      required
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="e.g., Session-001"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">NAME</label>
                    <input 
                      type="text" 
                      required
                      value={workerName}
                      onChange={(e) => setWorkerName(e.target.value)}
                      placeholder="Worker name"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">ID</label>
                    <input 
                      type="text" 
                      required
                      value={workerId}
                      onChange={(e) => setWorkerId(e.target.value)}
                      placeholder="Worker ID number"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">GROUP <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <input 
                      type="text" 
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Group / Department"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Starting...' : 'Start'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Stop Session Modal */}
      {isStopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-5 border-b border-slate-100 bg-red-50/50">
              <h2 className="text-xl font-bold text-red-600">Stop Session?</h2>
            </div>
            
            <div className="p-6">
              <p className="text-slate-600 mb-6 text-sm">
                Are you sure you want to stop the current recording session? The recorded data will be saved.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setIsStopModalOpen(false)}
                  className="px-5 py-2.5 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleStopSession}
                  className="px-6 py-2.5 font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all shadow-md shadow-red-500/20 active:scale-95"
                >
                  Stop Recording
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
