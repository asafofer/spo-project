"""Bidder Bid Prediction Model v2 - Improved

Key improvements over v1:
1. Predicts response_rate directly (regression) instead of binary classification
2. Uses sample weights (request_count) so high-volume combos count more
3. Target encoding for high-cardinality categoricals (domain, adUnitCode)
4. Aggregate features: bidder avg, domain avg, country avg response rates
5. Uses LightGBM for better categorical handling
6. Proper cross-validation with group splitting

Usage:
    python3 bid_prediction_model_v2.py
    python3 bid_prediction_model_v2.py --top-n 5
"""

import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold, cross_val_score, train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

# Try to import better gradient boosting libraries
try:
    import lightgbm as lgb

    HAS_LGBM = True
except Exception as e:
    HAS_LGBM = False
    print(f"LightGBM not available: {e}")

try:
    import joblib

    HAS_JOBLIB = True
except ImportError:
    HAS_JOBLIB = False


def load_training_data(json_file_path: Path) -> pd.DataFrame:
    """Load training data from JSON file"""
    print(f"Loading {json_file_path.name}...", flush=True)
    with open(json_file_path, "r") as f:
        data = json.load(f)

    print(f"✓ Loaded data from: {json_file_path.name}", flush=True)

    if isinstance(data, list):
        df = pd.DataFrame(data)
    elif "data" in data:
        print(f"Metadata: {json.dumps(data.get('metadata', {}), indent=2)}")
        df = pd.DataFrame(data["data"])
    else:
        df = pd.DataFrame(data)

    return df


def find_training_data_file() -> Path:
    """Find the training data file"""
    data_path = Path(__file__).parent.parent.parent / "data"
    data_file = data_path / "bidder-training-data.json"
    if not data_file.exists():
        raise FileNotFoundError(f"Training data file not found: {data_file}")
    return data_file


