# TMLR LaTeX Draft Scaffold

This directory is the LaTeX-facing paper scaffold for the blinded TMLR submission path.

## What This Is

- the canonical manuscript source for both TMLR and a later arXiv version
- a structured LaTeX draft split into section files
- a neutral, anonymized manuscript scaffold
- a home for tracked frozen submission artifacts and figures

## What This Is Not Yet

- not the final official TMLR template package
- not a camera-ready build
- not a substitute for the anonymization checklist

The current `main.tex` is a drafting scaffold that compiles with a generic LaTeX article setup. Before real submission, replace the preamble with the official TMLR style/template and keep the section inputs.

## Files

- `main.tex`: blinded manuscript scaffold
- `supplement.tex`: blinded supplementary-material scaffold
- `artifacts/frozen/`: tracked frozen comparable-cohort manifest, CSVs, and summary
- `figures/`: tracked figures used by the manuscript and supplement
- `sections/`: abstract, intro, related work, methods, results, discussion, conclusion, appendix
- `supplement_sections/`: prompts, reproducibility, extra results, and case-study material

## Build

From this directory:

```bash
latexmk -pdf main.tex
```

If you do not have the TMLR style locally yet, this scaffold is still useful for drafting and review.

## Workflow

1. Treat `paper/tmlr/` as the single manuscript source of truth.
2. Regenerate `logs/` and `results/`, then refresh the tracked copies in `artifacts/frozen/` and `figures/`.
3. Keep benchmark, blog, and support docs aligned to the same frozen numbers.
4. Swap in the official TMLR template/style.
5. Run the anonymization and TMLR submission checklists under `paper/support/`.
