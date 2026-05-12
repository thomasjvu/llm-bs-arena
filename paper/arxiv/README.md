# arXiv Manuscript

This directory is the active preprint path.

## What Is Here

- `main.tex`: arXiv preprint wrapper
- `author_block.tex`: author and corresponding email block for the preprint
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
- `paper/arxiv/build/main.pdf`

Prepare the upload bundle:

```bash
npm run arxiv:bundle
```

Bundle output:
- `paper/arxiv/submission/bs-bench-arxiv.tar.gz`

## Before Upload

- confirm the author block in `paper/arxiv/author_block.tex`
- keep the paper self-contained; the first upload does not include a separate supplement
- do not add repo, blog, or release URLs while those assets remain non-public
- run `npm run arxiv:bundle` and upload `paper/arxiv/submission/bs-bench-arxiv.tar.gz`