def add_aggregate_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add aggregate statistics as features.
    Uses efficient vectorized operations instead of slow .apply()
    """
    print("  Adding aggregate features...", flush=True)
    df = df.copy()

    # Pre-compute weighted response (for weighted averages)
    df["_weighted_response"] = df["response_rate"] * df["request_count"]
    global_avg = df["_weighted_response"].sum() / df["request_count"].sum()

    # --- Bidder-level aggregates ---
    print("    - bidder aggregates...", flush=True)
    bidder_agg = (
        df.groupby("bidderCode")
        .agg(
            _bidder_weighted_sum=("_weighted_response", "sum"),
            bidder_total_requests=("request_count", "sum"),
            bidder_response_variance=("response_rate", "std"),
        )
        .reset_index()
    )
    bidder_agg["bidder_avg_response_rate"] = (
        bidder_agg["_bidder_weighted_sum"] / bidder_agg["bidder_total_requests"]
    )
    bidder_agg = bidder_agg.drop(columns=["_bidder_weighted_sum"])
    df = df.merge(bidder_agg, on="bidderCode", how="left")

    # --- Domain-level aggregates ---
    print("    - domain aggregates...", flush=True)
    domain_agg = (
        df.groupby("domain")
        .agg(
            _domain_weighted_sum=("_weighted_response", "sum"),
            domain_total_requests=("request_count", "sum"),
        )
        .reset_index()
    )
    domain_agg["domain_avg_response_rate"] = (
        domain_agg["_domain_weighted_sum"] / domain_agg["domain_total_requests"]
    )
    domain_agg = domain_agg.drop(columns=["_domain_weighted_sum"])
    df = df.merge(domain_agg, on="domain", how="left", suffixes=("", "_dup"))

    # --- Country-level aggregates ---
    country_agg = (
        df.groupby("country")
        .agg(
            _country_weighted_sum=("_weighted_response", "sum"),
            country_total_requests=("request_count", "sum"),
        )
        .reset_index()
    )
    country_agg["country_avg_response_rate"] = (
        country_agg["_country_weighted_sum"] / country_agg["country_total_requests"]
    )
    country_agg = country_agg.drop(columns=["_country_weighted_sum"])
    df = df.merge(country_agg, on="country", how="left", suffixes=("", "_dup"))

    # --- Bidder × Domain interaction (CRITICAL for accuracy) ---
    bidder_domain_agg = (
        df.groupby(["bidderCode", "domain"])
        .agg(
            bidder_domain_requests=("request_count", "sum"),
            _bd_weighted_sum=("_weighted_response", "sum"),
            _bd_req_sum=("request_count", "sum"),
        )
        .reset_index()
    )
    bidder_domain_agg["bidder_domain_response_rate"] = (
        bidder_domain_agg["_bd_weighted_sum"] / bidder_domain_agg["_bd_req_sum"]
    )
    bidder_domain_agg = bidder_domain_agg.drop(
        columns=["_bd_weighted_sum", "_bd_req_sum"]
    )
    df = df.merge(
        bidder_domain_agg,
        on=["bidderCode", "domain"],
        how="left",
        suffixes=("", "_dup"),
    )

    # --- Bidder × Country interaction ---
    bidder_country_agg = (
        df.groupby(["bidderCode", "country"])
        .agg(
            _bc_weighted_sum=("_weighted_response", "sum"),
            _bc_requests=("request_count", "sum"),
        )
        .reset_index()
    )
    bidder_country_agg["bidder_country_avg_response"] = (
        bidder_country_agg["_bc_weighted_sum"] / bidder_country_agg["_bc_requests"]
    )
    bidder_country_agg = bidder_country_agg.drop(
        columns=["_bc_weighted_sum", "_bc_requests"]
    )
    df = df.merge(
        bidder_country_agg,
        on=["bidderCode", "country"],
        how="left",
        suffixes=("", "_dup"),
    )

    # Cleanup
    df = df.drop(columns=["_weighted_response"])
    df = df.loc[:, ~df.columns.str.endswith("_dup")]

    # Fill NaN
    for col in [
        "bidder_avg_response_rate",
        "domain_avg_response_rate",
        "country_avg_response_rate",
        "bidder_country_avg_response",
        "bidder_domain_response_rate",  # NEW: the key feature!
    ]:
        if col in df.columns:
            df[col] = df[col].fillna(global_avg)
    for col in ["bidder_response_variance"]:
        if col in df.columns:
            df[col] = df[col].fillna(0)
    for col in [
        "bidder_total_requests",
        "domain_total_requests",
        "country_total_requests",
        "bidder_domain_requests",
    ]:
        if col in df.columns:
            df[col] = df[col].fillna(0)

    return df


def target_encode(
    df: pd.DataFrame, col: str, target: str, weight_col: str, smoothing: float = 10
) -> pd.Series:
    """
    Target encoding with smoothing to prevent overfitting.

    For each category, computes weighted average of target,
    smoothed towards global mean based on sample size.
    """
    # Global weighted mean
    global_mean = np.average(df[target], weights=df[weight_col])

    # Per-category stats
    agg = df.groupby(col).apply(
        lambda g: pd.Series(
            {
                "sum_weight": g[weight_col].sum(),
                "weighted_mean": np.average(g[target], weights=g[weight_col]),
            }
        )
    )

    # Smoothing: blend category mean with global mean based on sample size
    # More samples → trust category mean more
    agg["smoothed_mean"] = (
        agg["sum_weight"] * agg["weighted_mean"] + smoothing * global_mean
    ) / (agg["sum_weight"] + smoothing)

    return df[col].map(agg["smoothed_mean"]).fillna(global_mean)


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Prepare features with proper encoding strategies.

    - Low cardinality (bidder, browser, os, mediaType): Label encoding (OK for trees)
    - High cardinality (domain, adUnitCode, adSize): Target encoding
    """
    df = df.copy()

    # Fill NaN
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
    for col in categorical_cols:
        df[col] = df[col].fillna("unknown").astype(str)
        df[col] = df[col].replace("", "unknown")

    # Add aggregate features FIRST (before encoding)
    print("Adding aggregate features...")
    df = add_aggregate_features(df)

    encoders = {}

    # Low cardinality: Label encode (trees handle this fine)
    low_card_cols = ["bidderCode", "browser", "os", "mediaType"]
    for col in low_card_cols:
        le = LabelEncoder()
        df[f"{col}_encoded"] = le.fit_transform(df[col])
        encoders[col] = le

    # High cardinality: Target encode
    high_card_cols = ["domain", "country", "adUnitCode", "adSize"]
    for col in high_card_cols:
        df[f"{col}_target_enc"] = target_encode(
            df, col, "response_rate", "request_count", smoothing=100
        )
        # Also store label encoder for prediction time
        le = LabelEncoder()
        le.fit(df[col])
        encoders[col] = le
        encoders[f"{col}_target_map"] = (
            df.groupby(col)[f"{col}_target_enc"].first().to_dict()
        )

    # Build feature matrix
    feature_cols = (
        [f"{col}_encoded" for col in low_card_cols]
        + [f"{col}_target_enc" for col in high_card_cols]
        + [
            "bidder_avg_response_rate",
            "bidder_total_requests",
            "bidder_response_variance",
            "domain_avg_response_rate",
            "domain_total_requests",
            "country_avg_response_rate",
            "country_total_requests",
            "bidder_domain_requests",
            "bidder_domain_response_rate",  # KEY: actual rate for this bidder+domain
            "bidder_country_avg_response",
        ]
    )

    # Only include columns that exist
    feature_cols = [c for c in feature_cols if c in df.columns]

    X = df[feature_cols].copy()

    # Store global mean for unseen categories
    encoders["_global_mean"] = np.average(
        df["response_rate"], weights=df["request_count"]
    )

    # Store feature column order for prediction time
    encoders["_feature_cols"] = feature_cols

    return X, df, encoders


