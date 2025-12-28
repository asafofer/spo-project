"""Bidder Bid Prediction Model

Predicts the probability that a bidder will respond to a bid request
based on supply characteristics (domain, country, browser, os, adUnitCode).

Usage:
    # Train and evaluate model
    python3 bid_prediction_model.py

    # Train with specific data file
    python3 bid_prediction_model.py --data-file ../data/bidder-training-data.json

    # Predict for specific conditions
    python3 bid_prediction_model.py --predict --bidder pubmatic --country US --domain example.com
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import pearsonr
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder

# Optional: for saving models
try:
    import joblib

    HAS_JOBLIB = True
except ImportError:
    HAS_JOBLIB = False


def load_training_data(json_file_path: Path) -> pd.DataFrame:
    """Load training data from JSON file exported by fetch-bidder-training-data.ts"""
    with open(json_file_path, "r") as f:
        data = json.load(f)

    print(f"Loaded data from: {json_file_path.name}")

    # Handle both formats: {metadata, data} or flat array
    if isinstance(data, list):
        df = pd.DataFrame(data)
    elif "data" in data:
        print(f"Metadata: {json.dumps(data.get('metadata', {}), indent=2)}")
        df = pd.DataFrame(data["data"])
    else:
        df = pd.DataFrame(data)

    # Create binary did_respond: 1 if bidder responded at least once, 0 otherwise
    if "did_respond" not in df.columns:
        if "response_count" in df.columns:
            df["did_respond"] = (df["response_count"] > 0).astype(int)
            print(f"Created did_respond from response_count > 0")
        elif "response_rate" in df.columns:
            df["did_respond"] = (df["response_rate"] > 0).astype(int)
            print(f"Created did_respond from response_rate > 0")

    return df


def find_training_data_file() -> Path:
    """Find the training data file"""
    data_path = Path(__file__).parent.parent.parent / "data"
    data_file = data_path / "bidder-training-data.json"
    if not data_file.exists():
        raise FileNotFoundError(
            f"Training data file not found: {data_file}\n"
            "Please run: bun run ml-pipeline/fetch-bidder-training-data.ts"
        )
    return data_file


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Prepare features for ML model.
    Encodes categorical variables and returns feature matrix.

    Returns:
        - X: Feature DataFrame
        - encoders: Dictionary of LabelEncoders for each categorical column
    """
    # Define categorical columns
    categorical_cols = [
        "bidderCode",
        "domain",
        "country",
        "browser",
        "os",
        "adUnitCode",
        "mediaType",
        "adSize",
    ]

    # Create a copy and fill NaN values
    df_features = df.copy()
    for col in categorical_cols:
        df_features[col] = df_features[col].fillna("unknown")

    # Encode categorical variables
    encoders = {}
    for col in categorical_cols:
        le = LabelEncoder()
        df_features[f"{col}_encoded"] = le.fit_transform(df_features[col].astype(str))
        encoders[col] = le

    # Create feature matrix with encoded columns
    feature_cols = [f"{col}_encoded" for col in categorical_cols]
    X = df_features[feature_cols].copy()

    # Rename columns to remove _encoded suffix for clarity
    X.columns = categorical_cols

    return X, encoders


def train_logistic_regression(X_train, y_train, X_test, y_test):
    """Train and evaluate Logistic Regression model"""
    print("\n" + "=" * 60)
    print("LOGISTIC REGRESSION MODEL")
    print("=" * 60)

    model = LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced")
    model.fit(X_train, y_train)

    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    # Metrics
    accuracy = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)

    print(f"\nAccuracy: {accuracy:.4f}")
    print(f"ROC-AUC: {roc_auc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["No Bid", "Bid"]))

    print("\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  True Negatives:  {cm[0, 0]:,}")
    print(f"  False Positives: {cm[0, 1]:,}")
    print(f"  False Negatives: {cm[1, 0]:,}")
    print(f"  True Positives:  {cm[1, 1]:,}")

    # Cross-validation
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring="roc_auc")
    print(
        f"\n5-Fold CV ROC-AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})"
    )

    return model, roc_auc


