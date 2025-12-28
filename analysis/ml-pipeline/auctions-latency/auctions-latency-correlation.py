"""Auctions vs Latency Correlation Analysis

Measures correlation between number of auctions per session and latency per auction.
Hypothesis: Lower latency per auction → auctions complete faster → more auctions per session
"""

import json
from pathlib import Path
import pandas as pd
import numpy as np
from scipy.stats import pearsonr
import matplotlib.pyplot as plt
import seaborn as sns


def load_auction_latency_sessions(json_file_path: Path) -> pd.DataFrame:
    """Load pre-aggregated session data with per-auction latency metrics"""
    with open(json_file_path, "r") as f:
        data = json.load(f)

    sessions = data["data"]
    df = pd.DataFrame(sessions)

    # Convert latency metrics to seconds for easier interpretation
    latency_cols = [
        "avg_latency_per_auction",
        "median_latency_per_auction",
        "p75_latency_per_auction",
        "p90_latency_per_auction",
        "p95_latency_per_auction",
        "p99_latency_per_auction",
    ]
    for col in latency_cols:
        if col in df.columns:
            sec_col = col.replace("_ms", "_sec").replace(
                "_per_auction", "_per_auction_sec"
            )
            df[sec_col] = df[col] / 1000

    return df


def find_auction_latency_sessions_file() -> Path:
    """Find the auction latency sessions data file"""
    data_path = Path(__file__).parent.parent.parent / "data"
    data_file = data_path / "axiom-auction-latency-sessions.json"
    if not data_file.exists():
        raise FileNotFoundError(
            f"Auction latency sessions file not found: {data_file}\n"
            "Please run: bun run ml-pipeline/fetch-auction-latency-sessions.ts"
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
    """Calculate Pearson correlations between auctions per session and latency metrics"""
    # Filter to sessions with valid latency and auctions data
    df_valid = df[
        (df["auctions_per_session"] > 0) & (df["avg_latency_per_auction"] > 0)
    ].copy()

    # Calculate time-normalized metrics
    # auctions_per_minute = auctions_per_session / (session_length_ms / 60000)
    df_valid["auctions_per_minute"] = df_valid["auctions_per_session"] / (
        df_valid["session_length_ms"] / 60000
    )
    # Handle infinite or NaN values (sessions with 0 length)
    df_valid = df_valid[
        (df_valid["auctions_per_minute"].notna())
        & (df_valid["auctions_per_minute"] != np.inf)
        & (df_valid["auctions_per_minute"] > 0)
    ].copy()

    original_count = len(df_valid)

    # Remove outliers if requested
    if remove_outliers:
        latency_metrics = [
            "avg_latency_per_auction",
            "median_latency_per_auction",
            "p75_latency_per_auction",
            "p90_latency_per_auction",
            "p95_latency_per_auction",
            "p99_latency_per_auction",
        ]
        outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
            "auctions_per_session",
            "auctions_per_minute",
        ]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)
        removed_count = original_count - len(df_valid)
        print(
            f"Outlier removal: {removed_count:,} sessions removed ({removed_count/original_count*100:.1f}%), {len(df_valid):,} remaining"
        )

    correlations = {}
    latency_metrics = [
        "avg_latency_per_auction",
        "median_latency_per_auction",
        "p75_latency_per_auction",
        "p90_latency_per_auction",
        "p95_latency_per_auction",
        "p99_latency_per_auction",
    ]

    # Correlations with auctions_per_session (original)
    for metric in latency_metrics:
        if metric in df_valid.columns:
            # Filter to sessions with valid values for this specific metric
            df_metric = df_valid[df_valid[metric] > 0].copy()
            if len(df_metric) > 1:
                corr, p = pearsonr(df_metric[metric], df_metric["auctions_per_session"])
                correlations[f"{metric}_vs_auctions_per_session"] = {
                    "correlation": corr,
                    "p_value": p,
                    "n": len(df_metric),
                }
            else:
                correlations[f"{metric}_vs_auctions_per_session"] = {
                    "correlation": None,
                    "p_value": None,
                    "n": 0,
                }

    # Correlations with auctions_per_minute (time-normalized)
    for metric in latency_metrics:
        if metric in df_valid.columns:
            # Filter to sessions with valid values for this specific metric
            df_metric = df_valid[df_valid[metric] > 0].copy()
            if len(df_metric) > 1:
                corr, p = pearsonr(df_metric[metric], df_metric["auctions_per_minute"])
                correlations[f"{metric}_vs_auctions_per_minute"] = {
                    "correlation": corr,
                    "p_value": p,
                    "n": len(df_metric),
                }
            else:
                correlations[f"{metric}_vs_auctions_per_minute"] = {
                    "correlation": None,
                    "p_value": None,
                    "n": 0,
                }

    return {
        "correlations": correlations,
        "valid_sessions": len(df_valid),
        "original_sessions": original_count,
        "outliers_removed": original_count - len(df_valid) if remove_outliers else 0,
    }


