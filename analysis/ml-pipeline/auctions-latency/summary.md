# Auctions vs Latency per Auction Correlation Analysis Summary

## Hypothesis
Lower latency per auction → auctions complete faster → more auctions per minute

## Data
- **Total sessions**: 7,774
- **Sessions after outlier removal**: 4,329
- **Outliers removed**: 3,329 (43.5%)

## Summary Statistics

- **Auctions per minute**: Mean=4.8297, Median=4.7237
- **Average Latency per Auction**: Mean=8615.45 ms, Median=8011.49 ms

## Correlation Results (Time-Normalized: Auctions per Minute)

### Avg Latency/Auction
- **Correlation**: -0.2245 ***
- **P-value**: 1.4447e-50
- **N**: 4,329
- **Direction**: ✓ Supports hypothesis

### Median Latency/Auction
- **Correlation**: -0.1619 ***
- **P-value**: 8.4279e-27
- **N**: 4,329
- **Direction**: ✓ Supports hypothesis

### P75 Latency/Auction
- **Correlation**: -0.4224 ***
- **P-value**: 6.9371e-187
- **N**: 4,329
- **Direction**: ✓ Supports hypothesis

### P90 Latency/Auction
- **Correlation**: -0.5034 ***
- **P-value**: 6.6402e-277
- **N**: 4,329
- **Direction**: ✓ Supports hypothesis

### P95 Latency/Auction
- **Correlation**: -0.5069 ***
- **P-value**: 2.2340e-281
- **N**: 4,329
- **Direction**: ✓ Supports hypothesis

### P99 Latency/Auction
- **Correlation**: -0.5085 ***
- **P-value**: 1.6624e-283
- **N**: 4,329
- **Direction**: ✓ Supports hypothesis

## Conclusion

✓ **Hypothesis SUPPORTED**: Lower latency per auction is associated with more auctions per minute
- Best correlation: P99 Latency/Auction = -0.5085

**Note**: Time-normalized analysis (auctions per minute) controls for session length.

**Visualization**: `auctions-latency-correlation.png`