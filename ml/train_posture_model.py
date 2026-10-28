import os
import glob
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

# Mapping nama kelas sesuai dengan standar Dashboard & Backend
CLASS_NAMES = ['Neutral Pose', 'Working Pose', 'Bad Pose']
LABEL_TO_ID = {name: idx for idx, name in enumerate(CLASS_NAMES)}
ID_TO_LABEL = {idx: name for idx, name in enumerate(CLASS_NAMES)}

FEATURE_NAMES = [
    's1_pitch',
    's2_pitch',
    's3_pitch',
    's4_pitch',
    's5_pitch',
    's6_pitch',
    'rel_s1',
    'rel_s4',
    'rel_s5',
    'rel_s6',
    'spine_delta_s1_s4',
    'max_spine_dev',
    'shoulder_mean',
    'wrench_active',
    'rolling_s1_mean',
    'rolling_s4_mean',
    'vel_s1',
    'vel_s4'
]


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Menstandarkan nama kolom CSV baik dari format lama (A..F) maupun format baru (S1..S6).
    """
    col_map = {
        'A (Neck) Pitch': 's1_pitch',
        'S1 Neck Pitch': 's1_pitch',
        'B (Right Shoulder) Pitch': 's2_pitch',
        'S2 Right Shoulder Pitch': 's2_pitch',
        'C (Left Shoulder) Pitch': 's3_pitch',
        'S3 Left Shoulder Pitch': 's3_pitch',
        'D (Upper Back) Pitch': 's4_pitch',
        'S4 Upper Back Pitch': 's4_pitch',
        'E (Mid Back) Pitch': 's5_pitch',
        'S5 Mid Back Pitch': 's5_pitch',
        'F (Pelvis) Pitch': 's6_pitch',
        'S6 Pelvis Pitch': 's6_pitch',
        'Wrench Status': 'wrench_status',
        'Timestamp': 'timestamp'
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    for col, default_val in [
        ('s1_pitch', -90.0),
        ('s2_pitch', 0.0),
        ('s3_pitch', 0.0),
        ('s4_pitch', -90.0),
        ('s5_pitch', -95.0),
        ('s6_pitch', -95.0),
    ]:
        if col not in df.columns:
            df[col] = default_val
        df[col] = pd.to_numeric(df[col], errors='coerce').ffill().bfill().fillna(default_val)

    # Sintesis S5 & S6 jika kosong (sesuai logika mqttService.js: S5 = S1 - 5, S6 = S4 - 5)
    if df['s5_pitch'].isna().all():
        df['s5_pitch'] = df['s1_pitch'] - 5.0
    if df['s6_pitch'].isna().all():
        df['s6_pitch'] = df['s4_pitch'] - 5.0

    df['wrench_status'] = df['wrench_status'].astype(str).str.upper().str.strip()
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Mengekstrak fitur spasial dan temporal (time-series window = 3 sampel) untuk setiap baris data.
    """
    df = df.copy()

    # 1. Relative pitch terhadap baseline tegak (-90 derajat untuk spine)
    df['rel_s1'] = df['s1_pitch'] - (-90.0)
    df['rel_s4'] = df['s4_pitch'] - (-90.0)
    df['rel_s5'] = df['s5_pitch'] - (-90.0)
    df['rel_s6'] = df['s6_pitch'] - (-90.0)

    # 2. Kelengkungan tulang belakang (beda sudut leher vs punggung atas) & deviasi maksimum
    df['spine_delta_s1_s4'] = df['s1_pitch'] - df['s4_pitch']
    df['max_spine_dev'] = np.maximum(df['rel_s1'].abs(), df['rel_s4'].abs())
    df['shoulder_mean'] = (df['s2_pitch'].abs() + df['s3_pitch'].abs()) / 2.0

    # 3. Status Bor (Wrench Status: ON = 1.0, OFF = 0.0)
    df['wrench_active'] = (df['wrench_status'] == 'ON').astype(float)

    # 4. Fitur Temporal (Sliding Window 3 detik untuk meredam noise gyro)
    df['rolling_s1_mean'] = df['rel_s1'].rolling(window=3, min_periods=1).mean()
    df['rolling_s4_mean'] = df['rel_s4'].rolling(window=3, min_periods=1).mean()
    df['vel_s1'] = df['s1_pitch'].diff().abs().fillna(0.0)
    df['vel_s4'] = df['s4_pitch'].diff().abs().fillna(0.0)

    return df


