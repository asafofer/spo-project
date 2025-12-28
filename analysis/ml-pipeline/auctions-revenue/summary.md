# Auctions vs Revenue Correlation Analysis Summary

## Hypothesis
More auctions per minute → More opportunities to win → Higher revenue

## Data
- **Total sessions**: 50,000
- **Sessions after outlier removal**: 36,432
- **Outliers removed**: 7,423 (16.9%)

## Summary Statistics

- **Auctions per minute (time-normalized)**: Mean=12.9441, Median=10.5933
- **Revenue per session**: Mean=$0.0254, Median=$0.0156

## Correlation Results

- **Correlation**: -0.0292 ***
- **P-value**: 2.4598e-08
- **N**: 36,432

## Conclusion

✗ **Hypothesis REJECTED**: More auctions per minute is associated with lower revenue
- Negative correlation = -0.0292

**Note**: Using time-normalized metric (auctions per minute) to control for session length.

**Visualization**: `auctions-revenue-correlation.png`