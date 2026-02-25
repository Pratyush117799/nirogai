"""
NirogAI — FastAPI Diabetes Route
==================================
File: ml_service/routes/diabetes.py

This file:
  1. Loads the trained diabetes_model_v6.pkl once at startup
  2. Defines the /diabetes/predict endpoint
  3. Validates input with Pydantic
  4. Returns structured JSON that Node.js backend will save to PostgreSQL
"""

import joblib
import json
from functools import lru_cache
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import Optional
import pandas as pd

router = APIRouter()

MODEL_PATH = "saved_models/diabetes_model_v6.pkl"


# ── Load bundle once and cache it ─────────────────────────────────────────────
# lru_cache means the bundle is loaded only ONCE, not on every request
@lru_cache(maxsize=1)
def load_bundle():
    try:
        bundle = joblib.load(MODEL_PATH)
        print(f"Diabetes bundle loaded | Threshold: {bundle['thresh_screen']}")
        return bundle
    except FileNotFoundError:
        raise RuntimeError(f"Model not found at {MODEL_PATH}. Run diabetes_model_v6.py first.")


# ── Input schema (what the form sends) ────────────────────────────────────────
# All fields the user fills in the React form
# Optional fields default to 0 (so short form works too)
class DiabetesInput(BaseModel):
    # ── Required (core form fields) ───────────────────────────────────────────
    BMI:          float = Field(..., ge=10, le=80,  description="Body Mass Index (10–80)")
    Age:          int   = Field(..., ge=1,  le=13,  description="Age category (1=18-24 ... 13=80+)")
    GenHlth:      int   = Field(..., ge=1,  le=5,   description="General health (1=excellent, 5=poor)")
    PhysActivity: int   = Field(..., ge=0,  le=1,   description="Physically active in past 30 days")

    # ── Optional (more complete screening) ────────────────────────────────────
    HighBP:               int = Field(default=0, ge=0, le=1)
    HighChol:             int = Field(default=0, ge=0, le=1)
    CholCheck:            int = Field(default=1, ge=0, le=1)
    Smoker:               int = Field(default=0, ge=0, le=1)
    Stroke:               int = Field(default=0, ge=0, le=1)
    HeartDiseaseorAttack: int = Field(default=0, ge=0, le=1)
    Fruits:               int = Field(default=0, ge=0, le=1)
    Veggies:              int = Field(default=0, ge=0, le=1)
    HvyAlcoholConsump:    int = Field(default=0, ge=0, le=1)
    AnyHealthcare:        int = Field(default=1, ge=0, le=1)
    NoDocbcCost:          int = Field(default=0, ge=0, le=1)
    MentHlth:             int = Field(default=0, ge=0, le=30)
    PhysHlth:             int = Field(default=0, ge=0, le=30)
    DiffWalk:             int = Field(default=0, ge=0, le=1)
    Sex:                  int = Field(default=0, ge=0, le=1)
    Education:            int = Field(default=4, ge=1, le=6)
    Income:               int = Field(default=5, ge=1, le=8)

    # ── Mode ──────────────────────────────────────────────────────────────────
    mode: str = Field(default='screening', description="'screening' or 'balanced'")

    @validator('mode')
    def mode_must_be_valid(cls, v):
        if v not in ('screening', 'balanced'):
            raise ValueError("mode must be 'screening' or 'balanced'")
        return v

    class Config:
        schema_extra = {
            "example": {
                "BMI": 28.5, "Age": 7, "GenHlth": 3, "PhysActivity": 0,
                "HighBP": 1, "HighChol": 1, "Smoker": 0, "mode": "screening"
            }
        }


# ── Output schema ─────────────────────────────────────────────────────────────
class DiabetesOutput(BaseModel):
    disease:          str
    risk_probability: float
    risk_level:       str
    key_factors:      list
    recommendation:   str
    threshold_used:   float
    threshold_type:   str
    model_confidence: dict
    disclaimer:       str


