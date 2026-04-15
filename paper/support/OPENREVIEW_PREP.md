# OpenReview Prep

Use this as the operational checklist before creating the TMLR submission.

## Accounts

- all authors have active OpenReview accounts
- institutional affiliations are current
- publication history is present
- conflicts are populated accurately

## Submission Metadata

- title is final for the blinded version
- abstract matches the frozen cohort
- keywords are prepared
- author order is final before submission
- funding and competing-interest notes are ready
- any broader-impact text is ready if needed
- repo remains private during the blind submission window
- blog remains unpublished during the blind submission window

## Action Editors and Reviewers

- prepare a short list of plausible action editors
- prepare a short list of potential reviewers
- check for conflicts before listing either
- bias toward people who would understand benchmark, evaluation, multi-agent ML, or alignment-eval framing

## Supplement Strategy

- decide whether to upload:
  - anonymized code snapshot
  - anonymized CSV bundle
  - reproducibility appendix
  - extra qualitative examples
- do not upload a supplement just because it exists; include only what strengthens the submission

## Rebuttal Readiness

- keep a small table of likely reviewer questions:
  - why Bullshit is informative beyond one game
  - why the prompt conditions are meaningful
  - why the control is a low-strategy reference rather than a random baseline
  - whether the findings are provider- or roster-specific
  - whether the benchmark measures strategy rather than only formatting reliability
- keep the claim-evidence matrix updated so rebuttal answers can cite exact files and figures fast

## After Submission

- do not casually update the public story in a way that conflicts with the blinded submission
- if new pilot data arrives after submission, keep it as potential revision material rather than silently changing the submission narrative

## Preview Before Upload

- build `paper/tmlr/build/main.pdf`
- build `paper/tmlr/build/supplement.pdf`
- read both once as if you were a reviewer, not the author
- check that the blinded PDFs stand on their own without repo context
