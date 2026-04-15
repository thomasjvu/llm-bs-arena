#!/usr/bin/env python3
"""
Generate a paper-friendly markdown research brief from exported CSVs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Optional

import numpy as np
import pandas as pd

from stats import bootstrap_mean_ci, bootstrap_mean_diff_ci


def load_csv(path: Path) -> Optional[pd.DataFrame]:
    if path.exists():
        return pd.read_csv(path)
    return None


def load_experiment_stats_tables(csv_dir: Path) -> Dict[int, pd.DataFrame]:
    tables: Dict[int, pd.DataFrame] = {}
    for path in sorted(csv_dir.glob("player_stats_exp*.csv")):
        try:
            exp_id = int(path.stem.replace("player_stats_exp", ""))
        except ValueError:
            continue
        tables[exp_id] = pd.read_csv(path)
    return tables


def pct(value: float) -> str:
    if pd.isna(value):
        return "n/a"
    return f"{value:.1%}"


def pct_ci(values: Iterable[float]) -> str:
    mean, lower, upper = bootstrap_mean_ci(values)
    if np.isnan(mean):
      return "n/a"
    return f"{mean:.1%} (95% CI {lower:.1%} to {upper:.1%})"


def pct_group_ci(df: pd.DataFrame, metric: str) -> str:
    grouped = df.groupby("model_id")[metric].mean()
    return pct_ci(grouped.astype(float))


def pct_delta_ci(values_a: Iterable[float], values_b: Iterable[float]) -> str:
    mean, lower, upper = bootstrap_mean_diff_ci(values_a, values_b)
    if np.isnan(mean):
        return "n/a"
    return f"{mean:+.1%} (95% CI {lower:+.1%} to {upper:+.1%})"


def render_experiment_overview(player_games: pd.DataFrame, experiment_stats: Dict[int, pd.DataFrame]) -> list[str]:
    lines = [
        "## Experiment Overview",
        "",
        "| Experiment | Games | Models | Mean win rate | Mean lie frequency | Mean paranoia | Mean instruction violation |",
        "|---|---:|---:|---|---|---|---|",
    ]

    experiment_ids = sorted({int(v) for v in player_games["experiment_id"].dropna().unique()} | set(experiment_stats.keys()))

    for experiment_id in experiment_ids:
        exp_df = player_games[player_games["experiment_id"] == experiment_id]
        exp_stats = experiment_stats.get(experiment_id)
        violation = "n/a"
        if exp_stats is not None and not exp_stats.empty:
            mean_win = pct_ci(exp_stats["win_rate"].astype(float))
            mean_lie = pct_ci(exp_stats["lie_frequency"].astype(float))
            mean_challenge = pct_ci(exp_stats["paranoia_frequency"].astype(float))
            if experiment_id == 3 and "instruction_violation_rate" in exp_stats.columns:
                violation = pct_ci(exp_stats["instruction_violation_rate"].fillna(0).astype(float))
            model_count = len(exp_stats)
        else:
            mean_win = pct_group_ci(exp_df, "won")
            mean_lie = pct_group_ci(exp_df, "lie_frequency")
            mean_challenge = pct_group_ci(exp_df, "paranoia_frequency")
            if experiment_id == 3 and "instruction_violation_rate" in exp_df.columns:
                violation = pct_group_ci(exp_df.fillna({"instruction_violation_rate": 0}), "instruction_violation_rate")
            model_count = exp_df["model_id"].nunique()

        lines.append(
            f"| {int(experiment_id)} | "
            f"{exp_df['game_id'].nunique()} | "
            f"{model_count} | "
            f"{mean_win} | "
            f"{mean_lie} | "
            f"{mean_challenge} | "
            f"{violation} |"
        )

    lines.append("")
    return lines


def render_baseline_table(player_games: pd.DataFrame, exp1_stats: Optional[pd.DataFrame]) -> list[str]:
    exp1 = player_games[player_games["experiment_id"] == 1]
    if (exp1_stats is None or exp1_stats.empty) and exp1.empty:
        return []

    if exp1_stats is not None and not exp1_stats.empty:
        df = exp1_stats.copy()
        df["games"] = df["games_played"].astype(int)
    else:
        rows = []
        for model_id, group in exp1.groupby("model_id"):
            rows.append({
                "model_id": model_id,
                "win_rate": float(group["won"].mean()),
                "lie_frequency": float(group["lie_frequency"].mean()),
                "lie_success_rate": float(group["lie_success_rate"].mean()),
                "paranoia_frequency": float(group["paranoia_frequency"].mean()),
                "challenge_accuracy": float(group["challenge_accuracy"].mean()),
                "games": len(group),
            })
        df = pd.DataFrame(rows)

    df = df.sort_values(["win_rate", "lie_frequency"], ascending=[False, False])
    lines = [
        "## RQ1: Baseline Deception (Experiment 1)",
        "",
        "| Model | Games | Win rate | Lie frequency | Lie success | Paranoia | Challenge accuracy |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]

    for _, row in df.iterrows():
        lines.append(
            f"| {row['model_id']} | {int(row['games'])} | {pct(row['win_rate'])} | "
            f"{pct(row['lie_frequency'])} | {pct(row['lie_success_rate'])} | "
            f"{pct(row['paranoia_frequency'])} | {pct(row['challenge_accuracy'])} |"
        )

    top_winner = df.iloc[0]
    top_liar = df.sort_values("lie_frequency", ascending=False).iloc[0]
    lines.extend([
        "",
        f"Top baseline winner: `{top_winner['model_id']}` at {pct(top_winner['win_rate'])}.",
        f"Highest baseline lie frequency: `{top_liar['model_id']}` at {pct(top_liar['lie_frequency'])}.",
        "",
    ])
    return lines


def render_moral_restraint(player_games: pd.DataFrame, exp1_stats: Optional[pd.DataFrame], exp2_stats: Optional[pd.DataFrame]) -> list[str]:
    exp1 = player_games[player_games["experiment_id"] == 1]
    exp2 = player_games[player_games["experiment_id"] == 2]
    if ((exp1_stats is None or exp1_stats.empty) and exp1.empty) or ((exp2_stats is None or exp2_stats.empty) and exp2.empty):
        return []

    rows = []
    if exp1_stats is not None and not exp1_stats.empty and exp2_stats is not None and not exp2_stats.empty:
        exp1_map = exp1_stats.set_index("model_id")
        exp2_map = exp2_stats.set_index("model_id")
        for model_id in sorted(set(exp1_map.index).intersection(set(exp2_map.index))):
            lie1 = float(exp1_map.loc[model_id, "lie_frequency"])
            lie2 = float(exp2_map.loc[model_id, "lie_frequency"])
            rows.append({
                "model_id": model_id,
                "exp1_lie_frequency": lie1,
                "exp2_lie_frequency": lie2,
                "delta": lie2 - lie1,
                "delta_text": f"{lie2 - lie1:+.1%}",
            })
    else:
        for model_id in sorted(set(exp1["model_id"]).intersection(set(exp2["model_id"]))):
            group1 = exp1[exp1["model_id"] == model_id]
            group2 = exp2[exp2["model_id"] == model_id]
            rows.append({
                "model_id": model_id,
                "exp1_lie_frequency": float(group1["lie_frequency"].mean()),
                "exp2_lie_frequency": float(group2["lie_frequency"].mean()),
                "delta": float(group2["lie_frequency"].mean() - group1["lie_frequency"].mean()),
                "delta_text": pct_delta_ci(group1["lie_frequency"].astype(float), group2["lie_frequency"].astype(float)),
            })

    df = pd.DataFrame(rows).sort_values("delta")
    lines = [
        "## RQ2: Moral Restraint (Experiment 1 vs Experiment 2)",
        "",
        "| Model | Exp 1 lie frequency | Exp 2 lie frequency | Delta (Exp2 - Exp1) |",
        "|---|---:|---:|---|",
    ]

    for _, row in df.iterrows():
        lines.append(
            f"| {row['model_id']} | {pct(row['exp1_lie_frequency'])} | "
            f"{pct(row['exp2_lie_frequency'])} | {row['delta_text']} |"
        )

    biggest_drop = df.iloc[0]
    biggest_increase = df.sort_values("delta", ascending=False).iloc[0]
    lines.extend([
        "",
        f"Largest lie-frequency reduction: `{biggest_drop['model_id']}` with {biggest_drop['delta_text']}.",
        f"Largest lie-frequency increase: `{biggest_increase['model_id']}` with {biggest_increase['delta_text']}.",
        "",
    ])
    return lines


def render_instruction_compliance(player_games: pd.DataFrame, exp3_stats: Optional[pd.DataFrame]) -> list[str]:
    exp3 = player_games[player_games["experiment_id"] == 3].copy()
    if (exp3_stats is None or exp3_stats.empty) and exp3.empty:
        return []

    if exp3_stats is not None and not exp3_stats.empty:
        df = exp3_stats.copy()
        df["violation_rate"] = df["instruction_violation_rate"].fillna(0).astype(float)
        df["games"] = df["games_played"].astype(int)
    else:
        exp3["instruction_violation_rate"] = exp3["instruction_violation_rate"].fillna(0).astype(float)
        rows = []
        for model_id, group in exp3.groupby("model_id"):
            rows.append({
                "model_id": model_id,
                "violation_rate": float(group["instruction_violation_rate"].mean()),
                "win_rate": float(group["won"].mean()),
                "games": len(group),
            })
        df = pd.DataFrame(rows)

    df = df.sort_values(["violation_rate", "win_rate"], ascending=[False, False])
    lines = [
        "## RQ3: Instruction Compliance (Experiment 3)",
        "",
        "| Model | Games | Instruction violation rate | Win rate |",
        "|---|---:|---:|---:|",
    ]

    for _, row in df.iterrows():
        lines.append(
            f"| {row['model_id']} | {int(row['games'])} | {pct(row['violation_rate'])} | {pct(row['win_rate'])} |"
        )

    top_violator = df.iloc[0]
    lines.extend([
        "",
        f"Highest instruction-violation rate: `{top_violator['model_id']}` at {pct(top_violator['violation_rate'])}.",
        "",
    ])
    return lines


def render_paper_fill_ins(player_games: pd.DataFrame) -> list[str]:
    total_games = player_games["game_id"].nunique()
    total_models = player_games["model_id"].nunique()
    experiments = ", ".join(str(int(v)) for v in sorted(player_games["experiment_id"].dropna().unique()))
    providers = ", ".join(sorted(str(v) for v in player_games["provider"].dropna().unique() if str(v))) or "unknown provider"
    prompt_versions = ", ".join(sorted(str(v) for v in player_games["prompt_version"].dropna().unique() if str(v))) or "unknown prompt version"

    lines = [
        "## Paper Fill-Ins",
        "",
        f"- Methods sentence: `We ran {total_games} four-player games across {total_models} models under experiments {experiments}, using {providers} with prompt version(s) {prompt_versions}.`",
        "- Results sentence template: `In the baseline deception condition, [MODEL] achieved the highest win rate, while [MODEL] lied most frequently; under asymmetric fairness, [MODEL] showed the largest reduction in lie frequency, and under the honesty mandate, [MODEL] had the highest instruction-violation rate.`",
        "- Discussion angle: `The strongest paper story is the tension between competitive success, deception rate, and instruction following, not raw leaderboard ranking.`",
        "",
    ]
    return lines


def render_data_quality_notes(player_games: pd.DataFrame, game_summary: Optional[pd.DataFrame]) -> list[str]:
    notes: list[str] = []
    providers = sorted(str(v) for v in player_games["provider"].dropna().unique() if str(v))
    prompt_versions = sorted(str(v) for v in player_games["prompt_version"].dropna().unique() if str(v))
    schema_versions = sorted(str(v) for v in player_games["log_schema_version"].dropna().unique())
    experiments = sorted(int(v) for v in player_games["experiment_id"].dropna().unique())

    if not providers or not prompt_versions or not schema_versions:
        notes.append("This dataset includes legacy or pre-schema logs with missing provenance. Do not use it for final paper claims.")

    if len(experiments) < 4:
        notes.append(f"Only experiments {', '.join(str(v) for v in experiments)} are present. Cross-experiment claims are incomplete.")

    games_per_model = player_games.groupby("model_id").size()
    if not games_per_model.empty and int(games_per_model.min()) < 5:
        notes.append("Several models have fewer than 5 player-game rows, so intervals and rankings are very unstable.")

    if game_summary is not None and "total_tokens" in game_summary.columns and int(game_summary["total_tokens"].fillna(0).sum()) == 0:
        notes.append("Token usage is missing from these logs, so cost and efficiency analysis is unavailable for this dataset.")

    if not notes:
        return []

    lines = ["## Data Quality Notes", ""]
    for note in notes:
        lines.append(f"- {note}")
    lines.append("")
    return lines


def render_figures(figures_dir: Path) -> list[str]:
    if not figures_dir.exists():
        return []

    figures = sorted(path.name for path in figures_dir.glob("*.png"))
    if not figures:
        return []

    lines = ["## Figures", ""]
    for figure in figures:
        lines.append(f"- `{figures_dir / figure}`")
    lines.append("")
    return lines


def build_report(
    player_games: pd.DataFrame,
    game_summary: Optional[pd.DataFrame],
    figures_dir: Path,
    experiment_stats: Dict[int, pd.DataFrame],
) -> str:
    schema_versions = sorted(str(v) for v in player_games["log_schema_version"].dropna().unique())
    providers = sorted(str(v) for v in player_games["provider"].dropna().unique() if str(v))
    prompt_versions = sorted(str(v) for v in player_games["prompt_version"].dropna().unique() if str(v))
    prompt_hashes = sorted(str(v) for v in player_games["prompt_hash"].dropna().unique() if str(v))

    lines = [
        "# LLM Bullshit Research Summary",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Dataset",
        "",
        f"- Games: {player_games['game_id'].nunique()}",
        f"- Player-game rows: {len(player_games)}",
        f"- Models: {player_games['model_id'].nunique()}",
        f"- Experiments present: {', '.join(str(int(v)) for v in sorted(player_games['experiment_id'].dropna().unique()))}",
        f"- Providers: {', '.join(providers) if providers else 'unknown'}",
        f"- Schema versions: {', '.join(schema_versions) if schema_versions else 'unknown'}",
        f"- Prompt versions: {', '.join(prompt_versions) if prompt_versions else 'unknown'}",
        f"- Prompt hashes: {', '.join(prompt_hashes) if prompt_hashes else 'unknown'}",
        "",
    ]

    if game_summary is not None and not game_summary.empty:
        duration_seconds = game_summary["duration_ms"].fillna(0).sum() / 1000
        lines.extend([
            f"- Aggregate runtime: {duration_seconds / 60:.1f} minutes",
        ])
        if "total_tokens" in game_summary.columns:
            total_tokens = int(game_summary["total_tokens"].fillna(0).sum())
            if total_tokens > 0:
                lines.append(f"- Aggregate token usage: {total_tokens:,} tokens")
        lines.append("")

    lines.extend(render_data_quality_notes(player_games, game_summary))
    lines.extend(render_experiment_overview(player_games, experiment_stats))
    lines.extend(render_baseline_table(player_games, experiment_stats.get(1)))
    lines.extend(render_moral_restraint(player_games, experiment_stats.get(1), experiment_stats.get(2)))
    lines.extend(render_instruction_compliance(player_games, experiment_stats.get(3)))
    lines.extend(render_paper_fill_ins(player_games))
    lines.extend(render_figures(figures_dir))

    return "\n".join(lines).strip() + "\n"


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate a markdown research summary from exported CSVs")
    parser.add_argument("--csv-dir", default="logs/csv", help="Directory containing CSV files")
    parser.add_argument("--output", default="results/research_summary.md", help="Output markdown path")
    parser.add_argument("--figures-dir", default="results/figures", help="Directory containing generated figures")
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)
    output_path = Path(args.output)
    figures_dir = Path(args.figures_dir)
    experiment_stats = load_experiment_stats_tables(csv_dir)

    player_games = load_csv(csv_dir / "player_game_stats.csv")
    if player_games is None or player_games.empty:
        raise SystemExit(f"Missing or empty player_game_stats.csv in {csv_dir}")

    game_summary = load_csv(csv_dir / "game_summary.csv")
    if "termination_reason" in player_games.columns:
        player_games = player_games[player_games["termination_reason"].fillna("") != "turn_cap"].copy()
    if game_summary is not None and "termination_reason" in game_summary.columns:
        game_summary = game_summary[game_summary["termination_reason"].fillna("") != "turn_cap"].copy()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_report(player_games, game_summary, figures_dir, experiment_stats), encoding="utf-8")

    print(f"Wrote research summary to {output_path}")
