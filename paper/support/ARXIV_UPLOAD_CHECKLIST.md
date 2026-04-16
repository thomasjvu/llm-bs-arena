# arXiv Upload Checklist

This is the active paper-ops checklist for the current preprint path.

## 1. Finalize The Main PDF

- [ ] replace the placeholder author block in `paper/arxiv/author_block.tex`
- [ ] verify the title, abstract, and figure captions are final
- [ ] confirm the main paper is self-contained and does not depend on a separate supplement
- [ ] confirm the appendix contains the full prompt texts and minimal reproducibility details

## 2. Keep The Preprint Private-Artifact Safe

- [ ] no repo URL is cited while the repo remains private
- [ ] no blog URL is cited while the blog remains unpublished
- [ ] no release URL is cited unless the referenced asset is actually public
- [ ] code and data availability statements use neutral future-facing wording if the assets are not yet public

## 3. Build And Review

- [ ] build `paper/arxiv/build/main.pdf`
- [ ] read the PDF once as a reader, not the author
- [ ] check that no anonymous-review or review-state language remains
- [ ] check that no `see supplement` references remain

## 4. Source Packaging

- [ ] package the arXiv source from the repository root or otherwise include `paper/arxiv/` and `references.bib`
- [ ] include the section files, tracked figures, and frozen artifacts needed to reproduce the paper story
- [ ] verify the packaged source still compiles cleanly

## 5. Final Upload Hygiene

- [ ] confirm author names, affiliations, and corresponding email are correct
- [ ] confirm the abstract matches the frozen 600-game cohort
- [ ] confirm the uploaded PDF is the arXiv build