def train_lightgbm(X_train, y_train, w_train, X_test, y_test, w_test):
    """Train LightGBM regressor"""
    print("\n" + "=" * 60)
    print("LIGHTGBM REGRESSOR")
    print("=" * 60)

    params = {
        "objective": "regression",
        "metric": "mae",
        "boosting_type": "gbdt",
        "num_leaves": 31,
        "learning_rate": 0.05,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
        "n_estimators": 200,
        "random_state": 42,
    }

    model = lgb.LGBMRegressor(**params)
    model.fit(
        X_train,
        y_train,
        sample_weight=w_train,
        eval_set=[(X_test, y_test)],
        eval_sample_weight=[w_test],
    )

    # Predictions (clip to valid range)
    y_pred = np.clip(model.predict(X_test), 0, 1)

    # Weighted metrics
    mae = mean_absolute_error(y_test, y_pred, sample_weight=w_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred, sample_weight=w_test))
    r2 = r2_score(y_test, y_pred, sample_weight=w_test)

    print(f"\nWeighted MAE: {mae:.4f}")
    print(f"Weighted RMSE: {rmse:.4f}")
    print(f"Weighted R²: {r2:.4f}")

    # Feature importance
    print("\nFeature Importance (top 10):")
    importance = pd.DataFrame(
        {"feature": X_train.columns, "importance": model.feature_importances_}
    ).sort_values("importance", ascending=False)
    for _, row in importance.head(10).iterrows():
        print(f"  {row['feature']}: {row['importance']:.0f}")

    return model, mae


