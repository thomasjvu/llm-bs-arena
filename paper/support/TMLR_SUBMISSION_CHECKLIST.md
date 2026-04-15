# TMLR Submission Checklist

Use this when the paper is ready for a real TMLR submission rather than just a public preprint.

## 1. Freeze The Empirical Cohort

- [ ] final included game count is recorded
- [ ] included experiments are final
- [ ] prompt version and prompt hash are frozen
- [ ] provider cohort is frozen
- [ ] quarantined and capped runs are excluded from the submission cohort
- [ ] cohort manifest is exported and archived

## 2. Tighten The Claims

- [ ] every headline finding is traceable to the frozen cohort
- [ ] no claim exceeds a controlled pilot study
- [ ] Exp0 is described as a low-strategy reference, not a true random baseline
- [ ] Exp3 is described as a plain-language honesty-mandate probe, not a maximal anti-lying intervention
- [ ] model-specific observations are not overgeneralized into family-size or capability claims
- [ ] a claims-to-evidence matrix exists for every headline result
- [ ] at least one paragraph in the introduction makes the audience-interest case explicit

## 3. Anonymize The Submission

- [ ] manuscript author block is anonymized
- [ ] acknowledgments are removed for submission
- [ ] supplementary materials are anonymized
- [ ] no repo URL, blog URL, or named preprint is included in the blinded submission
- [ ] screenshots, figures, and metadata do not contain author-identifying text
- [ ] repo remains private during the blind submission window
- [ ] blog remains unpublished during the blind submission window

## 4. Make The TMLR Fit Obvious

- [ ] title is benchmark-release oriented
- [ ] abstract emphasizes protocol, artifact quality, and empirical correctness
- [ ] introduction motivates strategic misrepresentation as an evaluation problem
- [ ] methods section makes reproducibility and exclusion rules explicit
- [ ] discussion separates benchmark contribution, empirical pilot, and limitations

## 5. Reproducibility Package

- [ ] benchmark spec matches the shipped code
- [ ] dataset card matches the frozen cohort
- [ ] figure/table pipeline reproduces the submission numbers
- [ ] qualitative case studies cite exact game ids from the valid cohort
- [ ] references are cleaned up from starter state

## 6. OpenReview / Submission Hygiene

- [ ] all authors have complete OpenReview profiles
- [ ] conflict information is prepared
- [ ] action editor suggestions are prepared
- [ ] supplementary ZIP, if any, is anonymized and directly supports the paper
- [ ] broader impact statement is included if needed
- [ ] funding / competing interests / IRB fields are prepared for submission

## 7. Optional arXiv Coordination

- [ ] arXiv timing will not break TMLR double blind
- [ ] if a preprint is posted, the TMLR submission does not link to an identified version
- [ ] public repo/blog release timing is chosen deliberately rather than by accident

## Recommended Order

1. freeze the cohort
2. regenerate final outputs
3. anonymize the paper and supplement
4. run the TMLR checklist
5. submit to TMLR
6. decide on arXiv timing separately
