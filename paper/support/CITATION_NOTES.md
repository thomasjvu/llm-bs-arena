# Citation Notes

This file is a staging area for the paper's references section. The goal is not to be a perfect bibliography manager; the goal is to keep a verified list of high-value references and their primary links so they can be converted into BibTeX cleanly before submission.

The working BibTeX starter now lives in `references.bib`. Use this file for deciding what belongs in the paper; use `references.bib` for the actual submission bibliography.

## Priority References

### Honesty, Truthfulness, and Behavioral Evaluation

1. Stephanie Lin, Jacob Hilton, and Owain Evans. *TruthfulQA: Measuring How Models Mimic Human Falsehoods*. 2021.
   - DOI: `10.48550/arXiv.2109.07958`
   - arXiv / paper hub: `https://arxiv.org/abs/2109.07958`
   - OpenAI page: `https://openai.com/index/truthfulqa/`
   - Why it matters here: the canonical single-turn truthfulness benchmark; useful contrast with our multi-agent deception setting.

2. Ethan Perez et al. *Discovering Language Model Behaviors with Model-Written Evaluations*. 2022.
   - DOI: `10.48550/arXiv.2212.09251`
   - arXiv / paper hub: `https://arxiv.org/abs/2212.09251`
   - Why it matters here: establishes behavior-centric evaluation as a distinct and important axis beyond standard task metrics.

3. Evan Hubinger et al. *Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training*. 2024.
   - DOI: `10.48550/arXiv.2401.05566`
   - arXiv / paper hub: `https://arxiv.org/abs/2401.05566`
   - Why it matters here: one of the clearest references on deliberately induced deceptive behavior in aligned language models.

### Multi-Agent, Debate, and Oversight

4. Geoffrey Irving, Paul Christiano, and Dario Amodei. *AI Safety via Debate*. 2018.
   - DOI: `10.48550/arXiv.1805.00899`
   - arXiv / paper hub: `https://arxiv.org/abs/1805.00899`
   - Why it matters here: frames adversarial interaction as a route to surfacing truth-relevant information.

5. Zachary Kenton et al. *On Scalable Oversight with Weak LLMs Judging Strong LLMs*. 2024.
   - DOI: `10.48550/arXiv.2407.04622`
   - arXiv / paper hub: `https://arxiv.org/abs/2407.04622`
   - Why it matters here: relevant to judge/agent asymmetry and the broader question of what multi-agent interaction reveals about model behavior.

### Communication Games and Social Deduction

6. Yuzhuang Xu et al. *Exploring Large Language Models for Communication Games: An Empirical Study on Werewolf*. 2023.
   - DOI: `10.48550/arXiv.2309.04658`
   - arXiv / paper hub: `https://arxiv.org/abs/2309.04658`
   - Why it matters here: strong nearby precedent for using communication-heavy incomplete-information games as an LLM research environment.

7. Shuang Wu, Liwen Zhu, Tao Yang, Shiwei Xu, Qiang Fu, Yang Wei, and Haobo Fu. *Enhance Reasoning for Large Language Models in the Game Werewolf*. 2024.
   - DOI: `10.48550/arXiv.2402.02330`
   - arXiv / paper hub: `https://arxiv.org/abs/2402.02330`
   - Why it matters here: another directly adjacent paper on strategic reasoning in a deception-relevant social game.

### Instruction Following and Alignment

8. Long Ouyang et al. *Training Language Models to Follow Instructions with Human Feedback*. 2022.
   - DOI: `10.48550/arXiv.2203.02155`
   - arXiv / paper hub: `https://arxiv.org/abs/2203.02155`
   - Why it matters here: canonical instruction-following / RLHF reference for framing Experiment 3.

## Nice-To-Have References To Add

- A direct LLM Coup or social-deduction-with-LLMs paper if one has a citable paper or preprint rather than only a project page.
- A goal misgeneralization or scheming-related citation that cleanly connects instruction violation to broader alignment concerns.
- A reward-hacking citation that is broad enough to motivate strategic rule-bending without overstating what this benchmark measures.

## How To Use This File

1. Convert each verified item into `references.bib`.
2. Keep the paper's references section aligned with only the references actually cited in the main text.
3. Prefer primary links (`arXiv`, official lab pages, or publisher pages) over blog summaries.
4. Do not cite project pages when a proper paper exists.
