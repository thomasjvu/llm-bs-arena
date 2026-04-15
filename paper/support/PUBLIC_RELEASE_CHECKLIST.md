# Public Release Checklist

Use this once the pilot is sufficiently complete and you are getting ready to publish the repo, the blog post, or the paper.

## 1. Freeze The Cohort

- [ ] choose the final provider cohort
- [ ] confirm the final prompt version/hash
- [ ] confirm the final included experiments
- [ ] confirm capped and quarantined logs are excluded

## 2. Clean The Repository

- [ ] remove transient junk files and `.DS_Store`
- [ ] confirm raw logs remain ignored and outside the tracked public release surface
- [ ] keep quarantined logs outside the active analysis path
- [ ] confirm docs match the shipped protocol
- [ ] confirm only retained public docs remain at the repo root

## 3. Regenerate Final Outputs

- [ ] `npm start -- manifest`
- [ ] `npm start -- analyze --csv`
- [ ] `npm run stats`
- [ ] `npm run plots`
- [ ] `npm run report`
- [ ] refresh `paper/tmlr/artifacts/frozen/` from the regenerated outputs
- [ ] refresh `paper/tmlr/figures/` from the selected final figures
- [ ] save the exact commit hash used for the release

## 4. Final Writing Pass

- [ ] abstract updated with final pilot findings
- [ ] results section filled from the final cohort
- [ ] qualitative case studies selected
- [ ] limitations checked for honesty and scope
- [ ] README updated with final dataset scale

## 5. Public-Facing Assets

- [ ] benchmark overview figure prepared
- [ ] screenshots captured
- [ ] one polished chart chosen for the repo front page
- [ ] one short GitHub-ready project summary prepared

## 6. Release Surfaces

- [ ] GitHub repo cleaned and pushed
- [ ] blog post updated from draft to publishable version
- [ ] if submitting to TMLR, blinded submission assets are kept separate from public release assets
- [ ] arXiv or technical report PDF generated
- [ ] final tracked manuscript figures and frozen artifacts are present under `paper/tmlr/`

## 7. Final Sanity Check

- [ ] every quantitative claim is traceable to a CSV or figure
- [ ] every qualitative example comes from the valid cohort
- [ ] no old capped run is cited as a full result
- [ ] no claim exceeds what a 600-game pilot can reasonably support

## Recommended Release Order

1. lock final dataset
2. regenerate outputs
3. refresh tracked artifacts and figures
4. finish paper/blog text
5. capture screenshots
6. publish repo
7. post blog
8. upload preprint / technical report
