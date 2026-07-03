---
layout: distill
title: "Where does an LLM agent actually help? Mapping the boundary in a drug-discovery pipeline"
date: 2026-06-24
description: "We won a hackathon by letting an LLM agent decide what a property-prediction model should learn from. The interesting part was finding where it stopped helping."
tags: agents transfer-learning drug-discovery
categories: research
giscus_comments: true
featured: true
published: true
bibliography: 2026-06-24.bib

authors:
  - name: Najwa Laabid
    url: "https://najwalaabid.github.io"
    affiliations:
      name: Aalto University

toc:
  - name: The problem nobody wants to do by hand
  - name: Test 1 — what should the model learn from?
  - name: Test 2 — can the agent run the whole thing?
  - name: Test 3 — which molecules should we measure first?
  - name: The boundary
  - name: Caveats and links
---

A quick framing before the results. Most "LLM agents for science" posts tell you
where an agent *worked* <d-cite key="bran2024chemcrow,boiko2023coscientist"></d-cite>. That's the easy half. The half that actually tells you how to
build these systems is the boundary: the same agent, on two neighbouring tasks in the
same pipeline, where it crushes a strong baseline on one and gets tied by twenty lines
of geometry on the other. We spent a weekend at the **Exponential Discovery in Life
Sciences** hackathon (organized by AMD / Silo AI, Orion, and CSC) mapping exactly that
line. This is what we found.

## The problem nobody wants to do by hand

In drug discovery you measure ADMET properties — absorption, distribution, metabolism,
excretion, toxicity — one assay at a time. Every new assay starts cold: a handful of
measured molecules, often 10–50, because each label is a real experiment that costs real
time and money. Train a model on that handful and you get nothing. On our benchmark,
few-shot prediction from scratch scored a mean test Spearman of **0.08** — statistically
indistinguishable from guessing.

The standard fix is transfer learning: pretrain on past assays you already have labels
for, then fine-tune on the few new ones. Which raises the question that is usually
settled by a senior scientist's intuition — *which* past assays do you transfer from? (Classical
transferability scores try to answer this without an LLM <d-cite key="nguyen2020leep,you2021logme"></d-cite>.)
Pick assays that measure something mechanistically related and you get a large boost.
Pick unrelated ones and you can make the model *worse* than no transfer at all.

So we made that decision the object of study. We held the predictor fixed — a plain
shared-trunk MLP — so that any improvement is attributable to *selection*, not to a
fancier model. Then we asked: how far can an LLM agent push that one decision, and where
does it stop mattering?

## Test 1 — what should the model learn from?

The first agent is small and boring by design. It sees candidate source assays as a list
with summary statistics and metadata (what each assay measures, how it correlates with
the target, how much the molecules overlap). It has two actions: `evaluate` a proposed
subset against a held-out split, and `finalize` a choice with a short, chemist-readable
rationale. It loops a few times, then commits.

Against a brute-force **powerset oracle** — which literally tries every combination of
source assays and keeps the best — the agent reaches the oracle's performance. It beats
naive "pretrain on everything" pooling decisively ($p < 10^{-4}$) and matches a strong
correlation heuristic, with its margin concentrated at the coldest start ($n=5$), exactly
where the decision is hardest and the data gives you the least to go on.

Scaling it up to the Therapeutics Data Commons benchmark <d-cite key="huang2021tdc"></d-cite>
(22 ADMET tasks) showed the edge isn't a fluke of one dataset — and that it *grows with
support*. The agent's win-rate over the correlation heuristic climbs from 55% to 82% as
you give it more shots, because its `evaluate` signal sharpens with data while a static
correlation statistic does not. On regression tasks it's the best method at every sample
size.

{% include figure.liquid loading="eager" path="assets/img/expdisc-tdc_scaling.png" class="img-fluid rounded z-depth-1" caption="Across 22 TDC ADMET tasks, the agent's advantage over the no-LLM correlation heuristic widens as the number of available labels grows — its validation signal sharpens with data, the static statistic doesn't." %}

The detail I keep coming back to: nobody told the agent any chemistry. Yet its selections
are mechanistically sensible — it routes a half-life task to clearance assays, a
protein-binding task to lipophilicity. It *rediscovered* the relationships a
pharmacologist would draw, from metadata and a few dozen labels. That's the moment that
makes you think the reasoning is doing something real.

## Test 2 — can the agent run the whole thing?

Picking sources is one decision. A real pipeline has several: how many labels to use, how
to spend the labeling budget, which assays to transfer. So we handed all of it to a single
ReAct agent <d-cite key="yao2023react"></d-cite> — sources, acquisition, and shot count — let it run 9–14 steps on
validation signal only, and took exactly one honest test evaluation when it finalized.
Every run drops a natural-language report explaining what it did and why.

