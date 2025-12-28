"""Latency vs Revenue Correlation Analysis

Measures correlation between average latency per session and revenue per session.
"""

import json
from pathlib import Path
import pandas as pd
import numpy as np
from scipy.stats import pearsonr
import matplotlib.pyplot as plt
import seaborn as sns


def load_aggregated_sessions(json_file_path: Path) -> pd.DataFrame:
    """Load pre-aggregated session data from JSON file"""
    with open(json_file_path, "r") as f:
        data = json.load(f)

    sessions = data["data"]
    df = pd.DataFrame(sessions)

    # Convert latency metrics to seconds for easier interpretation
    latency_cols = [
        "avg_latency_ms",
        "median_latency_ms",
        "p50_latency_ms",
        "p75_latency_ms",
        "p90_latency_ms",
        "p95_latency_ms",
        "p99_latency_ms",
    ]
    for col in latency_cols:
        if col in df.columns:
            sec_col = col.replace("_ms", "_sec")
            df[sec_col] = df[col] / 1000

    return df


def find_aggregated_sessions_file() -> Path:
    """Find the aggregated sessions data file"""
    data_path = Path(__file__).parent.parent.parent / "data"
    data_file = data_path / "axiom-sessions-aggregated.json"
    if not data_file.exists():
        raise FileNotFoundError(
            f"Aggregated sessions file not found: {data_file}\n"
            "Please run: bun run ml-pipeline/fetch-aggregated-sessions.ts"
        )
    return data_file


def remove_outliers_iqr(
    df: pd.DataFrame, columns: list, factor: float = 1.5
) -> pd.DataFrame:
    """Remove outliers using IQR method for specified columns"""
    df_clean = df.copy()

    for col in columns:
        if col in df_clean.columns:
            Q1 = df_clean[col].quantile(0.25)
            Q3 = df_clean[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - factor * IQR
            upper_bound = Q3 + factor * IQR

            # Keep only values within bounds
            df_clean = df_clean[
                (df_clean[col] >= lower_bound) & (df_clean[col] <= upper_bound)
            ]

    return df_clean


def calculate_correlations(df: pd.DataFrame, remove_outliers: bool = True):
    """Calculate Pearson correlations for different latency metrics"""
    # Filter to sessions with valid latency and revenue data
    # Use median as the base filter since it's more robust
    df_valid = df[
        (df["median_latency_ms"] > 0) & (df["revenue_per_session"] > 0)
    ].copy()

    original_count = len(df_valid)

    # Remove outliers if requested
    if remove_outliers:
        # Remove outliers from both latency metrics and revenue
        latency_metrics = [
            "avg_latency_ms",
            "median_latency_ms",
            "p50_latency_ms",
            "p75_latency_ms",
            "p90_latency_ms",
            "p95_latency_ms",
            "p99_latency_ms",
        ]
        outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
            "revenue_per_session"
        ]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)
        removed_count = original_count - len(df_valid)
        print(
            f"Outlier removal: {removed_count:,} sessions removed ({removed_count/original_count*100:.1f}%), {len(df_valid):,} remaining"
        )

    correlations = {}
    latency_metrics = [
        "avg_latency_ms",
        "median_latency_ms",
        "p50_latency_ms",
        "p75_latency_ms",
        "p90_latency_ms",
        "p95_latency_ms",
        "p99_latency_ms",
    ]

    for metric in latency_metrics:
        if metric in df_valid.columns:
            # Filter to sessions with valid values for this specific metric
            df_metric = df_valid[df_valid[metric] > 0].copy()
            if len(df_metric) > 1:
                corr, p = pearsonr(df_metric[metric], df_metric["revenue_per_session"])
                correlations[metric] = {
                    "correlation": corr,
                    "p_value": p,
                    "n": len(df_metric),
                }
            else:
                correlations[metric] = {"correlation": None, "p_value": None, "n": 0}

    return {
        "correlations": correlations,
        "valid_sessions": len(df_valid),
        "original_sessions": original_count,
        "outliers_removed": original_count - len(df_valid) if remove_outliers else 0,
    }


