#!/usr/bin/env python3
"""
Statistical tests for LLM Bullshit research.
Includes power analysis, significance testing, and effect size calculations.
"""

import pandas as pd
import numpy as np
from scipy import stats
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import warnings

warnings.filterwarnings("ignore", category=RuntimeWarning)


@dataclass
class StatisticalResult:
    test_name: str
    statistic: float
    p_value: float
    effect_size: Optional[float] = None
    confidence_interval: Optional[Tuple[float, float]] = None
    interpretation: str = ""


def power_analysis(effect_size: float, alpha: float = 0.05, power: float = 0.8) -> int:
    """
    Calculate required sample size for a given effect size.
    Uses normal approximation for two-sample t-test.
    
    Args:
        effect_size: Cohen's d (0.2=small, 0.5=medium, 0.8=large)
        alpha: Significance level (default 0.05)
        power: Statistical power (default 0.8)
    
    Returns:
        Required sample size per group
    """
    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_beta = stats.norm.ppf(power)
    
    n = 2 * ((z_alpha + z_beta) / effect_size) ** 2
    return int(np.ceil(n))


def sample_size_recommendations() -> Dict[str, int]:
    """Calculate recommended sample sizes for different effect sizes."""
    return {
        "small (d=0.2)": power_analysis(0.2),
        "small-medium (d=0.35)": power_analysis(0.35),
        "medium (d=0.5)": power_analysis(0.5),
        "medium-large (d=0.65)": power_analysis(0.65),
        "large (d=0.8)": power_analysis(0.8),
    }


def load_stats(csv_path: str) -> pd.DataFrame:
    """Load player stats from CSV."""
    return pd.read_csv(csv_path)


def paired_t_test(
    exp1_stats: pd.DataFrame,
    exp2_stats: pd.DataFrame,
    metric: str
) -> Tuple[float, float]:
    """Perform paired t-test on a metric between experiments."""
    merged = exp1_stats.merge(
        exp2_stats,
        on="model_id",
        suffixes=("_exp1", "_exp2")
    )

    if len(merged) < 2:
        return np.nan, np.nan

    t_stat, p_value = stats.ttest_rel(
        merged[f"{metric}_exp1"],
        merged[f"{metric}_exp2"]
    )

    return t_stat, p_value


def one_way_anova(df: pd.DataFrame, group_col: str, value_col: str) -> Tuple[float, float]:
    """Perform one-way ANOVA."""
    groups = [group[value_col].values for _, group in df.groupby(group_col)]
    groups = [g for g in groups if len(g) > 0]

    if len(groups) < 2:
        return np.nan, np.nan

    f_stat, p_value = stats.f_oneway(*groups)
    return f_stat, p_value


def chi_square_test(contingency_table: pd.DataFrame) -> Tuple[float, float]:
    """Perform chi-square test of independence."""
    chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)
    return chi2, p_value


def effect_size_cohens_d(group1: np.ndarray, group2: np.ndarray) -> float:
    """Calculate Cohen's d effect size."""
    n1, n2 = len(group1), len(group2)
    var1, var2 = np.var(group1, ddof=1), np.var(group2, ddof=1)

    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))

    if pooled_std == 0:
        return 0

    return (np.mean(group1) - np.mean(group2)) / pooled_std


