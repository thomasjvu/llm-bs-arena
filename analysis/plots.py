#!/usr/bin/env python3
"""
Visualization for LLM Bullshit research.
"""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROJECT_CACHE_DIR = PROJECT_ROOT / ".cache"
MPL_CACHE_DIR = PROJECT_CACHE_DIR / "matplotlib"

PROJECT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
MPL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("XDG_CACHE_HOME", str(PROJECT_CACHE_DIR.resolve()))
os.environ.setdefault("MPLCONFIGDIR", str(MPL_CACHE_DIR.resolve()))

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib.patches import FancyBboxPatch
from matplotlib.ticker import PercentFormatter

matplotlib.use("Agg")


EXPERIMENT_PALETTE = {
    0: "#5F7C99",
    1: "#C97A38",
    2: "#6C9561",
    3: "#B8565A",
}
BACKGROUND = "#FBF8F3"
PANEL = "#FFFDF9"
GRID = "#D7D0C3"
TEXT = "#1F2933"
MUTED = "#5B6674"
BOX_FILL = "#F3EBDD"
BOX_EDGE = "#304050"

PRETTY_MODEL_NAMES = {
    "minimaxai/minimax-m2.5": "MiniMax",
    "mistralai/mistral-small-4-119b-2603": "Mistral",
    "moonshotai/kimi-k2.5": "Kimi",
    "nvidia/nemotron-3-super-120b-a12b": "Nemotron",
    "qwen/qwen3.5-397b-a17b": "Qwen",
    "z-ai/glm5": "GLM",
}

MODEL_ORDER = [
    "nvidia/nemotron-3-super-120b-a12b",
    "moonshotai/kimi-k2.5",
    "qwen/qwen3.5-397b-a17b",
    "z-ai/glm5",
    "minimaxai/minimax-m2.5",
    "mistralai/mistral-small-4-119b-2603",
]


def setup_style():
    """Set up matplotlib style for publication-quality figures."""
    plt.style.use("seaborn-v0_8-whitegrid")
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.titlesize": 14,
        "axes.titleweight": "semibold",
        "axes.labelsize": 11,
        "axes.edgecolor": GRID,
        "axes.linewidth": 0.8,
        "axes.facecolor": PANEL,
        "figure.facecolor": BACKGROUND,
        "xtick.labelsize": 9,
        "ytick.labelsize": 9,
        "legend.fontsize": 9,
        "figure.titlesize": 14,
        "figure.dpi": 150,
        "savefig.dpi": 300,
        "savefig.bbox": "tight",
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "grid.alpha": 0.75,
        "text.color": TEXT,
        "axes.labelcolor": TEXT,
        "xtick.color": TEXT,
        "ytick.color": TEXT,
    })


def shorten_model_name(name: str) -> str:
    """Shorten model names for display."""
    if name in PRETTY_MODEL_NAMES:
        return PRETTY_MODEL_NAMES[name]
    parts = name.split("/")
    return parts[-1] if len(parts) > 1 else name


def style_axis(ax, title: str, xlabel: str, ylabel: str):
    """Apply consistent paper styling to an axis."""
    ax.set_title(title, pad=14)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(GRID)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(length=0)


def add_hbar_labels(ax, bars, formatter: str = "{:.1%}", pad: float = 0.008):
    """Add right-side value labels for horizontal bars."""
    xmax = ax.get_xlim()[1]
    for bar in bars:
        width = bar.get_width()
        x = min(width + pad, xmax * 0.985)
        ax.text(
            x,
            bar.get_y() + bar.get_height() / 2,
            formatter.format(width),
            va="center",
            ha="left" if x < xmax * 0.985 else "right",
            fontsize=9,
            color=TEXT,
        )


