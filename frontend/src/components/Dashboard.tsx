import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import ThreeModel from './ThreeModel';

interface DashboardProps {
  socket: Socket | null;
}

export default function Dashboard({ socket }: DashboardProps) {
  const [wrenchStatus, setWrenchStatus] = useState<boolean>(false);

  // We can track individual sensor data if needed, but three-setup handles the 3D model directly
  // We'll just manage the Socket connection here

  useEffect(() => {
    if (!socket) return;

    // MQTT Topic to Internal ID mapping
    const topicToInternalId: Record<string, string> = {
      'UMJ/EV/S1': 's2',
      'UMJ/EV/S2': 's3',
      'UMJ/EV/S3': 's5',
      'UMJ/EV/S4': 's7',
      'UMJ/EV/S5': 's8',
      'UMJ/EV/S6': 's9'
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
        uiLabel.innerHTML = `P:${data.pitch.toFixed(1)}&deg; R:${data.roll.toFixed(1)}&deg;`;
      }

      if (sid === 's2' || sid === 's3') {
        // Shoulders: write to boneTargets for lerp smoothing
        if (window.boneTargets) {
          const boneName = bonesMap[sid]; // 'lShoulder' or 'rShoulder'
          const t = window.boneTargets[boneName];
          if (t) {
            t.x = -data.pitch * (Math.PI / 180);
            t.z = -data.roll  * (Math.PI / 180);
          }
        }
      } else {
        // Spine sensors: store pitch then recalculate differential targets
        spinePitch[sid] = data.pitch;
        updateSpineBones();
      }
    };

    const handleWrenchStatus = (isOn: boolean) => {
      setWrenchStatus(isOn);
      if (window.updateWrenchState) {
        window.updateWrenchState(isOn);
      }
    };

    socket.on('sensor_data', handleSensorData);
    socket.on('wrench_status', handleWrenchStatus);

    return () => {
      socket.off('sensor_data', handleSensorData);
      socket.off('wrench_status', handleWrenchStatus);
    };
  }, [socket]);

  const turnWrenchOn = () => {
    if (socket) socket.emit('wrench_control', { value: 'ON' });
  };

  const turnWrenchOff = () => {
    if (socket) socket.emit('wrench_control', { value: 'OFF' });
  };

  return (
    /* Mobile: normal flow (parent scrolls). Desktop lg+: fixed height flex-row */
    <div className="flex flex-col lg:flex-row gap-3 md:gap-4 lg:h-full lg:min-h-0">
      
      {/* 3D Model Section */}
      <div className="lg:flex-[2] min-w-0 flex flex-col bg-white p-4 rounded-2xl shadow-sm border border-slate-200 lg:min-h-0">
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
      <div className="lg:flex-1 min-w-0 flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
        
        {/* Real-time Angles */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 shrink-0">
          <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Angle Values</h3>
          
          <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl mb-3 shadow-md">
            <div>
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-0.5">Total Curve Angle</p>
              <p id="val-curve" className="text-2xl font-bold text-green-400">0.00°</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[{id: 's2', label: 'Left Arm'}, {id: 's3', label: 'Right Arm'}, {id: 's5', label: 'Chest'}, {id: 's7', label: 'Mid Back'}, {id: 's8', label: 'Low Back'}, {id: 's9', label: 'Pelvis'}].map(s => (
              <div key={s.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{s.label}</p>
                <p id={`val-${s.id}`} className="text-xs font-mono font-bold text-slate-800 tracking-tight">--</p>
              </div>
            ))}
          </div>
        </div>

        {/* Impact Wrench Control */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 shrink-0">
          <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Impact Wrench</h3>
          
          <div className="flex flex-col justify-center items-center gap-4 py-2">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg transition-colors duration-300 ${wrenchStatus ? 'bg-green-500 shadow-green-500/40' : 'bg-red-500 shadow-red-500/40'}`}>
              {wrenchStatus ? 'ON' : 'OFF'}
            </div>
            
            <div className="flex gap-3 w-full">
              <button onClick={turnWrenchOn} className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-md active:scale-95">
                ON
              </button>
              <button onClick={turnWrenchOff} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-md active:scale-95">
                OFF
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
