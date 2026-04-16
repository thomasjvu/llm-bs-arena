# arXiv Manuscript

This directory is the active preprint path.

## What Is Here

- `main.tex`: arXiv preprint wrapper
- `author_block.tex`: author, affiliation, and email block to replace before upload
- `sections/`: full paper body and appendix
- `figures/`: tracked manuscript figures
- `artifacts/frozen/`: tracked frozen cohort artifacts

This directory is now the only maintained paper path.

## Preview

Build the arXiv paper:

```bash
tectonic --outdir paper/arxiv/build paper/arxiv/main.tex
```

Preview output:
- [paper/arxiv/build/main.pdf](/Users/area/repos/llm-bullshit/paper/arxiv/build/main.pdf)

## Before Upload

- replace the placeholder author block in [paper/arxiv/author_block.tex](/Users/area/repos/llm-bullshit/paper/arxiv/author_block.tex)
- keep the paper self-contained; the first upload does not include a separate supplement
- do not add repo, blog, or release URLs while those assets remain non-public
- package the arXiv source from the repository root or otherwise include `paper/arxiv/` and `references.bib`