# ── PREDICT endpoint ──────────────────────────────────────────────────────────
@router.post("/predict", response_model=DiabetesOutput)
async def predict_diabetes(data: DiabetesInput):
    """
    Predict diabetes risk from patient health data.

    Returns risk level (low/medium/high), probability, key risk factors,
    and recommendations. Node.js backend calls this and saves result to PostgreSQL.
    """
    try:
        bundle = load_bundle()
        patient_dict = data.dict(exclude={'mode'})

        # Call the predict function from the model script
        result = _predict_single(bundle, patient_dict, mode=data.mode)
        return result

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/health")
async def diabetes_health():
    try:
        bundle = load_bundle()
        return {
            "status":    "healthy",
            "model":     "diabetes_model_v6",
            "threshold": bundle['thresh_screen'],
            "metrics":   bundle['metrics']
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


# ── predict_single (copied from diabetes_model_v6.py) ────────────────────────
def _predict_single(bundle: dict, patient_data: dict, mode: str = 'screening') -> dict:
    models_b  = bundle['models']
    weights_b = bundle['ensemble_weights']
    scaler_b  = bundle['scaler']
    feats     = bundle['feature_names']
    thresh    = bundle['thresh_screen'] if mode == 'screening' else bundle['thresh_balanced']
    rt        = bundle['risk_thresholds']

    bmi = patient_data.get('BMI', 0)
    if not (10 < bmi <= 80):
        raise ValueError(f"BMI {bmi} must be between 10 and 80")

    inp = pd.DataFrame([patient_data])
    inp['BMI']                = inp['BMI'].clip(10, 80)
    inp['MentHlth']           = inp['MentHlth'].clip(0, 30)
    inp['PhysHlth']           = inp['PhysHlth'].clip(0, 30)
    inp['CardioRisk']         = inp['HighBP'] + inp['HighChol'] + inp['HeartDiseaseorAttack'] + inp['Stroke']
    inp['Lifestyle']          = inp['PhysActivity'] + inp['Fruits'] + inp['Veggies'] - inp['HvyAlcoholConsump']
    inp['HealthBurden']       = inp['MentHlth'] + inp['PhysHlth']
    inp['Is_Obese']           = (inp['BMI'] >= 30).astype(int)
    inp['Is_Overweight']      = ((inp['BMI'] >= 25) & (inp['BMI'] < 30)).astype(int)
    inp['BMI_Cat']            = pd.cut(inp['BMI'], bins=[0,18.5,25,30,40,100], labels=[0,1,2,3,4]).astype(int)
    inp['Is_Senior']          = (inp['Age'] >= 9).astype(int)
    inp['Age_x_BP']           = inp['Age'] * inp['HighBP']
    inp['Age_x_Obese']        = inp['Age'] * inp['Is_Obese']
    inp['Cardio_x_Lifestyle'] = inp['CardioRisk'] * (3 - inp['Lifestyle'].clip(0, 3))
    inp['BMI_x_Cardio']       = inp['BMI'] * inp['CardioRisk']
    inp['HealthAccess']       = inp['AnyHealthcare'] - inp['NoDocbcCost']
    inp['GenHlth_x_Phys']     = inp['GenHlth'] * inp['PhysHlth']
    inp['Age_x_GenHlth']      = inp['Age'] * inp['GenHlth']

    inp        = inp[feats]
    inp_scaled = scaler_b.transform(inp)

    probas = {name: float(m.predict_proba(inp_scaled)[0][1]) for name, m in models_b.items()}
    total_w = sum(weights_b[n] for n in probas)
    prob    = sum(weights_b[n] * p for n, p in probas.items()) / total_w

    if prob < rt['low_max']:      risk_level = 'low'
    elif prob < rt['medium_max']: risk_level = 'medium'
    else:                         risk_level = 'high'

    key_factors = []
    if patient_data.get('HighBP'):                key_factors.append("High blood pressure")
    if patient_data.get('BMI', 0) >= 30:          key_factors.append(f"Obesity (BMI {bmi:.1f})")
    elif patient_data.get('BMI', 0) >= 25:        key_factors.append(f"Overweight (BMI {bmi:.1f})")
    if patient_data.get('HighChol'):              key_factors.append("High cholesterol")
    if not patient_data.get('PhysActivity'):      key_factors.append("Physical inactivity")
    if patient_data.get('Age', 1) >= 9:           key_factors.append("Age 60+ years")
    if patient_data.get('HeartDiseaseorAttack'):  key_factors.append("Heart disease history")
    if patient_data.get('Stroke'):                key_factors.append("Prior stroke")
    if patient_data.get('HvyAlcoholConsump'):     key_factors.append("Heavy alcohol use")
    if patient_data.get('GenHlth', 1) >= 4:       key_factors.append("Poor self-reported health")
    if not key_factors:
        key_factors.append("No major risk flags — maintain healthy lifestyle")

    rec = {
        'low':    "Low risk. Stay active and screen annually after age 45.",
        'medium': "Moderate risk. Schedule HbA1c and fasting glucose test.",
        'high':   "High risk. Consult a doctor urgently for HbA1c and OGTT."
    }

    return {
        'disease':          'diabetes',
        'risk_probability': round(prob * 100, 1),
        'risk_level':       risk_level,
        'key_factors':      key_factors,
        'recommendation':   rec[risk_level],
        'threshold_used':   thresh,
        'threshold_type':   mode,
        'model_confidence': {n: round(p*100, 1) for n, p in probas.items()},
        'disclaimer':       'Screening only. Does not replace medical diagnosis.'
    }
