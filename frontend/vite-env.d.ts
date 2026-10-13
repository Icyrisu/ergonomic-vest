/// <reference types="vite/client" />

interface Window {
  mannequinBones?: Record<string, import('three').Object3D>;
  updateWrenchState?: (isOn: boolean) => void;
  toggleSensors?: (visible: boolean) => void;
  toggleCharacter?: (visible: boolean) => void;
  setCameraView?: (view: 'front' | 'side' | 'perspective') => void;
  boneTargets?: Record<string, { x: number; z: number }>;
}
