# Public Release Checklist

Use this once the pilot is sufficiently complete and you are getting ready to publish the repo, the blog post, or the paper.

## 1. Freeze The Cohort

- [ ] choose the final provider cohort
- [ ] confirm the final prompt version/hash
- [ ] confirm the final included experiments
- [ ] confirm capped and quarantined logs are excluded

## 2. Clean The Repository

- [ ] remove transient junk files and `.DS_Store`
- [ ] confirm `logs/games/` only contains intended included runs
- [ ] keep quarantined logs outside the active analysis path
- [ ] confirm docs match the shipped protocol

## 3. Regenerate Final Outputs

- [ ] `npm start -- analyze --csv`
- [ ] `npm run stats`
- [ ] `npm run plots`
- [ ] `npm run report`
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
- [ ] short project summary prepared for GitHub / LinkedIn / portfolio

## 6. Release Surfaces

- [ ] GitHub repo cleaned and pushed
- [ ] blog post updated from draft to publishable version
- [ ] arXiv or technical report PDF generated
- [ ] resume bullets updated with final numbers

## 7. Final Sanity Check

- [ ] every quantitative claim is traceable to a CSV or figure
- [ ] every qualitative example comes from the valid cohort
- [ ] no old capped run is cited as a full result
- [ ] no claim exceeds what a 600-game pilot can reasonably support

## Recommended Release Order

1. lock final dataset
2. regenerate outputs
3. finish paper/blog text
4. capture screenshots
5. publish repo
6. post blog
7. upload preprint / technical report