def print_summary_stats(df: pd.DataFrame, correlations: dict):
    """Print summary statistics"""
    df_valid = df[
        (df["auctions_per_session"] > 0) & (df["avg_latency_per_auction"] > 0)
    ].copy()

    # Calculate time-normalized metrics
    df_valid["auctions_per_minute"] = df_valid["auctions_per_session"] / (
        df_valid["session_length_ms"] / 60000
    )
    df_valid = df_valid[
        (df_valid["auctions_per_minute"].notna())
        & (df_valid["auctions_per_minute"] != np.inf)
        & (df_valid["auctions_per_minute"] > 0)
    ].copy()

    # Apply same outlier removal if it was done
    if correlations.get("outliers_removed", 0) > 0:
        latency_metrics = [
            "avg_latency_per_auction",
            "median_latency_per_auction",
            "p75_latency_per_auction",
            "p90_latency_per_auction",
            "p95_latency_per_auction",
            "p99_latency_per_auction",
        ]
        outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
            "auctions_per_session",
            "auctions_per_minute",
        ]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    print("=" * 60)
    print("AUCTIONS vs LATENCY CORRELATION ANALYSIS")
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

    print("Auctions per session:")
    print(f"  Mean: {df_valid['auctions_per_session'].mean():.2f}")
    print(f"  Median: {df_valid['auctions_per_session'].median():.2f}")
    print(f"  Std: {df_valid['auctions_per_session'].std():.2f}")

    print("\nAuctions per minute (time-normalized):")
    print(f"  Mean: {df_valid['auctions_per_minute'].mean():.4f}")
    print(f"  Median: {df_valid['auctions_per_minute'].median():.4f}")
    print(f"  Std: {df_valid['auctions_per_minute'].std():.4f}")

    if "avg_latency_per_auction" in df_valid.columns:
        print("\nAverage Latency per Auction:")
        print(f"  Mean: {df_valid['avg_latency_per_auction'].mean():.2f} ms")
        print(f"  Median: {df_valid['avg_latency_per_auction'].median():.2f} ms")
        print(f"  Std: {df_valid['avg_latency_per_auction'].std():.2f} ms")

    if "median_latency_per_auction" in df_valid.columns:
        print("\nMedian Latency per Auction:")
        print(f"  Mean: {df_valid['median_latency_per_auction'].mean():.2f} ms")
        print(f"  Median: {df_valid['median_latency_per_auction'].median():.2f} ms")

    if "p95_latency_per_auction" in df_valid.columns:
        print("\nP95 Latency per Auction:")
        print(f"  Mean: {df_valid['p95_latency_per_auction'].mean():.2f} ms")
        print(f"  Median: {df_valid['p95_latency_per_auction'].median():.2f} ms")

    print("\n" + "=" * 60)
    print("CORRELATION RESULTS")
    print("=" * 60)
    print("\nHypothesis: Lower latency per auction → More auctions per session/minute")
    print("Expected: Negative correlation (lower latency = more auctions)")

    metric_names = {
        "avg_latency_per_auction": "Avg Latency/Auction",
        "median_latency_per_auction": "Median Latency/Auction",
        "p75_latency_per_auction": "P75 Latency/Auction",
        "p90_latency_per_auction": "P90 Latency/Auction",
        "p95_latency_per_auction": "P95 Latency/Auction",
        "p99_latency_per_auction": "P99 Latency/Auction",
    }

    # Display correlations with auctions_per_session
    print("\n1. Correlations: Latency vs Auctions per Session (NOT time-normalized):")
    print("-" * 60)
    for metric, result in correlations["correlations"].items():
        if "_vs_auctions_per_session" in metric and result["correlation"] is not None:
            base_metric = metric.replace("_vs_auctions_per_session", "")
            corr = result["correlation"]
            p_val = result["p_value"]
            n = result["n"]
            metric_name = metric_names.get(base_metric, base_metric)

            sig = (
                "***"
                if p_val < 0.001
                else "**" if p_val < 0.01 else "*" if p_val < 0.05 else ""
            )
            direction = "✓" if (p_val < 0.05 and corr < 0) else "✗"

            print(
                f"{direction} {metric_name:25s}: {corr:7.4f} (p={p_val:.4e}, n={n:,}) {sig}"
            )

    # Display correlations with auctions_per_minute
    print("\n2. Correlations: Latency vs Auctions per Minute (TIME-NORMALIZED):")
    print("-" * 60)
    for metric, result in correlations["correlations"].items():
        if "_vs_auctions_per_minute" in metric and result["correlation"] is not None:
            base_metric = metric.replace("_vs_auctions_per_minute", "")
            corr = result["correlation"]
            p_val = result["p_value"]
            n = result["n"]
            metric_name = metric_names.get(base_metric, base_metric)

            sig = (
                "***"
                if p_val < 0.001
                else "**" if p_val < 0.01 else "*" if p_val < 0.05 else ""
            )
            direction = "✓" if (p_val < 0.05 and corr < 0) else "✗"

            print(
                f"{direction} {metric_name:25s}: {corr:7.4f} (p={p_val:.4e}, n={n:,}) {sig}"
            )

    print("\n" + "=" * 60)
    print("Interpretation:")
    print("-" * 60)

    # Find the best (most negative) significant correlation for time-normalized
    best_corr = None
    best_metric = None
    for metric, result in correlations["correlations"].items():
        if (
            "_vs_auctions_per_minute" in metric
            and result["correlation"] is not None
            and result["p_value"] < 0.05
        ):
            if best_corr is None or result["correlation"] < best_corr:
                best_corr = result["correlation"]
                best_metric = metric

    if best_corr is not None and best_corr < 0:
        base_metric = best_metric.replace("_vs_auctions_per_minute", "")
        print(
            f"  ✓ Best significant correlation (time-normalized): {metric_names.get(base_metric, base_metric)}"
        )
        print(
            f"  ✓ Hypothesis SUPPORTED: Lower latency per auction is associated with more auctions per minute"
        )
    elif best_corr is not None and best_corr > 0:
        base_metric = best_metric.replace("_vs_auctions_per_minute", "")
        print(
            f"  ✗ Best significant correlation (time-normalized): {metric_names.get(base_metric, base_metric)}"
        )
        print(
            f"  ✗ Hypothesis REJECTED: Higher latency per auction is associated with more auctions per minute"
        )
    else:
        print(f"  ✗ No statistically significant correlations found (all p > 0.05)")
        print(f"  ✗ Hypothesis NOT SUPPORTED: No meaningful relationship found")

    print("=" * 60)