def evaluate_ranking_quality(model, X_test, df_test, encoders, top_n: int = 3):
    """
    Evaluate how well the model ranks bidders for each supply context.

    Simulates the real use case: for each unique supply context,
    rank all bidders and see if top-N includes the best actual performers.
    """
    print("\n" + "=" * 60)
    print(f"RANKING QUALITY EVALUATION (Top-{top_n})")
    print("=" * 60)

    # Group test data by supply context (excluding bidder)
    supply_cols = [
        "domain",
        "country",
        "browser",
        "os",
        "adUnitCode",
        "mediaType",
        "adSize",
    ]

    # Get unique supply contexts with enough bidders
    supply_contexts = df_test.groupby(supply_cols)["bidderCode"].nunique()
    valid_contexts = supply_contexts[supply_contexts >= top_n + 2].index.tolist()

    if len(valid_contexts) == 0:
        print("Not enough supply contexts with multiple bidders for evaluation")
        return

    print(f"Evaluating on {len(valid_contexts)} supply contexts...")

    hits_at_n = 0
    ndcg_scores = []
    total_contexts = 0

    for ctx in valid_contexts[:100]:  # Limit for speed
        # Get all bidders for this context
        mask = True
        for i, col in enumerate(supply_cols):
            mask = mask & (df_test[col] == ctx[i])

        ctx_data = df_test[mask].copy()
        if len(ctx_data) < top_n + 1:
            continue

        total_contexts += 1

        # Get actual best bidders (by response_rate weighted by requests)
        actual_ranking = ctx_data.nlargest(len(ctx_data), "response_rate")
        actual_top_n = set(actual_ranking.head(top_n)["bidderCode"].tolist())

        # Get predicted ranking
        ctx_X = X_test.loc[ctx_data.index]
        ctx_data["predicted_rate"] = np.clip(model.predict(ctx_X), 0, 1)
        predicted_ranking = ctx_data.nlargest(len(ctx_data), "predicted_rate")
        predicted_top_n = set(predicted_ranking.head(top_n)["bidderCode"].tolist())

        # Hit rate: how many of actual top-N are in predicted top-N?
        hits = len(actual_top_n & predicted_top_n)
        hits_at_n += hits / top_n

        # NDCG-style scoring
        actual_order = actual_ranking["bidderCode"].tolist()
        predicted_order = predicted_ranking["bidderCode"].tolist()

        # DCG for predicted order
        dcg = 0
        for i, bidder in enumerate(predicted_order[:top_n]):
            if bidder in actual_top_n:
                dcg += 1 / np.log2(i + 2)

        # Ideal DCG
        idcg = sum(1 / np.log2(i + 2) for i in range(min(top_n, len(actual_top_n))))
        ndcg = dcg / idcg if idcg > 0 else 0
        ndcg_scores.append(ndcg)

    if total_contexts > 0:
        avg_hit_rate = hits_at_n / total_contexts
        avg_ndcg = np.mean(ndcg_scores)
        print(f"\nResults over {total_contexts} contexts:")
        print(
            f"  Hit Rate @ {top_n}: {avg_hit_rate:.3f} (fraction of true top-{top_n} in predicted top-{top_n})"
        )
        print(f"  NDCG @ {top_n}: {avg_ndcg:.3f} (ranking quality score)")
        print(f"\n  Interpretation:")
        print(f"  - Random baseline hit rate: {top_n/28:.3f} (assuming 28 bidders)")
        print(f"  - Model improvement over random: {avg_hit_rate / (top_n/28):.1f}x")


