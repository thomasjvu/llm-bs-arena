# TMLR Manuscript

This directory is the canonical manuscript source for the blinded TMLR submission path.

## What Is Here

- `main.tex`: blinded manuscript
- `supplement.tex`: blinded supplement
- `sections/`: main-paper section files
- `supplement_sections/`: prompt, reproducibility, extra-results, and case-study sections
- `artifacts/frozen/`: tracked frozen cohort artifacts used to write the paper
- `figures/`: tracked manuscript figures
- `build/`: local compiled PDFs and auxiliary output

## Preview The Current Submission Draft

Build the main paper:

```bash
tectonic --outdir paper/tmlr/build paper/tmlr/main.tex
```

Build the supplement:

```bash
tectonic --outdir paper/tmlr/build paper/tmlr/supplement.tex
```

Preview outputs:
- [paper/tmlr/build/main.pdf](/Users/area/repos/llm-bullshit/paper/tmlr/build/main.pdf)
- [paper/tmlr/build/supplement.pdf](/Users/area/repos/llm-bullshit/paper/tmlr/build/supplement.pdf)

## Current Status

The manuscript is:
- anonymized at the author-block level
- compiled and reviewable locally
- aligned to the frozen `600`-game cohort

The manuscript is not yet the final TMLR submission package. Before submission, still do:
- swap the generic article preamble for the official TMLR template/style
- run the anonymization checklist under [paper/support/ANONYMIZATION_PLAN.md](/Users/area/repos/llm-bullshit/paper/support/ANONYMIZATION_PLAN.md)
- run the venue checklist under [paper/support/TMLR_SUBMISSION_CHECKLIST.md](/Users/area/repos/llm-bullshit/paper/support/TMLR_SUBMISSION_CHECKLIST.md)
- prepare the blinded supplement bundle and OpenReview metadata

## Working Rule

Treat `paper/tmlr/` as the single manuscript source of truth. Update the markdown/blog/docs only as supporting surfaces; the paper text should not be maintained in parallel elsewhere.
