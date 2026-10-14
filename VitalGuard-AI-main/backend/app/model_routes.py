"""Synthetic-model evaluation and coefficient contribution endpoints."""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score

from .model import FEATURES, MODEL, MODEL_VERSION, _training_data, predict_probability, risk_level
from .schemas import VitalInput

router = APIRouter(prefix="/api/v1", tags=["model-transparency"])


@router.get("/model/evaluation")
def model_evaluation():
    # A separate deterministic generated sample avoids evaluating on training rows.
    rows, labels = _training_data(seed=20261011, samples=3000)
    probabilities = MODEL.predict_proba(rows)[:, 1]
    predicted = (probabilities >= 0.5).astype(int)
    matrix = confusion_matrix(labels, predicted, labels=[0, 1]).tolist()
    metrics = {
        "accuracy": float(accuracy_score(labels, predicted)),
        "precision": float(precision_score(labels, predicted, zero_division=0)),
        "recall": float(recall_score(labels, predicted, zero_division=0)),
        "f1": float(f1_score(labels, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(labels, probabilities)),
    }
    return {
        "model_version": MODEL_VERSION,
        "evaluation_type": "deterministic synthetic holdout",
        "sample_count": int(len(labels)),
        "positive_label_definition": "Generated heuristic score plus seeded noise >= 35 on synthetic vital-sign rows.",
        "threshold": 0.5,
        "metrics": metrics,
        "confusion_matrix": {
            "labels": ["synthetic_negative", "synthetic_positive"],
            "rows_actual_columns_predicted": matrix,
        },
        "limitations": [
            "The holdout rows and labels are synthetic, not clinical data or clinical outcomes.",
            "Metrics describe agreement with generated heuristic labels only.",
            "This evaluation does not establish clinical discrimination, calibration, safety, or generalization.",
        ],
        "demo_only": True,
        "clinically_validated": False,
    }


@router.post("/risk/explain")
def risk_explanation(payload: VitalInput):
    values = payload.model_dump(exclude={"patient_id"})
    row = np.asarray([[values[name] for name in FEATURES]], dtype=float)
    scale = MODEL.named_steps["scale"]
    classifier = MODEL.named_steps["classifier"]
    transformed = scale.transform(row)[0]
    weights = classifier.coef_[0]
    contributions = []
    for index, feature in enumerate(FEATURES):
        value = float(transformed[index] * weights[index])
        contributions.append({
            "feature": feature,
            "observed_value": float(values[feature]),
            "standardized_log_odds_contribution": round(value, 6),
            "direction": "positive_class" if value >= 0 else "negative_class",
            "method": "standardized logistic-regression coefficient contribution",
        })
    probability = predict_probability(values)
    score = round(probability * 100)
    return {
        "patient_id": payload.patient_id,
        "model_version": MODEL_VERSION,
        "risk_score": score,
        "risk_level": risk_level(score),
        "contributions": contributions,
        "method": "Feature value centered/scaled with the training scaler, multiplied by the logistic-regression coefficient.",
        "caveat": "These contributions describe this synthetic model's log-odds calculation; they are not SHAP, not causal, and not clinical guidance.",
        "demo_only": True,
        "clinically_validated": False,
    }
