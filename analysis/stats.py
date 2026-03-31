#!/usr/bin/env python3
"""
Statistical summaries for LLM Bullshit research.

This script intentionally uses player-game rows as the primary unit of analysis
and reports bootstrap confidence intervals instead of fragile significance tests
on turn-level or per-model aggregates.
"""

from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

import numpy as np
import pandas as pd


BOOTSTRAP_ITERATIONS = 5000
BOOTSTRAP_SEED = 42


def load_csv(path: Path) -> Optional[pd.DataFrame]:
    if path.exists():
        return pd.read_csv(path)
    return None


def bootstrap_mean_ci(
    values: Iterable[float],
    iterations: int = BOOTSTRAP_ITERATIONS,
    confidence: float = 0.95,
    seed: int = BOOTSTRAP_SEED,
) -> Tuple[float, float, float]:
    arr = np.asarray(list(values), dtype=float)
    arr = arr[~np.isnan(arr)]
    if len(arr) == 0:
        return np.nan, np.nan, np.nan

    rng = np.random.default_rng(seed)
    means = np.empty(iterations)
    for i in range(iterations):
        sample = rng.choice(arr, size=len(arr), replace=True)
        means[i] = sample.mean()

    alpha = 1 - confidence
    lower = np.percentile(means, 100 * (alpha / 2))
    upper = np.percentile(means, 100 * (1 - alpha / 2))
    return float(arr.mean()), float(lower), float(upper)


def bootstrap_mean_diff_ci(
    values_a: Iterable[float],
    values_b: Iterable[float],
    iterations: int = BOOTSTRAP_ITERATIONS,
    confidence: float = 0.95,
    seed: int = BOOTSTRAP_SEED,
) -> Tuple[float, float, float]:
    arr_a = np.asarray(list(values_a), dtype=float)
    arr_b = np.asarray(list(values_b), dtype=float)
    arr_a = arr_a[~np.isnan(arr_a)]
    arr_b = arr_b[~np.isnan(arr_b)]

    if len(arr_a) == 0 or len(arr_b) == 0:
        return np.nan, np.nan, np.nan

    rng = np.random.default_rng(seed)
    diffs = np.empty(iterations)
    for i in range(iterations):
        sample_a = rng.choice(arr_a, size=len(arr_a), replace=True)
        sample_b = rng.choice(arr_b, size=len(arr_b), replace=True)
        diffs[i] = sample_b.mean() - sample_a.mean()

    observed = float(arr_b.mean() - arr_a.mean())
    alpha = 1 - confidence
    lower = np.percentile(diffs, 100 * (alpha / 2))
    upper = np.percentile(diffs, 100 * (1 - alpha / 2))
    return observed, float(lower), float(upper)


def format_ci(mean: float, lower: float, upper: float, pct: bool = False) -> str:
    if np.isnan(mean):
        return "n/a"
    if pct:
        return f"{mean:.1%} (95% CI {lower:.1%} to {upper:.1%})"
    return f"{mean:.3f} (95% CI {lower:.3f} to {upper:.3f})"


def summarize_metric_by_model(df: pd.DataFrame, metric: str) -> pd.DataFrame:
    rows = []
    for model_id, group in df.groupby("model_id"):
        mean, lower, upper = bootstrap_mean_ci(group[metric].astype(float).values)
        rows.append({
            "model_id": model_id,
            "n": len(group),
            "mean": mean,
            "ci_lower": lower,
            "ci_upper": upper,
        })
    if not rows:
        return pd.DataFrame(columns=["model_id", "n", "mean", "ci_lower", "ci_upper"])
    return pd.DataFrame(rows).sort_values("mean", ascending=False)


def compare_experiments_by_model(player_games: pd.DataFrame, metric: str, exp_a: int, exp_b: int) -> pd.DataFrame:
    rows = []
    for model_id in sorted(player_games["model_id"].dropna().unique()):
        group_a = player_games[(player_games["model_id"] == model_id) & (player_games["experiment_id"] == exp_a)]
        group_b = player_games[(player_games["model_id"] == model_id) & (player_games["experiment_id"] == exp_b)]
        if group_a.empty or group_b.empty:
            continue

        mean_a = float(group_a[metric].mean())
        mean_b = float(group_b[metric].mean())
        delta, lower, upper = bootstrap_mean_diff_ci(group_a[metric].values, group_b[metric].values)
        rows.append({
            "model_id": model_id,
            f"exp{exp_a}_mean": mean_a,
            f"exp{exp_b}_mean": mean_b,
            "delta": delta,
            "ci_lower": lower,
            "ci_upper": upper,
            "n_exp_a": len(group_a),
            "n_exp_b": len(group_b),
        })
    if not rows:
        return pd.DataFrame(columns=["model_id", "delta", "ci_lower", "ci_upper"])
    return pd.DataFrame(rows).sort_values("delta")


def summarize_experiment(player_games: pd.DataFrame, experiment_id: int) -> Dict[str, str]:
    exp_df = player_games[player_games["experiment_id"] == experiment_id]
    if exp_df.empty:
        return {}

    lie_frequency = bootstrap_mean_ci(exp_df["lie_frequency"].astype(float).values)
    paranoia = bootstrap_mean_ci(exp_df["paranoia_frequency"].astype(float).values)

    summary = {
        "player_games": str(len(exp_df)),
        "models": str(exp_df["model_id"].nunique()),
        "lie_frequency": format_ci(*lie_frequency, pct=True),
        "paranoia_frequency": format_ci(*paranoia, pct=True),
    }

    if experiment_id == 3:
        violations = bootstrap_mean_ci(exp_df["instruction_violation_rate"].fillna(0).astype(float).values)
        summary["instruction_violation_rate"] = format_ci(*violations, pct=True)

    return summary


