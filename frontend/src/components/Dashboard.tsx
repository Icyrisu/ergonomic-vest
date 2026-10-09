import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

import ThreeModel from './ThreeModel';
import StartSessionModal from './dashboard/StartSessionModal';
import StopSessionModal from './dashboard/StopSessionModal';

interface DashboardProps {
  socket: Socket | null;
}

export default function Dashboard({ socket }: DashboardProps) {
  const [wrenchStatus, setWrenchStatus] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState<boolean>(false);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);



  useEffect(() => {
    if (!socket) return;

    // MQTT Topic to internal ID mapping
    const topicToInternalId: Record<string, string> = {
      'UMJ/EV/S1': 'A', // Neck
      'UMJ/EV/S2': 'B', // Right Arm
      'UMJ/EV/S3': 'C', // Left Arm
      'UMJ/EV/S4': 'D', // Chest (Punggung)
      'UMJ/EV/S5': 'E', // Low Back (Pinggang)
      'UMJ/EV/S6': 'F'  // Pelvis (Bokong)
    };

    const bonesMap: Record<string, string> = {
      'F': 'pelvis',
      'E': 'spine2',
      'D': 'chest',
      'A': 'neck',
      'C': 'rShoulder',
      'B': 'lShoulder'
    };

    // Store latest pitch per spine sensor (absolute bow angle)
    const spinePitch: Record<string, number> = {
      A: -90, D: -90, E: -90, F: -90   // default: upright
    };

    const updateSpineBones = () => {
      if (!(window as any).boneTargets) return;
      const t = (window as any).boneTargets;

      const bowF = spinePitch.F + 90;  // pelvis
      const bowE = spinePitch.E + 90;  // mid back
      const bowD = spinePitch.D + 90;  // chest
      const bowA = spinePitch.A + 90;  // neck

      const toRad = (deg: number) => deg * (Math.PI / 180);

      // Distribute the bend from Pelvis to Waist evenly across spine1 and spine2
      const diffFtoE = toRad(bowE - bowF);
      if (t.pelvis) t.pelvis.x = toRad(bowF);
      if (t.spine1) t.spine1.x = diffFtoE / 2;
      if (t.spine2) t.spine2.x = diffFtoE / 2;
      
      if (t.chest)  t.chest.x  = toRad(bowD - bowE);
      if (t.neck)   t.neck.x   = toRad(bowA - bowD);
    };

    const handleSensorData = (data: any) => {
      const sid = topicToInternalId[data.topic];
      if (!sid) return;

      const uiLabel = document.getElementById(`val-${sid}`);
      const uiCard = document.getElementById(`card-${sid}`);
      const uiStatus = document.getElementById(`status-${sid}`);
      
      if (uiLabel) {
        uiLabel.innerHTML = `${data.pitch.toFixed(1)}&deg;`;
      }
      
      if (uiCard) {
        let bgClass = 'bg-slate-50 border-slate-100';
        if (data.status === 'Bad Pose') bgClass = 'bg-red-50 border-red-200';
        else if (data.status === 'Working Pose') bgClass = 'bg-yellow-50 border-yellow-200';
        else if (data.status === 'Neutral Pose') bgClass = 'bg-green-50 border-green-200';
        
        uiCard.className = `py-2 px-2 lg:py-1 rounded-xl border text-center flex flex-col justify-center transition-colors ${bgClass}`;
      }

      if (uiStatus) {
        uiStatus.innerText = data.status || '-';
        if (data.status === 'Bad Pose') uiStatus.className = 'text-xs font-bold text-red-600 uppercase tracking-wider';
        else if (data.status === 'Working Pose') uiStatus.className = 'text-xs font-bold text-yellow-600 uppercase tracking-wider';
        else if (data.status === 'Neutral Pose') uiStatus.className = 'text-xs font-bold text-green-600 uppercase tracking-wider';
        else uiStatus.className = 'text-xs font-bold text-slate-400 uppercase tracking-wider';
      }
      
      if ((window as any).updateBoneStatus) {
         (window as any).updateBoneStatus(bonesMap[sid], data.status);
      }

      if (sid === 'B' || sid === 'C') {
        if ((window as any).boneTargets) {
          const boneName = bonesMap[sid]; 
          const t = (window as any).boneTargets[boneName];
          if (t) {
            const bowArm = data.pitch;
            const bowChest = spinePitch.D !== undefined ? spinePitch.D + 90 : 0;
            t.x = (bowArm - bowChest) * (Math.PI / 180);
            t.z = 0;
          }
        }
      } else {
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

    const handleSessionStatus = (isActive: boolean) => {
      setIsSessionActive(isActive);
    };

    socket.on('sensor_data', handleSensorData);
    socket.on('wrench_status', handleWrenchStatus);
    socket.on('session_status', handleSessionStatus);

    socket.emit('request_session_status');

    return () => {
      socket.off('sensor_data', handleSensorData);
      socket.off('wrench_status', handleWrenchStatus);
      socket.off('session_status', handleSessionStatus);
    };
  }, [socket]);

  return (
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

        <div className="relative h-[300px] sm:h-[380px] lg:flex-1 lg:min-h-0 bg-white rounded-xl overflow-hidden border border-slate-200">
          <ThreeModel />
        </div>
      </div>

      {/* Controls Section */}
      <div className="lg:flex-1 min-w-0 flex flex-col bg-white p-4 rounded-2xl shadow-sm border border-slate-200 lg:min-h-0 lg:overflow-hidden">
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

          {/* Angle Values */}
          <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0 lg:gap-1.5">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Angle Values</h3>

            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 lg:gap-1.5 lg:flex-1 lg:auto-rows-fr">
              {[
                {id: 'A', label: 'S1 (Neck)'},
                {id: 'B', label: 'S2 (Right Arm)'},
                {id: 'C', label: 'S3 (Left Arm)'},
                {id: 'D', label: 'S4 (Upper Back)'},
                {id: 'E', label: 'S5 (Mid Back)'},
                {id: 'F', label: 'S6 (Pelvis)'}
              ].map(s => (
                <div key={s.id} id={`card-${s.id}`} className="bg-slate-50 py-2 px-2 lg:py-1 rounded-xl border border-slate-100 text-center flex flex-col justify-center transition-colors">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                  <p id={`val-${s.id}`} className="text-base font-extrabold text-slate-800 my-0.5">--&deg;</p>
                  <p id={`status-${s.id}`} className="text-xs font-bold text-slate-400 uppercase tracking-wider">-</p>
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
                <p className={`text-3xl font-bold leading-tight ${wrenchStatus ? 'text-green-400' : 'text-red-400'}`}>
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

      <StartSessionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => setIsModalOpen(false)} 
      />
      
      <StopSessionModal 
        isOpen={isStopModalOpen} 
        onClose={() => setIsStopModalOpen(false)} 
        onSuccess={() => setIsStopModalOpen(false)} 
      />
    </div>
  );
}