def plot_benchmark_overview(output_path: str):
    """Generate the benchmark overview figure."""
    fig, ax = plt.subplots(figsize=(14, 4.8))
    fig.patch.set_facecolor(BACKGROUND)
    ax.set_facecolor(BACKGROUND)
    ax.set_xlim(0, 20)
    ax.set_ylim(0, 6)
    ax.axis("off")

    boxes = [
        (0.8, 1.8, 3.3, 2.3, "Prompt Conditions", ["Exp0 control", "Exp1 deception", "Exp2 asymmetric", "Exp3 honesty"]),
        (5.0, 1.4, 3.5, 3.1, "Seeded Game Engine", ["4 players", "legal bluffing", "sequential challenges"]),
        (9.4, 1.4, 3.7, 3.1, "Provenance-Aware Logs", ["actual cards", "public claims", "challenge outcomes"]),
        (14.0, 1.4, 3.8, 3.1, "Player-Game Analysis", ["CSV summaries", "cohort filtering", "frozen artifacts"]),
        (18.4, 1.8, 1.2, 2.3, "Paper +", ["release"]),
    ]

    for x, y, w, h, title, lines in boxes:
        rect = FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.12,rounding_size=0.14",
            linewidth=1.6,
            edgecolor=BOX_EDGE,
            facecolor=BOX_FILL,
        )
        ax.add_patch(rect)
        ax.text(
            x + w / 2,
            y + h - 0.5,
            title,
            ha="center",
            va="top",
            fontsize=13,
            fontweight="semibold",
            color=TEXT,
        )
        ax.text(
            x + w / 2,
            y + h / 2 - 0.12,
            "\n".join(lines),
            ha="center",
            va="center",
            fontsize=12,
            color=TEXT,
        )

    chip_x = 1.05
    for label, color in [("E0", EXPERIMENT_PALETTE[0]), ("E1", EXPERIMENT_PALETTE[1]), ("E2", EXPERIMENT_PALETTE[2]), ("E3", EXPERIMENT_PALETTE[3])]:
        chip = FancyBboxPatch(
            (chip_x, 1.2),
            0.5,
            0.34,
            boxstyle="round,pad=0.05,rounding_size=0.08",
            linewidth=0,
            facecolor=color,
        )
        ax.add_patch(chip)
        ax.text(chip_x + 0.25, 1.37, label, ha="center", va="center", fontsize=8.5, color="white", fontweight="bold")
        chip_x += 0.6

    for start_x, end_x in [(4.15, 5.0), (8.62, 9.4), (13.12, 14.0), (17.92, 18.4)]:
        ax.annotate(
            "",
            xy=(end_x, 3.0),
            xytext=(start_x, 3.0),
            arrowprops=dict(arrowstyle="-|>", lw=1.6, color=BOX_EDGE, shrinkA=0, shrinkB=0),
        )

    ax.text(0.9, 0.52, "same roster, same prompt hash, same seeded protocol", fontsize=11, color=MUTED)
    ax.text(8.1, 0.18, "frozen comparable cohort: 600 winner-terminated games", fontsize=11, color=MUTED)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_win_rates(
    stats_df: pd.DataFrame,
    output_path: str,
    title: str = "Win Rates by Model",
    experiment_id: int = 1,
    baseline_df: pd.DataFrame | None = None,
):
    """Leaderboard chart of win rates, optionally with baseline markers."""
    fig, ax = plt.subplots(figsize=(10.5, 6.3))

    df = stats_df.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)
    df = df.sort_values("win_rate", ascending=True).reset_index(drop=True)

    baseline_map = None
    if baseline_df is not None:
        baseline_map = baseline_df.set_index("model_id")["win_rate"].to_dict()

    bars = ax.barh(
        df["short_name"],
        df["win_rate"],
        color=EXPERIMENT_PALETTE.get(experiment_id, "#6A88A8"),
        edgecolor="white",
        linewidth=1.2,
        height=0.78,
    )

    ax.set_xlim(0, max(df["win_rate"].max() * 1.1, 0.72))
    ax.xaxis.set_major_formatter(PercentFormatter(1.0))
    style_axis(ax, title, "Win rate", "")
    ax.grid(axis="x", color=GRID, linewidth=0.9, alpha=0.7)
    ax.grid(axis="y", visible=False)
    add_hbar_labels(ax, bars)

    if baseline_map is not None:
        y_positions = np.arange(len(df))
        baseline_values = [baseline_map.get(model_id, np.nan) for model_id in df["model_id"]]
        ax.scatter(
            baseline_values,
            y_positions,
            s=44,
            facecolors=PANEL,
            edgecolors=TEXT,
            linewidths=1.0,
            zorder=4,
            label="Exp 0 reference",
        )
        ax.legend(frameon=False, loc="lower right")

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_deception_metrics(stats_df: pd.DataFrame, output_path: str):
    """Scatter plot of lie frequency vs lie success rate."""
    fig, ax = plt.subplots(figsize=(10.5, 6.8))

    df = stats_df.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)
    sizes = df["win_rate"] * 520 + 55

    scatter = ax.scatter(
        df["lie_frequency"],
        df["lie_success_rate"],
        s=sizes,
        c=df["win_rate"],
        cmap="copper",
        alpha=0.88,
        edgecolors="white",
        linewidths=0.9,
    )

    for _, row in df.iterrows():
        ax.annotate(
            row["short_name"],
            (row["lie_frequency"], row["lie_success_rate"]),
            xytext=(5, 5),
            textcoords="offset points",
            fontsize=8,
        )

    style_axis(ax, "Deception Effectiveness", "Lie frequency", "Lie success rate")
    ax.xaxis.set_major_formatter(PercentFormatter(1.0))
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.grid(axis="both", color=GRID, linewidth=0.9, alpha=0.7)

    cbar = plt.colorbar(scatter)
    cbar.set_label("Win rate")
    cbar.ax.yaxis.set_major_formatter(PercentFormatter(1.0))

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_paranoia_distribution(stats_df: pd.DataFrame, output_path: str):
    """Bar chart of challenge frequency by model."""
    fig, ax = plt.subplots(figsize=(10.5, 6.3))

    df = stats_df.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)
    df = df.sort_values("paranoia_frequency", ascending=True)

    bars = ax.barh(
        df["short_name"],
        df["paranoia_frequency"],
        color="#8A6F87",
        edgecolor="white",
        linewidth=1.2,
        height=0.78,
    )

    ax.set_xlim(0, max(df["paranoia_frequency"].max() * 1.1, 0.8))
    ax.xaxis.set_major_formatter(PercentFormatter(1.0))
    style_axis(ax, "Challenge Frequency by Model", "Challenge frequency", "")
    ax.grid(axis="x", color=GRID, linewidth=0.9, alpha=0.7)
    ax.grid(axis="y", visible=False)
    add_hbar_labels(ax, bars)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_experiment_comparison(
    experiment_stats: dict[int, pd.DataFrame],
    metric: str,
    output_path: str,
    title: str = "Experiment Comparison",
    ylabel: str = "Lie frequency",
):
    """Compare a metric across all experiments with per-model trajectories."""
    records = []
    for experiment_id, stats_df in experiment_stats.items():
        for _, row in stats_df.iterrows():
            records.append({
                "experiment_id": experiment_id,
                "model_id": row["model_id"],
                metric: row[metric],
            })

    combined = pd.DataFrame(records)
    pivot = combined.pivot(index="model_id", columns="experiment_id", values=metric).loc[MODEL_ORDER]

    fig, ax = plt.subplots(figsize=(11.5, 6.3))
    x = np.arange(4)

    for model_id in MODEL_ORDER:
        values = pivot.loc[model_id].values
        ax.plot(
            x,
            values,
            color=MUTED,
            linewidth=1.3,
            alpha=0.5,
            zorder=1,
        )
        for experiment_id, value in zip(sorted(experiment_stats), values):
            ax.scatter(
                experiment_id,
                value,
                s=70,
                color=EXPERIMENT_PALETTE[experiment_id],
                edgecolors="white",
                linewidths=0.9,
                zorder=3,
            )

    for model_id in [
        "moonshotai/kimi-k2.5",
        "nvidia/nemotron-3-super-120b-a12b",
        "mistralai/mistral-small-4-119b-2603",
    ]:
        values = pivot.loc[model_id].values
        ax.plot(
            x,
            values,
            color=TEXT,
            linewidth=2.2,
            alpha=0.95,
            zorder=2,
        )
        ax.text(
            x[-1] + 0.08,
            values[-1],
            shorten_model_name(model_id),
            va="center",
            fontsize=9,
            color=TEXT,
        )

    ax.set_xticks(x)
    ax.set_xticklabels([f"Exp {idx}" for idx in x])
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.set_ylim(0, max(pivot.max().max() * 1.15, 0.58))
    ax.set_xlim(-0.2, 3.55)
    style_axis(ax, title, "Condition", ylabel)
    ax.grid(axis="y", color=GRID, linewidth=0.9, alpha=0.7)
    ax.grid(axis="x", color=GRID, linewidth=0.6, alpha=0.45)
    ax.set_title(title, pad=14)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_instruction_violations(exp3_stats: pd.DataFrame, output_path: str):
    """Bar chart of instruction violation rates in experiment 3."""
    fig, ax = plt.subplots(figsize=(10.5, 6.3))

    df = exp3_stats.copy()
    df["short_name"] = df["model_id"].apply(shorten_model_name)
    df = df.sort_values("instruction_violation_rate", ascending=True).reset_index(drop=True)

    bars = ax.barh(
        df["short_name"],
        df["instruction_violation_rate"],
        color=EXPERIMENT_PALETTE[3],
        edgecolor="white",
        linewidth=1.2,
        height=0.78,
    )

    ax.set_xlim(0, max(df["instruction_violation_rate"].max() * 1.18, 0.34))
    ax.xaxis.set_major_formatter(PercentFormatter(1.0))
    style_axis(ax, "Experiment 3: Honesty-Rule Violations", "Instruction violation rate", "")
    ax.grid(axis="x", color=GRID, linewidth=0.9, alpha=0.7)
    ax.grid(axis="y", visible=False)
    add_hbar_labels(ax, bars, pad=0.006)

    if "win_rate" in df.columns:
        y_positions = np.arange(len(df))
        ax.scatter(
            df["win_rate"],
            y_positions,
            s=40,
            facecolors=PANEL,
            edgecolors=TEXT,
            linewidths=1.0,
            zorder=4,
            label="Win rate",
        )
        ax.legend(frameon=False, loc="lower right")

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_lie_frequency_heatmap(turns_df: pd.DataFrame, output_path: str):
    """Heatmap of lie frequency by model and experiment."""
    fig, ax = plt.subplots(figsize=(11.5, 7.2))

    plot_df = turns_df.copy()
    plot_df["short_name"] = plot_df["model_id"].apply(shorten_model_name)

    pivot = plot_df.pivot_table(
        values="was_lie",
        index="short_name",
        columns="experiment_id",
        aggfunc="mean",
    )

    sns.heatmap(
        pivot,
        annot=True,
        fmt=".2f",
        cmap="RdYlGn_r",
        ax=ax,
        vmin=0,
        vmax=1,
        linewidths=0.5,
        linecolor=PANEL,
    )

    ax.set_xlabel("Experiment")
    ax.set_ylabel("Model")
    ax.set_title("Lie Frequency by Model and Experiment", pad=12)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_game_length_distribution(summary_df: pd.DataFrame, output_path: str):
    """Distribution of game lengths by experiment."""
    fig, ax = plt.subplots(figsize=(10.5, 6.3))

    for exp_id in sorted(summary_df["experiment_id"].unique()):
        data = summary_df[summary_df["experiment_id"] == exp_id]["total_turns"]
        ax.hist(
            data,
            bins=20,
            alpha=0.42,
            label=f"Exp {exp_id}",
            color=EXPERIMENT_PALETTE.get(int(exp_id), "#7A7A7A"),
            edgecolor="white",
            linewidth=0.5,
        )

    style_axis(ax, "Distribution of Game Lengths", "Number of turns", "Frequency")
    ax.grid(axis="y", color=GRID, linewidth=0.9, alpha=0.7)
    ax.grid(axis="x", visible=False)
    ax.legend(frameon=False)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_metric_vs_win_rate(
    exp_stats: list[tuple[int, pd.DataFrame]],
    metric: str,
    output_path: str,
    title: str,
    xlabel: str,
):
    """Scatter plot of a condition-level metric vs win rate across model-condition pairs."""
    frames = []
    for experiment_id, stats_df in exp_stats:
        df = stats_df.copy()
        df["experiment_id"] = experiment_id
        df["short_name"] = df["model_id"].apply(shorten_model_name)
        frames.append(df)

    if not frames:
        return

    combined = pd.concat(frames, ignore_index=True)
    fig, ax = plt.subplots(figsize=(10.5, 6.8))

    markers = {0: "o", 1: "s", 2: "^", 3: "D"}
    for experiment_id, group in combined.groupby("experiment_id"):
        ax.scatter(
            group[metric],
            group["win_rate"],
            s=110,
            alpha=0.88,
            color=EXPERIMENT_PALETTE.get(int(experiment_id), "#666666"),
            edgecolors="white",
            linewidths=0.8,
            marker=markers.get(int(experiment_id), "o"),
            label=f"Exp {int(experiment_id)}",
        )

    label_models = {
        "moonshotai/kimi-k2.5": "Kimi",
        "mistralai/mistral-small-4-119b-2603": "Mistral",
        "nvidia/nemotron-3-super-120b-a12b": "Nemotron",
    }
    for _, row in combined.iterrows():
        if row["model_id"] not in label_models:
            continue
        ax.annotate(
            f"{label_models[row['model_id']]} E{int(row['experiment_id'])}",
            (row[metric], row["win_rate"]),
            xytext=(6, 6),
            textcoords="offset points",
            fontsize=8.5,
            color=TEXT,
        )

    style_axis(ax, title, xlabel, "Win rate")
    ax.xaxis.set_major_formatter(PercentFormatter(1.0))
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.grid(axis="both", color=GRID, linewidth=0.9, alpha=0.7)
    ax.axvline(combined[metric].median(), color=MUTED, linewidth=1.0, linestyle="--", alpha=0.5)
    ax.axhline(combined["win_rate"].median(), color=MUTED, linewidth=1.0, linestyle="--", alpha=0.5)
    ax.legend(title="Condition", frameon=False)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_lie_frequency_vs_win_rate(exp_stats: list[tuple[int, pd.DataFrame]], output_path: str):
    """Scatter plot of lie frequency vs win rate across model-condition pairs."""
    plot_metric_vs_win_rate(
        exp_stats,
        "lie_frequency",
        output_path,
        "Lie Frequency vs Win Rate by Model and Condition",
        "Lie frequency",
    )