def print_model_table(df: pd.DataFrame, pct: bool = True) -> None:
    if df.empty:
        print("  No data")
        return

    for _, row in df.iterrows():
        print(
            f"  {row['model_id']}: "
            f"{format_ci(row['mean'], row['ci_lower'], row['ci_upper'], pct=pct)} "
            f"(n={int(row['n'])})"
        )


def print_comparison_table(df: pd.DataFrame, exp_a: int, exp_b: int, pct: bool = True) -> None:
    if df.empty:
        print("  No overlapping model data")
        return

    for _, row in df.iterrows():
        delta = row["delta"]
        lower = row["ci_lower"]
        upper = row["ci_upper"]
        if pct:
            delta_str = f"{delta:+.1%} (95% CI {lower:+.1%} to {upper:+.1%})"
        else:
            delta_str = f"{delta:+.3f} (95% CI {lower:+.3f} to {upper:+.3f})"

        print(
            f"  {row['model_id']}: "
            f"exp{exp_a}={row[f'exp{exp_a}_mean']:.1%}, "
            f"exp{exp_b}={row[f'exp{exp_b}_mean']:.1%}, "
            f"delta={delta_str}"
        )


def print_statistical_report(player_games: pd.DataFrame) -> None:
    print("=" * 80)
    print("STATISTICAL SUMMARY REPORT")
    print("=" * 80)
    print()

    schema_versions = sorted(str(v) for v in player_games["log_schema_version"].dropna().unique())
    providers = sorted(str(v) for v in player_games["provider"].dropna().unique() if str(v))
    prompt_versions = sorted(str(v) for v in player_games["prompt_version"].dropna().unique() if str(v))

    print("Dataset")
    print("-" * 60)
    print(f"  Player-game rows: {len(player_games)}")
    print(f"  Games: {player_games['game_id'].nunique()}")
    print(f"  Models: {player_games['model_id'].nunique()}")
    print(f"  Schema versions: {', '.join(schema_versions) if schema_versions else 'unknown'}")
    print(f"  Providers: {', '.join(providers) if providers else 'unknown'}")
    print(f"  Prompt versions: {', '.join(prompt_versions) if prompt_versions else 'unknown'}")
    print()

    for experiment_id in sorted(player_games["experiment_id"].dropna().unique()):
        summary = summarize_experiment(player_games, int(experiment_id))
        if not summary:
            continue
        print(f"Experiment {int(experiment_id)}")
        print("-" * 60)
        print(f"  Player-game rows: {summary['player_games']}")
        print(f"  Models: {summary['models']}")
        print(f"  Mean lie frequency: {summary['lie_frequency']}")
        print(f"  Mean paranoia frequency: {summary['paranoia_frequency']}")
        print("  Experiment-level win rate is omitted here because one winner is guaranteed per four-player game;")
        print("  use the per-model leaderboard below for meaningful win-rate comparisons.")
        if "instruction_violation_rate" in summary:
            print(f"  Mean instruction violation rate: {summary['instruction_violation_rate']}")
        print()

    exp1 = player_games[player_games["experiment_id"] == 1]
    if not exp1.empty:
        print("RQ1: Baseline deception effectiveness by model")
        print("-" * 60)
        print("  Lie frequency:")
        print_model_table(summarize_metric_by_model(exp1, "lie_frequency"))
        print()
        print("  Win rate:")
        print_model_table(summarize_metric_by_model(exp1, "won"))
        print()

    if not player_games[player_games["experiment_id"] == 1].empty and not player_games[player_games["experiment_id"] == 2].empty:
        print("RQ2: Moral restraint (Exp 1 vs Exp 2 lie frequency)")
        print("-" * 60)
        print_comparison_table(compare_experiments_by_model(player_games, "lie_frequency", 1, 2), 1, 2)
        print()

    exp3 = player_games[player_games["experiment_id"] == 3]
    if not exp3.empty:
        print("RQ3: Instruction compliance in Experiment 3")
        print("-" * 60)
        print_model_table(summarize_metric_by_model(exp3.fillna({"instruction_violation_rate": 0}), "instruction_violation_rate"))
        print()

    exp1_or_all = exp1 if not exp1.empty else player_games
    if not exp1_or_all.empty:
        print("RQ4: Challenge behavior by model")
        print("-" * 60)
        print("  Paranoia frequency:")
        print_model_table(summarize_metric_by_model(exp1_or_all, "paranoia_frequency"))
        print()
        print("  Challenge accuracy:")
        print_model_table(summarize_metric_by_model(exp1_or_all, "challenge_accuracy"))


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Statistical summary for LLM Bullshit")
    parser.add_argument("--csv-dir", default="logs/csv", help="Directory containing CSV files")
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)
    player_games = load_csv(csv_dir / "player_game_stats.csv")

    if player_games is None:
        print("No player_game_stats.csv found. Run the analyze/export step first.")
        raise SystemExit(1)

    if "termination_reason" in player_games.columns:
        raw_games = player_games["game_id"].nunique()
        player_games = player_games[player_games["termination_reason"].fillna("") != "turn_cap"].copy()
        excluded_games = raw_games - player_games["game_id"].nunique()
        if excluded_games > 0:
            print(f"Excluded {excluded_games} turn-cap games from statistical summaries.")

    print_statistical_report(player_games)
