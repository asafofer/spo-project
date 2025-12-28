# Latency vs Revenue Correlation Analysis Summary

## Hypothesis
Lower latency → Higher revenue per session

## Data
- **Total sessions**: 50,000
- **Sessions after outlier removal**: 26,216
- **Outliers removed**: 17,639 (40.2%)

## Summary Statistics

- **Average Latency**: Mean=861.61 ms, Median=808.22 ms
- **Revenue per session**: Mean=$0.0263, Median=$0.0168

## Correlation Results

### Average Latency
- **Correlation**: -0.0323 ***
- **P-value**: 1.6935e-07
- **N**: 26,216
- **Direction**: ✓ Supports hypothesis

### Median Latency
- **Correlation**: -0.0297 ***
- **P-value**: 1.5693e-06
- **N**: 26,216
- **Direction**: ✓ Supports hypothesis

### P50 Latency
- **Correlation**: -0.0297 ***
- **P-value**: 1.5693e-06
- **N**: 26,216
- **Direction**: ✓ Supports hypothesis

### P75 Latency
- **Correlation**: -0.0446 ***
- **P-value**: 4.8659e-13
- **N**: 26,216
- **Direction**: ✓ Supports hypothesis

### P90 Latency
- **Correlation**: -0.0157 *
- **P-value**: 1.0869e-02
- **N**: 26,216
- **Direction**: ✓ Supports hypothesis

### P95 Latency
- **Correlation**: 0.0131 *
- **P-value**: 3.3428e-02
- **N**: 26,216
- **Direction**: ✗ Does not support hypothesis

### P99 Latency
- **Correlation**: 0.1099 ***
- **P-value**: 3.2276e-71
- **N**: 26,216
- **Direction**: ✗ Does not support hypothesis

## Conclusion

✗ **Hypothesis NOT SUPPORTED**: No significant negative correlation found

**Visualization**: `latency-revenue-correlation.png`