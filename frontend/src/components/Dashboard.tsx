import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Activity, 
  Clock, 
  RotateCcw, 
  Play, 
  Square,
  Wrench
} from 'lucide-react';

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

  // Ergonomic state
  const [overallStatus, setOverallStatus] = useState<'Neutral Pose' | 'Working Pose' | 'Bad Pose'>('Neutral Pose');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [activeCameraView, setActiveCameraView] = useState<'perspective' | 'front' | 'side'>('perspective');
  const [showCharacter, setShowCharacter] = useState<boolean>(true);
  const [showSensors, setShowSensors] = useState<boolean>(true);
  const [tareFeedback, setTareFeedback] = useState<string | null>(null);

  // Sensor state for UI
  const [sensorValues, setSensorValues] = useState<Record<string, { pitch: number; status: string }>>({
    A: { pitch: 0, status: 'Neutral Pose' },
    B: { pitch: 0, status: 'Neutral Pose' },
    C: { pitch: 0, status: 'Neutral Pose' },
    D: { pitch: 0, status: 'Neutral Pose' },
    E: { pitch: 0, status: 'Neutral Pose' },
    F: { pitch: 0, status: 'Neutral Pose' },
  });

  // Stopwatch timer for active session
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isSessionActive]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!socket) return;

    const topicToInternalId: Record<string, string> = {
      'UMJ/EV/S1': 'A', // Neck
      'UMJ/EV/S2': 'B', // Right Arm
      'UMJ/EV/S3': 'C', // Left Arm
      'UMJ/EV/S4': 'D', // Upper Back
      'UMJ/EV/S5': 'E', // Mid Back
      'UMJ/EV/S6': 'F'  // Pelvis
    };

    const bonesMap: Record<string, string> = {
      'F': 'pelvis',
      'E': 'spine2',
      'D': 'chest',
      'A': 'neck',
      'C': 'rShoulder',
      'B': 'lShoulder'
    };

    const spinePitch: Record<string, number> = {
      A: -90, D: -90, E: -90, F: -90
    };

    const updateSpineBones = () => {
      if (!(window as any).boneTargets) return;
      const t = (window as any).boneTargets;

      const bowF = spinePitch.F + 90;
      const bowE = spinePitch.E + 90;
      const bowD = spinePitch.D + 90;
      const bowA = spinePitch.A + 90;

      const toRad = (deg: number) => deg * (Math.PI / 180);
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

      const pitchVal = data.pitch !== undefined ? data.pitch : 0;
      const statusVal = data.status || 'Neutral Pose';

      setSensorValues(prev => {
        const next = { ...prev, [sid]: { pitch: pitchVal, status: statusVal } };
        const statuses = Object.values(next).map(v => v.status);
        if (statuses.includes('Bad Pose')) {
          setOverallStatus('Bad Pose');
        } else if (statuses.includes('Working Pose')) {
          setOverallStatus('Working Pose');
        } else {
          setOverallStatus('Neutral Pose');
        }
        return next;
      });

      // Synchronize DOM elements if present
      const uiLabel = document.getElementById(`val-${sid}`);
      const uiStatus = document.getElementById(`status-${sid}`);
      if (uiLabel) uiLabel.innerHTML = `${pitchVal.toFixed(1)}&deg;`;
      if (uiStatus) uiStatus.innerText = statusVal;

      if ((window as any).updateBoneStatus) {
        (window as any).updateBoneStatus(bonesMap[sid], statusVal);
      }

      if (sid === 'B' || sid === 'C') {
        if ((window as any).boneTargets) {
          const boneName = bonesMap[sid];
          const t = (window as any).boneTargets[boneName];
          if (t) {
            const bowArm = pitchVal;
            const bowChest = spinePitch.D !== undefined ? spinePitch.D + 90 : 0;
            t.x = (bowArm - bowChest) * (Math.PI / 180);
            t.z = 0;
          }
        }
      } else {
        spinePitch[sid] = pitchVal;
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

  // Camera preset handlers
  const handleCameraChange = (view: 'perspective' | 'front' | 'side') => {
    setActiveCameraView(view);
    if (window.setCameraView) {
      window.setCameraView(view);
    }
  };

  // Toggle Character Mesh
  const handleToggleCharacter = () => {
    const next = !showCharacter;
    setShowCharacter(next);
    if (window.toggleCharacter) {
      window.toggleCharacter(next);
    }
  };

  // Toggle Sensor Nodes
  const handleToggleSensors = () => {
    const next = !showSensors;
    setShowSensors(next);
    if (window.toggleSensors) {
      window.toggleSensors(next);
    }
  };

  // Quick Tare Zero Handler
  const handleTare = () => {
    if (socket) {
      socket.emit('tare_request', { timestamp: new Date().toISOString() });
    }
    setTareFeedback('Zero Reference Set (0°)');
    setTimeout(() => setTareFeedback(null), 3000);
  };

  // Sensor definitions in concise English
  const sensorsList = [
    { id: 'A', code: 'S1', label: 'Neck' },
    { id: 'B', code: 'S2', label: 'Right Arm' },
    { id: 'C', code: 'S3', label: 'Left Arm' },
    { id: 'D', code: 'S4', label: 'Upper Back' },
    { id: 'E', code: 'S5', label: 'Mid Back' },
    { id: 'F', code: 'S6', label: 'Pelvis' },
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full min-h-0">

      {/* ======================================================= */}
      {/* 1. SLIM COMPACT STATUS TOOLBAR                           */}
      {/* ======================================================= */}
      <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Overall Posture Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Posture:</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded border uppercase ${
            overallStatus === 'Bad Pose' 
              ? 'bg-red-50 text-red-700 border-red-200' 
              : overallStatus === 'Working Pose'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {overallStatus}
          </span>
        </div>

        {/* Right: Stopwatch + Tare Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono font-bold bg-slate-50 px-2 py-1 rounded border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{isSessionActive ? formatTimer(elapsedSeconds) : '00:00'}</span>
            <span className={`text-[10px] uppercase font-bold ml-1 ${
              isSessionActive ? 'text-blue-600 animate-pulse' : 'text-slate-400'
            }`}>
              {isSessionActive ? 'REC' : 'IDLE'}
            </span>
          </div>

          <button
            onClick={handleTare}
            title="Set current posture as upright baseline (0°)"
            className="px-2.5 py-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded transition-colors flex items-center gap-1 active:scale-95"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            {tareFeedback ? <span className="text-emerald-600 font-bold">{tareFeedback}</span> : 'Tare 0°'}
          </button>
        </div>

      </div>

      {/* ======================================================= */}
      {/* 2. MAIN WORKSPACE (3D VIEWPORT & TELEMETRY PANEL)        */}
      {/* ======================================================= */}
      <div className="flex flex-col lg:flex-row gap-2.5 flex-1 min-h-0">

        {/* LEFT: 3D Biomechanics Viewport */}
        <div className="flex-1 min-h-[340px] lg:min-h-0 bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden">
          
          {/* Viewport Top Bar */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">3D Biomechanics Model</span>
            </div>

            {/* Camera View Presets */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCameraChange('side')}
                className={`px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
                  activeCameraView === 'side'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Side View
              </button>
              <button
                onClick={() => handleCameraChange('front')}
                className={`px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
                  activeCameraView === 'front'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Front View
              </button>
              <button
                onClick={() => handleCameraChange('perspective')}
                className={`px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
                  activeCameraView === 'perspective'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                3D Iso
              </button>
            </div>
          </div>

          {/* 3D Canvas Box */}
          <div className="relative flex-1 min-h-[280px] w-full bg-slate-50">
            <ThreeModel />

            {/* Floating Toggles (Bottom Left) */}
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 bg-white/95 px-2 py-1 rounded border border-slate-200 text-xs shadow-xs">
              <button
                onClick={handleToggleCharacter}
                className={`px-2 py-0.5 rounded font-medium text-xs transition-colors ${
                  showCharacter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                Mesh
              </button>
              <button
                onClick={handleToggleSensors}
                className={`px-2 py-0.5 rounded font-medium text-xs transition-colors ${
                  showSensors ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                Sensors
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT: Controls & Telemetry Column */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-2.5 shrink-0">

          {/* Action CTA Button */}
          {!isSessionActive ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-2 active:scale-98"
            >
              <Play className="w-4 h-4 fill-current" />
              START SESSION
            </button>
          ) : (
            <button
              onClick={() => setIsStopModalOpen(true)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-2 active:scale-98"
            >
              <Square className="w-4 h-4 fill-current" />
              STOP SESSION
            </button>
          )}

          {/* Sensor Values Card */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Angle Values (Pitch)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Relative to Upright</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {sensorsList.map(s => {
                const data = sensorValues[s.id] || { pitch: 0, status: 'Neutral Pose' };
                const isBad = data.status === 'Bad Pose';
                const isWorking = data.status === 'Working Pose';

                return (
                  <div
                    key={s.id}
                    id={`card-${s.id}`}
                    className={`p-2 rounded border text-center flex flex-col justify-between transition-colors ${
                      isBad
                        ? 'bg-red-50 border-red-200'
                        : isWorking
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {s.code} ({s.label})
                    </span>

                    <span 
                      id={`val-${s.id}`} 
                      className="text-lg font-black text-slate-800 my-0.5"
                    >
                      {data.pitch !== undefined ? `${data.pitch.toFixed(1)}°` : '--°'}
                    </span>

                    <span
                      id={`status-${s.id}`}
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isBad
                          ? 'bg-red-600 text-white'
                          : isWorking
                          ? 'bg-amber-500 text-white'
                          : 'text-slate-400 bg-slate-200/60'
                      }`}
                    >
                      {data.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Impact Wrench Telemetry Widget */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-500" />
                Impact Wrench
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Tool Telemetry</span>
            </div>

            <div className="p-2.5 rounded bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Tool Status
                </span>
                <span className={`text-lg font-black tracking-wider ${wrenchStatus ? 'text-green-400' : 'text-slate-400'}`}>
                  {wrenchStatus ? 'ACTIVE (ON)' : 'OFF'}
                </span>
              </div>
              <div className={`w-3.5 h-3.5 rounded-full ${
                wrenchStatus ? 'bg-green-400' : 'bg-red-500'
              }`} />
            </div>
          </div>

        </div>

      </div>

      {/* Modals */}
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