def plot_challenge_frequency_vs_win_rate(exp_stats: list[tuple[int, pd.DataFrame]], output_path: str):
    """Scatter plot of challenge frequency vs win rate across model-condition pairs."""
    plot_metric_vs_win_rate(
        exp_stats,
        "paranoia_frequency",
        output_path,
        "Challenge Frequency vs Win Rate by Model and Condition",
        "Challenge frequency",
    )


def generate_all_plots(csv_dir: str, output_dir: str):
    """Generate all plots from CSV data."""
    csv_path = Path(csv_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    setup_style()

    turns_df = None
    summary_df = None
    exp0_stats = None
    exp1_stats = None
    exp2_stats = None
    exp3_stats = None

    if (csv_path / "all_turns.csv").exists():
        turns_df = pd.read_csv(csv_path / "all_turns.csv")

    if (csv_path / "game_summary.csv").exists():
        summary_df = pd.read_csv(csv_path / "game_summary.csv")

    if (csv_path / "player_stats_exp0.csv").exists():
        exp0_stats = pd.read_csv(csv_path / "player_stats_exp0.csv")

    if (csv_path / "player_stats_exp1.csv").exists():
        exp1_stats = pd.read_csv(csv_path / "player_stats_exp1.csv")

    if (csv_path / "player_stats_exp2.csv").exists():
        exp2_stats = pd.read_csv(csv_path / "player_stats_exp2.csv")

    if (csv_path / "player_stats_exp3.csv").exists():
        exp3_stats = pd.read_csv(csv_path / "player_stats_exp3.csv")

    if exp1_stats is not None:
        plot_win_rates(
            exp1_stats,
            output_path / "exp1_win_rates.png",
            "Experiment 1: Win Rate Leaderboard",
            experiment_id=1,
            baseline_df=exp0_stats,
        )
        plot_deception_metrics(exp1_stats, output_path / "exp1_deception.png")
        plot_paranoia_distribution(exp1_stats, output_path / "exp1_paranoia.png")

    if exp2_stats is not None:
        plot_win_rates(
            exp2_stats,
            output_path / "exp2_win_rates.png",
            "Experiment 2: Win Rate Leaderboard",
            experiment_id=2,
        )

    if exp3_stats is not None and "instruction_violation_rate" in exp3_stats.columns:
        plot_instruction_violations(exp3_stats, output_path / "exp3_violations.png")

    if exp0_stats is not None and exp1_stats is not None and exp2_stats is not None and exp3_stats is not None:
        plot_experiment_comparison(
            {
                0: exp0_stats,
                1: exp1_stats,
                2: exp2_stats,
                3: exp3_stats,
            },
            "lie_frequency",
            output_path / "compare_lie_frequency.png",
            "Lie Frequency by Model Across Conditions",
        )
        plot_experiment_comparison(
            {
                0: exp0_stats,
                1: exp1_stats,
                2: exp2_stats,
                3: exp3_stats,
            },
            "paranoia_frequency",
            output_path / "compare_challenge_frequency.png",
            "Challenge Frequency by Model Across Conditions",
            ylabel="Challenge frequency",
        )

    scatter_inputs = [
        (experiment_id, stats_df)
        for experiment_id, stats_df in [
            (0, exp0_stats),
            (1, exp1_stats),
            (2, exp2_stats),
            (3, exp3_stats),
        ]
        if stats_df is not None
    ]
    if scatter_inputs:
        plot_lie_frequency_vs_win_rate(scatter_inputs, output_path / "lie_frequency_vs_win_rate.png")
        plot_challenge_frequency_vs_win_rate(scatter_inputs, output_path / "challenge_frequency_vs_win_rate.png")

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
