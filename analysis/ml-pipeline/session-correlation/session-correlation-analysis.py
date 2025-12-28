"""Session Correlation Analysis - Impression Lift Hypothesis

Validates: Less timeout → auctions finished faster → more auctions per session → impression → viewability + revenue

Measures correlations between:
- Timeouts per session → Auctions per session
- Timeouts per session → Revenue per session (RPS)

Uses pre-aggregated session-level data from Axiom for efficient analysis.
"""

import json
from pathlib import Path
import pandas as pd
from scipy.stats import pearsonr
import matplotlib.pyplot as plt
import seaborn as sns


def load_aggregated_sessions(
    json_file_path: Path, filter_median_length: bool = False
) -> pd.DataFrame:
    """
    Load pre-aggregated session data from JSON file

    Args:
        json_file_path: Path to the aggregated sessions JSON file
        filter_median_length: If True, filter to sessions around 10 minutes (±5 min)

    Returns:
        DataFrame with session-level metrics
    """
    with open(json_file_path, "r") as f:
        data = json.load(f)

    # Extract session data
    sessions = data["data"]

    # Convert to DataFrame
    df = pd.DataFrame(sessions)

    # Convert session_length_ms to minutes if present
    if "session_length_ms" in df.columns:
        df["session_length_min"] = df["session_length_ms"] / 1000 / 60

    # Filter to sessions around median length (10 minutes ± 5 minutes)
    if filter_median_length and "session_length_min" in df.columns:
        df = df[
            (df["session_length_min"] >= 5) & (df["session_length_min"] <= 15)
        ].copy()
        print(f"Filtered to sessions with length 5-15 minutes: {len(df)} sessions")

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


def calculate_correlations(df: pd.DataFrame):
    """Calculate Pearson correlations"""
    corr_timeouts_auctions, p1 = pearsonr(
        df["timeouts_per_session"], df["auctions_per_session"]
    )
    corr_timeouts_revenue, p2 = pearsonr(
        df["timeouts_per_session"], df["revenue_per_session"]
    )

    return {
        "timeouts_vs_auctions": {"correlation": corr_timeouts_auctions, "p_value": p1},
        "timeouts_vs_revenue": {"correlation": corr_timeouts_revenue, "p_value": p2},
    }


def print_summary_stats(df: pd.DataFrame, correlations: dict):
    """Print summary statistics"""
    print("=" * 60)
    print("IMPRESSION LIFT HYPOTHESIS VALIDATION")
    print("Session Correlation Analysis")
    print("=" * 60)
    print(f"\nTotal sessions analyzed: {len(df)}")
    print("\nSummary Statistics:")
    print("-" * 60)
    print("Timeouts per session:")
    print(f"  Mean: {df['timeouts_per_session'].mean():.2f}")
    print(f"  Median: {df['timeouts_per_session'].median():.2f}")
    print(f"  Std: {df['timeouts_per_session'].std():.2f}")
    print("\nAuctions per session:")
    print(f"  Mean: {df['auctions_per_session'].mean():.2f}")
    print(f"  Median: {df['auctions_per_session'].median():.2f}")
    print(f"  Std: {df['auctions_per_session'].std():.2f}")
    print("\nRevenue per session (RPS):")
    print(f"  Mean: ${df['revenue_per_session'].mean():.4f}")
    print(f"  Median: ${df['revenue_per_session'].median():.4f}")
    print(f"  Std: ${df['revenue_per_session'].std():.4f}")
    print("\n" + "=" * 60)
    print("CORRELATION RESULTS")
    print("=" * 60)
    print("\nTimeouts vs Auctions per session:")
    print(f"  Correlation: {correlations['timeouts_vs_auctions']['correlation']:.4f}")
    print(f"  P-value: {correlations['timeouts_vs_auctions']['p_value']:.4e}")
    print("\nTimeouts vs Revenue per session:")
    print(f"  Correlation: {correlations['timeouts_vs_revenue']['correlation']:.4f}")
    print(f"  P-value: {correlations['timeouts_vs_revenue']['p_value']:.4e}")
    print("=" * 60)