def print_summary_stats(df: pd.DataFrame, correlations: dict):
    """Print summary statistics"""
    # Use the same filtering as in calculate_correlations
    df_valid = df[
        (df["median_latency_ms"] > 0) & (df["revenue_per_session"] > 0)
    ].copy()

    # Apply same outlier removal if it was done
    if correlations.get("outliers_removed", 0) > 0:
        latency_metrics = [
            "avg_latency_ms",
            "median_latency_ms",
            "p50_latency_ms",
            "p75_latency_ms",
            "p90_latency_ms",
            "p95_latency_ms",
            "p99_latency_ms",
        ]
        outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
            "revenue_per_session"
        ]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    print("=" * 60)
    print("LATENCY vs REVENUE CORRELATION ANALYSIS")
    print("=" * 60)
    print(f"\nTotal sessions: {len(df)}")
    print(
        f"Original valid sessions: {correlations.get('original_sessions', correlations['valid_sessions']):,}"
    )
    if correlations.get("outliers_removed", 0) > 0:
        print(f"Outliers removed: {correlations['outliers_removed']:,}")
    print(f"Sessions after cleaning: {correlations['valid_sessions']:,}")
    print("\nSummary Statistics:")
    print("-" * 60)

    # Show different latency metrics
    if "avg_latency_ms" in df_valid.columns:
        print("Average Latency per session:")
        print(f"  Mean: {df_valid['avg_latency_ms'].mean():.2f} ms")
        print(f"  Median: {df_valid['avg_latency_ms'].median():.2f} ms")
        print(f"  Std: {df_valid['avg_latency_ms'].std():.2f} ms")

    if "median_latency_ms" in df_valid.columns:
        print("\nMedian Latency per session:")
        print(f"  Mean: {df_valid['median_latency_ms'].mean():.2f} ms")
        print(f"  Median: {df_valid['median_latency_ms'].median():.2f} ms")

    if "p95_latency_ms" in df_valid.columns:
        print("\nP95 Latency per session:")
        print(f"  Mean: {df_valid['p95_latency_ms'].mean():.2f} ms")
        print(f"  Median: {df_valid['p95_latency_ms'].median():.2f} ms")

    print("\nRevenue per session (RPS):")
    print(f"  Mean: ${df_valid['revenue_per_session'].mean():.4f}")
    print(f"  Median: ${df_valid['revenue_per_session'].median():.4f}")
    print(f"  Std: ${df_valid['revenue_per_session'].std():.4f}")

    print("\n" + "=" * 60)
    print("CORRELATION RESULTS")
    print("=" * 60)
    print("\nHypothesis: Lower latency → Higher revenue")
    print("Expected: Negative correlation (lower latency = higher revenue)")

    # Display correlations for all latency metrics
    print("\nCorrelations by Latency Metric:")
    print("-" * 60)

    metric_names = {
        "avg_latency_ms": "Average Latency",
        "median_latency_ms": "Median Latency",
        "p50_latency_ms": "P50 Latency",
        "p75_latency_ms": "P75 Latency",
        "p90_latency_ms": "P90 Latency",
        "p95_latency_ms": "P95 Latency",
        "p99_latency_ms": "P99 Latency",
    }

    for metric, result in correlations["correlations"].items():
        if result["correlation"] is not None:
            corr = result["correlation"]
            p_val = result["p_value"]
            n = result["n"]
            metric_name = metric_names.get(metric, metric)

            sig = (
                "***"
                if p_val < 0.001
                else "**" if p_val < 0.01 else "*" if p_val < 0.05 else ""
            )
            direction = "✓" if (p_val < 0.05 and corr < 0) else "✗"

            print(
                f"{direction} {metric_name:20s}: {corr:7.4f} (p={p_val:.4e}, n={n:,}) {sig}"
            )

    print("\n" + "=" * 60)
    print("Interpretation:")
    print("-" * 60)

    # Find the best (most negative) significant correlation
    best_corr = None
    best_metric = None
    for metric, result in correlations["correlations"].items():
        if result["correlation"] is not None and result["p_value"] < 0.05:
            if best_corr is None or result["correlation"] < best_corr:
                best_corr = result["correlation"]
                best_metric = metric

    if best_corr is not None and best_corr < 0:
        print(
            f"  ✓ Best significant correlation: {metric_names.get(best_metric, best_metric)}"
        )
        print(
            f"  ✓ Hypothesis SUPPORTED: Lower latency is associated with higher revenue"
        )
    elif best_corr is not None and best_corr > 0:
        print(
            f"  ✗ Best significant correlation: {metric_names.get(best_metric, best_metric)}"
        )
        print(
            f"  ✗ Hypothesis REJECTED: Higher latency is associated with higher revenue"
        )
    else:
        print(f"  ✗ No statistically significant correlations found (all p > 0.05)")
        print(f"  ✗ Hypothesis NOT SUPPORTED: No meaningful relationship found")

    print("=" * 60)


