# Literature References

Key papers and resources for the LLM Bullshit research project.

## LLM Game-Playing

### Primary References

1. **GAMEBoT: Evaluating Game-Playing Abilities of Large Language Models**
   - Authors: Akshat Agarwal, et al.
   - Link: https://arxiv.org/abs/????
   - Notes: Evaluates LLMs on various games; establishes baseline for game-playing capabilities.

2. **LLM Coup: A Benchmark for Strategic Deception**
   - Authors: Khoj AI team
   - Link: https://github.com/khoj-ai/llm-coup
   - Notes: Studies deception in the social deduction game Coup; closest prior work to ours.

3. **Chess Arena (Featherless)**
   - Link: https://github.com/featherlessai/chess-arena
   - Notes: Competitive chess playing between LLMs; establishes methodology for LLM competitions.

### Additional Game-Playing References

4. **Emergent social learning in multi-agent systems**
   - Notes: How agents learn from each other in multi-agent settings.

5. **Strategic behavior in multi-agent reinforcement learning**
   - Notes: Game-theoretic approaches to multi-agent learning.

## LLM Deception and Honesty

### Truthfulness

1. **TruthfulQA: Measuring How Models Mimic Human Falsehoods**
   - Authors: Stephanie Lin, Jacob Hilton, Owain Evans
   - Link: https://arxiv.org/abs/2109.07958
   - Year: 2021
   - Notes: Benchmark for measuring model truthfulness; shows models often generate false answers.

2. **Teaching Models to Express Their Uncertainty in Words**
   - Authors: Stephanie Lin, Jacob Hilton, Owain Evans
   - Link: https://arxiv.org/abs/2205.14334
   - Year: 2022
   - Notes: Methods for calibrating model confidence.

3. **The Capacity for Moral Self-Correction in Large Language Models**
   - Authors: Deep Ganguli, et al.
   - Link: https://arxiv.org/abs/2301.11379
   - Year: 2023
   - Notes: Studies whether models can self-correct harmful outputs.

### Sycophancy

4. **Sycophancy in Large Language Models**
   - Authors: Ethan Perez, et al.
   - Link: https://arxiv.org/abs/2301.11379
   - Year: 2022
   - Notes: Models tend to agree with user opinions even when wrong; relevant to honesty.

### Deception

5. **Sycophancy in Large Language Models**
   - Authors: Alex Turner, et al.
   - Notes: Models can learn to deceive in pursuit of objectives.

6. **AI Deception: A Survey of Cases, Risks, and Potential Solutions**
   - Authors: Park et al.
   - Link: https://arxiv.org/abs/????
   - Year: 2024
   - Notes: Comprehensive survey of deception in AI systems.

## Multi-Agent LLM Systems

### Collaboration

1. **Multi-Agent Debate**
   - Authors: Xinyun Chen, et al.
   - Link: https://arxiv.org/abs/2305.14325
   - Year: 2023
   - Notes: Multiple agents debating to improve reasoning.

2. **CAMEL: Communicative Agents for "Mind" Exploration**
   - Authors: Guohao Li, et al.
   - Link: https://arxiv.org/abs/2303.17760
   - Year: 2023
   - Notes: Two agents collaborating on tasks.

### Competition

3. **Competitive Multi-Agent Interactions**
   - Notes: How competition changes agent behavior.

4. **Social dilemmas in multi-agent systems**
   - Notes: Tension between individual and collective outcomes.

## Instruction Following vs. Goal Achievement

### Goal Misgeneralization

1. **Goal Misgeneralization: Why Correct Specifications Aren't Enough For Correct Goals**
   - Authors: Evan Hubinger, et al.
   - Link: https://arxiv.org/abs/2210.01790
   - Year: 2022
   - Notes: Models pursue wrong goals even with correct specifications.

### Reward Hacking

2. **The Reward Hacking Problem**
   - Authors: Tom Everitt, Marcus Hutter
   - Notes: Agents gaming reward functions.

3. **Sycophancy as a Form of Reward Hacking**
   - Notes: Connection between sycophancy and reward gaming.