def create_visualizations(
    df: pd.DataFrame, output_dir: Path, num_sessions: int, remove_outliers: bool = True
):
    """Create scatter plots for different latency metrics vs auctions per session"""
    df_valid = df[
        (df["auctions_per_session"] > 0) & (df["avg_latency_per_auction"] > 0)
    ].copy()

    # Calculate time-normalized metrics
    df_valid["auctions_per_minute"] = df_valid["auctions_per_session"] / (
        df_valid["session_length_ms"] / 60000
    )
    df_valid = df_valid[
        (df_valid["auctions_per_minute"].notna())
        & (df_valid["auctions_per_minute"] != np.inf)
        & (df_valid["auctions_per_minute"] > 0)
    ].copy()

    # Apply same outlier removal if requested
    if remove_outliers:
        latency_metrics = [
            "avg_latency_per_auction",
            "median_latency_per_auction",
            "p75_latency_per_auction",
            "p90_latency_per_auction",
            "p95_latency_per_auction",
            "p99_latency_per_auction",
        ]
        outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
            "auctions_per_session",
            "auctions_per_minute",
        ]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    sns.set_style("whitegrid")
    # Create 2x3 grid: top row = auctions per session, bottom row = auctions per minute
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))

    # Top row: Auctions per Session (NOT time-normalized)
    # Plot 1: Average Latency per Auction vs Auctions per Session
    if "avg_latency_per_auction" in df_valid.columns:
        df_avg = df_valid[df_valid["avg_latency_per_auction"] > 0].copy()
        axes[0, 0].scatter(
            df_avg["avg_latency_per_auction"],
            df_avg["auctions_per_session"],
            alpha=0.3,
            s=10,
        )
        axes[0, 0].set_xlabel("Average Latency per Auction (ms)")
        axes[0, 0].set_ylabel("Auctions per Session")
        axes[0, 0].set_title("Avg Latency/Auction vs Auctions/Session")
        axes[0, 0].grid(True, alpha=0.3)

    # Plot 2: Median Latency per Auction vs Auctions per Session
    if "median_latency_per_auction" in df_valid.columns:
        df_median = df_valid[df_valid["median_latency_per_auction"] > 0].copy()
        axes[0, 1].scatter(
            df_median["median_latency_per_auction"],
            df_median["auctions_per_session"],
            alpha=0.3,
            s=10,
        )
        axes[0, 1].set_xlabel("Median Latency per Auction (ms)")
        axes[0, 1].set_ylabel("Auctions per Session")
        axes[0, 1].set_title("Median Latency/Auction vs Auctions/Session")
        axes[0, 1].grid(True, alpha=0.3)

    # Plot 3: P95 Latency per Auction vs Auctions per Session
    if "p95_latency_per_auction" in df_valid.columns:
        df_p95 = df_valid[df_valid["p95_latency_per_auction"] > 0].copy()
        axes[0, 2].scatter(
            df_p95["p95_latency_per_auction"],
            df_p95["auctions_per_session"],
            alpha=0.3,
            s=10,
        )
        axes[0, 2].set_xlabel("P95 Latency per Auction (ms)")
        axes[0, 2].set_ylabel("Auctions per Session")
        axes[0, 2].set_title("P95 Latency/Auction vs Auctions/Session")
        axes[0, 2].grid(True, alpha=0.3)

    # Bottom row: Auctions per Minute (TIME-NORMALIZED)
    # Plot 4: Average Latency per Auction vs Auctions per Minute
    if "avg_latency_per_auction" in df_valid.columns:
        df_avg = df_valid[df_valid["avg_latency_per_auction"] > 0].copy()
        axes[1, 0].scatter(
            df_avg["avg_latency_per_auction"],
            df_avg["auctions_per_minute"],
            alpha=0.3,
            s=10,
        )
        axes[1, 0].set_xlabel("Average Latency per Auction (ms)")
        axes[1, 0].set_ylabel("Auctions per Minute")
        axes[1, 0].set_title("Avg Latency/Auction vs Auctions/Min (Time-Normalized)")
        axes[1, 0].grid(True, alpha=0.3)

    # Plot 5: Median Latency per Auction vs Auctions per Minute
    if "median_latency_per_auction" in df_valid.columns:
        df_median = df_valid[df_valid["median_latency_per_auction"] > 0].copy()
        axes[1, 1].scatter(
            df_median["median_latency_per_auction"],
            df_median["auctions_per_minute"],
            alpha=0.3,
            s=10,
        )
        axes[1, 1].set_xlabel("Median Latency per Auction (ms)")
        axes[1, 1].set_ylabel("Auctions per Minute")
        axes[1, 1].set_title("Median Latency/Auction vs Auctions/Min (Time-Normalized)")
        axes[1, 1].grid(True, alpha=0.3)

    # Plot 6: P95 Latency per Auction vs Auctions per Minute
    if "p95_latency_per_auction" in df_valid.columns:
        df_p95 = df_valid[df_valid["p95_latency_per_auction"] > 0].copy()
        axes[1, 2].scatter(
            df_p95["p95_latency_per_auction"],
            df_p95["auctions_per_minute"],
            alpha=0.3,
            s=10,
        )
        axes[1, 2].set_xlabel("P95 Latency per Auction (ms)")
        axes[1, 2].set_ylabel("Auctions per Minute")
        axes[1, 2].set_title("P95 Latency/Auction vs Auctions/Min (Time-Normalized)")
        axes[1, 2].grid(True, alpha=0.3)

    # Add metadata text with explanation
    info_text = f"Sessions analyzed: {num_sessions:,} (pre-aggregated data)"
    explanation_text = (
        "Time-Normalized (Bottom Row): Auctions per Minute = Auctions per Session ÷ Session Length (minutes). "
        "This controls for session duration to show if lower latency enables more auctions per unit time."
    )

    fig.suptitle(
        "Auctions vs Latency per Auction Correlation Analysis",
        fontsize=14,
        y=0.995,
    )
    fig.text(0.5, 0.02, info_text, ha="center", fontsize=10, style="italic")
    fig.text(
        0.5,
        0.005,
        explanation_text,
        ha="center",
        fontsize=9,
        style="italic",
        color="gray",
    )

    plt.tight_layout(rect=[0, 0.03, 1, 0.98])

    output_path = output_dir / "auctions-latency-correlation.png"
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"\nVisualizations saved to: {output_path}")
    plt.close()


