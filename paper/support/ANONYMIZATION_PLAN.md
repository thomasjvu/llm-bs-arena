# Anonymization Plan

Use this when converting the project from a public working repo into a blinded TMLR submission package.

## Goal

Keep the scientific content intact while removing or isolating anything that can identify the authors during review.

## Paper PDF

- remove author names, affiliations, acknowledgments, and personal URLs
- replace self-references like "in our repo" with neutral wording such as "in the accompanying supplementary material"
- avoid citing a public blog post, public project page, or deanonymized repository snapshot in the submission draft
- keep game ids, experiment labels, and file-style artifact names if they are scientifically useful; those are not author identifiers by themselves

## Supplementary Material

- include only materials that directly support the submission
- remove GitHub usernames, machine usernames, local filesystem paths, and screenshots with identifying window chrome
- if source code is included, package a blinded snapshot rather than linking to a named public repository
- if logs or CSVs are included, check metadata for author names or machine-specific paths

## Figures and Tables

- remove screenshots that show personal browser tabs, local usernames, desktop names, or repo remotes
- use neutral captions that refer to "the benchmark UI" or "the analysis dashboard"
- ensure exported plots do not include local absolute paths in titles or footnotes

## OpenReview Submission

- do not put the public repo URL in the submission form if the repository is deanonymized
- do not use the abstract or comments fields to point to a named preprint, blog post, or public project page
- keep author information in OpenReview profiles complete, but do not leak it through the blinded manuscript

## Public Release Timing

- keep the repo private until the blinded submission path is settled
- do not publish the blog during blind review
- if any public release happens before or during review, ensure the submission itself still does not point to it
- prefer a deliberate release plan rather than an accidental one
- if there is uncertainty, bias toward keeping the blinded submission package self-contained

## Final Check

Before submission, ask:
- could a reviewer identify the authors from the PDF alone?
- could a reviewer identify the authors from the supplement alone?
- does any URL in the submission resolve to a deanonymized artifact?

If the answer to any of these is yes, keep tightening.
