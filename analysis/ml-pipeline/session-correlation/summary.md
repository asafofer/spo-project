# Session Correlation Analysis Summary

## Hypothesis
Impression Lift Hypothesis: Less timeout → auctions finished faster → more auctions per session → impression → viewability + revenue

## Data
- **Total sessions analyzed**: 13,351
- **Filter**: Sessions with length 5-15 minutes (median ± 5 min)

## Summary Statistics

- **Timeouts per session**: Mean=265.31, Median=60.00
- **Auctions per session**: Mean=109.96, Median=99.00
- **Revenue per session (RPS)**: Mean=$0.0573, Median=$0.0279

## Correlation Results

### Timeouts vs Auctions per session
- **Correlation**: 0.0444
- **P-value**: 2.9106e-07
- **Interpretation**: ✓ Positive correlation

### Timeouts vs Revenue per session
- **Correlation**: 0.1030
- **P-value**: 8.4595e-33
- **Interpretation**: ✓ Positive correlation

## Conclusion

The analysis shows correlations between timeouts, auctions, and revenue for sessions of similar length (5-15 minutes).

**Visualization**: `session-correlation-analysis.png`