"""Quick test script to verify v2 model predictions work.

Usage:
    python3 test_predictions.py
"""

import sys
from pathlib import Path

# Import the model module
import bid_prediction_model_v2 as model


def main():
    print("=" * 60)
    print("TESTING V2 MODEL PREDICTIONS")
    print("=" * 60)

    # Load data
    data_file = model.find_training_data_file()
    df = model.load_training_data(data_file)

    # Prepare features and train
    print("\nPreparing features and training model...")
    X, df_enriched, encoders = model.prepare_features(df)
    y = df_enriched["response_rate"]
    weights = df_enriched["request_count"]

    from sklearn.model_selection import train_test_split

    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, weights, test_size=0.2, random_state=42
    )

    # Train model
    if model.HAS_LGBM:
        import lightgbm as lgb

        lgb_model = lgb.LGBMRegressor(
            objective="regression", n_estimators=100, random_state=42, verbose=-1
        )
        lgb_model.fit(X_train, y_train, sample_weight=w_train)
        trained_model = lgb_model
        print("✓ Trained LightGBM model")
    else:
        from sklearn.ensemble import GradientBoostingRegressor

        gb_model = GradientBoostingRegressor(n_estimators=50, random_state=42)
        gb_model.fit(X_train, y_train, sample_weight=w_train)
        trained_model = gb_model
        print("✓ Trained sklearn GradientBoosting model")

    # Test predictions for various scenarios
    print("\n" + "-" * 60)
    print("TESTING PREDICTIONS")
    print("-" * 60)

    test_cases = [
        {"bidder": "pubmatic", "domain": "moovit.com", "country": "US"},
        {"bidder": "rubicon", "domain": "moovit.com", "country": "US"},
        {"bidder": "appnexusAst", "domain": "go.paddling.com", "country": "GB"},
        {"bidder": "vidazoo", "domain": "moovit.com", "country": "DE"},
        {
            "bidder": "unknown_bidder",
            "domain": "unknown.com",
            "country": "XX",
        },  # unseen values
    ]

    all_passed = True
    for i, tc in enumerate(test_cases, 1):
        try:
            pred = model.make_prediction(
                trained_model,
                encoders,
                df,
                bidder=tc["bidder"],
                domain=tc["domain"],
                country=tc["country"],
                browser="chrome",
                os="android",
            )

            # Validate prediction is in valid range
            assert 0 <= pred <= 1, f"Prediction {pred} out of range [0,1]"

            print(
                f"  {i}. {tc['bidder']} + {tc['domain']} ({tc['country']}): {pred*100:.1f}% ✓"
            )
        except Exception as e:
            print(f"  {i}. {tc['bidder']} + {tc['domain']}: FAILED - {e}")
            all_passed = False

    # Test ranking for a supply context
    print("\n" + "-" * 60)
    print("TESTING BIDDER RANKING")
    print("-" * 60)

    all_bidders = df["bidderCode"].unique().tolist()
    test_domain = df["domain"].value_counts().index[0]  # most common domain

    scores = []
    for bidder in all_bidders:
        pred = model.make_prediction(
            trained_model, encoders, df, bidder=bidder, domain=test_domain, country="US"
        )
        scores.append((bidder, pred))

    scores.sort(key=lambda x: x[1], reverse=True)

    print(f"\nTop 5 bidders for {test_domain}:")
    for i, (bidder, score) in enumerate(scores[:5], 1):
        print(f"  {i}. {bidder}: {score*100:.1f}%")

    # Verify ranking makes sense (scores should vary)
    score_range = scores[0][1] - scores[-1][1]
    if score_range < 0.05:
        print(
            f"\n⚠️  Warning: Score range is small ({score_range:.3f}), predictions may be clustered"
        )
    else:
        print(f"\n✓ Good score spread: {score_range:.2f} range between top and bottom")

    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("ALL TESTS PASSED ✓")
    else:
        print("SOME TESTS FAILED ✗")
        sys.exit(1)
    print("=" * 60)


if __name__ == "__main__":
    main()