def create_visualizations(df: pd.DataFrame, output_dir: Path, num_sessions: int):
    """Create scatter plots"""
    sns.set_style("whitegrid")
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Plot 1: Timeouts vs Auctions
    axes[0].scatter(
        df["timeouts_per_session"], df["auctions_per_session"], alpha=0.5, s=20
    )
    axes[0].set_xlabel("Timeouts per Session")
    axes[0].set_ylabel("Auctions per Session")
    axes[0].set_title("Timeouts vs Auctions per Session")
    axes[0].grid(True, alpha=0.3)

    # Plot 2: Timeouts vs Revenue
    axes[1].scatter(
        df["timeouts_per_session"], df["revenue_per_session"], alpha=0.5, s=20
    )
    axes[1].set_xlabel("Timeouts per Session")
    axes[1].set_ylabel("Revenue per Session (RPS)")
    axes[1].set_title("Timeouts vs Revenue per Session")
    axes[1].grid(True, alpha=0.3)

    # Add metadata text
    info_text = f"Sessions analyzed: {num_sessions:,} | Filtered: 5-15 min session length (pre-aggregated data)"
    fig.suptitle("Impression Lift Hypothesis Analysis", fontsize=14, y=1.02)
    fig.text(0.5, 0.01, info_text, ha="center", fontsize=10, style="italic")

    plt.tight_layout(rect=[0, 0.03, 1, 0.98])

    output_path = output_dir / "session-correlation-analysis.png"
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"\nVisualizations saved to: {output_path}")
    plt.close()


def generate_summary(df: pd.DataFrame, correlations: dict, output_dir: Path):
    """Generate summary.md file"""
    summary_lines = [
        "# Session Correlation Analysis Summary",
        "",
        "## Hypothesis",
        "Impression Lift Hypothesis: Less timeout → auctions finished faster → more auctions per session → impression → viewability + revenue",
        "",
        "## Data",
        f"- **Total sessions analyzed**: {len(df):,}",
        f"- **Filter**: Sessions with length 5-15 minutes (median ± 5 min)",
        "",
        "## Summary Statistics",
        "",
        f"- **Timeouts per session**: Mean={df['timeouts_per_session'].mean():.2f}, Median={df['timeouts_per_session'].median():.2f}",
        f"- **Auctions per session**: Mean={df['auctions_per_session'].mean():.2f}, Median={df['auctions_per_session'].median():.2f}",
        f"- **Revenue per session (RPS)**: Mean=${df['revenue_per_session'].mean():.4f}, Median=${df['revenue_per_session'].median():.4f}",
        "",
        "## Correlation Results",
        "",
        f"### Timeouts vs Auctions per session",
        f"- **Correlation**: {correlations['timeouts_vs_auctions']['correlation']:.4f}",
        f"- **P-value**: {correlations['timeouts_vs_auctions']['p_value']:.4e}",
        f"- **Interpretation**: {'✓ Positive correlation' if correlations['timeouts_vs_auctions']['correlation'] > 0 else '✗ Negative correlation'}",
        "",
        f"### Timeouts vs Revenue per session",
        f"- **Correlation**: {correlations['timeouts_vs_revenue']['correlation']:.4f}",
        f"- **P-value**: {correlations['timeouts_vs_revenue']['p_value']:.4e}",
        f"- **Interpretation**: {'✓ Positive correlation' if correlations['timeouts_vs_revenue']['correlation'] > 0 else '✗ Negative correlation'}",
        "",
        "## Conclusion",
        "",
        "The analysis shows correlations between timeouts, auctions, and revenue for sessions of similar length (5-15 minutes).",
        "",
        f"**Visualization**: `session-correlation-analysis.png`",
    ]

    summary_path = output_dir / "summary.md"
    with open(summary_path, "w") as f:
        f.write("\n".join(summary_lines))
    print(f"Summary saved to: {summary_path}")


def main():
    # Find and load aggregated session data
    data_file = find_aggregated_sessions_file()
    print(f"Loading aggregated session data from: {data_file.name}")
    df = load_aggregated_sessions(data_file, filter_median_length=True)

    print(f"Loaded {len(df)} session records")

    # Calculate correlations
    correlations = calculate_correlations(df)

    # Print results
    print_summary_stats(df, correlations)

    # Create visualizations
    output_dir = Path(__file__).parent
    create_visualizations(df, output_dir, len(df))

    # Generate summary
    generate_summary(df, correlations, output_dir)


if __name__ == "__main__":
    main()
