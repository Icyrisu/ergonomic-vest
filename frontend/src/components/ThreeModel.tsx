import { useEffect, useRef } from 'react';
import { initThreeModel } from '../utils/three-setup';

export default function ThreeModel() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const cleanup = initThreeModel(containerRef.current);
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, []);

  return (
    <div 
      ref={containerRef} 
      id="three-container" 
      className="w-full h-full min-h-[400px] bg-slate-50 relative rounded-xl overflow-hidden"
    >
      {/* The canvas will be injected here by three-setup.js */}
    </div>
  );
}
