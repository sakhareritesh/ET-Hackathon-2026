"""Monte Carlo FIRE simulation engine.

Runs N simulation paths with randomized annual returns drawn from a
normal distribution to produce confidence intervals and success
probability for reaching FIRE.
"""

import numpy as np
from typing import Optional


def run_fire_simulation(
    current_age: int,
    target_fire_age: int,
    current_corpus: float,
    monthly_sip: float,
    monthly_expenses: float,
    expected_return: float = 12.0,
    volatility: float = 15.0,
    inflation_rate: float = 6.0,
    life_expectancy: int = 85,
    n_simulations: int = 10_000,
    seed: Optional[int] = None,
) -> dict:
    if seed is not None:
        np.random.seed(seed)

    years_to_fire = max(target_fire_age - current_age, 1)
    years_post_fire = max(life_expectancy - target_fire_age, 1)
    total_years = years_to_fire + years_post_fire

    mean_return = expected_return / 100
    vol = volatility / 100
    infl = inflation_rate / 100
    annual_sip = monthly_sip * 12

    # Generate random returns matrix: (n_simulations, total_years)
    returns = np.random.normal(mean_return, vol, (n_simulations, total_years))

    corpus = np.full(n_simulations, current_corpus, dtype=np.float64)

    # Store corpus at each year for percentile curves
    corpus_history = np.zeros((n_simulations, total_years + 1))
    corpus_history[:, 0] = corpus

    # Accumulation phase
    for yr in range(years_to_fire):
        corpus = corpus * (1 + returns[:, yr]) + annual_sip
        corpus = np.maximum(corpus, 0)
        corpus_history[:, yr + 1] = corpus

    corpus_at_fire = corpus.copy()

    # Withdrawal phase
    for yr in range(years_post_fire):
        actual_yr = years_to_fire + yr
        annual_expense = monthly_expenses * 12 * ((1 + infl) ** (actual_yr))
        corpus = corpus * (1 + returns[:, actual_yr]) - annual_expense
        corpus = np.maximum(corpus, 0)
        corpus_history[:, actual_yr + 1] = corpus

    # Success = corpus > 0 at life expectancy
    success_count = int(np.sum(corpus > 0))
    success_rate = round(success_count / n_simulations * 100, 1)

    # Percentile paths for fan chart
    percentiles = [10, 25, 50, 75, 90]
    percentile_paths = {}
    for p in percentiles:
        path = np.percentile(corpus_history, p, axis=0)
        percentile_paths[f"p{p}"] = [
            {"age": current_age + i, "value": round(float(v), 0)}
            for i, v in enumerate(path)
        ]

    median_fire_corpus = float(np.median(corpus_at_fire))

    # Find recommended SIP for 95% success via binary search
    recommended_sip = _find_target_sip(
        current_age, target_fire_age, current_corpus,
        monthly_expenses, mean_return, vol, infl, life_expectancy,
        target_probability=0.95, n_sims=2000,
    )

    return {
        "success_rate": success_rate,
        "median_fire_corpus": round(median_fire_corpus, 0),
        "fire_number": round(monthly_expenses * 12 * 25, 0),
        "percentile_paths": percentile_paths,
        "years_to_fire": years_to_fire,
        "recommended_monthly_sip_95": recommended_sip,
        "n_simulations": n_simulations,
    }


def _find_target_sip(
    current_age, target_fire_age, current_corpus,
    monthly_expenses, mean_return, vol, infl, life_expectancy,
    target_probability=0.95, n_sims=2000,
) -> float:
    """Binary search for the monthly SIP that achieves target_probability success."""
    lo, hi = 0.0, monthly_expenses * 5
    years_to_fire = max(target_fire_age - current_age, 1)
    years_post_fire = max(life_expectancy - target_fire_age, 1)
    total_years = years_to_fire + years_post_fire

    for _ in range(20):
        mid = (lo + hi) / 2
        annual_sip = mid * 12
        returns = np.random.normal(mean_return, vol, (n_sims, total_years))
        corpus = np.full(n_sims, current_corpus)

        for yr in range(years_to_fire):
            corpus = corpus * (1 + returns[:, yr]) + annual_sip
            corpus = np.maximum(corpus, 0)
        for yr in range(years_post_fire):
            actual_yr = years_to_fire + yr
            expense = monthly_expenses * 12 * ((1 + infl) ** actual_yr)
            corpus = corpus * (1 + returns[:, actual_yr]) - expense
            corpus = np.maximum(corpus, 0)

        success = np.sum(corpus > 0) / n_sims
        if success >= target_probability:
            hi = mid
        else:
            lo = mid

    return round((lo + hi) / 2, 0)
