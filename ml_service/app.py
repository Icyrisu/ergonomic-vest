from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import shutil

from model_manager import ModelManager, ACTIVITY_CLASSES
from train_model import train

app = FastAPI(
    title="Ergonomic Vest HAR Microservice",
    description="Microservice Machine Learning Real-Time untuk Klasifikasi Aktivitas Kerja Rompi Ergonomis (Random Forest)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_mgr = ModelManager()

class TelemetrySample(BaseModel):
    wrench: Optional[Any] = False
    s1: Optional[float] = -90.0
    s2: Optional[float] = 0.0
    s3: Optional[float] = 0.0
    s4: Optional[float] = -90.0
    s5: Optional[float] = -90.0
    s6: Optional[float] = -90.0

class PredictRequest(BaseModel):
    window: List[TelemetrySample]

@app.get("/")
def root():
    return {
        "service": "Ergonomic Vest HAR Microservice",
        "status": "online",
        "model_loaded": model_mgr.model is not None,
        "supported_classes": ACTIVITY_CLASSES
    }

@app.get("/health")
def health():
    return {"status": "ok", "model_active": model_mgr.model is not None}

@app.get("/classes")
def get_classes():
    return {"classes": ACTIVITY_CLASSES}

@app.post("/predict")
def predict_activity(req: PredictRequest):
    """
    Prediksi aktivitas kerja (3 kelas) dari sliding window data sensor.
    Output mencakup: activity, holding_prop, confidence, risk_level.
    """
    samples = [s.model_dump() for s in req.window]
    result = model_mgr.predict(samples)
    return result

@app.post("/train")
async def train_uploaded_dataset(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    """
    Mengunggah berkas CSV sesi untuk melatih ulang model Random Forest di latar belakang.
    """
    os.makedirs("datasets", exist_ok=True)
    temp_path = os.path.join("datasets", file.filename)
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    def run_training():
        train(single_file=temp_path)
        model_mgr.load_model()

    if background_tasks:
        background_tasks.add_task(run_training)
    else:
        run_training()

    return {
        "status": "training_started",
        "filename": file.filename,
        "message": "Pelatihan model Random Forest sedang berjalan. Model baru akan otomatis aktif setelah selesai."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
