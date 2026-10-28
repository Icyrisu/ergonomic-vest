const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const MODEL_PATH = path.join(__dirname, '..', 'ml', 'posture_model.json');

let modelArtifact = null;

// State sensor terkini dan sliding window (3 sampel terakhir) untuk fitur temporal
const sensorState = {
    'UMJ/EV/S1': { current: -90.0, prev: -90.0, historyRel: [0.0] },
    'UMJ/EV/S2': { current: 0.0, prev: 0.0, historyRel: [0.0] },
    'UMJ/EV/S3': { current: 0.0, prev: 0.0, historyRel: [0.0] },
    'UMJ/EV/S4': { current: -90.0, prev: -90.0, historyRel: [0.0] },
    'UMJ/EV/S5': { current: -95.0, prev: -95.0, historyRel: [-5.0] },
    'UMJ/EV/S6': { current: -95.0, prev: -95.0, historyRel: [-5.0] },
};

function loadModel() {
    try {
        if (fs.existsSync(MODEL_PATH)) {
            const raw = fs.readFileSync(MODEL_PATH, 'utf-8');
            modelArtifact = JSON.parse(raw);
            logger.info(
                `[ML] Loaded ${modelArtifact.model_type} (${modelArtifact.n_estimators} trees, ` +
                `test accuracy: ${(modelArtifact.metrics?.test_accuracy * 100).toFixed(2)}%)`
            );
            return true;
        } else {
            logger.warn(`[ML] Model file not found at ${MODEL_PATH}, using rule-based fallback.`);
            return false;
        }
    } catch (err) {
        logger.error(`[ML] Failed to load model artifact: ${err.message}`);
        return false;
    }
}

// Muat model saat modul diinisialisasi
loadModel();

/**
 * Mengevaluasi satu Decision Tree terhadap vektor fitur.
 */
function predictSingleTree(tree, featureVector) {
    let nodeIdx = 0;
    const features = tree.feature;
    const thresholds = tree.threshold;
    const left = tree.children_left;
    const right = tree.children_right;

    // Di scikit-learn, leaf node ditandai dengan children_left[nodeIdx] === -1
    while (left[nodeIdx] !== -1 && right[nodeIdx] !== -1) {
        const featIdx = features[nodeIdx];
        const threshold = thresholds[nodeIdx];
        if (featureVector[featIdx] <= threshold) {
            nodeIdx = left[nodeIdx];
        } else {
            nodeIdx = right[nodeIdx];
        }
    }
    return tree.value[nodeIdx];
}

/**
 * Menjalankan inferensi Random Forest pada vektor fitur (18 fitur).
 * Mengembalikan { label, classIndex, probabilities }
 */
function predictFromFeatureVector(featureVector) {
    if (!modelArtifact || !modelArtifact.trees || modelArtifact.trees.length === 0) {
        return null;
    }

    const numClasses = modelArtifact.classes.length;
    const avgProbs = new Array(numClasses).fill(0.0);
    const numTrees = modelArtifact.trees.length;

    for (let i = 0; i < numTrees; i++) {
        const treeProbs = predictSingleTree(modelArtifact.trees[i], featureVector);
        for (let c = 0; c < numClasses; c++) {
            avgProbs[c] += (treeProbs[c] || 0) / numTrees;
        }
    }

    let bestIdx = 0;
    let bestProb = avgProbs[0];
    for (let c = 1; c < numClasses; c++) {
        if (avgProbs[c] > bestProb) {
            bestProb = avgProbs[c];
            bestIdx = c;
        }
    }

    return {
        label: modelArtifact.classes[bestIdx],
        classIndex: bestIdx,
        confidence: Number(bestProb.toFixed(4)),
        probabilities: avgProbs.map(p => Number(p.toFixed(4)))
    };
}

/**
 * Menyusun 18 fitur sesuai urutan FEATURE_NAMES di train_posture_model.py
 */
function buildCurrentFeatureVector(wrenchStatus) {
    const s1 = sensorState['UMJ/EV/S1'].current;
    const s2 = sensorState['UMJ/EV/S2'].current;
    const s3 = sensorState['UMJ/EV/S3'].current;
    const s4 = sensorState['UMJ/EV/S4'].current;
    const s5 = sensorState['UMJ/EV/S5'].current;
    const s6 = sensorState['UMJ/EV/S6'].current;

    const rel_s1 = s1 - (-90.0);
    const rel_s4 = s4 - (-90.0);
    const rel_s5 = s5 - (-90.0);
    const rel_s6 = s6 - (-90.0);

    const spine_delta_s1_s4 = s1 - s4;
    const max_spine_dev = Math.max(Math.abs(rel_s1), Math.abs(rel_s4));
    const shoulder_mean = (Math.abs(s2) + Math.abs(s3)) / 2.0;
    const wrench_active = String(wrenchStatus).toUpperCase() === 'ON' ? 1.0 : 0.0;

    const h1 = sensorState['UMJ/EV/S1'].historyRel;
    const h4 = sensorState['UMJ/EV/S4'].historyRel;
    const rolling_s1_mean = h1.reduce((a, b) => a + b, 0) / h1.length;
    const rolling_s4_mean = h4.reduce((a, b) => a + b, 0) / h4.length;

    const vel_s1 = Math.abs(s1 - sensorState['UMJ/EV/S1'].prev);
    const vel_s4 = Math.abs(s4 - sensorState['UMJ/EV/S4'].prev);

    return [
        s1,
        s2,
        s3,
        s4,
        s5,
        s6,
        rel_s1,
        rel_s4,
        rel_s5,
        rel_s6,
        spine_delta_s1_s4,
        max_spine_dev,
        shoulder_mean,
        wrench_active,
        rolling_s1_mean,
        rolling_s4_mean,
        vel_s1,
        vel_s4
    ];
}

