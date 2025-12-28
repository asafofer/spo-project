# Bidder Bid Prediction Model

Predicts the probability that a bidder will respond to a bid request based on supply characteristics. This enables filtering out low-probability requests to improve bid rates and CPMs.

## Goal

> "Predict the likelihood of the top bidders to bid per supply opportunity. If the prediction score is low, don't send requests. As a result, seats/placements should improve - we shift some of the filtering done on the SSP side to our side which should be more effective and increase bid rate, CPMs etc."

## Quick Start

### 1. Fetch Training Data

From the `analysis` directory:

```bash
# Fetch 50,000 aggregated records (default)
bun run ml-pipeline/fetch-bidder-training-data.ts

# Fetch more data for better model accuracy
bun run ml-pipeline/fetch-bidder-training-data.ts --limit 100000

# Fetch data from a specific time range
bun run ml-pipeline/fetch-bidder-training-data.ts --start-time 2024-01-01T00:00:00Z
```

This creates `data/bidder-training-data.json` with the training data.

### 2. Train the Model

```bash
cd ml-pipeline/bidder-prediction
python3 bid_prediction_model.py
```

This will:
- Load the training data
- Train both Logistic Regression and Gradient Boosting models
- Evaluate performance (accuracy, ROC-AUC)
- Show feature importance
- Analyze different decision thresholds

### 3. Make Predictions

```bash
# Predict for a specific bidder/domain combination
python3 bid_prediction_model.py --predict --bidder pubmatic --domain example.com

# With more context
python3 bid_prediction_model.py --predict \
  --bidder pubmatic \
  --domain example.com \
  --country US \
  --browser Chrome \
  --os Windows
```

## Data Shape

Each training record represents a unique combination of supply characteristics:

| Field | Description |
|-------|-------------|
| `bidderCode` | Bidder name (e.g., 'pubmatic', 'appnexus') |
| `domain` | Publisher domain |
| `country` | User country (from yotoCountry) |
| `browser` | Browser type |
| `os` | Operating system |
| `adUnitCode` | Ad unit identifier |
| `request_count` | Number of bid requests for this combination |
| `response_count` | Number of bid responses |
| `response_rate` | response_count / request_count |
| `did_respond` | Binary label: 1 if any responses, 0 otherwise |

## Model Output

### Performance Metrics

- **Accuracy**: Overall prediction accuracy
- **ROC-AUC**: Area under the ROC curve (higher is better)
- **Precision/Recall**: Per-class metrics
- **Feature Importance**: Which factors most influence bid likelihood

### Threshold Analysis

The model provides threshold analysis to help decide when to skip requests:

```
Threshold | Skip Rate | Missed Bids | Saved Requests
---------------------------------------------------------
  0.10    |  5.2%     |  0.8%       | 2,600
  0.15    | 12.3%     |  2.1%       | 6,150
  0.20    | 21.5%     |  4.5%       | 10,750
  ...
```

Interpretation:
- **Threshold 0.15**: If we skip all requests with predicted probability < 15%, we would:
  - Skip 12.3% of all requests (save infrastructure costs)
  - Miss only 2.1% of bids that would have happened
  - A good tradeoff!

## Command Line Options

### fetch-bidder-training-data.ts

| Option | Description | Default |
|--------|-------------|---------|
| `--limit, -l` | Max aggregated records | 50000 |
| `--dataset, -d` | Axiom dataset name | prebid-events |
| `--output, -o` | Output file path | data/bidder-training-data.json |
| `--start-time` | Query start time (ISO) | - |
| `--end-time` | Query end time (ISO) | now |

### bid_prediction_model.py

| Option | Description |
|--------|-------------|
| `--data-file` | Path to training data JSON |
| `--predict` | Make a prediction (requires --bidder, --domain) |
| `--bidder` | Bidder code for prediction |
| `--domain` | Domain for prediction |
| `--country` | Country for prediction (default: unknown) |
| `--browser` | Browser for prediction (default: unknown) |
| `--os` | OS for prediction (default: unknown) |
| `--ad-unit` | Ad unit for prediction (default: unknown) |
| `--save-model` | Save trained model to disk |
| `--use-gb` | Use Gradient Boosting (default: best model) |

## Example Usage

### Training Flow

```bash
# 1. Ensure you're in the analysis directory
cd analysis

# 2. Fetch training data
bun run ml-pipeline/fetch-bidder-training-data.ts --limit 100000

# 3. Train and evaluate
cd ml-pipeline/bidder-prediction
python3 bid_prediction_model.py

# 4. Save the model for production use
python3 bid_prediction_model.py --save-model
```

### Prediction Flow

```bash
# Simple prediction
python3 bid_prediction_model.py --predict --bidder ozone --domain go.paddling.com

# Full context prediction
python3 bid_prediction_model.py --predict \
  --bidder pubmatic \
  --domain example.com \
  --country GB \
  --browser Safari \
  --os iOS \
  --ad-unit leaderboard
```

## Interpreting Results

### Prediction Score

- **0.0 - 0.15**: Very unlikely to bid → **SKIP REQUEST**
- **0.15 - 0.30**: Borderline → Consider skipping
- **0.30 - 0.60**: Moderate probability → Send request
- **0.60 - 1.0**: High probability → Definitely send

### Feature Importance

The model shows which factors most influence bid likelihood:

```
Feature Importance:
  bidderCode: 0.4521    ← Bidder identity matters most
  domain: 0.2134        ← Publisher site matters
  country: 0.1256       ← Geography influences bidding
  browser: 0.0823       ← Browser type has some effect
  os: 0.0712            ← OS has minor effect
  adUnitCode: 0.0554    ← Ad placement type
```

## Dependencies

Python packages (already in `requirements.txt`):
- pandas
- numpy
- scikit-learn
- scipy

Optional:
- joblib (for model persistence)

## Files

| File | Purpose |
|------|---------|
| `fetch-bidder-training-data.ts` | Fetches training data from Axiom |
| `bid_prediction_model.py` | Trains model and makes predictions |
| `data/bidder-training-data.json` | Training data (generated) |
| `bid_prediction_model.joblib` | Saved model (if --save-model used) |
| `encoders.joblib` | Saved encoders (if --save-model used) |


