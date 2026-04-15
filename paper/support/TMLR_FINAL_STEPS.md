# TMLR Final Steps

Use this as the short operational note for what is still left before submission.

## Already Done

- frozen `600`-game cohort is complete
- tracked figures and frozen artifacts exist
- manuscript and supplement compile locally
- repo is private
- blog is not part of the submission path
- main runtime/provider story is narrowed to the NIM-backed cohort that was actually used

## Still Required Before Submission

### 1. Final manuscript pass

- lock the final title, abstract, and introduction wording
- tighten any remaining related-work prose
- verify every quantitative claim against `paper/tmlr/artifacts/frozen/`
- make sure figure captions are final and consistent with the text

### 2. Official template swap

- replace the generic article preamble in `paper/tmlr/main.tex`
- replace the generic article preamble in `paper/tmlr/supplement.tex`
- rebuild both PDFs and check for layout regressions

### 3. Blind submission package

- remove any remaining deanonymizing references from manuscript and supplement
- decide exactly what goes into the supplement
- prepare a blinded code/data snapshot only if it materially helps the submission
- keep the repo private during the blind review window

### 4. OpenReview submission prep

- finalize author order outside the blinded PDF
- prepare conflicts
- prepare action-editor suggestions
- prepare funding / competing-interest / broader-impact text if needed

## Preview Commands

```bash
tectonic --outdir paper/tmlr/build paper/tmlr/main.tex
tectonic --outdir paper/tmlr/build paper/tmlr/supplement.tex
```

Outputs:
- `paper/tmlr/build/main.pdf`
- `paper/tmlr/build/supplement.pdf`
