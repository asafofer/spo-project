# Bidder Bid Prediction Model

Predicts the probability that a bidder will respond to a bid request based on supply characteristics. This enables smart bidder selection to improve bid rates and CPMs.

## Goal

> "Given a supply opportunity, rank all bidders by likelihood to respond, then send requests only to the top N. This shifts filtering to our side, improving bid rate and CPMs."

## Models

### v2 (Recommended) - `bid_prediction_model_v2.py`

**Key improvements:**

- Predicts actual `response_rate` (regression) instead of binary classification
- Uses sample weights (`request_count`) so high-volume combos count more
- Target encoding for high-cardinality categoricals (domain, adUnitCode)
- **`bidder_domain_response_rate`** - the actual historical rate for each bidder+domain combo
- Aggregate features: bidder avg, domain avg, country avg response rates
- Uses LightGBM for better categorical handling

**Performance:**

- Hit Rate @ 3: **84.3%** (fraction of true top-3 bidders in predicted top-3)
- NDCG @ 3: **0.869** (ranking quality score)
- **7.9x improvement over random** baseline

### v1 (Legacy) - `bid_prediction_model.py`

Binary classifier predicting "did bidder ever respond?" Good ROC-AUC (0.93) but predictions are clustered (87-91%), making ranking difficult.

## Quick Start

### 1. Fetch Training Data

From the `analysis` directory:

```bash
bun run ml-pipeline/fetch-bidder-training-data.ts
```

This creates `data/bidder-training-data.json` with aggregated bidder response data.

### 2. Train the Model (v2)

```bash
cd ml-pipeline/bidder-prediction
python3 bid_prediction_model_v2.py --top-n 3
```

### 3. Test Predictions

```bash
python3 test_predictions.py
```

### 4. Verify Against Axiom

```bash
cd ../..
bun run queries/verify-bidder-response-rate.ts --bidder vidazoo --domain moovit.com --country US
```

## Data Shape

Each training record represents a unique combination of supply characteristics:

| Field            | Description                                 |
| ---------------- | ------------------------------------------- |
| `bidderCode`     | Bidder name (e.g., 'pubmatic', 'appnexus')  |
| `domain`         | Publisher domain                            |
| `country`        | User country                                |
| `browser`        | Browser type                                |
| `os`             | Operating system                            |
| `adUnitCode`     | Ad unit identifier                          |
| `mediaType`      | banner, video, etc.                         |
| `adSize`         | Ad dimensions (e.g., 300x250)               |
| `request_count`  | Number of bid requests for this combination |
| `response_count` | Number of bid responses                     |
| `response_rate`  | response_count / request_count              |

## v2 Features

The v2 model uses 18 engineered features:

| Feature                       | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `bidder_domain_response_rate` | **KEY:** Actual response rate for this bidder+domain |
| `bidder_country_avg_response` | Bidder's response rate in this country               |
| `bidder_avg_response_rate`    | Bidder's overall weighted response rate              |
| `bidder_domain_requests`      | Volume of bidder requests on this domain             |
| `domain_avg_response_rate`    | Domain's overall response rate                       |
| `domain_target_enc`           | Target-encoded domain value                          |
| `country_target_enc`          | Target-encoded country value                         |
| ...                           | Plus encoded categoricals                            |

**Feature Importance:**

```
bidder_country_avg_response: 867   ← How bidder performs in this country
bidder_domain_response_rate: 797   ← KEY: actual rate for this bidder+domain
country_target_enc: 542            ← Country characteristics
adUnitCode_target_enc: 500         ← Ad unit characteristics
```

## Command Line Options

### bid_prediction_model_v2.py

| Option         | Description                     | Default     |
| -------------- | ------------------------------- | ----------- |
| `--data-file`  | Path to training data JSON      | auto-detect |
| `--top-n`      | Number of top bidders to select | 3           |
| `--save-model` | Save trained model to disk      | false       |

### fetch-bidder-training-data.ts

| Option    | Description            | Default |
| --------- | ---------------------- | ------- |
| `--limit` | Max aggregated records | 100000  |
| `--days`  | Days of data to fetch  | 30      |

### verify-bidder-response-rate.ts

| Option      | Description            | Default |
| ----------- | ---------------------- | ------- |
| `--bidder`  | Bidder code (required) | -       |
| `--domain`  | Domain filter          | all     |
| `--country` | Country filter         | all     |
| `--days`    | Days of data           | 30      |

## Dependencies

Python packages (in `requirements.txt`):

- pandas, numpy
- scikit-learn
- lightgbm (recommended)
- joblib (for model persistence)

**macOS note:** LightGBM requires libomp:

```bash
brew install libomp
```

## Files

| File                             | Purpose                                |
| -------------------------------- | -------------------------------------- |
| `fetch-bidder-training-data.ts`  | Fetches training data from Axiom       |
| `bid_prediction_model_v2.py`     | **v2 model** - regression with ranking |
| `bid_prediction_model.py`        | v1 model - binary classification       |
| `test_predictions.py`            | Quick test script for v2               |
| `verify-bidder-response-rate.ts` | Verify predictions against Axiom       |

## v1 vs v2 Comparison

| Aspect         | v1                   | v2                            |
| -------------- | -------------------- | ----------------------------- |
| Target         | Binary `did_respond` | Actual `response_rate`        |
| Sample Weights | None                 | `request_count`               |
| Encoding       | Label encoding       | Target + Label                |
| Features       | 8 raw                | 18 engineered                 |
| Key Feature    | -                    | `bidder_domain_response_rate` |
| Hit Rate @ 3   | Not measured         | **84.3%**                     |
| vs Random      | -                    | **7.9x better**               |
