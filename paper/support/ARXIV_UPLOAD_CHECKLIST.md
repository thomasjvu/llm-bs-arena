# arXiv Upload Checklist

This is the active paper-ops checklist for the current preprint path.

## 1. Finalize The Main PDF

- [x] replace the placeholder author block in `paper/arxiv/author_block.tex`
- [x] verify the title, abstract, and figure captions are final
- [x] confirm the main paper is self-contained and does not depend on a separate supplement
- [x] confirm the appendix contains the full prompt texts and minimal reproducibility details

## 2. Keep The Preprint Private-Artifact Safe

- [x] no repo URL is cited while the repo remains private
- [x] no blog URL is cited while the blog remains unpublished
- [x] no release URL is cited unless the referenced asset is actually public
- [x] code and data availability statements use neutral future-facing wording if the assets are not yet public

## 3. Build And Review

- [x] build `paper/arxiv/build/main.pdf`
- [ ] read the PDF once as a reader, not the author
- [x] check that no anonymous-review or review-state language remains
- [x] check that no `see supplement` references remain

## 4. Source Packaging

- [x] run `npm run arxiv:bundle`
- [x] verify `paper/arxiv/submission/bs-bench-arxiv.tar.gz` exists
- [x] verify the packaged source compiles cleanly

## 5. Final Upload Hygiene

- [x] confirm author names, affiliations, and corresponding email are correct
- [x] confirm the abstract matches the frozen 600-game cohort
- [ ] confirm the uploaded PDF is the arXiv build

## Latest Verification

- `2026-05-10`: `tectonic --outdir paper/arxiv/build paper/arxiv/main.tex` passed.
- `2026-05-10`: `npm run arxiv:bundle` produced `paper/arxiv/submission/bs-bench-arxiv.tar.gz`.
- `2026-05-10`: extracted arXiv bundle compiled successfully with `tectonic`.