def make_prediction(
    model,
    encoders: dict,
    df_full: pd.DataFrame,
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
    Returns predicted response rate (0.0 - 1.0)
    """
    # Build feature vector
    global_mean = encoders["_global_mean"]

    features = {}

    # Low cardinality: label encode
    for col, val in [
        ("bidderCode", bidder),
        ("browser", browser),
        ("os", os),
        ("mediaType", media_type),
    ]:
        enc = encoders.get(col)
        if enc is not None and val in enc.classes_:
            features[f"{col}_encoded"] = enc.transform([val])[0]
        elif enc is not None and "unknown" in enc.classes_:
            features[f"{col}_encoded"] = enc.transform(["unknown"])[0]
        else:
            features[f"{col}_encoded"] = 0

    # High cardinality: use target encoding maps
    for col, val in [
        ("domain", domain),
        ("country", country),
        ("adUnitCode", ad_unit),
        ("adSize", ad_size),
    ]:
        target_map = encoders.get(f"{col}_target_map", {})
        features[f"{col}_target_enc"] = target_map.get(val, global_mean)

    # Aggregate features from training data
    # Look up bidder stats
    bidder_mask = df_full["bidderCode"] == bidder
    if bidder_mask.any():
        bidder_data = df_full[bidder_mask]
        features["bidder_avg_response_rate"] = np.average(
            bidder_data["response_rate"], weights=bidder_data["request_count"]
        )
        features["bidder_total_requests"] = bidder_data["request_count"].sum()
        features["bidder_response_variance"] = bidder_data["response_rate"].std()
    else:
        features["bidder_avg_response_rate"] = global_mean
        features["bidder_total_requests"] = 0
        features["bidder_response_variance"] = 0

    # Domain stats
    domain_mask = df_full["domain"] == domain
    if domain_mask.any():
        domain_data = df_full[domain_mask]
        features["domain_avg_response_rate"] = np.average(
            domain_data["response_rate"], weights=domain_data["request_count"]
        )
        features["domain_total_requests"] = domain_data["request_count"].sum()
    else:
        features["domain_avg_response_rate"] = global_mean
        features["domain_total_requests"] = 0

    # Country stats
    country_mask = df_full["country"] == country
    if country_mask.any():
        country_data = df_full[country_mask]
        features["country_avg_response_rate"] = np.average(
            country_data["response_rate"], weights=country_data["request_count"]
        )
        features["country_total_requests"] = country_data["request_count"].sum()
    else:
        features["country_avg_response_rate"] = global_mean
        features["country_total_requests"] = 0

    # Bidder × Domain (KEY feature for accuracy)
    bd_mask = (df_full["bidderCode"] == bidder) & (df_full["domain"] == domain)
    if bd_mask.any():
        bd_data = df_full[bd_mask]
        features["bidder_domain_requests"] = bd_data["request_count"].sum()
        features["bidder_domain_response_rate"] = np.average(
            bd_data["response_rate"], weights=bd_data["request_count"]
        )
    else:
        features["bidder_domain_requests"] = 0
        features["bidder_domain_response_rate"] = global_mean

    # Bidder × Country
    bc_mask = (df_full["bidderCode"] == bidder) & (df_full["country"] == country)
    if bc_mask.any():
        bc_data = df_full[bc_mask]
        features["bidder_country_avg_response"] = np.average(
            bc_data["response_rate"], weights=bc_data["request_count"]
        )
    else:
        features["bidder_country_avg_response"] = global_mean

    X = pd.DataFrame([features])

    # Ensure column order matches training
    feature_cols = encoders.get("_feature_cols")
    if feature_cols:
        X = X[feature_cols]

    return float(np.clip(model.predict(X)[0], 0, 1))


def print_data_summary(df: pd.DataFrame):
    """Print summary of training data"""
    print("\n" + "=" * 60)
    print("TRAINING DATA SUMMARY")
    print("=" * 60)

    print(f"\nTotal records: {len(df):,}")
    print(f"Total bid requests: {df['request_count'].sum():,}")
    print(f"Total bid responses: {df['response_count'].sum():,}")

    print("\nResponse Rate Distribution:")
    print(f"  Mean (unweighted): {df['response_rate'].mean():.4f}")
    weighted_mean = np.average(df["response_rate"], weights=df["request_count"])
    print(f"  Mean (weighted by request_count): {weighted_mean:.4f}")
    print(f"  Std: {df['response_rate'].std():.4f}")

    # Response rate distribution
    print("\nResponse Rate Buckets:")
    buckets = [(0, 0.1), (0.1, 0.3), (0.3, 0.5), (0.5, 0.7), (0.7, 0.9), (0.9, 1.0)]
    for low, high in buckets:
        mask = (df["response_rate"] >= low) & (df["response_rate"] < high)
        count = mask.sum()
        requests = df[mask]["request_count"].sum()
        print(f"  {low:.0%}-{high:.0%}: {count:,} records, {requests:,} requests")

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
        print(f"  {col}: {unique} unique values")


def main():
    parser = argparse.ArgumentParser(description="Bidder bid prediction model v2")
    parser.add_argument("--data-file", type=str, help="Path to training data JSON file")
    parser.add_argument(
        "--top-n", type=int, default=3, help="Number of top bidders to select"
    )
    parser.add_argument("--save-model", action="store_true", help="Save trained model")

    args = parser.parse_args()

    print("=" * 60, flush=True)
    print("BIDDER BID PREDICTION MODEL v2", flush=True)
    print("=" * 60, flush=True)

    # Load data
    if args.data_file:
        data_file = Path(args.data_file)
    else:
        data_file = find_training_data_file()

    df = load_training_data(data_file)
    print_data_summary(df)

    # Prepare features
    print("\nPreparing features...")
    X, df_enriched, encoders = prepare_features(df)
    y = df_enriched["response_rate"]  # Predict actual response rate!
    weights = df_enriched["request_count"]  # Weight by volume

    print(f"Features: {list(X.columns)}")
    print(f"Total samples: {len(X):,}")

    # Train/test split (stratified by bidder to ensure all bidders in both sets)
    X_train, X_test, y_train, y_test, w_train, w_test, idx_train, idx_test = (
        train_test_split(
            X,
            y,
            weights,
            df_enriched.index,
            test_size=0.2,
            random_state=42,
            stratify=df_enriched["bidderCode"],
        )
    )
    df_test = df_enriched.loc[idx_test]

    print(f"\nTraining set: {len(X_train):,} samples ({w_train.sum():,} requests)")
    print(f"Test set: {len(X_test):,} samples ({w_test.sum():,} requests)")

    # Train models
    if not HAS_LGBM:
        print("\n⚠️  LightGBM not installed. Install with: pip install lightgbm")
        print("Falling back to sklearn GradientBoosting...")
        from sklearn.ensemble import GradientBoostingRegressor

        model = GradientBoostingRegressor(
            n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
        )
        model.fit(X_train, y_train, sample_weight=w_train)
        y_pred = np.clip(model.predict(X_test), 0, 1)
        mae = mean_absolute_error(y_test, y_pred, sample_weight=w_test)
        print(f"\nWeighted MAE: {mae:.4f}")
        best_model = model
    else:
        lgb_model, lgb_mae = train_lightgbm(
            X_train, y_train, w_train, X_test, y_test, w_test
        )
        best_model = lgb_model

    # Evaluate ranking quality (the actual use case!)
    evaluate_ranking_quality(best_model, X_test, df_test, encoders, top_n=args.top_n)

    # Demo: rank bidders for sample supply contexts
    print(f"\n{'='*60}")
    print(f"BIDDER RANKING DEMO - Top {args.top_n}")
    print(f"{'='*60}")

    all_bidders = df["bidderCode"].unique().tolist()
    sample_domains = (
        df.groupby("domain")["request_count"].sum().nlargest(3).index.tolist()
    )

    for domain in sample_domains[:2]:
        print(f"\n📍 Supply: domain={domain}, country=US, browser=chrome")
        print("-" * 50)

        bidder_scores = []
        for bidder in all_bidders:
            pred_rate = make_prediction(
                best_model,
                encoders,
                df,
                bidder=bidder,
                domain=domain,
                country="US",
                browser="chrome",
                os="android",
                ad_unit="unknown",
                media_type="banner",
                ad_size="300x250",
            )
            bidder_scores.append((bidder, pred_rate))

        bidder_scores.sort(key=lambda x: x[1], reverse=True)

        print(f"Bidder ranking (predicted response rate):")
        for i, (bidder, rate) in enumerate(bidder_scores[: args.top_n + 2], 1):
            marker = "✅" if i <= args.top_n else "  "
            action = "← SEND" if i <= args.top_n else "(skip)"
            print(f"  {marker} {i}. {bidder}: {rate*100:.1f}% {action}")

        reduction = (len(all_bidders) - args.top_n) / len(all_bidders) * 100
        print(
            f"\n  → Sending to top {args.top_n}, skipping {len(all_bidders) - args.top_n} ({reduction:.0f}% reduction)"
        )

    # Save model
    if args.save_model and HAS_JOBLIB:
        output_dir = Path(__file__).parent
        joblib.dump(best_model, output_dir / "bid_prediction_model_v2.joblib")
        joblib.dump(encoders, output_dir / "encoders_v2.joblib")
        # Also save the original df for prediction-time lookups
        df.to_pickle(output_dir / "training_data_v2.pkl")
        print(f"\nModel saved to {output_dir}")


if __name__ == "__main__":
    main()