def analyze_lie_frequency_by_experiment(turns_df: pd.DataFrame) -> Dict:
    """Analyze lie frequency differences across experiments."""
    results = {}

    # Group by experiment
    exp_groups = turns_df.groupby("experiment_id")
    lie_rates = exp_groups["was_lie"].mean()

    results["lie_rates_by_experiment"] = lie_rates.to_dict()

    # ANOVA across experiments
    f_stat, p_value = one_way_anova(turns_df, "experiment_id", "was_lie")
    results["anova_f"] = f_stat
    results["anova_p"] = p_value

    # Pairwise comparisons
    experiments = turns_df["experiment_id"].unique()
    for i, exp1 in enumerate(experiments):
        for exp2 in experiments[i+1:]:
            group1 = turns_df[turns_df["experiment_id"] == exp1]["was_lie"].astype(float)
            group2 = turns_df[turns_df["experiment_id"] == exp2]["was_lie"].astype(float)

            t_stat, p_value = stats.ttest_ind(group1, group2)
            d = effect_size_cohens_d(group1.values, group2.values)

            results[f"exp{exp1}_vs_exp{exp2}_t"] = t_stat
            results[f"exp{exp1}_vs_exp{exp2}_p"] = p_value
            results[f"exp{exp1}_vs_exp{exp2}_d"] = d

    return results


def analyze_challenge_behavior(turns_df: pd.DataFrame) -> Dict:
    """Analyze challenge patterns."""
    results = {}

    challenged_turns = turns_df[turns_df["challenged"]]

    # Challenge accuracy by model
    accuracy_by_model = challenged_turns.groupby("challenger_model")["challenge_correct"].mean()
    results["challenge_accuracy_by_model"] = accuracy_by_model.to_dict()

    # Challenge rate by experiment
    challenge_rate = turns_df.groupby("experiment_id")["challenged"].mean()
    results["challenge_rate_by_experiment"] = challenge_rate.to_dict()

    return results


def analyze_instruction_compliance(exp3_turns: pd.DataFrame) -> Dict:
    """Analyze instruction violation in experiment 3."""
    results = {}

    # Violation rate by model
    violation_by_model = exp3_turns.groupby("model_id")["was_lie"].mean()
    results["violation_rate_by_model"] = violation_by_model.to_dict()

    # Overall violation rate
    results["overall_violation_rate"] = exp3_turns["was_lie"].mean()

    # Test if violation rate differs from 0 (binomial test)
    n_violations = exp3_turns["was_lie"].sum()
    n_total = len(exp3_turns)

    if n_total > 0:
        # One-tailed binomial test
        p_value = stats.binom_test(n_violations, n_total, 0, alternative="greater")
        results["binomial_p"] = p_value

    return results


def analyze_moral_restraint(exp1_stats: pd.DataFrame, exp2_stats: pd.DataFrame) -> Dict:
    """
    Analyze RQ2: Do LLMs show moral restraint when told opponents are honest?
    Compare lie frequency between Exp1 (normal) and Exp2 (asymmetric).
    """
    results = {}

    merged = exp1_stats.merge(
        exp2_stats,
        on="model_id",
        suffixes=("_exp1", "_exp2")
    )

    if len(merged) < 2:
        return {"error": "Not enough data"}

    # Paired t-test on lie frequency
    t_stat, p_value = stats.ttest_rel(
        merged["lie_frequency_exp1"],
        merged["lie_frequency_exp2"]
    )

    results["paired_t_stat"] = t_stat
    results["paired_p_value"] = p_value

    # Effect size
    d = effect_size_cohens_d(
        merged["lie_frequency_exp1"].values,
        merged["lie_frequency_exp2"].values
    )
    results["cohens_d"] = d

    # Which models reduced lying?
    merged["lie_reduction"] = merged["lie_frequency_exp1"] - merged["lie_frequency_exp2"]
    results["models_showing_restraint"] = merged[merged["lie_reduction"] > 0]["model_id"].tolist()
    results["mean_lie_reduction"] = merged["lie_reduction"].mean()

    return results


