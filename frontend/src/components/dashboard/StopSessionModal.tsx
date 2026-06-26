import { useState } from 'react';
import { api } from '../../services/api';

interface StopSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StopSessionModal({ isOpen, onClose, onSuccess }: StopSessionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleStopSession = async () => {
    setIsSubmitting(true);
    try {
      await api.stopSession();
      onSuccess();
    } catch (err) {
      console.error('Failed to stop session', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleStopSession}
              disabled={isSubmitting}
              className="px-6 py-2.5 font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all shadow-md shadow-red-500/20 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Stopping...' : 'Stop Recording'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