def assign_labels(df: pd.DataFrame, filename: str) -> pd.Series:
    """
    Pelabelan 3 kelas berdasarkan konteks sesi CSV dan aturan ergonomis:
    - Neutral Pose (0): Postur tegak (deviasi spine <= 12 derajat dari -90, yaitu pitch <= -78°).
    - Working Pose (1): Membungkuk ringan/menengah (12° < deviasi <= 75°, yaitu pitch antara -78° s/d -15°)
                        DENGAN kondisi Bor Menyala (Wrench Status == ON).
    - Bad Pose (2):     Membungkuk tanpa bor (Wrench Status == OFF dan deviasi > 12°)
                        ATAU membungkuk terlalu ekstrem (> 75° deviasi / pitch > -15°) meskipun bor menyala.
    """
    fname = filename.upper()
    labels = pd.Series(index=df.index, dtype=int)

    # Indikator apakah pekerja sedang membungkuk (melebihi batas netral ~12 derajat dari -90)
    # Pada data NETRAL_1 & NETRAL_2, nilai normal berada di sekitar -80 s/d -95.
    is_bent = (df['s1_pitch'] > -77.0) | (df['s4_pitch'] > -77.0)
    is_extreme_bend = (df['s1_pitch'] > -15.0) | (df['s4_pitch'] > -15.0)
    wrench_on = df['wrench_active'] == 1.0

    if 'NETRAL' in fname:
        # Sesi rekaman postur tegak -> Neutral Pose (kecuali jika ada outlier bungkuk ekstrem)
        labels[:] = LABEL_TO_ID['Neutral Pose']
    elif 'WORK' in fname:
        # Sesi rekaman kerja dengan bor:
        # - Saat berdiri tegak istirahat -> Neutral Pose
        # - Saat membungkuk kerja & bor ON (tidak ekstrem) -> Working Pose
        # - Saat membungkuk tapi bor OFF atau bungkuk ekstrem -> Bad Pose
        labels[:] = LABEL_TO_ID['Neutral Pose']
        labels[is_bent & wrench_on & (~is_extreme_bend)] = LABEL_TO_ID['Working Pose']
        labels[is_bent & ((~wrench_on) | is_extreme_bend)] = LABEL_TO_ID['Bad Pose']
    elif 'BUNGKUK' in fname:
        # Sesi rekaman bungkuk tanpa bor:
        # Di sela-sela repetisi bungkuk, subjek kembali berdiri tegak (-85 s/d -95°).
        # Memisahkan fase tegak istirahat (Neutral Pose) dan fase bungkuk (Bad Pose) agar model akurat.
        labels[:] = LABEL_TO_ID['Neutral Pose']
        labels[is_bent & (~wrench_on)] = LABEL_TO_ID['Bad Pose']
        labels[is_bent & wrench_on & (~is_extreme_bend)] = LABEL_TO_ID['Working Pose']
        labels[is_extreme_bend] = LABEL_TO_ID['Bad Pose']
    else:
        # Fallback umum untuk file CSV masa depan
        labels[:] = LABEL_TO_ID['Neutral Pose']
        labels[is_bent & wrench_on & (~is_extreme_bend)] = LABEL_TO_ID['Working Pose']
        labels[is_bent & ((~wrench_on) | is_extreme_bend)] = LABEL_TO_ID['Bad Pose']

    return labels


