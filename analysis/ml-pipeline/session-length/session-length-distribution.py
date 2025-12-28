"""Session Length Distribution

Simple visualization of session length distribution.
"""

import json
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns


def load_aggregated_sessions(json_file_path: Path) -> pd.DataFrame:
    """Load pre-aggregated session data from JSON file"""
    with open(json_file_path, "r") as f:
        data = json.load(f)

    sessions = data["data"]
    df = pd.DataFrame(sessions)

    # Convert session_length_ms to minutes
    df["session_length_min"] = df["session_length_ms"] / 1000 / 60

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


def create_visualizations(df: pd.DataFrame, output_dir: Path):
    """Create bell curve of session lengths"""
    sns.set_style("whitegrid")
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # Filter: remove zero-length sessions and limit to 52.3 minutes max
    df_limited = df[
        (df["session_length_min"] > 0) & (df["session_length_min"] <= 52.3)
    ].copy()

    # Calculate stats once
    median = df_limited["session_length_min"].median()
    p95 = df_limited["session_length_min"].quantile(0.95)

    # Plot 1: Log scale histogram
    axes[0].hist(
        df_limited["session_length_min"], bins=100, alpha=0.7, edgecolor="black"
    )
    axes[0].set_xlabel("Session Length (minutes)")
    axes[0].set_ylabel("Frequency (log scale)")
    axes[0].set_yscale("log")
    axes[0].set_title("Session Length Distribution (Log Scale)")
    axes[0].grid(True, alpha=0.3, which="both")
    axes[0].axvline(
        median, color="r", linestyle="--", alpha=0.5, label=f"Median: {median:.1f} min"
    )
    axes[0].axvline(
        p95, color="orange", linestyle="--", alpha=0.5, label=f"95th: {p95:.1f} min"
    )
    axes[0].legend()

    # Plot 2: Non-log scale histogram (actual values)
    axes[1].hist(
        df_limited["session_length_min"], bins=100, alpha=0.7, edgecolor="black"
    )
    axes[1].set_xlabel("Session Length (minutes)")
    axes[1].set_ylabel("Frequency")
    axes[1].set_title("Session Length Distribution (Actual Values)")
    axes[1].grid(True, alpha=0.3)
    axes[1].axvline(
        median, color="r", linestyle="--", alpha=0.5, label=f"Median: {median:.1f} min"
    )
    axes[1].axvline(
        p95, color="orange", linestyle="--", alpha=0.5, label=f"95th: {p95:.1f} min"
    )
    axes[1].legend()

    # Add overall title
    fig.suptitle(
        f"Session Length Distribution - {len(df_limited):,} sessions (≤52.3 min, from {len(df):,} total)",
        fontsize=14,
        y=1.02,
    )

    plt.tight_layout()

    output_path = output_dir / "session-length-distribution.png"
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"Visualization saved to: {output_path}")
    plt.close()


def generate_summary(df: pd.DataFrame, output_dir: Path):
    """Generate summary.md file"""
    df_limited = df[
        (df["session_length_min"] > 0) & (df["session_length_min"] <= 52.3)
    ].copy()

    summary_lines = [
        "# Session Length Distribution Summary",
        "",
        "## Overview",
        "Analysis of session length distribution to understand user engagement patterns.",
        "",
        "## Data",
        f"- **Total sessions**: {len(df):,}",
        f"- **Sessions visualized**: {len(df_limited):,} (filtered to ≤52.3 minutes)",
        f"- **Full range**: {df['session_length_min'].min():.2f} - {df['session_length_min'].max():.2f} minutes",
        "",
        "## Statistics",
        "",
        f"- **Mean**: {df_limited['session_length_min'].mean():.2f} minutes",
        f"- **Median**: {df_limited['session_length_min'].median():.2f} minutes",
        f"- **95th percentile**: {df_limited['session_length_min'].quantile(0.95):.2f} minutes",
        f"- **Standard deviation**: {df_limited['session_length_min'].std():.2f} minutes",
        "",
        "## Distribution Characteristics",
        "",
        "The session length distribution is highly skewed with:",
        f"- Most sessions concentrated in the lower range (median: {df_limited['session_length_min'].median():.1f} min)",
        f"- Long tail extending to {df_limited['session_length_min'].max():.1f} minutes",
        "- Log scale visualization helps reveal the distribution pattern",
        "",
        f"**Visualization**: `session-length-distribution.png`",
    ]

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
    print(
        f"Session length range: {df['session_length_min'].min():.2f} - {df['session_length_min'].max():.2f} minutes"
    )

    # Create visualizations
    output_dir = Path(__file__).parent
    create_visualizations(df, output_dir)

    # Generate summary
    generate_summary(df, output_dir)


if __name__ == "__main__":
    main()
