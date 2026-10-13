import os
import glob
import argparse
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from feature_extractor import FeatureExtractor

MODEL_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "har_model.joblib")

def infer_label_from_filename_or_row(filename: str, row_label: str = None) -> str:
    """Mendeteksi label aktivitas dari nama file atau kolom Label."""
    if pd.notna(row_label) and str(row_label).strip() != "":
        lbl = str(row_label).strip().lower()
        if "fasten" in lbl or "tool" in lbl or "wrench" in lbl:
            return "Fastening with Tool"
        elif "pick" in lbl or "bend" in lbl:
            return "Material Picking"
        elif "neutral" in lbl or "stand" in lbl:
            return "Neutral"

    fn = filename.lower()
    if "fasten" in fn or "tool" in fn or "wrench" in fn:
        return "Fastening with Tool"
    elif "pick" in fn or "bend" in fn:
        return "Material Picking"
    return "Neutral"

def load_and_preprocess_dataset(csv_paths: list, window_size: int = 15, step_size: int = 5):
    """
    Membaca berkas CSV hasil ekspor dashboard dan membuat dataset sliding window.
    """
    all_features = []
    all_labels = []

    for path in csv_paths:
        if not os.path.exists(path):
            continue
        print(f"[DATA] Membaca file: {path}...")
        try:
            df = pd.read_csv(path)
        except Exception as e:
            print(f"[WARN] Gagal membaca {path}: {e}")
            continue

        # Normalisasi nama kolom dari hasil ekspor dashboard
        col_map = {}
        for c in df.columns:
            cl = c.lower()
            if "wrench" in cl:
                col_map[c] = "wrench"
            elif "neck" in cl or "s1" in cl:
                col_map[c] = "s1"
            elif "right shoulder" in cl or "r-arm" in cl or "s2" in cl:
                col_map[c] = "s2"
            elif "left shoulder" in cl or "l-arm" in cl or "s3" in cl:
                col_map[c] = "s3"
            elif "upper back" in cl or "s4" in cl:
                col_map[c] = "s4"
            elif "mid back" in cl or "s5" in cl:
                col_map[c] = "s5"
            elif "pelvis" in cl or "s6" in cl:
                col_map[c] = "s6"
            elif "label" in cl or "activity" in cl:
                col_map[c] = "label"

        df = df.rename(columns=col_map)

        # Ubah nilai ke list of dict
        records = []
        for _, row in df.iterrows():
            rec = {
                "wrench": str(row.get("wrench", "")).upper() in ["ON", "ONLINE", "1", "TRUE"],
                "s1": float(row.get("s1", -90.0)) if pd.notna(row.get("s1")) else -90.0,
                "s2": float(row.get("s2", 0.0)) if pd.notna(row.get("s2")) else 0.0,
                "s3": float(row.get("s3", 0.0)) if pd.notna(row.get("s3")) else 0.0,
                "s4": float(row.get("s4", -90.0)) if pd.notna(row.get("s4")) else -90.0,
                "s5": float(row.get("s5", -90.0)) if pd.notna(row.get("s5")) else -90.0,
                "s6": float(row.get("s6", -90.0)) if pd.notna(row.get("s6")) else -90.0,
            }
            records.append((rec, row.get("label", None)))

        # Slicing sliding window
        for i in range(0, len(records) - window_size + 1, step_size):
            window = [r[0] for r in records[i : i + window_size]]
            window_raw_label = records[i + window_size - 1][1]
            label = infer_label_from_filename_or_row(os.path.basename(path), window_raw_label)

            features = FeatureExtractor.extract_from_window(window)
            all_features.append(features)
            all_labels.append(label)

    return np.array(all_features), np.array(all_labels)

def train(data_dir: str = None, single_file: str = None):
    files = []
    if single_file:
        files = [single_file]
    elif data_dir:
        files = glob.glob(os.path.join(data_dir, "*.csv"))
    else:
        # Default scan folder datasets/ jika ada
        default_dir = os.path.join(os.path.dirname(__file__), "datasets")
        if os.path.exists(default_dir):
            files = glob.glob(os.path.join(default_dir, "*.csv"))

    if not files:
        print("[ERROR] Tidak ada berkas CSV yang ditemukan untuk pelatihan.")
        print("Penggunaan: python train_model.py --file path/to/session.csv atau --dir path/to/csv_folder/")
        return

    print(f"\n=======================================================")
    print(f"  PELATIHAN MODEL MACHINE LEARNING HAR (RANDOM FOREST) ")
    print(f"=======================================================")
    print(f"Jumlah berkas data: {len(files)}")

    X, y = load_and_preprocess_dataset(files)
    if len(X) < 10:
        print(f"[ERROR] Jumlah sampel ({len(X)}) terlalu sedikit untuk melatih model.")
        return

    print(f"Total sampel sliding-window: {len(X)}")
    print(f"Distribusi label:\n{pd.Series(y).value_counts()}")

    # Split train/test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y if len(pd.Series(y).unique()) > 1 else None)

    # Inisialisasi Random Forest
    clf = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)

    # Evaluasi
    y_pred = clf.predict(X_test)
    print("\n--- HASIL EVALUASI MODEL (TEST SET) ---")
    print(classification_report(y_test, y_pred))
    print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))

    # Simpan model
    joblib.dump(clf, MODEL_OUTPUT_PATH)
    print(f"\n[SUKSES] Model Random Forest berhasil disimpan di: {MODEL_OUTPUT_PATH}")
    print("Model ini akan otomatis langsung aktif digunakan oleh server saat API restart.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Latih model Random Forest HAR dari berkas CSV")
    parser.add_argument("--file", type=str, help="Path ke satu berkas CSV sesi")
    parser.add_argument("--dir", type=str, help="Path ke folder berisi berkas-berkas CSV sesi")
    args = parser.parse_args()

    train(data_dir=args.dir, single_file=args.file)