def create_visualizations(
    df: pd.DataFrame, output_dir: Path, num_sessions: int, remove_outliers: bool = True
):
    """Create scatter plots for different latency metrics"""
    df_valid = df[
        (df["median_latency_ms"] > 0) & (df["revenue_per_session"] > 0)
    ].copy()

    # Apply same outlier removal if requested
    if remove_outliers:
        latency_metrics = [
            "avg_latency_ms",
            "median_latency_ms",
            "p50_latency_ms",
            "p75_latency_ms",
            "p90_latency_ms",
            "p95_latency_ms",
            "p99_latency_ms",
        ]
        outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
            "revenue_per_session"
        ]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    sns.set_style("whitegrid")
    # Create 2x2 grid for different latency metrics
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # Plot 1: Average Latency vs Revenue
    if "avg_latency_ms" in df_valid.columns:
        df_avg = df_valid[df_valid["avg_latency_ms"] > 0].copy()
        axes[0, 0].scatter(
            df_avg["avg_latency_ms"], df_avg["revenue_per_session"], alpha=0.3, s=10
        )
        axes[0, 0].set_xlabel("Average Latency (ms)")
        axes[0, 0].set_ylabel("Revenue per Session (RPS)")
        axes[0, 0].set_title("Average Latency vs Revenue")
        axes[0, 0].grid(True, alpha=0.3)

    # Plot 2: Median Latency vs Revenue
    if "median_latency_ms" in df_valid.columns:
        df_median = df_valid[df_valid["median_latency_ms"] > 0].copy()
        axes[0, 1].scatter(
            df_median["median_latency_ms"],
            df_median["revenue_per_session"],
            alpha=0.3,
            s=10,
        )
        axes[0, 1].set_xlabel("Median Latency (ms)")
        axes[0, 1].set_ylabel("Revenue per Session (RPS)")
        axes[0, 1].set_title("Median Latency vs Revenue")
        axes[0, 1].grid(True, alpha=0.3)

    # Plot 3: P95 Latency vs Revenue
    if "p95_latency_ms" in df_valid.columns:
        df_p95 = df_valid[df_valid["p95_latency_ms"] > 0].copy()
        axes[1, 0].scatter(
            df_p95["p95_latency_ms"], df_p95["revenue_per_session"], alpha=0.3, s=10
        )
        axes[1, 0].set_xlabel("P95 Latency (ms)")
        axes[1, 0].set_ylabel("Revenue per Session (RPS)")
        axes[1, 0].set_title("P95 Latency vs Revenue")
        axes[1, 0].grid(True, alpha=0.3)

    # Plot 4: P99 Latency vs Revenue
    if "p99_latency_ms" in df_valid.columns:
        df_p99 = df_valid[df_valid["p99_latency_ms"] > 0].copy()
        axes[1, 1].scatter(
            df_p99["p99_latency_ms"], df_p99["revenue_per_session"], alpha=0.3, s=10
        )
        axes[1, 1].set_xlabel("P99 Latency (ms)")
        axes[1, 1].set_ylabel("Revenue per Session (RPS)")
        axes[1, 1].set_title("P99 Latency vs Revenue")
        axes[1, 1].grid(True, alpha=0.3)

    # Add metadata text
    info_text = f"Sessions analyzed: {num_sessions:,} (pre-aggregated data)"
    fig.suptitle(
        "Latency vs Revenue Correlation Analysis - Multiple Metrics",
        fontsize=14,
        y=0.995,
    )
    fig.text(0.5, 0.01, info_text, ha="center", fontsize=10, style="italic")

    plt.tight_layout(rect=[0, 0.03, 1, 0.98])

    output_path = output_dir / "latency-revenue-correlation.png"
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"\nVisualizations saved to: {output_path}")
    plt.close()


