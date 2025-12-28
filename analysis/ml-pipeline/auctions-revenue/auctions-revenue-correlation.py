"""Auctions vs Revenue Correlation Analysis

Measures correlation between number of auctions per session and revenue per session.
Hypothesis: More auctions → More opportunities to win → Higher revenue
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
    """Calculate Pearson correlations between auctions per minute and revenue"""
    # Filter to sessions with valid auctions, revenue, and session length data
    df_valid = df[
        (df["auctions_per_session"] > 0)
        & (df["revenue_per_session"] > 0)
        & (df["session_length_ms"] > 0)
    ].copy()

    # Calculate time-normalized metrics
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
        outlier_cols = ["auctions_per_minute", "revenue_per_session"]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)
        removed_count = original_count - len(df_valid)
        print(
            f"Outlier removal: {removed_count:,} sessions removed ({removed_count/original_count*100:.1f}%), {len(df_valid):,} remaining"
        )

    # Calculate correlation with auctions_per_minute
    if len(df_valid) > 1:
        corr, p = pearsonr(
            df_valid["auctions_per_minute"], df_valid["revenue_per_session"]
        )
        correlation_result = {
            "correlation": corr,
            "p_value": p,
            "n": len(df_valid),
        }
    else:
        correlation_result = {"correlation": None, "p_value": None, "n": 0}

    return {
        "correlation": correlation_result,
        "valid_sessions": len(df_valid),
        "original_sessions": original_count,
        "outliers_removed": original_count - len(df_valid) if remove_outliers else 0,
    }


def print_summary_stats(df: pd.DataFrame, correlations: dict):
    """Print summary statistics"""
    df_valid = df[
        (df["auctions_per_session"] > 0)
        & (df["revenue_per_session"] > 0)
        & (df["session_length_ms"] > 0)
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
        outlier_cols = ["auctions_per_minute", "revenue_per_session"]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    print("=" * 60)
    print("AUCTIONS vs REVENUE CORRELATION ANALYSIS")
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

    print("Auctions per minute (time-normalized):")
    print(f"  Mean: {df_valid['auctions_per_minute'].mean():.4f}")
    print(f"  Median: {df_valid['auctions_per_minute'].median():.4f}")
    print(f"  Std: {df_valid['auctions_per_minute'].std():.4f}")
    print(f"  Min: {df_valid['auctions_per_minute'].min():.4f}")
    print(f"  Max: {df_valid['auctions_per_minute'].max():.4f}")

    print("\nRevenue per session (RPS):")
    print(f"  Mean: ${df_valid['revenue_per_session'].mean():.4f}")
    print(f"  Median: ${df_valid['revenue_per_session'].median():.4f}")
    print(f"  Std: ${df_valid['revenue_per_session'].std():.4f}")
    print(f"  Min: ${df_valid['revenue_per_session'].min():.4f}")
    print(f"  Max: ${df_valid['revenue_per_session'].max():.4f}")

    print("\n" + "=" * 60)
    print("CORRELATION RESULTS")
    print("=" * 60)
    print(
        "\nHypothesis: More auctions per minute → More opportunities to win → Higher revenue"
    )
    print("Expected: Positive correlation (more auctions/min = higher revenue)")
    print(
        "Note: Using time-normalized metric (auctions per minute) to control for session length"
    )

    result = correlations["correlation"]
    if result["correlation"] is not None:
        corr = result["correlation"]
        p_val = result["p_value"]
        n = result["n"]

        sig = (
            "***"
            if p_val < 0.001
            else "**" if p_val < 0.01 else "*" if p_val < 0.05 else ""
        )
        direction = "✓" if (p_val < 0.05 and corr > 0) else "✗"

        print(f"\n{direction} Correlation: {corr:7.4f} (p={p_val:.4e}, n={n:,}) {sig}")

        print("\n" + "=" * 60)
        print("Interpretation:")
        print("-" * 60)

        if p_val < 0.05:
            if corr > 0:
                print(f"  ✓ Statistically significant POSITIVE correlation")
                print(
                    f"  ✓ Hypothesis SUPPORTED: More auctions is associated with higher revenue"
                )
                if corr > 0.5:
                    print(f"  → Strong positive relationship (correlation > 0.5)")
                elif corr > 0.3:
                    print(f"  → Moderate positive relationship (correlation > 0.3)")
                else:
                    print(f"  → Weak but significant positive relationship")
            else:
                print(f"  ✗ Statistically significant NEGATIVE correlation")
                print(
                    f"  ✗ Hypothesis REJECTED: More auctions per minute is associated with lower revenue"
                )
        else:
            print(f"  ✗ Correlation is NOT statistically significant (p > 0.05)")
            print(f"  ✗ Hypothesis NOT SUPPORTED: No meaningful relationship found")
            if abs(corr) < 0.1:
                print(f"  Note: Correlation is essentially zero ({corr:.4f})")

    print("=" * 60)


def create_visualizations(
    df: pd.DataFrame,
    output_dir: Path,
    num_sessions: int,
    remove_outliers: bool = True,
    correlation: float = None,
):
    """Create scatter plots for auctions per minute vs revenue"""
    df_valid = df[
        (df["auctions_per_session"] > 0)
        & (df["revenue_per_session"] > 0)
        & (df["session_length_ms"] > 0)
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
        outlier_cols = ["auctions_per_minute", "revenue_per_session"]
        df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    sns.set_style("whitegrid")
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Calculate trend line using numpy polyfit
    x = df_valid["auctions_per_minute"].values
    y = df_valid["revenue_per_session"].values
    z = np.polyfit(x, y, 1)
    p = np.poly1d(z)
    x_trend = np.linspace(x.min(), x.max(), 100)
    y_trend = p(x_trend)

    # Plot 1: Auctions per Minute vs Revenue per Session with trend line
    axes[0].scatter(
        df_valid["auctions_per_minute"],
        df_valid["revenue_per_session"],
        alpha=0.2,
        s=8,
        color="steelblue",
    )
    axes[0].plot(
        x_trend,
        y_trend,
        "r--",
        linewidth=2,
        label=f"Trend line (r={correlation:.3f})" if correlation else "Trend line",
    )
    axes[0].set_xlabel("Auctions per Minute (Time-Normalized)", fontsize=11)
    axes[0].set_ylabel("Revenue per Session (RPS)", fontsize=11)
    axes[0].set_title(
        "Auctions per Minute vs Revenue per Session", fontsize=12, fontweight="bold"
    )
    axes[0].grid(True, alpha=0.3)
    axes[0].legend(loc="upper left")

    # Add correlation text box
    if correlation:
        textstr = f"Correlation: {correlation:.3f}\nModerate positive relationship"
        props = dict(boxstyle="round", facecolor="wheat", alpha=0.8)
        axes[0].text(
            0.05,
            0.95,
            textstr,
            transform=axes[0].transAxes,
            fontsize=10,
            verticalalignment="top",
            bbox=props,
        )

    # Plot 2: Binned average to show clearer trend
    # Create bins for auctions per minute
    df_valid["auction_bin"] = pd.cut(
        df_valid["auctions_per_minute"],
        bins=20,
        labels=False,
    )
    bin_centers = df_valid.groupby("auction_bin")["auctions_per_minute"].mean()
    bin_means = df_valid.groupby("auction_bin")["revenue_per_session"].mean()
    bin_stds = df_valid.groupby("auction_bin")["revenue_per_session"].std()
    bin_counts = df_valid.groupby("auction_bin").size()

    axes[1].scatter(
        df_valid["auctions_per_minute"],
        df_valid["revenue_per_session"],
        alpha=0.1,
        s=5,
        color="lightblue",
        label="Individual sessions",
    )
    axes[1].errorbar(
        bin_centers,
        bin_means,
        yerr=bin_stds,
        fmt="o-",
        color="red",
        linewidth=2,
        markersize=8,
        capsize=4,
        label="Binned average ± 1 std",
    )
    axes[1].set_xlabel("Auctions per Minute (Time-Normalized)", fontsize=11)
    axes[1].set_ylabel("Revenue per Session (RPS)", fontsize=11)
    axes[1].set_title(
        "Binned Average: Auctions/Min vs Revenue", fontsize=12, fontweight="bold"
    )
    axes[1].grid(True, alpha=0.3)
    axes[1].legend(loc="upper left")

    # Add metadata text
    info_text = f"Sessions analyzed: {num_sessions:,} (pre-aggregated data)"
    explanation_text = (
        "Time-Normalized: Auctions per Minute = Auctions per Session ÷ Session Length (minutes). "
        "This controls for session duration to show if more auctions per unit time leads to higher revenue."
    )
    fig.suptitle(
        "Auctions per Minute vs Revenue per Session Correlation Analysis",
        fontsize=14,
        y=1.02,
    )
    fig.text(
        0.5,
        0.005,
        explanation_text,
        ha="center",
        fontsize=9,
        style="italic",
        color="gray",
    )
    fig.text(0.5, 0.01, info_text, ha="center", fontsize=10, style="italic")

    plt.tight_layout(rect=[0, 0.03, 1, 0.98])

    output_path = output_dir / "auctions-revenue-correlation.png"
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"\nVisualizations saved to: {output_path}")
    plt.close()


def generate_summary(df: pd.DataFrame, correlations: dict, output_dir: Path):
    """Generate summary.md file"""
    df_valid = df[
        (df["auctions_per_session"] > 0)
        & (df["revenue_per_session"] > 0)
        & (df["session_length_ms"] > 0)
    ].copy()
    df_valid["auctions_per_minute"] = df_valid["auctions_per_session"] / (
        df_valid["session_length_ms"] / 60000
    )
    df_valid = df_valid[
        (df_valid["auctions_per_minute"].notna())
        & (df_valid["auctions_per_minute"] != np.inf)
        & (df_valid["auctions_per_minute"] > 0)
    ].copy()

    outlier_cols = ["auctions_per_minute", "revenue_per_session"]
    df_valid = remove_outliers_iqr(df_valid, outlier_cols, factor=1.5)

    result = correlations["correlation"]

    summary_lines = [
        "# Auctions vs Revenue Correlation Analysis Summary",
        "",
        "## Hypothesis",
        "More auctions per minute → More opportunities to win → Higher revenue",
        "",
        "## Data",
        f"- **Total sessions**: {len(df):,}",
        f"- **Sessions after outlier removal**: {correlations['valid_sessions']:,}",
        f"- **Outliers removed**: {correlations.get('outliers_removed', 0):,} ({correlations.get('outliers_removed', 0)/correlations.get('original_sessions', correlations['valid_sessions'])*100:.1f}%)",
        "",
        "## Summary Statistics",
        "",
        f"- **Auctions per minute (time-normalized)**: Mean={df_valid['auctions_per_minute'].mean():.4f}, Median={df_valid['auctions_per_minute'].median():.4f}",
        f"- **Revenue per session**: Mean=${df_valid['revenue_per_session'].mean():.4f}, Median=${df_valid['revenue_per_session'].median():.4f}",
        "",
        "## Correlation Results",
        "",
    ]

    if result["correlation"] is not None:
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
            "✓" if (result["p_value"] < 0.05 and result["correlation"] > 0) else "✗"
        )

        summary_lines.extend(
            [
                f"- **Correlation**: {result['correlation']:.4f} {sig}",
                f"- **P-value**: {result['p_value']:.4e}",
                f"- **N**: {result['n']:,}",
                "",
                "## Conclusion",
                "",
            ]
        )

        if result["p_value"] < 0.05:
            if result["correlation"] > 0:
                strength = (
                    "Strong"
                    if result["correlation"] > 0.5
                    else "Moderate" if result["correlation"] > 0.3 else "Weak"
                )
                summary_lines.extend(
                    [
                        f"✓ **Hypothesis SUPPORTED**: More auctions per minute is associated with higher revenue",
                        f"- {strength} positive relationship (correlation = {result['correlation']:.4f})",
                    ]
                )
            else:
                summary_lines.extend(
                    [
                        f"✗ **Hypothesis REJECTED**: More auctions per minute is associated with lower revenue",
                        f"- Negative correlation = {result['correlation']:.4f}",
                    ]
                )
        else:
            summary_lines.extend(
                [
                    "✗ **Hypothesis NOT SUPPORTED**: No statistically significant relationship found",
                ]
            )

    summary_lines.extend(
        [
            "",
            "**Note**: Using time-normalized metric (auctions per minute) to control for session length.",
            "",
            f"**Visualization**: `auctions-revenue-correlation.png`",
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
    corr_value = (
        correlations["correlation"]["correlation"]
        if correlations["correlation"]["correlation"] is not None
        else 0
    )
    create_visualizations(
        df,
        output_dir,
        correlations["valid_sessions"],
        remove_outliers=True,
        correlation=corr_value,
    )

    # Generate summary
    generate_summary(df, correlations, output_dir)


if __name__ == "__main__":
    main()
