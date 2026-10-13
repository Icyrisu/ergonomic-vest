import numpy as np
from typing import List, Dict, Any

class FeatureExtractor:
    """
    Ekstraksi fitur time-series dari sliding window data rompi ergonomis.
    Mendukung sensor pitch S1 s/d S6 dan status Impact Wrench (0/1).
    """

    FEATURE_NAMES = [
        # Mean per sensor
        "s1_mean", "s2_mean", "s3_mean", "s4_mean", "s5_mean", "s6_mean",
        # Std dev per sensor
        "s1_std", "s2_std", "s3_std", "s4_std", "s5_std", "s6_std",
        # Range (Max - Min)
        "s1_range", "s2_range", "s3_range", "s4_range", "s5_range", "s6_range",
        # Root Mean Square (RMS)
        "s4_rms", "s5_rms",
        # Kinematic Jerk (Mean absolute diff)
        "s4_jerk", "s5_jerk",
        # Contextual tool feature
        "wrench_ratio"
    ]

    @staticmethod
    def extract_from_window(window_samples: List[Dict[str, Any]]) -> np.ndarray:
        """
        Mengekstrak array 1D fitur statistik dari list sampel dalam sliding window (misal 10-20 sampel = 1-2 detik).
        Sample format:
        {
            "wrench": True/False atau "ON"/"OFF",
            "s1": float, "s2": float, "s3": float,
            "s4": float, "s5": float, "s6": float
        }
        """
        if not window_samples:
            return np.zeros(len(FeatureExtractor.FEATURE_NAMES))

        # Default values jika sensor tertentu belum dipasang (-90 untuk spine/neck, 0 untuk arm)
        s1 = [float(s.get("s1", -90.0) if s.get("s1") is not None else -90.0) for s in window_samples]
        s2 = [float(s.get("s2", 0.0) if s.get("s2") is not None else 0.0) for s in window_samples]
        s3 = [float(s.get("s3", 0.0) if s.get("s3") is not None else 0.0) for s in window_samples]
        s4 = [float(s.get("s4", -90.0) if s.get("s4") is not None else -90.0) for s in window_samples]
        s5 = [float(s.get("s5", -90.0) if s.get("s5") is not None else -90.0) for s in window_samples]
        s6 = [float(s.get("s6", -90.0) if s.get("s6") is not None else -90.0) for s in window_samples]

        wrenches = [1.0 if s.get("wrench") in [True, 1, "ON", "ONLINE"] else 0.0 for s in window_samples]

        def stats(arr):
            a = np.array(arr, dtype=float)
            return float(np.mean(a)), float(np.std(a)), float(np.ptp(a))

        s1_mean, s1_std, s1_rng = stats(s1)
        s2_mean, s2_std, s2_rng = stats(s2)
        s3_mean, s3_std, s3_rng = stats(s3)
        s4_mean, s4_std, s4_rng = stats(s4)
        s5_mean, s5_std, s5_rng = stats(s5)
        s6_mean, s6_std, s6_rng = stats(s6)

        # RMS
        s4_rms = float(np.sqrt(np.mean(np.square(s4))))
        s5_rms = float(np.sqrt(np.mean(np.square(s5))))

        # Jerk / Delta rate (Mean absolute difference between consecutive points)
        s4_jerk = float(np.mean(np.abs(np.diff(s4)))) if len(s4) > 1 else 0.0
        s5_jerk = float(np.mean(np.abs(np.diff(s5)))) if len(s5) > 1 else 0.0

        wrench_ratio = float(np.mean(wrenches))

        features = [
            s1_mean, s2_mean, s3_mean, s4_mean, s5_mean, s6_mean,
            s1_std, s2_std, s3_std, s4_std, s5_std, s6_std,
            s1_range, s2_range, s3_range, s4_range, s5_range, s6_range,
            s4_rms, s5_rms,
            s4_jerk, s5_jerk,
            wrench_ratio
        ]

        return np.array(features, dtype=float)