def generate_summary(df: pd.DataFrame, correlations: dict, output_dir: Path):
    """Generate summary.md file"""
    df_valid = df[
        (df["auctions_per_session"] > 0) & (df["avg_latency_per_auction"] > 0)
    ].copy()
    df_valid["auctions_per_minute"] = df_valid["auctions_per_session"] / (
        df_valid["session_length_ms"] / 60000
    )
    df_valid = df_valid[
        (df_valid["auctions_per_minute"].notna())
        & (df_valid["auctions_per_minute"] != np.inf)
        & (df_valid["auctions_per_minute"] > 0)
    ].copy()

    latency_metrics = [
        "avg_latency_per_auction",
        "median_latency_per_auction",
        "p75_latency_per_auction",
        "p90_latency_per_auction",
        "p95_latency_per_auction",
        "p99_latency_per_auction",
    ]
    outlier_cols = [m for m in latency_metrics if m in df_valid.columns] + [
        "auctions_per_session",
        "auctions_per_minute",
    ]
    df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    # Find best time-normalized correlation
    best_corr = None
    best_metric = None
    for metric, result in correlations["correlations"].items():
        if (
            "_vs_auctions_per_minute" in metric
            and result["correlation"] is not None
            and result["p_value"] < 0.05
        ):
            if best_corr is None or result["correlation"] < best_corr:
                best_corr = result["correlation"]
                best_metric = metric

    metric_names = {
        "avg_latency_per_auction": "Avg Latency/Auction",
        "median_latency_per_auction": "Median Latency/Auction",
        "p75_latency_per_auction": "P75 Latency/Auction",
        "p90_latency_per_auction": "P90 Latency/Auction",
        "p95_latency_per_auction": "P95 Latency/Auction",
        "p99_latency_per_auction": "P99 Latency/Auction",
    }

    summary_lines = [
        "# Auctions vs Latency per Auction Correlation Analysis Summary",
        "",
        "## Hypothesis",
        "Lower latency per auction → auctions complete faster → more auctions per minute",
        "",
        "## Data",
        f"- **Total sessions**: {len(df):,}",
        f"- **Sessions after outlier removal**: {correlations['valid_sessions']:,}",
        f"- **Outliers removed**: {correlations.get('outliers_removed', 0):,} ({correlations.get('outliers_removed', 0)/correlations.get('original_sessions', correlations['valid_sessions'])*100:.1f}%)",
        "",
        "## Summary Statistics",
        "",
        f"- **Auctions per minute**: Mean={df_valid['auctions_per_minute'].mean():.4f}, Median={df_valid['auctions_per_minute'].median():.4f}",
        f"- **Average Latency per Auction**: Mean={df_valid['avg_latency_per_auction'].mean():.2f} ms, Median={df_valid['avg_latency_per_auction'].median():.2f} ms",
        "",
        "## Correlation Results (Time-Normalized: Auctions per Minute)",
        "",
    ]

    for metric, result in correlations["correlations"].items():
        if "_vs_auctions_per_minute" in metric and result["correlation"] is not None:
            base_metric = metric.replace("_vs_auctions_per_minute", "")
            metric_name = metric_names.get(base_metric, base_metric)
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
        base_metric = best_metric.replace("_vs_auctions_per_minute", "")
        summary_lines.extend(
            [
                "## Conclusion",
                "",
                f"✓ **Hypothesis SUPPORTED**: Lower latency per auction is associated with more auctions per minute",
                f"- Best correlation: {metric_names.get(base_metric, base_metric)} = {best_corr:.4f}",
                "",
                "**Note**: Time-normalized analysis (auctions per minute) controls for session length.",
                "",
                f"**Visualization**: `auctions-latency-correlation.png`",
            ]
        )
    else:
        summary_lines.extend(
            [
                "## Conclusion",
                "",
                "✗ **Hypothesis NOT SUPPORTED**: No significant negative correlation found",
                "",
                f"**Visualization**: `auctions-latency-correlation.png`",
            ]
        )

    summary_path = output_dir / "summary.md"
    with open(summary_path, "w") as f:
        f.write("\n".join(summary_lines))
    print(f"Summary saved to: {summary_path}")


def main():
    # Find and load aggregated session data
    data_file = find_auction_latency_sessions_file()
    print(f"Loading auction latency session data from: {data_file.name}")
    df = load_auction_latency_sessions(data_file)

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
