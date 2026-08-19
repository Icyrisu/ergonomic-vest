import { useState } from 'react';
import { api } from '../../services/api';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StartSessionModal({ isOpen, onClose, onSuccess }: StartSessionModalProps) {
  const [sessionName, setSessionName] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [formError, setFormError] = useState('');
  const [tolerance, setTolerance] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultPoses: Record<string, number[]> = {
    'UMJ/EV/S1': [0, 10],
    'UMJ/EV/S2': [-20, 20],
    'UMJ/EV/S3': [-20, 20],
    'UMJ/EV/S4': [0, 20],
    'UMJ/EV/S5': [-10, 10],
    'UMJ/EV/S6': [-10, 10],
  };

  const [useDefault, setUseDefault] = useState(true);
  const [neutralPoses, setNeutralPoses] = useState(defaultPoses);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    
    try {
      const payloadPoses: any = { ...(useDefault ? defaultPoses : neutralPoses) };
      payloadPoses.tolerance = tolerance;
      
      await api.startSession({
        session_name: sessionName,
        name: workerName,
        id: workerId,
        group: groupName,
        neutralPoses: payloadPoses
      });
      
      setSessionName('');
      setWorkerName('');
      setWorkerId('');
      setGroupName('');
      onSuccess();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Start New Session</h2>
          <p className="text-sm text-slate-500 mt-1">Please fill in the session details below.</p>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSubmit}>
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

            <div className="mb-6 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-bold text-slate-800">Neutral Pose Angles</label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 select-none">
                  <input type="checkbox" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Use Default
                </label>
              </div>
              
              <div className="flex flex-col gap-4">
                {[
                  { id: 'UMJ/EV/S1', label: 'Neck (S1)' },
                  { id: 'UMJ/EV/S4', label: 'Upper Back (S4)' },
                  { id: 'UMJ/EV/S5', label: 'Waist (S5)' },
                  { id: 'UMJ/EV/S6', label: 'Pelvis (S6)' }
                ].map((sensor) => (
                  <div key={sensor.id} className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500 mb-1">{sensor.label}</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        disabled={useDefault}
                        value={useDefault ? defaultPoses[sensor.id][0] : neutralPoses[sensor.id][0]}
                        onChange={(e) => setNeutralPoses({...neutralPoses, [sensor.id]: [Number(e.target.value), neutralPoses[sensor.id][1]]})}
                        className="w-full px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-md disabled:bg-slate-100 disabled:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                      />
                      <span className="text-slate-400 font-bold">-</span>
                      <input 
                        type="number" 
                        disabled={useDefault}
                        value={useDefault ? defaultPoses[sensor.id][1] : neutralPoses[sensor.id][1]}
                        onChange={(e) => setNeutralPoses({...neutralPoses, [sensor.id]: [neutralPoses[sensor.id][0], Number(e.target.value)]})}
                        className="w-full px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-md disabled:bg-slate-100 disabled:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col mt-4">
                <label className="text-sm font-semibold text-slate-700 mb-1">
                  Tolerance Pose (Degrees)
                </label>
                <input 
                  type="number"
                  value={tolerance}
                  onChange={(e) => setTolerance(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-md disabled:bg-slate-100 disabled:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                  disabled={useDefault}
                />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button" 
                onClick={onClose}
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
  );
}