def print_statistical_report(
    exp1_stats: Optional[pd.DataFrame],
    exp2_stats: Optional[pd.DataFrame],
    exp3_stats: Optional[pd.DataFrame],
    turns_df: pd.DataFrame
) -> None:
    """Print comprehensive statistical analysis."""
    print("=" * 80)
    print("STATISTICAL ANALYSIS REPORT")
    print("=" * 80)
    print()

    # RQ1: Deception effectiveness
    print("RQ1: How effectively can LLMs deceive other LLMs?")
    print("-" * 60)
    if exp1_stats is not None:
        print("Experiment 1 (Full Rules) - Baseline Deception:")
        print(f"  Mean lie frequency: {exp1_stats['lie_frequency'].mean():.3f}")
        print(f"  Mean lie success rate: {exp1_stats['lie_success_rate'].mean():.3f}")
        print()

        # Correlation between lying and winning
        corr, p = stats.pearsonr(exp1_stats["lie_frequency"], exp1_stats["win_rate"])
        print(f"  Correlation (lie_frequency vs win_rate): r={corr:.3f}, p={p:.3f}")
    print()

    # RQ2: Moral restraint
    print("RQ2: Do LLMs restrain deception when told opponents are honest?")
    print("-" * 60)
    if exp1_stats is not None and exp2_stats is not None:
        restraint = analyze_moral_restraint(exp1_stats, exp2_stats)
        print(f"  Paired t-test: t={restraint.get('paired_t_stat', np.nan):.3f}, p={restraint.get('paired_p_value', np.nan):.3f}")
        print(f"  Cohen's d: {restraint.get('cohens_d', np.nan):.3f}")
        print(f"  Mean lie reduction: {restraint.get('mean_lie_reduction', np.nan):.3f}")
        print(f"  Models showing restraint: {restraint.get('models_showing_restraint', [])}")
    else:
        print("  Insufficient data for comparison")
    print()

    # RQ3: Instruction compliance
    print("RQ3: Will LLMs violate explicit honesty instructions to win?")
    print("-" * 60)
    if exp3_stats is not None:
        exp3_turns = turns_df[turns_df["experiment_id"] == 3]
        compliance = analyze_instruction_compliance(exp3_turns)
        print(f"  Overall violation rate: {compliance.get('overall_violation_rate', np.nan):.3f}")
        print(f"  Binomial test p-value: {compliance.get('binomial_p', np.nan):.4f}")
        print("  Violation rate by model:")
        for model, rate in compliance.get("violation_rate_by_model", {}).items():
            print(f"    {model}: {rate:.3f}")
    else:
        print("  No experiment 3 data")
    print()

    # RQ4: Paranoia
    print("RQ4: How does paranoia (challenge frequency) vary by model?")
    print("-" * 60)
    challenge_results = analyze_challenge_behavior(turns_df)
    print("  Challenge accuracy by model:")
    for model, acc in sorted(challenge_results.get("challenge_accuracy_by_model", {}).items(), key=lambda x: x[1], reverse=True):
        print(f"    {model}: {acc:.3f}")

    if exp1_stats is not None:
        # ANOVA on paranoia
        f_stat, p_value = one_way_anova(exp1_stats, "model_id", "paranoia_frequency")
        print(f"\n  ANOVA on paranoia frequency: F={f_stat:.3f}, p={p_value:.3f}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Statistical analysis for LLM Bullshit")
    parser.add_argument("--csv-dir", default="logs/csv", help="Directory containing CSV files")
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)

    # Load data
    exp1_stats = None
    exp2_stats = None
    exp3_stats = None
    turns_df = None

    if (csv_dir / "player_stats_exp1.csv").exists():
        exp1_stats = load_stats(csv_dir / "player_stats_exp1.csv")

    if (csv_dir / "player_stats_exp2.csv").exists():
        exp2_stats = load_stats(csv_dir / "player_stats_exp2.csv")

    if (csv_dir / "player_stats_exp3.csv").exists():
        exp3_stats = load_stats(csv_dir / "player_stats_exp3.csv")

    if (csv_dir / "all_turns.csv").exists():
        turns_df = pd.read_csv(csv_dir / "all_turns.csv")

    if turns_df is None:
        print("No turn data found")
        exit(1)

    print_statistical_report(exp1_stats, exp2_stats, exp3_stats, turns_df)
