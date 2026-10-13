import os
import joblib
import numpy as np
from typing import Dict, Any, List, Tuple
from feature_extractor import FeatureExtractor

MODEL_PATH = os.path.join(os.path.dirname(__file__), "har_model.joblib")

# 3 Kelas Aktivitas Utama sesuai permintaan user:
# 1. Neutral (Tangan di samping, berdiri tegak / istirahat normal, tangan kosong)
# 2. Material Picking (Membungkuk mengambil part/kotak, memegang kardus)
# 3. Fastening with Tool (Memegang dan mengoperasikan bor/impact wrench)
ACTIVITY_CLASSES = [
    "Neutral",
    "Material Picking",
    "Fastening with Tool"
]

class ModelManager:
    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self):
        """Memuat model Random Forest jika file model tersedia di disk."""
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                print(f"[ML] Model Random Forest berhasil dimuat dari: {MODEL_PATH}")
            except Exception as e:
                print(f"[ML] Gagal memuat model, fallback ke baseline heuristik: {e}")
                self.model = None
        else:
            print("[ML] File har_model.joblib belum ada. Menggunakan Intelligent Baseline Heuristic.")
            self.model = None

    def predict(self, window_samples: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Melakukan prediksi aktivitas (3 kelas) dan evaluasi tingkat risiko ergonomi secara real-time (<2 ms).
        """
        if not window_samples:
            return {
                "activity": "Neutral",
                "confidence": 0.50,
                "model_type": "fallback",
                "risk_level": "Level 1 (Low)",
                "risk_score": 1.0,
                "holding_prop": "None (Hands Empty)"
            }

        # Ekstraksi fitur statistik 1D
        features = FeatureExtractor.extract_from_window(window_samples)

        # 1. Jika model Random Forest terlatih tersedia
        if self.model is not None:
            try:
                probs = self.model.predict_proba([features])[0]
                pred_idx = int(np.argmax(probs))
                activity = str(self.model.classes_[pred_idx])
                confidence = float(probs[pred_idx])

                risk_level, risk_score = self._evaluate_risk(activity, window_samples[-1])
                holding_prop = self._get_holding_prop(activity)

                return {
                    "activity": activity,
                    "confidence": round(confidence, 2),
                    "model_type": "random_forest_ml",
                    "risk_level": risk_level,
                    "risk_score": risk_score,
                    "holding_prop": holding_prop,
                    "features_summary": {
                        "s5_mean": round(float(features[4]), 2),
                        "wrench_ratio": round(float(features[-1]), 2)
                    }
                }
            except Exception as e:
                print(f"[ML] Error saat inferensi model ML: {e}. Menggunakan fallback.")

        # 2. Intelligent Heuristic Baseline (Bekerja langsung sebelum ada dataset terlatih)
        return self._heuristic_predict(features, window_samples)

    def _heuristic_predict(self, features: np.ndarray, window_samples: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Klasifikasi rule-based berbasis sudut fleksi tulang belakang dan status tool.
        """
        latest = window_samples[-1]
        wrenches = [1 if s.get("wrench") in [True, 1, "ON", "ONLINE"] else 0 for s in window_samples]
        wrench_ratio = sum(wrenches) / len(wrenches) if wrenches else 0.0

        # Ambil sudut lumbar/trunk (S4, S5, atau S6)
        # Sudut netral tegak sensor = -90 deg.
        # Saat membungkuk ke depan, sudut berubah dari -90 deg menjadi -60, -45, -30 deg.
        # Flexion angle = pitch + 90 (0 = tegak, 20+ = membungkuk)
        s4 = float(latest.get("s4", -90.0) if latest.get("s4") is not None else -90.0)
        s5 = float(latest.get("s5", -90.0) if latest.get("s5") is not None else -90.0)
        s6 = float(latest.get("s6", -90.0) if latest.get("s6") is not None else -90.0)

        trunk_pitch = s5 if s5 != -90.0 else (s4 if s4 != -90.0 else s6)
        trunk_flexion = trunk_pitch + 90.0

        if wrench_ratio > 0.35:
            activity = "Fastening with Tool"
            confidence = 0.95
        elif trunk_flexion >= 20.0:
            activity = "Material Picking"
            confidence = min(0.98, 0.75 + (trunk_flexion / 100.0))
        else:
            activity = "Neutral"
            confidence = 0.92

        risk_level, risk_score = self._evaluate_risk(activity, latest)
        holding_prop = self._get_holding_prop(activity)

        return {
            "activity": activity,
            "confidence": round(confidence, 2),
            "model_type": "intelligent_heuristic_baseline",
            "risk_level": risk_level,
            "risk_score": risk_score,
            "holding_prop": holding_prop,
            "features_summary": {
                "trunk_flexion_deg": round(float(trunk_flexion), 1),
                "wrench_ratio": round(float(wrench_ratio), 2)
            }
        }

    def _get_holding_prop(self, activity: str) -> str:
        if activity == "Fastening with Tool":
            return "Impact Wrench"
        elif activity == "Material Picking":
            return "Material Box"
        return "None (Hands Empty)"

    def _evaluate_risk(self, activity: str, latest_point: Dict[str, Any]) -> Tuple[str, float]:
        """Menghitung tingkat risiko ergonomi terpadu."""
        if activity == "Material Picking":
            return "Level 3 (High Risk)", 7.2
        elif activity == "Fastening with Tool":
            s5 = float(latest_point.get("s5", -90.0) if latest_point.get("s5") is not None else -90.0)
            if (s5 + 90.0) > 20.0:
                return "Level 4 (Very High Risk)", 8.5
            return "Level 2 (Medium Risk)", 4.0
        else:
            return "Level 1 (Low Risk)", 1.5