On the three sparsest endpoints — the genuinely label-starved ones, 222 to 1300 labels —
the autonomous agent reached **96% of the brute-force oracle** and **+56% over no
transfer**, beating the no-transfer floor on all nine runs.

{% include figure.liquid loading="eager" path="assets/img/expdisc-autoresearch_vs_oracle.png" class="img-fluid rounded z-depth-1" caption="One agent driving the full pipeline on the sparsest endpoints: it lands within 96% of a brute-force oracle and far above no-transfer, with a saved rationale for every run." %}

Here's the honest framing, because it matters: it does **not** beat a carefully-tuned
expert greedy pipeline — on average it ties it. The claim is automation, not dominance: a
single agent that also tunes the knobs a human would tune, matching the expert and nearly
reaching the oracle, while writing down its reasoning. And on the *hardest* cold start —
the endpoint with the lowest floor — it did edge past greedy. The reasoning earns the most
where transfer is hardest. That's the pattern you'd hope for.

## Test 3 — which molecules should we measure first?

This is the test that makes the post worth writing.

Same setup, a neighbouring question — arguably the more valuable one to a chemist: with
*zero* labels on a new target, which molecules should you measure first? Spend your first
five experiments well and you bootstrap the whole assay. We built the agent a per-molecule
recommender: it reads the other assays' values plus RDKit descriptors and names specific
molecules to measure, with a reason for each ("unique scaffold and low LogD", "high Caco-2
efflux", "similar to m12, skip it").

It lost. Not to another agent — to **k-medoids**, a label-free clustering heuristic that
just picks geometrically representative molecules in the embedding space. At the real
cold-start regime ($n=5$), k-medoids was the best method on 8 of 9 targets. The agent beat
random sampling but couldn't catch the heuristic.

{% include figure.liquid loading="eager" path="assets/img/expdisc-coldstart_acquisition.png" class="img-fluid rounded z-depth-1" caption="Cold-start molecule selection: a label-free k-medoids heuristic (pick representative points) ties or beats the LLM agent. Where a geometric objective already captures the signal, the reasoning adds nothing." %}

My first instinct was that we'd handicapped the agent — it saw a lossy summary, k-medoids
saw the full embedding. So we ran the control: we gave the agent k-medoids' *exact* input,
the full pool embedding, plus a Python REPL with k-medoids, farthest-first, and V-optimal
design as callable tools. If the gap were an information problem, it would close. It
didn't. The agent inspected the data, judged the k-medoids picks good, and finalized
them — reproducing the heuristic's selection exactly on 81% of cases. It had nothing to
add because there was nothing to add: representative geometric sampling is simply the
right objective for "cover the space", and an LLM can't out-reason a problem that's
already solved by an algorithm. A clean null result.

(The per-molecule agent still earns its place in the demo — it's the *interpretable* layer,
naming molecules with a chemical reason a human can audit. But sell that as transparency,
not accuracy. It ties the heuristic; it doesn't beat it.)

## The boundary

Put the three tests side by side and the line is sharp:

- **The agent helps** when the task is *discrete selection over options* plus
  *mechanistic reasoning over metadata* — what to transfer from, how to automate a
  multi-step pipeline. Here it matches oracles and rediscovers chemistry.
- **The agent doesn't help** when a *geometric or statistical objective already captures
  the signal* — which points to sample to cover a space. Here a short, classical algorithm
  is the right tool and the LLM just re-derives it.

The practical takeaway, and the thing I'd tell anyone building these systems: use the LLM
for the judgment calls, not the math that already has a good algorithm. The wins come from
reasoning over messy, semantic, discrete choices — not from asking a language model to do
numerical optimization that scipy does better. Knowing *where the agent doesn't help* is
what lets you build something that does.

## Caveats and links

This was a hackathon: two benchmarks (OpenADMET ExpansionRx <d-cite key="openadmet2025expansionrx"></d-cite> and TDC), 22 tasks, a weekend.
One obvious baseline — query-by-committee active learning — is implemented but unrun. Treat
this as a focused empirical map, not a final word.

- **Try the agent** — it names the molecules to measure next, and why: [https://admet-demo-diffalign.2.rahtiapp.fi/]
- **Read the report** — full methods, tables, and statistics: [report / arXiv link]
- **Code** — [https://github.com/NajwaLaabid/assay-transfer-agent]

*Built with [teammates] at the Exponential Discovery in Life Sciences hackathon.*