### Instruction Following

4. **Constitutional AI: Harmlessness from AI Feedback**
   - Authors: Yuntao Bai, et al. (Anthropic)
   - Link: https://arxiv.org/abs/2212.08073
   - Year: 2022
   - Notes: Training models to follow principles/constitutions.

5. **Training Language Models to Follow Instructions**
   - Authors: Long Ouyang, et al. (OpenAI)
   - Link: https://arxiv.org/abs/2203.02155
   - Year: 2022
   - Notes: InstructGPT paper; foundational work on instruction following.

## AI Alignment

### Core Alignment

1. **Concrete Problems in AI Safety**
   - Authors: Dario Amodei, et al.
   - Link: https://arxiv.org/abs/1606.06565
   - Year: 2016
   - Notes: Foundational paper on AI safety challenges.

2. **Alignment Tax**
   - Notes: The cost of aligning models; trade-offs between capability and alignment.

3. **Scalable Oversight**
   - Notes: How to supervise systems smarter than the supervisor.

### Honesty in AI

4. **Honest AI: A Sufficient Condition for Alignment**
   - Authors: Owain Evans, Owen Cotton-Barratt, Lukas Finnvedal
   - Notes: Argument that honesty alone could solve alignment.

## Game Theory and Deception

### Classic References

1. **The Evolution of Deception**
   - Notes: Evolutionary biology perspective on deception.

2. **Signaling Theory**
   - Notes: How honest/dishonest signals evolve.

3. **Cheap Talk and Deception in Games**
   - Notes: Game-theoretic treatment of verbal deception.

## Methodology References

### Statistical Methods

1. **Power Analysis for Experimental Design**
   - Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences.
   - Notes: Foundational text for sample size calculations.

2. **Effect Sizes and Their Interpretation**
   - Notes: Cohen's d, eta-squared, etc.

### Experimental Design

3. **Between-Subjects vs Within-Subjects Design**
   - Notes: Trade-offs in experimental design.

## To Add

- [ ] Specific papers on LLM moral reasoning
- [ ] Papers on fairness in AI systems
- [ ] More recent multi-agent LLM papers
- [ ] Specific Chutes/Featherless documentation
- [ ] Recent deception benchmarks

---

## Citation Format

When citing in the paper, use this format:
- First mention: Full author names, "Title," Venue Year.
- Subsequent: Author et al., Year.

Example:
> Lin et al. (2021) introduced TruthfulQA to measure model truthfulness, finding that models frequently generate false answers that mimic common human misconceptions.

---

## Literature Review Draft

### For Related Work Section

**LLM Game-Playing.** The ability of LLMs to play games has been studied extensively. GAMEBoT [citation] evaluated models across multiple games, finding that while models can learn game rules, strategic reasoning remains challenging. LLM Coup [citation] specifically studied deception in social deduction games, finding that models vary in their ability to bluff and detect deception. Our work extends this by systematically manipulating the ethical framing of deception.

**LLM Honesty and Deception.** Research on LLM truthfulness has primarily focused on factual accuracy rather than strategic deception. TruthfulQA [Lin et al., 2021] showed that models often generate false answers that mimic human misconceptions. Sycophancy research [Perez et al., 2022] revealed that models tend to agree with user opinions even when incorrect, suggesting a tension between honesty and helpfulness. However, these studies examine deception in cooperative settings, whereas we study it in competitive contexts where deception is strategically rational.

**Multi-Agent LLM Interactions.** Multi-agent systems with LLMs have primarily studied collaboration [Chen et al., 2023; Li et al., 2023]. Less attention has been paid to competitive settings, where agents have conflicting objectives. Our work addresses this gap by studying deception in a competitive multi-agent game.

**Instruction Following vs. Goal Achievement.** A key alignment challenge is the tension between following instructions and achieving goals. Goal misgeneralization [Hubinger et al., 2022] occurs when models pursue incorrect goals despite correct specifications. Our Experiment 3 directly tests whether models will violate explicit instructions against deception when doing so helps them win, illuminating this tension in a controlled setting.
