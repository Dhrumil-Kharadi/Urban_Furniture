from pathlib import Path

import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / 'ml_models' / 'saved_model' / 'toxicity_model.pkl'
VECTORIZER_PATH = BASE_DIR / 'ml_models' / 'saved_model' / 'tfidf_vectorizer.pkl'
TARGET_COLUMNS = [
    'toxic',
    'severe_toxic',
    'obscene',
    'threat',
    'insult',
    'identity_hate',
]

_model = None
_vectorizer = None


def load_model_assets():
    global _model, _vectorizer

    if _model is None or _vectorizer is None:
        if not MODEL_PATH.exists() or not VECTORIZER_PATH.exists():
            raise FileNotFoundError(
                'Saved model files not found. Please train the model first and ensure the files exist under ml_models/saved_model.'
            )

        _model = joblib.load(MODEL_PATH)
        _vectorizer = joblib.load(VECTORIZER_PATH)

    return _model, _vectorizer


class CommentRequest(BaseModel):
    comment: str


@router.post('/predict-comment')
def predict_comment(payload: CommentRequest):
    comment = (payload.comment or '').strip()

    if not comment:
        raise HTTPException(status_code=400, detail='Comment text is required.')

    try:
        model, vectorizer = load_model_assets()
        transformed_comment = vectorizer.transform([comment])
        prediction = model.predict(transformed_comment)[0]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Model prediction failed: {str(exc)}') from exc

    prediction_map = {
        label: bool(value)
        for label, value in zip(TARGET_COLUMNS, prediction)
    }
    predicted_classes = [label for label, value in prediction_map.items() if value]

    return {
        'comment': comment,
        'is_toxic': bool(predicted_classes),
        'predicted_classes': predicted_classes,
        'prediction': prediction_map,
    }
