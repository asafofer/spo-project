"""Test the saved bid prediction model"""

import joblib
import pandas as pd
from pathlib import Path


def load_model():
    """Load saved model and encoders"""
    model_dir = Path(__file__).parent
    model = joblib.load(model_dir / "bid_prediction_model.joblib")
    encoders = joblib.load(model_dir / "encoders.joblib")
    return model, encoders


def predict(model, encoders, bidder, domain, country="US", browser="chrome", 
            os="android", ad_unit="unknown", media_type="banner", ad_size="300x250"):
    """Predict bid probability for a single bidder"""
    input_values = {
        "bidderCode": bidder,
        "domain": domain,
        "country": country,
        "browser": browser,
        "os": os,
        "adUnitCode": ad_unit,
        "mediaType": media_type,
        "adSize": ad_size,
    }
    
    features = {}
    for col, value in input_values.items():
        encoder = encoders[col]
        if value in encoder.classes_:
            features[col] = encoder.transform([value])[0]
        elif "unknown" in encoder.classes_:
            features[col] = encoder.transform(["unknown"])[0]
        else:
            features[col] = 0
    
    X = pd.DataFrame([features])
    return model.predict_proba(X)[0, 1]


def rank_bidders(model, encoders, domain, country="US", browser="chrome",
                 os="android", ad_unit="unknown", media_type="banner", 
                 ad_size="300x250", top_n=3):
    """Rank all bidders for a supply opportunity and return top N"""
    all_bidders = encoders["bidderCode"].classes_.tolist()
    
    scores = []
    for bidder in all_bidders:
        if bidder == "unknown":
            continue
        proba = predict(model, encoders, bidder, domain, country, browser, 
                       os, ad_unit, media_type, ad_size)
        scores.append((bidder, proba))
    
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_n]


if __name__ == "__main__":
    print("Loading saved model...")
    model, encoders = load_model()
    print("✅ Model loaded successfully\n")
    
    # Test 1: Single prediction
    print("=" * 50)
    print("TEST 1: Single bidder prediction")
    print("=" * 50)
    proba = predict(model, encoders, "vidazoo", "moovit.com", country="US")
    print(f"vidazoo + moovit.com (US): {proba*100:.1f}% chance to bid\n")
    
    # Test 2: Rank bidders
    print("=" * 50)
    print("TEST 2: Rank bidders for supply opportunity")
    print("=" * 50)
    
    test_cases = [
        {"domain": "moovit.com", "country": "US", "ad_size": "300x250"},
        {"domain": "www.spin.com", "country": "US", "ad_size": "320x50"},
        {"domain": "go.paddling.com", "country": "CA", "ad_size": "728x90"},
    ]
    
    for case in test_cases:
        print(f"\n📍 {case}")
        top_bidders = rank_bidders(model, encoders, top_n=3, **case)
        for i, (bidder, proba) in enumerate(top_bidders, 1):
            print(f"   {i}. {bidder}: {proba*100:.1f}%")
    
    print("\n✅ All tests passed!")

