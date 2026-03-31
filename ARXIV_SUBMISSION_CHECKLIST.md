# arXiv Submission Checklist

Use this once the 600-game pilot is complete and the paper text has been filled in.

## Before Writing Final Numbers

- [ ] all target shard jobs are complete
- [ ] no active pilot shards are still writing into the final cohort
- [ ] quarantined runs are separated from the final dataset
- [ ] capped runs are excluded from the final report cohort

## Data Freeze

- [ ] final cohort size is recorded
- [ ] experiment coverage is recorded
- [ ] prompt version and prompt hash are frozen
- [ ] provider cohort is frozen
- [ ] final included date range is recorded

## Paper Fill-In

- [ ] abstract includes only claims supported by the finished pilot
- [ ] results section is filled with actual numbers
- [ ] figures and tables match the final cohort
- [ ] qualitative case studies cite concrete game ids
- [ ] limitations mention provider/roster dependence and lack of human baselines

## References

- [ ] `references.bib` is converted from starter status to final status
- [ ] all `and others` placeholders are replaced where needed
- [ ] all cited works appear in the bibliography
- [ ] no uncited works remain in the submission bibliography

## Artifact Quality

- [ ] `README.md` reflects the final pilot status
- [ ] `BENCHMARK_SPEC.md` matches the shipped code and released cohort
- [ ] `DATASET_CARD.md` matches the released logs
- [ ] one leaderboard screenshot is captured
- [ ] one replay UI screenshot is captured
- [ ] one chart is ready for the paper/blog/portfolio

## Reproducibility

- [ ] appendix reproducibility text is updated from draft to final
- [ ] commands used for collection and analysis are preserved
- [ ] inclusion/exclusion rules are stated in the paper
- [ ] all final figures can be traced back to exported CSVs

## arXiv Packaging

- [ ] title is benchmark-harness oriented
- [ ] author block and affiliations are final
- [ ] PDF builds cleanly
- [ ] appendix is included in the uploaded PDF
- [ ] code and repo URL are included if intended for immediate release
- [ ] abstract and comments field are ready for arXiv metadata

## Recommended Release Order

1. Freeze the final cohort.
2. Generate the final report, figures, and tables.
3. Finish the paper and appendix.
4. Publish the repo/docs cleanup.
5. Upload to arXiv.
6. Publish the companion blog post and portfolio writeup.
