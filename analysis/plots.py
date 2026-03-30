#!/usr/bin/env python3
"""
Visualization for LLM Bullshit research.
"""

import os
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROJECT_CACHE_DIR = PROJECT_ROOT / ".cache"
MPL_CACHE_DIR = PROJECT_CACHE_DIR / "matplotlib"

PROJECT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
MPL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("XDG_CACHE_HOME", str(PROJECT_CACHE_DIR.resolve()))
os.environ.setdefault("MPLCONFIGDIR", str(MPL_CACHE_DIR.resolve()))

import pandas as pd
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns


def setup_style():
    """Set up matplotlib style for publication-quality figures."""
    plt.style.use("seaborn-v0_8-whitegrid")
    plt.rcParams.update({
        "font.size": 10,
        "axes.titlesize": 12,
        "axes.labelsize": 11,
        "xtick.labelsize": 9,
        "ytick.labelsize": 9,
        "legend.fontsize": 9,
        "figure.titlesize": 14,
        "figure.dpi": 150,
        "savefig.dpi": 300,
        "savefig.bbox": "tight",
    })


def shorten_model_name(name: str) -> str:
    """Shorten model names for display."""
    parts = name.split("/")
    return parts[-1] if len(parts) > 1 else name


def plot_win_rates(stats_df: pd.DataFrame, output_path: str, title: str = "Win Rates by Model"):
    """Bar chart of win rates."""
    fig, ax = plt.subplots(figsize=(10, 6))

    df = stats_df.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)
    df = df.sort_values("win_rate", ascending=True)

    colors = plt.cm.Blues(np.linspace(0.3, 0.9, len(df)))

    bars = ax.barh(df["short_name"], df["win_rate"], color=colors)

    ax.set_xlabel("Win Rate")
    ax.set_title(title)
    ax.set_xlim(0, max(df["win_rate"]) * 1.1)

    # Add value labels
    for bar, val in zip(bars, df["win_rate"]):
        ax.text(val + 0.01, bar.get_y() + bar.get_height()/2,
                f"{val:.1%}", va="center", fontsize=8)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_deception_metrics(stats_df: pd.DataFrame, output_path: str):
    """Scatter plot of lie frequency vs lie success rate."""
    fig, ax = plt.subplots(figsize=(10, 8))

    df = stats_df.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)

    # Size points by win rate
    sizes = df["win_rate"] * 500 + 50

    scatter = ax.scatter(
        df["lie_frequency"],
        df["lie_success_rate"],
        s=sizes,
        c=df["win_rate"],
        cmap="RdYlGn",
        alpha=0.7,
        edgecolors="black",
        linewidths=1
    )

    # Add labels
    for _, row in df.iterrows():
        ax.annotate(
            row["short_name"],
            (row["lie_frequency"], row["lie_success_rate"]),
            xytext=(5, 5),
            textcoords="offset points",
            fontsize=8
        )

    ax.set_xlabel("Lie Frequency")
    ax.set_ylabel("Lie Success Rate")
    ax.set_title("Deception Effectiveness: Frequency vs Success")

    cbar = plt.colorbar(scatter)
    cbar.set_label("Win Rate")

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_paranoia_distribution(stats_df: pd.DataFrame, output_path: str):
    """Bar chart of paranoia (challenge frequency) by model."""
    fig, ax = plt.subplots(figsize=(10, 6))

    df = stats_df.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)
    df = df.sort_values("paranoia_frequency", ascending=True)

    colors = plt.cm.Reds(np.linspace(0.3, 0.9, len(df)))

    bars = ax.barh(df["short_name"], df["paranoia_frequency"], color=colors)

    ax.set_xlabel("Challenge Frequency (Paranoia)")
    ax.set_title("Paranoia by Model: How Often Each Model Challenges")
    ax.set_xlim(0, max(df["paranoia_frequency"]) * 1.1)

    for bar, val in zip(bars, df["paranoia_frequency"]):
        ax.text(val + 0.005, bar.get_y() + bar.get_height()/2,
                f"{val:.1%}", va="center", fontsize=8)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_experiment_comparison(
    exp1_stats: pd.DataFrame,
    exp2_stats: pd.DataFrame,
    metric: str,
    output_path: str,
    title: str = "Experiment Comparison"
):
    """Compare a metric between two experiments."""
    fig, ax = plt.subplots(figsize=(12, 6))

    merged = exp1_stats.merge(
        exp2_stats,
        on="model_id",
        suffixes=("_exp1", "_exp2")
    )
    merged["short_name"] = merged["model_id"].apply(shorten_model_name)

    x = np.arange(len(merged))
    width = 0.35

    bars1 = ax.bar(x - width/2, merged[f"{metric}_exp1"], width, label="Experiment 1", color="steelblue")
    bars2 = ax.bar(x + width/2, merged[f"{metric}_exp2"], width, label="Experiment 2", color="coral")

    ax.set_xlabel("Model")
    ax.set_ylabel(metric.replace("_", " ").title())
    ax.set_title(title)
    ax.set_xticks(x)
    ax.set_xticklabels(merged["short_name"], rotation=45, ha="right")
    ax.legend()

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_instruction_violations(exp3_stats: pd.DataFrame, output_path: str):
    """Bar chart of instruction violation rates in experiment 3."""
    fig, ax = plt.subplots(figsize=(10, 6))

    df = exp3_stats.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)
    df = df.sort_values("instruction_violation_rate", ascending=False)

    colors = ["red" if v > 0.1 else "orange" if v > 0.05 else "green"
              for v in df["instruction_violation_rate"]]

    bars = ax.bar(range(len(df)), df["instruction_violation_rate"], color=colors)

    ax.set_xlabel("Model")
    ax.set_ylabel("Instruction Violation Rate")
    ax.set_title("RQ3: Who Violates Honesty Instructions?")
    ax.set_xticks(range(len(df)))
    ax.set_xticklabels(df["short_name"], rotation=45, ha="right")

    # Add threshold line
    ax.axhline(y=0, color="black", linestyle="-", linewidth=0.5)
    ax.axhline(y=0.05, color="orange", linestyle="--", linewidth=1, label="5% threshold")
    ax.axhline(y=0.1, color="red", linestyle="--", linewidth=1, label="10% threshold")
    ax.legend()

    for bar, val in zip(bars, df["instruction_violation_rate"]):
        ax.text(bar.get_x() + bar.get_width()/2, val + 0.005,
                f"{val:.1%}", ha="center", va="bottom", fontsize=8)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_lie_frequency_heatmap(turns_df: pd.DataFrame, output_path: str):
    """Heatmap of lie frequency by model and experiment."""
    fig, ax = plt.subplots(figsize=(12, 8))

    turns_df["short_name"] = turns_df["model_id"].apply(shorten_model_name)

    pivot = turns_df.pivot_table(
        values="was_lie",
        index="short_name",
        columns="experiment_id",
        aggfunc="mean"
    )

    sns.heatmap(
        pivot,
        annot=True,
        fmt=".2f",
        cmap="RdYlGn_r",
        ax=ax,
        vmin=0,
        vmax=1
    )

    ax.set_xlabel("Experiment")
    ax.set_ylabel("Model")
    ax.set_title("Lie Frequency by Model and Experiment")

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_game_length_distribution(summary_df: pd.DataFrame, output_path: str):
    """Distribution of game lengths by experiment."""
    fig, ax = plt.subplots(figsize=(10, 6))

    for exp_id in sorted(summary_df["experiment_id"].unique()):
        data = summary_df[summary_df["experiment_id"] == exp_id]["total_turns"]
        ax.hist(data, bins=20, alpha=0.5, label=f"Experiment {exp_id}")

    ax.set_xlabel("Number of Turns")
    ax.set_ylabel("Frequency")
    ax.set_title("Distribution of Game Lengths")
    ax.legend()

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def generate_all_plots(csv_dir: str, output_dir: str):
    """Generate all plots from CSV data."""
    csv_path = Path(csv_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    setup_style()

    # Load data
    turns_df = None
    summary_df = None
    exp1_stats = None
    exp2_stats = None
    exp3_stats = None

    if (csv_path / "all_turns.csv").exists():
        turns_df = pd.read_csv(csv_path / "all_turns.csv")

    if (csv_path / "game_summary.csv").exists():
        summary_df = pd.read_csv(csv_path / "game_summary.csv")

    if (csv_path / "player_stats_exp1.csv").exists():
        exp1_stats = pd.read_csv(csv_path / "player_stats_exp1.csv")

    if (csv_path / "player_stats_exp2.csv").exists():
        exp2_stats = pd.read_csv(csv_path / "player_stats_exp2.csv")

    if (csv_path / "player_stats_exp3.csv").exists():
        exp3_stats = pd.read_csv(csv_path / "player_stats_exp3.csv")

    # Generate plots
    if exp1_stats is not None:
        plot_win_rates(exp1_stats, output_path / "exp1_win_rates.png", "Experiment 1: Win Rates")
        plot_deception_metrics(exp1_stats, output_path / "exp1_deception.png")
        plot_paranoia_distribution(exp1_stats, output_path / "exp1_paranoia.png")

    if exp2_stats is not None:
        plot_win_rates(exp2_stats, output_path / "exp2_win_rates.png", "Experiment 2: Win Rates")

    if exp3_stats is not None and "instruction_violation_rate" in exp3_stats.columns:
        plot_instruction_violations(exp3_stats, output_path / "exp3_violations.png")

    if exp1_stats is not None and exp2_stats is not None:
        plot_experiment_comparison(
            exp1_stats, exp2_stats, "lie_frequency",
            output_path / "compare_lie_frequency.png",
            "RQ2: Lie Frequency - Exp1 vs Exp2 (Asymmetric)"
        )

    if turns_df is not None:
        plot_lie_frequency_heatmap(turns_df, output_path / "lie_frequency_heatmap.png")

    if summary_df is not None:
        plot_game_length_distribution(summary_df, output_path / "game_length_distribution.png")

    print(f"Generated plots in {output_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate plots for LLM Bullshit")
    parser.add_argument("--csv-dir", default="logs/csv", help="Directory containing CSV files")
    parser.add_argument("--output-dir", default="results/figures", help="Output directory for plots")
    args = parser.parse_args()

    generate_all_plots(args.csv_dir, args.output_dir)