def generate_summary(df: pd.DataFrame, correlations: dict, output_dir: Path):
    """Generate summary.md file"""
    df_valid = df[
        (df["median_latency_ms"] > 0) & (df["revenue_per_session"] > 0)
    ].copy()
    latency_metrics = [
        "avg_latency_ms",
        "median_latency_ms",
        "p50_latency_ms",
        "p75_latency_ms",
        "p90_latency_ms",
        "p95_latency_ms",
        "p99_latency_ms",
    ]
    outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
        "revenue_per_session"
    ]
    df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    # Find best correlation
    best_corr = None
    best_metric = None
    for metric, result in correlations["correlations"].items():
        if result["correlation"] is not None and result["p_value"] < 0.05:
            if best_corr is None or abs(result["correlation"]) > abs(best_corr):
                best_corr = result["correlation"]
                best_metric = metric

    metric_names = {
        "avg_latency_ms": "Average Latency",
        "median_latency_ms": "Median Latency",
        "p50_latency_ms": "P50 Latency",
        "p75_latency_ms": "P75 Latency",
        "p90_latency_ms": "P90 Latency",
        "p95_latency_ms": "P95 Latency",
        "p99_latency_ms": "P99 Latency",
    }

    summary_lines = [
        "# Latency vs Revenue Correlation Analysis Summary",
        "",
        "## Hypothesis",
        "Lower latency → Higher revenue per session",
        "",
        "## Data",
        f"- **Total sessions**: {len(df):,}",
        f"- **Sessions after outlier removal**: {correlations['valid_sessions']:,}",
        f"- **Outliers removed**: {correlations.get('outliers_removed', 0):,} ({correlations.get('outliers_removed', 0)/correlations.get('original_sessions', correlations['valid_sessions'])*100:.1f}%)",
        "",
        "## Summary Statistics",
        "",
        f"- **Average Latency**: Mean={df_valid['avg_latency_ms'].mean():.2f} ms, Median={df_valid['avg_latency_ms'].median():.2f} ms",
        f"- **Revenue per session**: Mean=${df_valid['revenue_per_session'].mean():.4f}, Median=${df_valid['revenue_per_session'].median():.4f}",
        "",
        "## Correlation Results",
        "",
    ]

    for metric, result in correlations["correlations"].items():
        if result["correlation"] is not None:
            metric_name = metric_names.get(metric, metric)
            sig = (
                "***"
                if result["p_value"] < 0.001
                else (
                    "**"
                    if result["p_value"] < 0.01
                    else "*" if result["p_value"] < 0.05 else ""
                )
            )
            direction = (
                "✓" if (result["p_value"] < 0.05 and result["correlation"] < 0) else "✗"
            )
            summary_lines.append(f"### {metric_name}")
            summary_lines.append(
                f"- **Correlation**: {result['correlation']:.4f} {sig}"
            )
            summary_lines.append(f"- **P-value**: {result['p_value']:.4e}")
            summary_lines.append(f"- **N**: {result['n']:,}")
            summary_lines.append(
                f"- **Direction**: {direction} {'Supports hypothesis' if (result['p_value'] < 0.05 and result['correlation'] < 0) else 'Does not support hypothesis'}"
            )
            summary_lines.append("")

    if best_corr is not None and best_corr < 0:
        summary_lines.extend(
            [
                "## Conclusion",
                "",
                f"✓ **Hypothesis SUPPORTED**: Lower latency is associated with higher revenue",
                f"- Best correlation: {metric_names.get(best_metric, best_metric)} = {best_corr:.4f}",
                "",
                f"**Visualization**: `latency-revenue-correlation.png`",
            ]
        )
    else:
        summary_lines.extend(
            [
                "## Conclusion",
                "",
                "✗ **Hypothesis NOT SUPPORTED**: No significant negative correlation found",
                "",
                f"**Visualization**: `latency-revenue-correlation.png`",
            ]
        )

    summary_path = output_dir / "summary.md"
    with open(summary_path, "w") as f:
        f.write("\n".join(summary_lines))
    print(f"Summary saved to: {summary_path}")


def main():
    # Find and load aggregated session data
    data_file = find_aggregated_sessions_file()
    print(f"Loading aggregated session data from: {data_file.name}")
    df = load_aggregated_sessions(data_file)

    print(f"Loaded {len(df)} session records")

    # Calculate correlations (with outlier removal)
    correlations = calculate_correlations(df, remove_outliers=True)

    # Print results
    print_summary_stats(df, correlations)

    # Create visualizations (with outlier removal)
    output_dir = Path(__file__).parent
    create_visualizations(
        df, output_dir, correlations["valid_sessions"], remove_outliers=True
    )

    # Generate summary
    generate_summary(df, correlations, output_dir)


if __name__ == "__main__":
    main()