/**
 * Memperbarui data sensor dan memprediksi status postur untuk sensor tersebut.
 * Menggabungkan prediksi model ML (Neutral Pose, Working Pose, Bad Pose)
 * dengan pengecekan deviasi sensor spesifik agar visualisasi per-tulang 3D akurat.
 */
function updateSensorAndPredict(sensorTopic, sensorPitch, wrenchStatus, activeNeutralPoses, activeTolerance = 10) {
    if (sensorState[sensorTopic]) {
        const st = sensorState[sensorTopic];
        st.prev = st.current;
        st.current = sensorPitch;

        const base = (sensorTopic === 'UMJ/EV/S2' || sensorTopic === 'UMJ/EV/S3') ? 0.0 : -90.0;
        const rel = sensorPitch - base;
        st.historyRel.push(rel);
        if (st.historyRel.length > 3) {
            st.historyRel.shift();
        }
    }

    // Evaluasi di Mode ML murni berdasarkan distribusi dataset NETRAL (tanpa memakai parameter manual)
    const isArmSensor = (sensorTopic === 'UMJ/EV/S2' || sensorTopic === 'UMJ/EV/S3');
    const baseline = isArmSensor ? 0.0 : -90.0;
    const relativePitch = sensorPitch - baseline;
    const mlNeutralLimit = isArmSensor ? 20.0 : 13.0; // Selaras dengan batas tegak pada CSV NETRAL_1 & NETRAL_2

    const featureVector = buildCurrentFeatureVector(wrenchStatus);
    const mlRes = predictFromFeatureVector(featureVector);

    // Jika sensor spesifik ini masih tegak (di dalam zona netral ML), tulangnya tetap hijau (Neutral Pose)
    if (Math.abs(relativePitch) <= mlNeutralLimit) {
        return {
            status: 'Neutral Pose',
            mlPrediction: mlRes ? mlRes.label : 'Neutral Pose',
            confidence: mlRes ? mlRes.confidence : 1.0
        };
    }

    if (mlRes) {
        // Jika sensor ini membungkuk tapi sensor utama di model ML masih memprediksi Neutral,
        // tentukan antara Working Pose vs Bad Pose berdasarkan aturan ML (Wrench ON & tidak bungkuk ekstrem)
        let finalStatus = mlRes.label;
        const isWrenchOn = String(wrenchStatus).toUpperCase() === 'ON';
        const isExtremeSensorBend = (baseline === -90.0 && sensorPitch > -15.0) || Math.abs(relativePitch) > 75.0;

        if (finalStatus === 'Neutral Pose') {
            finalStatus = (isWrenchOn && !isExtremeSensorBend) ? 'Working Pose' : 'Bad Pose';
        } else if (finalStatus === 'Working Pose' && (!isWrenchOn || isExtremeSensorBend)) {
            finalStatus = 'Bad Pose';
        }

        return {
            status: finalStatus,
            mlPrediction: mlRes.label,
            confidence: mlRes.confidence,
            probabilities: mlRes.probabilities
        };
    }

    // Fallback jika file model JSON belum tersedia
    const isWrenchOn = String(wrenchStatus).toUpperCase() === 'ON';
    const isExtremeSensorBend = (baseline === -90.0 && sensorPitch > -15.0) || Math.abs(relativePitch) > 75.0;
    const fallbackStatus = (isWrenchOn && !isExtremeSensorBend) ? 'Working Pose' : 'Bad Pose';

    return {
        status: fallbackStatus,
        mlPrediction: fallbackStatus,
        confidence: 1.0
    };
}

function getModelInfo() {
    if (!modelArtifact) return { loaded: false };
    return {
        loaded: true,
        modelType: modelArtifact.model_type,
        version: modelArtifact.version,
        nEstimators: modelArtifact.n_estimators,
        classes: modelArtifact.classes,
        metrics: modelArtifact.metrics
    };
}

module.exports = {
    loadModel,
    predictFromFeatureVector,
    buildCurrentFeatureVector,
    updateSensorAndPredict,
    getModelInfo
};