def train_gradient_boosting(X_train, y_train, X_test, y_test):
    """Train and evaluate Gradient Boosting model"""
    print("\n" + "=" * 60)
    print("GRADIENT BOOSTING MODEL")
    print("=" * 60)

    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    # Metrics
    accuracy = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)

    print(f"\nAccuracy: {accuracy:.4f}")
    print(f"ROC-AUC: {roc_auc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["No Bid", "Bid"]))

    print("\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  True Negatives:  {cm[0, 0]:,}")
    print(f"  False Positives: {cm[0, 1]:,}")
    print(f"  False Negatives: {cm[1, 0]:,}")
    print(f"  True Positives:  {cm[1, 1]:,}")

    # Feature importance
    print("\nFeature Importance:")
    feature_names = X_train.columns.tolist()
    importance = model.feature_importances_
    sorted_idx = np.argsort(importance)[::-1]
    for idx in sorted_idx:
        print(f"  {feature_names[idx]}: {importance[idx]:.4f}")

    return model, roc_auc


def analyze_threshold(y_test, y_pred_proba, model_name: str):
    """Analyze different decision thresholds for filtering"""
    print(f"\n--- {model_name} Threshold Analysis ---")
    print("(For filtering: we want to skip low-probability requests)")
    print("\nThreshold | Skip Rate | Missed Bids | Saved Requests")
    print("-" * 55)

    total = len(y_test)
    actual_bids = y_test.sum()

    for threshold in [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50]:
        # If probability < threshold, we would skip the request
        would_skip = y_pred_proba < threshold
        skip_rate = would_skip.sum() / total * 100

        # Of those we skip, how many would have actually bid?
        missed_bids = (would_skip & (y_test == 1)).sum()
        missed_bid_rate = missed_bids / actual_bids * 100 if actual_bids > 0 else 0

        # How many requests would we save by not sending?
        saved_requests = would_skip.sum()

        print(
            f"  {threshold:.2f}     | {skip_rate:5.1f}%    | {missed_bid_rate:5.1f}%      | {saved_requests:,}"
        )


def print_data_summary(df: pd.DataFrame):
    """Print summary of training data"""
    print("\n" + "=" * 60)
    print("TRAINING DATA SUMMARY")
    print("=" * 60)

    print(f"\nTotal records: {len(df):,}")

    # Target distribution
    print("\nTarget Distribution (did_respond):")
    value_counts = df["did_respond"].value_counts()
    for val, count in value_counts.items():
        pct = count / len(df) * 100
        label = "Responded (1)" if val == 1 else "No Response (0)"
        print(f"  {label}: {count:,} ({pct:.1f}%)")

    # Response rate stats
    print("\nResponse Rate Statistics:")
    print(f"  Mean: {df['response_rate'].mean():.4f}")
    print(f"  Median: {df['response_rate'].median():.4f}")
    print(f"  Std: {df['response_rate'].std():.4f}")
    print(f"  Min: {df['response_rate'].min():.4f}")
    print(f"  Max: {df['response_rate'].max():.4f}")

    # Feature cardinality
    print("\nFeature Cardinality:")
    for col in [
        "bidderCode",
        "domain",
        "country",
        "browser",
        "os",
        "adUnitCode",
        "mediaType",
        "adSize",
    ]:
        unique = df[col].nunique()
        null_pct = df[col].isna().sum() / len(df) * 100
        print(f"  {col}: {unique} unique values ({null_pct:.1f}% null)")

    # Top bidders by volume
    print("\nTop 10 Bidders by Request Count:")
    top_bidders = (
        df.groupby("bidderCode")
        .agg({"request_count": "sum", "response_count": "sum", "response_rate": "mean"})
        .sort_values("request_count", ascending=False)
        .head(10)
    )
    for bidder, row in top_bidders.iterrows():
        print(
            f"  {bidder}: {int(row['request_count']):,} requests, "
            f"{row['response_rate']*100:.1f}% avg response rate"
        )


def make_prediction(
    model,
    encoders: dict,
    bidder: str,
    domain: str,
    country: str = "unknown",
    browser: str = "unknown",
    os: str = "unknown",
    ad_unit: str = "unknown",
    media_type: str = "unknown",
    ad_size: str = "unknown",
) -> float:
    """
    Make a prediction for a specific supply opportunity.

    Returns:
        Probability that the bidder will respond (0.0 - 1.0)
    """
    # Encode each feature using the trained encoders
    features = {}
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

    for col, value in input_values.items():
        encoder = encoders[col]
        # Handle unseen values by using "unknown" if available, otherwise use first class
        if value in encoder.classes_:
            features[col] = encoder.transform([value])[0]
        elif "unknown" in encoder.classes_:
            features[col] = encoder.transform(["unknown"])[0]
        else:
            # Use the most common class (first one after fitting)
            features[col] = 0

    # Create feature vector
    X = pd.DataFrame([features])

    # Predict probability
    proba = model.predict_proba(X)[0, 1]
    return proba


def save_model(model, encoders: dict, output_dir: Path):
    """Save trained model and encoders to disk"""
    if not HAS_JOBLIB:
        print("Warning: joblib not available, skipping model save")
        return

    model_path = output_dir / "bid_prediction_model.joblib"
    encoders_path = output_dir / "encoders.joblib"

    joblib.dump(model, model_path)
    joblib.dump(encoders, encoders_path)

    print(f"\nModel saved to: {model_path}")
    print(f"Encoders saved to: {encoders_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Train and use bidder bid prediction model"
    )
    parser.add_argument(
        "--data-file",
        type=str,
        help="Path to training data JSON file",
    )
    parser.add_argument(
        "--predict",
        action="store_true",
        help="Make a prediction instead of training",
    )
    parser.add_argument("--bidder", type=str, help="Bidder code for prediction")
    parser.add_argument("--domain", type=str, help="Domain for prediction")
    parser.add_argument(
        "--country", type=str, default="unknown", help="Country for prediction"
    )
    parser.add_argument(
        "--browser", type=str, default="unknown", help="Browser for prediction"
    )
    parser.add_argument("--os", type=str, default="unknown", help="OS for prediction")
    parser.add_argument(
        "--ad-unit", type=str, default="unknown", help="Ad unit for prediction"
    )
    parser.add_argument(
        "--media-type",
        type=str,
        default="unknown",
        help="Media type for prediction (banner/video)",
    )
    parser.add_argument(
        "--ad-size",
        type=str,
        default="unknown",
        help="Ad size for prediction (e.g., 300x250)",
    )
    parser.add_argument(
        "--save-model",
        action="store_true",
        help="Save trained model to disk",
    )
    parser.add_argument(
        "--use-gb",
        action="store_true",
        help="Use Gradient Boosting instead of Logistic Regression",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=3,
        help="Number of top bidders to select (default: 3)",
    )

    args = parser.parse_args()

    # Load training data
    if args.data_file:
        data_file = Path(args.data_file)
    else:
        data_file = find_training_data_file()

    df = load_training_data(data_file)

    # Print data summary
    print_data_summary(df)

    # Prepare features
    print("\nPreparing features...")
    X, encoders = prepare_features(df)
    y = df["did_respond"]

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training set: {len(X_train):,} samples")
    print(f"Test set: {len(X_test):,} samples")

    # Train models
    lr_model, lr_auc = train_logistic_regression(X_train, y_train, X_test, y_test)
    gb_model, gb_auc = train_gradient_boosting(X_train, y_train, X_test, y_test)

    # Threshold analysis
    lr_proba = lr_model.predict_proba(X_test)[:, 1]
    gb_proba = gb_model.predict_proba(X_test)[:, 1]
    analyze_threshold(y_test.values, lr_proba, "Logistic Regression")
    analyze_threshold(y_test.values, gb_proba, "Gradient Boosting")

    # Select best model
    best_model = gb_model if gb_auc > lr_auc else lr_model
    best_name = "Gradient Boosting" if gb_auc > lr_auc else "Logistic Regression"
    print(f"\n{'='*60}")
    print(f"BEST MODEL: {best_name} (ROC-AUC: {max(gb_auc, lr_auc):.4f})")
    print(f"{'='*60}")

    # Save model if requested
    if args.save_model:
        output_dir = Path(__file__).parent
        save_model(best_model, encoders, output_dir)

    # Make prediction if requested
    if args.predict:
        if not args.bidder or not args.domain:
            print("\nError: --bidder and --domain are required for prediction")
            sys.exit(1)

        model_to_use = gb_model if args.use_gb else best_model
        proba = make_prediction(
            model_to_use,
            encoders,
            args.bidder,
            args.domain,
            args.country,
            args.browser,
            args.os,
            args.ad_unit,
            args.media_type,
            args.ad_size,
        )

        print(f"\n{'='*60}")
        print("PREDICTION RESULT")
        print(f"{'='*60}")
        print(f"Bidder: {args.bidder}")
        print(f"Domain: {args.domain}")
        print(f"Country: {args.country}")
        print(f"Browser: {args.browser}")
        print(f"OS: {args.os}")
        print(f"Ad Unit: {args.ad_unit}")
        print(f"Media Type: {args.media_type}")
        print(f"Ad Size: {args.ad_size}")
        print(f"\nBid Probability: {proba:.4f} ({proba*100:.2f}%)")

        # Recommendation
        if proba < 0.15:
            print("Recommendation: SKIP (probability too low)")
        elif proba < 0.30:
            print("Recommendation: CONSIDER SKIPPING (borderline)")
        else:
            print("Recommendation: SEND REQUEST (good probability)")

    # BIDDER RANKING: The actual use case
    # Given a supply opportunity, rank ALL bidders and pick top N
    top_n = args.top_n
    print(f"\n{'='*60}")
    print(f"BIDDER RANKING (THE GOAL) - Top {top_n}")
    print(f"Given supply context → rank bidders → pick top {top_n}")
    print(f"{'='*60}")

    all_bidders = df["bidderCode"].unique().tolist()
    sample_domains = (
        df.groupby("domain")["request_count"].sum().nlargest(3).index.tolist()
    )

    for domain in sample_domains[:2]:
        print(
            f"\n📍 Supply: domain={domain}, country=US, mediaType=banner, adSize=300x250"
        )
        print("-" * 50)

        # Score all bidders for this supply
        bidder_scores = []
        for bidder in all_bidders:
            proba = make_prediction(
                best_model,
                encoders,
                bidder,
                domain,
                country="US",
                browser="chrome",
                os="android",
                ad_unit="unknown",
                media_type="banner",
                ad_size="300x250",
            )
            bidder_scores.append((bidder, proba))

        # Rank by probability (descending)
        bidder_scores.sort(key=lambda x: x[1], reverse=True)

        # Show top N + a few more for context
        print(f"Bidder ranking (top {min(top_n + 2, len(bidder_scores))}):")
        for i, (bidder, proba) in enumerate(bidder_scores[: top_n + 2], 1):
            if i <= top_n:
                marker = "✅"
                print(f"  {marker} {i}. {bidder}: {proba*100:.1f}% ← SEND")
            else:
                print(f"     {i}. {bidder}: {proba*100:.1f}% (skip)")

        # Summary
        selected = bidder_scores[:top_n]
        skipped = len(all_bidders) - top_n
        reduction = skipped / len(all_bidders) * 100
        selected_names = ", ".join([b[0] for b in selected])
        print(f"\n  → Send to: {selected_names}")
        print(f"  → Skip {skipped} bidders ({reduction:.0f}% reduction)")


if __name__ == "__main__":
    main()
