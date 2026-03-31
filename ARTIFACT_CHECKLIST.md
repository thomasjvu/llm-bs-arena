# Artifact Checklist

Use this before publishing the repo, paper, or dataset summary.

## Data Integrity

- [ ] no quarantined logs remain in `logs/games/`
- [ ] capped runs are excluded from the final analysis cohort
- [ ] prompt version and prompt hash are consistent across the final cohort
- [ ] provider metadata is present in all included games
- [ ] all reported figures can be traced back to concrete CSV rows

## Repo Quality

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Python analysis scripts compile
- [ ] README reflects the current uncapped protocol
- [ ] benchmark, dataset, and writing docs are linked from the README

## Paper Quality

- [ ] abstract contains only claims supported by the pilot
- [ ] related work contains real citations, not placeholders
- [ ] methods match the shipped code
- [ ] results distinguish strong findings from suggestive ones
- [ ] limitations are explicit

## Portfolio Quality

- [ ] one clean project description exists
- [ ] 2-3 resume bullets are selected
- [ ] one screenshot of the visualizer is prepared
- [ ] one screenshot of the leaderboard/stats panel is prepared
- [ ] one chart is ready for the portfolio page

## Release Quality

- [ ] final cohort size is stated clearly
- [ ] experiment coverage is stated clearly
- [ ] benchmark version / pilot status is stated clearly
- [ ] arXiv vs technical-report release path is decided
