import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  RotateCcw, 
  Clock, 
  Eye, 
  Wrench, 
  AlertCircle,
  Play,
  Square,
  Sparkles,
  Compass
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

  // Health-Tech Metrics State
  const [overallPostureRisk, setOverallPostureRisk] = useState<'SAFE' | 'WARNING' | 'DANGER'>('SAFE');
  const [spineHealthScore, setSpineHealthScore] = useState<number>(100);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [activeCameraView, setActiveCameraView] = useState<'perspective' | 'front' | 'side'>('perspective');
  const [showCharacter, setShowCharacter] = useState<boolean>(true);
  const [showSensors, setShowSensors] = useState<boolean>(true);
  const [tareNotice, setTareNotice] = useState<string | null>(null);

  // Sensor angles state for UI display
  const [sensorValues, setSensorValues] = useState<Record<string, { pitch: number; status: string }>>({
    A: { pitch: 0, status: 'Neutral Pose' },
    B: { pitch: 0, status: 'Neutral Pose' },
    C: { pitch: 0, status: 'Neutral Pose' },
    D: { pitch: 0, status: 'Neutral Pose' },
    E: { pitch: 0, status: 'Neutral Pose' },
    F: { pitch: 0, status: 'Neutral Pose' },
  });

  // Active Session Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSessionActive) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isSessionActive]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

      const pitchVal = data.pitch !== undefined ? data.pitch : 0;
      const statusVal = data.status || 'Neutral Pose';

      setSensorValues(prev => {
        const next = { ...prev, [sid]: { pitch: pitchVal, status: statusVal } };
        
        // Calculate overall ergonomic risk & score
        const statuses = Object.values(next).map(v => v.status);
        if (statuses.includes('Bad Pose')) {
          setOverallPostureRisk('DANGER');
          setSpineHealthScore(48);
        } else if (statuses.includes('Working Pose')) {
          setOverallPostureRisk('WARNING');
          setSpineHealthScore(76);
        } else {
          setOverallPostureRisk('SAFE');
          setSpineHealthScore(98);
        }
        return next;
      });

      // Keep legacy DOM IDs synchronized for safety
      const uiLabel = document.getElementById(`val-${sid}`);
      const uiCard = document.getElementById(`card-${sid}`);
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

  // Camera presets
  const handleCameraChange = (view: 'perspective' | 'front' | 'side') => {
    setActiveCameraView(view);
    if (window.setCameraView) {
      window.setCameraView(view);
    }
  };

  // Toggle Character
  const handleToggleCharacter = () => {
    const next = !showCharacter;
    setShowCharacter(next);
    if (window.toggleCharacter) {
      window.toggleCharacter(next);
    }
  };

  // Toggle Sensors
  const handleToggleSensors = () => {
    const next = !showSensors;
    setShowSensors(next);
    if (window.toggleSensors) {
      window.toggleSensors(next);
    }
  };

  // Quick Tare / Zero Position Handler
  const handleQuickTare = () => {
    if (socket) {
      socket.emit('tare_request', { timestamp: new Date().toISOString() });
    }
    setTareNotice('Sudut dinolkan sebagai baseline berdiri tegak!');
    setTimeout(() => setTareNotice(null), 3500);
  };

  // Sensor definitions with clinical anatomical names
  const spineSensors = [
    { id: 'A', name: 'Leher (Cervical Spine)', node: 'S1', safeRange: '0° - 15°' },
    { id: 'D', name: 'Punggung Atas (Thoracic)', node: 'S4', safeRange: '0° - 20°' },
    { id: 'E', name: 'Pinggang (Lumbar Spine)', node: 'S5', safeRange: '0° - 20°' },
    { id: 'F', name: 'Panggul (Pelvic Tilt)', node: 'S6', safeRange: '0° - 15°' }
  ];

  const limbSensors = [
    { id: 'B', name: 'Bahu Kanan (Right Arm)', node: 'S2' },
    { id: 'C', name: 'Bahu Kiri (Left Arm)', node: 'S3' }
  ];

  return (
    <div className="flex flex-col gap-3 md:gap-4 h-full min-h-0 overflow-y-auto lg:overflow-hidden p-1">

      {/* ======================================================== */}
      {/* 1. HEALTH-TECH CLINICAL SUMMARY HEADER                   */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
        
        {/* Posture Risk Health Indicator */}
        <div className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between shadow-sm ${
          overallPostureRisk === 'SAFE' 
            ? 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-emerald-200' 
            : overallPostureRisk === 'WARNING'
            ? 'bg-gradient-to-br from-amber-50 via-yellow-50/50 to-white border-amber-200'
            : 'bg-gradient-to-br from-rose-50 via-red-50/50 to-white border-rose-200 shadow-rose-100'
        }`}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              Status Keselarasan Tulang
            </span>
            <div className="flex items-center gap-1.5">
              {overallPostureRisk === 'SAFE' && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-extrabold text-emerald-700 tracking-tight">Optimal • Neutral Pose</span>
                </>
              )}
              {overallPostureRisk === 'WARNING' && (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="text-sm font-extrabold text-amber-700 tracking-tight">Beban Sedang • Working Pose</span>
                </>
              )}
              {overallPostureRisk === 'DANGER' && (
                <>
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
                  <span className="text-sm font-extrabold text-rose-700 tracking-tight">Risiko Bahaya • Bad Pose</span>
                </>
              )}
            </div>
          </div>
          <span className={`w-3 h-3 rounded-full ${
            overallPostureRisk === 'SAFE' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' :
            overallPostureRisk === 'WARNING' ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' :
            'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-ping'
          }`} />
        </div>

        {/* Spine Health Index Score */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              Spine Health Index
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black ${
                spineHealthScore >= 85 ? 'text-emerald-600' :
                spineHealthScore >= 65 ? 'text-amber-600' :
                'text-rose-600'
              }`}>
                {spineHealthScore}
              </span>
              <span className="text-xs font-semibold text-slate-400">/ 100</span>
              <span className={`text-[11px] font-bold ml-1.5 px-2 py-0.5 rounded-full ${
                spineHealthScore >= 85 ? 'bg-emerald-100 text-emerald-800' :
                spineHealthScore >= 65 ? 'bg-amber-100 text-amber-800' :
                'bg-rose-100 text-rose-800'
              }`}>
                {spineHealthScore >= 85 ? 'Grade A' : spineHealthScore >= 65 ? 'Grade B' : 'Grade C (Risk)'}
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Active Session Stopwatch */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              Durasi Sesi Monitoring
            </span>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xl font-extrabold ${isSessionActive ? 'text-blue-600' : 'text-slate-400'}`}>
                {isSessionActive ? formatTimer(elapsedSeconds) : '00:00'}
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                isSessionActive ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-slate-100 text-slate-500'
              }`}>
                {isSessionActive ? 'RECORDING' : 'STANDBY'}
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Quick Tare Action Button */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              Kalibrasi Postur
            </span>
            <p className="text-xs text-slate-500 truncate">
              {tareNotice ? (
                <span className="text-emerald-600 font-bold">{tareNotice}</span>
              ) : (
                'Setel postur berdiri = 0°'
              )}
            </p>
          </div>
          <button 
            onClick={handleQuickTare}
            title="Klik saat pekerja berdiri tegak lurus sempurna"
            className="px-3 py-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 hover:border-blue-200 shrink-0 active:scale-95 shadow-sm"
          >
            <Compass className="w-4 h-4 text-blue-500" />
            Tare 0°
          </button>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE: 3D BIOMECHANICS & TELEMETRY MATRIX    */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-4 flex-1 min-h-0">

        {/* LEFT / CENTER: 3D Biomechanics Arena */}
        <div className="lg:flex-[1.65] min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[360px] lg:min-h-0">
          
          {/* 3D Viewport Clinical Header */}
          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <h2 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase">
                3D Biomechanical Mannequin
              </h2>
              <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                Live 60 FPS
              </span>
            </div>

            {/* Camera View Angle Presets */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              <button
                onClick={() => handleCameraChange('side')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeCameraView === 'side' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Lihat kelengkungan tulang belakang dari samping (Sagittal Plane)"
              >
                Side View
              </button>
              <button
                onClick={() => handleCameraChange('front')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeCameraView === 'front' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Lihat tampak depan (Coronal Plane)"
              >
                Front View
              </button>
              <button
                onClick={() => handleCameraChange('perspective')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeCameraView === 'perspective' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Tampilan 3D Isometrik"
              >
                3D Iso
              </button>
            </div>
          </div>

          {/* 3D Canvas Box */}
          <div className="relative flex-1 min-h-[300px] w-full bg-gradient-to-b from-slate-50 to-white">
            <ThreeModel />

            {/* Floating Visual Toggles (Bottom-Left HUD) */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-md">
              <button
                onClick={handleToggleCharacter}
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
                  showCharacter ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Mesh
              </button>
              <button
                onClick={handleToggleSensors}
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
                  showSensors ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Sensors
              </button>
            </div>

            {/* Quick Helper Badge (Bottom-Right HUD) */}
            <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-1 text-[10px] text-slate-400 bg-white/80 backdrop-blur-xs px-2 py-1 rounded-md border border-slate-200">
              Drag mouse to rotate • Scroll to zoom
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Anatomical Spine Telemetry & Tool Load */}
        <div className="lg:flex-[1] min-w-0 flex flex-col gap-3">

          {/* CTA Action Hero Button */}
          {!isSessionActive ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black tracking-wide text-sm shadow-lg shadow-blue-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2 group shrink-0"
            >
              <Play className="w-4 h-4 fill-current group-hover:translate-x-0.5 transition-transform" />
              MULAI SESI MONITORING (START)
            </button>
          ) : (
            <button
              onClick={() => setIsStopModalOpen(true)}
              className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-2xl font-black tracking-wide text-sm shadow-lg shadow-rose-500/30 transition-all transform active:scale-98 flex items-center justify-center gap-2 animate-pulse shrink-0"
            >
              <Square className="w-4 h-4 fill-current" />
              HENTIKAN SESI (STOP SESSION)
            </button>
          )}

          {/* Anatomical Spine Sensor Matrix Card */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Sudut Tulang Belakang (Spine Pitch)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Toleransi Dinamis</span>
            </div>

            {/* Grid of Anatomical Cards */}
            <div className="grid grid-cols-2 gap-2 flex-1 auto-rows-fr">
              {spineSensors.map(s => {
                const data = sensorValues[s.id] || { pitch: 0, status: 'Neutral Pose' };
                const isBad = data.status === 'Bad Pose';
                const isWorking = data.status === 'Working Pose';
                const isNeutral = data.status === 'Neutral Pose';

                return (
                  <div
                    key={s.id}
                    id={`card-${s.id}`}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all duration-300 ${
                      isBad 
                        ? 'bg-rose-50/80 border-rose-200 text-rose-900 shadow-xs' 
                        : isWorking 
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900 shadow-xs' 
                        : isNeutral 
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' 
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {/* Header: Node & Name */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                        {s.node}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 truncate">
                        {s.safeRange}
                      </span>
                    </div>

                    {/* Middle: Big Pitch Angle Value */}
                    <div className="text-center my-1">
                      <span 
                        id={`val-${s.id}`} 
                        className="text-2xl font-black tracking-tight"
                      >
                        {data.pitch !== undefined ? `${data.pitch.toFixed(1)}°` : '--°'}
                      </span>
                      <p className="text-[11px] font-bold text-slate-600 truncate mt-0.5">
                        {s.name}
                      </p>
                    </div>

                    {/* Footer: Status Pill */}
                    <div className="text-center">
                      <span 
                        id={`status-${s.id}`}
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                          isBad 
                            ? 'bg-rose-600 text-white shadow-xs' 
                            : isWorking 
                            ? 'bg-amber-500 text-white shadow-xs' 
                            : isNeutral 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {data.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Impact Wrench Industrial Telemetry Card */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-600" />
                Alat Berat (Impact Wrench Telemetry)
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Vibration & Ergonomic Load</span>
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-300 ${
              wrenchStatus 
                ? 'bg-gradient-to-r from-emerald-900 to-slate-900 border-emerald-500/40 text-white shadow-md' 
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  wrenchStatus 
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_#10b981]' 
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}>
                  <Wrench className={`w-5 h-5 ${wrenchStatus ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status Alat Saat Ini</p>
                  <p className={`text-xl font-black tracking-wider ${wrenchStatus ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {wrenchStatus ? 'TOOL ACTIVE (ON)' : 'STANDBY (OFF)'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                  wrenchStatus 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {wrenchStatus ? '+1 Load Risk' : '0 Load'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Start and Stop Modals */}
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