def export_random_forest_to_json(rf: RandomForestClassifier, feature_names: list, metrics: dict, output_path: str):
    """
    Mengekspor seluruh Decision Trees di dalam RandomForestClassifier ke format JSON murni
    agar dapat dieksekusi secara real-time di Node.js (mqttService.js) tanpa library C++ tambahan.
    """
    trees_data = []
    for estimator in rf.estimators_:
        tree = estimator.tree_
        # Normalisasi value di leaf node menjadi probabilitas per kelas
        values_norm = []
        for val in tree.value:
            counts = val[0]
            total = float(np.sum(counts))
            probs = [round(float(c) / total, 5) if total > 0 else 0.0 for c in counts]
            values_norm.append(probs)

        trees_data.append({
            'feature': tree.feature.tolist(),
            'threshold': [round(float(t), 5) for t in tree.threshold],
            'children_left': tree.children_left.tolist(),
            'children_right': tree.children_right.tolist(),
            'value': values_norm
        })

    model_artifact = {
        'model_type': 'RandomForestClassifier',
        'version': '1.0.0',
        'classes': CLASS_NAMES,
        'feature_names': feature_names,
        'n_estimators': len(trees_data),
        'metrics': metrics,
        'trees': trees_data
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(model_artifact, f, indent=2)


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_dir = os.path.join(base_dir, 'dataset')
    csv_files = sorted(glob.glob(os.path.join(dataset_dir, '*.csv')))

    if not csv_files:
        raise FileNotFoundError(f'Tidak ditemukan file CSV di {dataset_dir}')

    print('=' * 70)
    print('1. MEMUAT DATASET & FEATURE ENGINEERING')
    print('=' * 70)

    all_dfs = []
    for path in csv_files:
        fname = os.path.basename(path)
        raw_df = pd.read_csv(path)
        norm_df = normalize_columns(raw_df)
        feat_df = engineer_features(norm_df)
        feat_df['label'] = assign_labels(feat_df, fname)
        feat_df['source_file'] = fname
        all_dfs.append(feat_df)

        counts = feat_df['label'].map(ID_TO_LABEL).value_counts().to_dict()
        print(f'  - {fname:<15} | Total: {len(feat_df):>4} baris | Distribusi Kelas: {counts}')

    full_df = pd.concat(all_dfs, ignore_index=True)

    # Sintesis augmentasi Working Pose moderat (bungkuk ringan -80 s/d -55 saat bor ON)
    # agar model memiliki representasi penuh di seluruh rentang sudut bungkuk sedikit + bor menyala
    rng = np.random.default_rng(42)
    n_aug = 180
    aug_s1 = rng.uniform(-76.5, -45.0, n_aug)
    aug_s4 = aug_s1 + rng.normal(-3.0, 3.5, n_aug)
    aug_s2 = rng.uniform(-5.0, 35.0, n_aug)
    aug_s3 = aug_s2 + rng.normal(0.0, 3.0, n_aug)
    aug_df = pd.DataFrame({
        's1_pitch': aug_s1,
        's2_pitch': aug_s2,
        's3_pitch': aug_s3,
        's4_pitch': aug_s4,
        's5_pitch': aug_s1 - 5.0,
        's6_pitch': aug_s4 - 5.0,
        'wrench_status': 'ON'
    })
    aug_df = engineer_features(aug_df)
    aug_df['label'] = LABEL_TO_ID['Working Pose']
    aug_df['source_file'] = 'SYNTH_WORK_MILD'

    full_df = pd.concat([full_df, aug_df], ignore_index=True)

    print('\nTotal Dataset Gabungan:', len(full_df), 'baris')
    for label_id, label_name in ID_TO_LABEL.items():
        cnt = int((full_df['label'] == label_id).sum())
        pct = (cnt / len(full_df)) * 100
        print(f'  [{label_id}] {label_name:<15}: {cnt:>4} sampel ({pct:.1f}%)')

    X = full_df[FEATURE_NAMES].values
    y = full_df['label'].values

    # Split 80% Train, 20% Test dengan Stratifikasi
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print('\n' + '=' * 70)
    print('2. PELATIHAN MODEL (RANDOM FOREST CLASSIFIER)')
    print('=' * 70)

    rf_model = RandomForestClassifier(
        n_estimators=35,
        max_depth=8,
        min_samples_leaf=3,
        class_weight='balanced',
        random_state=42
    )
    rf_model.fit(X_train, y_train)

    # Evaluasi Cross-Validation 5-Fold
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf_model, X, y, cv=cv, scoring='f1_macro')

    # Evaluasi Test Set
    y_pred = rf_model.predict(X_test)
    acc = float(accuracy_score(y_test, y_pred))
    f1_mac = float(f1_score(y_test, y_pred, average='macro'))
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f'Accuracy (Test Set)       : {acc * 100:.2f}%')
    print(f'Macro F1-Score (Test Set) : {f1_mac * 100:.2f}%')
    print(f'5-Fold CV Macro F1-Score  : {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std() * 100:.2f}%)\n')

    print('Classification Report:')
    print(classification_report(y_test, y_pred, target_names=CLASS_NAMES, digits=4))

    print('Confusion Matrix (Baris = Aktual, Kolom = Prediksi):')
    header = '               ' + '  '.join([f'{c:>13}' for c in CLASS_NAMES])
    print(header)
    for idx, row in enumerate(cm):
        row_str = '  '.join([f'{val:>13}' for val in row])
        print(f'{CLASS_NAMES[idx]:<15}{row_str}')

    print('\nTop 10 Feature Importances:')
    importances = sorted(
        zip(FEATURE_NAMES, rf_model.feature_importances_),
        key=lambda x: x[1],
        reverse=True
    )
    for feat, imp in importances[:10]:
        print(f'  - {feat:<20}: {imp * 100:6.2f}%')

    # Simpan model .joblib untuk Python & .json untuk Backend Node.js
    joblib_path = os.path.join(base_dir, 'posture_model.joblib')
    joblib.dump(rf_model, joblib_path)

    backend_json_path = os.path.abspath(
        os.path.join(base_dir, '..', 'backend', 'src', 'ml', 'posture_model.json')
    )
    metrics_summary = {
        'test_accuracy': round(acc, 5),
        'test_f1_macro': round(f1_mac, 5),
        'cv_f1_macro_mean': round(float(cv_scores.mean()), 5),
        'confusion_matrix': cm,
        'total_samples': int(len(full_df)),
        'feature_importances': {k: round(float(v), 5) for k, v in importances}
    }
    export_random_forest_to_json(rf_model, FEATURE_NAMES, metrics_summary, backend_json_path)

    print('\n' + '=' * 70)
    print('3. EKSPOR ARTEFAK MODEL SELESAI')
    print('=' * 70)
    print(f'  [Python Joblib] : {joblib_path}')
    print(f'  [Node.js JSON]  : {backend_json_path}')


if __name__ == '__main__':
    main()

