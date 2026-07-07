---
layout: distill
title: "How well can an LLM-Agent select assays for transfer learning?"
date: 2026-06-24
subtitle: >-
  We spent a weekend at the [Exponential Discovery in Life Sciences hackathon](https://www.linkedin.com/posts/amdsiloai_togetherweadvanceabrai-lifesciences-drugdiscovery-activity-7471116375785201664-Uhnl?utm_source=share&utm_medium=member_desktop&rcm=ACoAABnwz9AB6GgdcRyQqvbPyRe1b9V-W7-f5wA)
  (organized by AMD / Silo AI, Orion, and CSC) testing where an LLM agent helps in a
  drug-discovery pipeline, and where a simple algorithm does the job just as well.
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
  - name: Why evaluating molecules is slow and costly
  - name: The setup
  - name: First, the baselines
  - name: Our agent
  - name: How far can one agent go?
  - name: Conclusion, demo and code
---

Modern drug discovery leans hard on prediction: rather than measure every property of every
candidate in the lab, you train models to guess them _in silico_ and only run the
measurements you have to. When a property has too few labels to learn from, the standard
trick is to borrow what a model already picked up from a related,
better-measured property, also known as _transfer learning_. The catch is deciding which property to borrow from, and that is
exactly the kind of judgement call you might hope an AI agent could make. Here's where it
can, and where a twenty-line heuristic does the job just as well.

## Why evaluating molecules is slow and costly

Before a molecule can become a drug, you need to know how it behaves in the body: how
much of it is **A**bsorbed, how it **D**istributes, how fast it is **M**etabolised and
**E**xcreted, and how **T**oxic it is. These five properties are known collectively as ADMET <d-cite key="waterbeemd2003admet"></d-cite>. Each one is a separate lab measurement, also known as an _assay_<d-footnote>This is also what we will call a set of measured compounds for one endpoint, i.e. a column in a dataset of molecular properties.</d-footnote>, where multiple candidate compounds are tested together whenever possible.

Some assays are cheap, like an aqueous-solubility readout<d-footnote>The measurement is done by diluting a compound into aqueous buffer and reading off how much stays dissolved. Hundreds of compounds can be tested at once, with no cells or animals to keep alive.</d-footnote>, while a half-life toxicity endpoint (LD50) requires dosing animals with one compound at a time and drawing timed blood samples <d-cite key="kerns2016druglike"></d-cite>.
For endpoints like the latter, requiring days of wet-lab work and real money per compound, assays often start with only 10–50 compounds.

| ADMET stage      | The question it answers           | Common endpoints (**bold** = OpenADMET · _italic_ = TDC)                                                                                                                              |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**bsorption   | Does it get into the bloodstream? | **_solubility (KSOL)_**, **_permeability (Caco-2)_**, **efflux (Caco-2 ratio)**, **_lipophilicity (LogD)_**, _intestinal absorption (HIA)_, _P-gp inhibition_, _oral bioavailability_ |
| **D**istribution | Where in the body does it go?     | **_protein binding (MPPB / MBPB / MGMB; PPBR)_**, _volume of distribution (VDss)_, _blood–brain barrier (BBB)_                                                                        |
| **M**etabolism   | How fast is it broken down?       | **_microsomal clearance (HLM, MLM CLint)_**, _hepatocyte clearance_, _CYP 2C9 / 2D6 / 3A4 inhibition & substrate_                                                                     |
| **E**xcretion    | How is it cleared from the body?  | _half-life_, renal clearance                                                                                                                                                          |
| **T**oxicity     | Could it cause harm?              | _LD50_, _hERG (cardiac)_, _Ames (mutagenicity)_, _DILI (liver injury)_                                                                                                                |

**Table 1.** Common ADMET endpoints by stage; **bold** = OpenADMET, _italic_ = TDC.
{: .caption}

A reasonable move is to train a model to predict the assay from a molecule's structure,
then screen the rest in silico. But a model needs labels, and the endpoints that matter
most are the slow, expensive ones where labels are scarcest. Training from scratch on 10–50
measurements gets us nothing. To show this, we train the same model on n=5 observations from 9 different endpoints in turn, and record a mean test Spearman<d-footnote>Spearman's rank correlation (ρ) scores how well predictions <em>rank</em> compounds rather than how close they are in absolute value, which is what matters when the task is to pick the best few to take forward.</d-footnote> of
**0.06**, indistinguishable from guessing.

The standard fix is transfer learning: instead of training from scratch, pretrain the
model on past assays you already have labels for, then fine-tune it on the few new ones <d-cite key="pan2010survey"></d-cite>. The catch is _which_ past assays to pretrain on.
Take lipophilicity (LogD) with only five labels, pretraining on one other assay at a time: a mechanistically related source like plasma protein binding lifts Spearman from noise (ρ≈0) to 0.57, while an unrelated one like Caco-2 efflux pushes it _below_ the no-transfer line (negative transfer).

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-negtransfer" style="width:100%; height:460px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-negative_transfer.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">Target = lipophilicity (LogD). We pretrain on one source assay at a time. The right source (plasma protein binding, mechanistically tied to lipophilicity) turns a useless cold-start model into a good one; an unrelated permeability assay (Caco-2 efflux)  makes it worse than no transfer at all. Which source you pick is the whole game.</figcaption> -->
</figure>

Which assays help is usually settled by a senior scientist's intuition, but there are
cheap signals you can compute in addition: how strongly a candidate assay correlates with the
target (which requires enough measurements), how much the assays' molecules overlap, or classical transferability scores <d-cite key="nguyen2020leep,you2021logme"></d-cite> like LEEP and LogME, which estimate how well a source will transfer from its model's features alone, without paying to fine-tune on it first.

In this project, we explore how well an LLM-agent chooses the assays to pretrain on compared to traditional baselines. We hold the predictor fixed (a plain MLP where we swap the final layer when training on each different property) so any improvement comes from _selection_, not a fancier model. Then we ask two things: 1) can an LLM agent choose a better set of source assays than these baselines?, and 2) can it run the whole pipeline (selecting the assays, deciding how many new compounds to measure, and choose which specific compounds to use in the new assay), end to end on its own?

The [interactive demo](https://admet-demo-diffalign.2.rahtiapp.fi/) and the [code](https://github.com/NajwaLaabid/assay-transfer-agent) are online if you'd rather see the agnet at work first; otherwise, read on for how we got there.

## The setup

To test whether an agent can learn ADMET properties better, we use **OpenADMET
ExpansionRx** <d-cite key="openadmet2025expansionrx"></d-cite>, a real lead-optimization
dataset from the recent OpenADMET blind challenge: 5,326 training and 2,282 test molecules,
each measured on the same nine assays. Because every molecule carries all nine readings, the
assays are densely co-measured — which, as we'll see, is exactly what makes a plain
correlation such a strong baseline here. To probe the opposite regime we add the
**Therapeutics Data Commons** (TDC) ADMET collection <d-cite key="huang2021tdc"></d-cite>:
22 assays drawn from separate studies whose molecules barely overlap, so most source–target
pairs share too few compounds to correlate at all. OpenADMET tests selection when the cheap
signal is trustworthy; TDC tests it when that signal is gone.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-coverage" style="width:100%; height:460px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-data_coverage.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">OpenADMET's sparsity gradient: coverage runs from 96% (solubility) down to 4% (muscle binding). The well-covered endpoints become transfer sources, the sparse ones the few-shot targets. Hover a bar for the molecule count.</figcaption> -->
</figure>

The predictor is the same simple model in every experiment, with or without the agent: a
small neural network<d-footnote>A shared-trunk MLP, 2248&rarr;512&rarr;128. Each molecule enters as a SMILES string, which RDKit turns into a fixed 2248-number vector: a 2048-bit ECFP4 fingerprint (a Morgan fingerprint of radius 2 — a bit-vector recording which substructures the molecule contains) concatenated with ~200 RDKit 2D physicochemical descriptors (molecular weight, LogP, hydrogen-bond counts, and the like). This featurization is deliberately plain; a fancier representation — a graph neural network over the molecular graph, learned embeddings, or richer descriptors — would likely predict better, but we hold it fixed on purpose so any gain traces to source _selection_, not the model.</d-footnote>
that turns a molecule's structure into a predicted assay value. We pretrain it on the
chosen source assays, freeze it, and fit a simple linear read-out (a ridge regression) on
the few target labels.

Every experiment runs the same rotation: one endpoint is the **target**, the rest are
candidate **sources**, and we cycle through all nine so each is the target in turn. The
target contributes only $n$ labels to the read-out — we sweep $n \in \{5, 10, 25, 50\}$ to
trace the cold-start-to-warm curve — while sources bring their full label sets. Every number
is a mean over five random draws of those $n$ labels. Sources are chosen on a held-out split
of the target's own train molecules; the reported Spearman is always on the untouched
official test set.

For the agent we use CSC's [Aitta](https://zenodo.org/records/17305233) inference service
running **Llama-3.3-70B-Instruct**. We pick this open-weights model for its reasoning and
its reliable tool use (following instructions and returning well-formed choices). Aitta serves
the model on LUMI's AMD MI250X GPUs behind an OpenAI-compatible REST endpoint, so every step of
the agent is a plain chat-completion call from our own machine (no local GPU), and the same
code would run against any hosted model by swapping one string.

## First, the baselines

Before handing anything to an agent, it's worth knowing what can be achieved with existing heuristics. Every method here uses the _same_ fixed predictor (the MLP described earlier); the only difference is which source assays are picked to pretrain on. Five rungs, floor to ceiling: **no transfer** at all, a **random** pair of sources, **all** sources pooled, a **correlation heuristic** that ranks sources by how strongly they track the target and keeps adding until the score stops improving, and a brute-force
**oracle** that tries every possible subset and keeps the best.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-baselines" style="width:100%; height:480px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-s1_method_lines.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">The baseline ladder on OpenADMET (mean test ρ over 9 targets, across the few-shot budget). No transfer is useless (ρ≈0.06); <em>any</em> pretraining leaps to ρ≈0.46 (even a random pair reaches ρ≈0.31) and choosing sources by correlation climbs to ρ≈0.50, close to the oracle's ρ≈0.53. The dotted line is the abundant-label ceiling (0.61). Hover for exact values.</figcaption> -->
</figure>

Two things fall out of this ladder. First, **transfer is the whole game**: going from
no-transfer to _any_ pretraining is a 5× jump, far bigger than any gap between selection
methods. Second, **pooling everything is not the same as choosing well**: "all sources" sits at
0.46 while the oracle reaches 0.53, and a curated subset beats all-source pooling on 8 of 9
targets. Combining many assays mitigates negative transfer, so the pool never drops below
the floor; but the effect is still visible as _dilution_, which is exactly why the
pretraining sources are worth choosing well. The best subset is small: performance peaks at
two or three well-chosen sources, then decays steadily as you pile on more.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-dilution" style="width:100%; height:470px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-s1_dilution.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">Why selection matters: the best subset peaks at two or three assays, then dilutes as you pile on more. Hover a point for the exact rank correlation and the sources most often chosen at that size.</figcaption> -->
</figure>

And here's the catch that sets up everything after: the best subset is _different for every
target_. Yet a plain correlation ranking
already recovers 96% of the oracle's gain. So on a dataset like this, where every assay is
co-measured, so correlation is a clean, trustworthy signal, a twenty-line heuristic gets
you _most_ of the way to optimal. Which raises the real question: **is there anything left
for an agent to do?** Two places it might. At the coldest start ($n=5$), where correlation
is estimated from almost no data and turns noisy. And on datasets where assays _don't_ share
molecules, so a correlation can't be computed at all. Both are exactly where we look next.

## Our agent

Our first agent is deliberately simple. It sees the candidate assays with their stats and
metadata, and has two moves: `evaluate` a proposed source set — we run the transfer for real
and hand back its held-out score — and `finalize` a set with a short, chemist-readable
reason. It evaluates a few candidates, then commits.

Here is one such run, verbatim — the metabolism target HLM CLint with just five labels:

<style>
.react-trace{border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:1.1em 1.2em;margin:1.6em 0;font-size:.9rem;line-height:1.5;background:rgba(128,128,128,.04)}
.react-trace ol{margin:0;padding-left:1.4em}
.react-trace li{margin:.55em 0;padding-left:.2em}
.react-trace .act{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.83rem;color:#7c3aed;font-weight:600}
.react-trace .obs{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem;opacity:.85}
.react-trace .err{color:#c0392b}
.react-trace .th{opacity:.9}
.react-trace .cap{margin-top:.9em;font-size:.8rem;opacity:.7}
@media (prefers-color-scheme: dark){.react-trace .act{color:#a78bfa}.react-trace .err{color:#ff7a6b}}
</style>
<div class="react-trace" markdown="0">
<ol>
<li><span class="th">Starting point: no-transfer floor</span> <span class="obs">→ val ρ 0.11.</span></li>
<li><span class="th">"Try a mechanistically related metabolism assay plus a physicochemical property."</span> → <span class="act">evaluate {MLM CLint, LogD}</span></li>
<li><span class="th">"Is the metabolism assay enough on its own?"</span> → <span class="act">evaluate {MLM CLint}</span></li>
<li><span class="th">"Swap the physicochemical partner for solubility?"</span> → <span class="act">evaluate {MLM CLint, KSOL}</span></li>
<li><span class="th">"Does a third source help?"</span> → <span class="act">evaluate {MLM CLint, LogD, KSOL}</span></li>
<li><span class="th">"Re-confirm the leader."</span> → <span class="act">evaluate {MLM CLint, LogD}</span></li>
<li><span class="act">finalize {MLM CLint, LogD}</span> — <span class="th">"mechanistically related metabolism assay and a physicochemical property with good coverage and moderate correlation, yielding the highest validation score."</span> <span class="obs">val ρ 0.63 → held-out test ρ 0.50.</span></li>
</ol>
<div class="cap">The simple agent probes a handful of source sets — single vs. paired sources, swapping the physicochemical partner, testing a third — then commits to the metabolism sister assay (MLM CLint) and lipophilicity (LogD). It was handed no chemistry, yet the pick is textbook.</div>
</div>

And the choices stay chemically legible across all nine targets: the two cross-species
clearance assays (HLM and MLM CLint) pick each other, the two Caco-2 permeability assays do the
same, and the three tissue-binding endpoints form a mutually-selecting cluster — textbook ADMET
relationships, rediscovered.

On OpenADMET it answers the first question cleanly. The agent **reaches the oracle**,
**beats naive all-source pooling decisively** ($p < 10^{-4}$), and **matches the
correlation heuristic**. Its margin over the heuristic concentrates exactly at the
coldest start ($n=5$), where a correlation estimated from five points is least trustworthy.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-methods" style="width:100%; height:480px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-s1_method_lines.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">The same ladder, now with the agent (violet). It tracks the brute-force oracle, sits well above naive all-source pooling, and matches the correlation heuristic — with its clearest edge at the coldest start, n=5. Hover to compare all methods at a given budget.</figcaption> -->
</figure>

Where the heuristic has enough co-measured points to trust its correlation, reasoning adds little and the two converge. But at the $n=5$ cold start, where a five-point correlation is mostly noise, the agent is already ahead: it wins precisely where the cheap
signal doesn't yet exist.

To further showcase this, we evaluate on a dataset where correlation is unreliable by design.
On the Therapeutics Data Commons benchmark <d-cite key="huang2021tdc"></d-cite> (22 ADMET tasks, mostly _not_
co-measured, so correlation is often undefined), the agent's edge over the heuristic _grows
with data_: its win-rate climbs from 55% to 82% as you give it more shots, because its
`evaluate` signal sharpens while a static correlation statistic does not. Same agent; the difference is whether the cheap
baseline is fixable. On the nine regression tasks, where small-sample correlation is
noisiest, the agent leads every baseline at every budget. Naive pooling or random
selection sink _below_ no-transfer, the same collapse we saw once OpenADMET's source pool grew.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-tdc-baselines" style="width:100%; height:470px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-tdc_baselines.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">The plain agent against every non-LLM baseline on TDC's nine regression tasks (no oracle here — molecule-disjoint tasks can't be enumerated over shared molecules). The agent (violet) leads at every budget, while pooling all sources or picking at random drops below no-transfer. Hover to compare.</figcaption> -->
</figure>

One test pins down _where_ that lead comes from. The agent reads two kinds of information — the
correlation statistics and the assays' text descriptions — so we removed each in turn. Strip
the descriptions and it falls back to the plain correlation heuristic (worst at $n=50$, where
that heuristic is weakest); strip the correlations instead and it keeps almost all of its edge.
What the reasoning adds is the biology in the metadata, not the statistics.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-tdc" style="width:100%; height:470px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-tdc_scaling.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">Ablation on the same tasks. The full agent (violet) and a metadata-only variant climb with data; strip the assay descriptions (corr-only, dashed) and the agent collapses to the correlation heuristic at n=50. Hover to compare.</figcaption> -->
</figure>

So far the agent has made a single call — _what to transfer from_ — and made it well,
pulling ahead exactly where the cheap statistics run out. But source selection is one
decision in a campaign that has many. Can the same reasoning drive the rest?

## How far can one agent go?

A real campaign is a chain of decisions, not one: past _which_ assays to borrow from, someone
must choose _how many_ compounds to label and _which_ ones. We hand both to the agent — one it
aces, one it flubs.

**Can it run the whole pipeline?** By _whole pipeline_ we mean the three decisions taken
together — which source assays to pretrain on, how many new target compounds to label ($n$),
and which specific compounds to pick — made inside a single loop and judged by one held-out
test evaluation at the very end. We give this to one agent running a **reason–act loop**
(the ReAct pattern <d-cite key="yao2023react"></d-cite>: the model alternates a written
_thought_ with a concrete _action_, then uses what it observes to choose the next move). Its
actions come from a fixed toolset: `inspect_data` and `source_stats` to orient itself
(coverage, value ranges, correlations, the no-transfer floor), `evaluate` to run one full
configuration — sources, acquisition method, $n$ — and read back its _validation_ score,
`run_python` for a persistent sandbox where it can test its own hypotheses (compute a
statistic, try a descriptor), and `finalize` to commit a configuration plus a chemist-facing
report. A run takes 9–14 of these steps; the test set is revealed exactly once, on whatever it
finalizes.

Here is one run, verbatim — the agent's own thoughts and actions on the tissue-binding target
MBPB, lightly trimmed:

<div class="react-trace" markdown="0">
<ol>
<li><span class="act">inspect_data</span> · <span class="act">source_stats</span> — <span class="th">orient: coverage, value range, no-transfer floor, correlations to every candidate.</span></li>
<li><span class="th">"MGMB correlates 0.90 with MBPB and shares 216 molecules — a valuable source."</span> → <span class="act">evaluate {MGMB}</span> <span class="obs">→ val ρ 0.51</span></li>
<li><span class="th">"Add the next-best, MPPB (corr 0.61)."</span> → <span class="act">evaluate {MGMB, MPPB}</span> <span class="obs">→ val ρ 0.74</span></li>
<li><span class="th">"Are they complementary or redundant?"</span> → <span class="act">run_python: train['MGMB']['smiles'].corr(...)</span> <span class="err">→ KeyError</span></li>
<li><span class="th">"That key doesn't exist; use the label columns directly."</span> → <span class="act">run_python: train['MGMB'].corr(train['MPPB'])</span> <span class="obs">→ 0.46 — complementary, not redundant.</span></li>
<li><span class="th">"Add LogD (corr 0.51, 961 shared)."</span> → <span class="act">evaluate {MGMB, MPPB, LogD}</span> <span class="obs">→ val ρ 0.79</span></li>
<li><span class="th">"Now tune the knobs."</span> → sweep acquisition and budget: <span class="act">random</span> <span class="obs">(lower)</span>, <span class="act">farthest_first n=50</span> <span class="obs">(overfits, drops)</span>, <span class="act">kmedoids n=25</span> <span class="obs">→ val ρ 0.81, the best yet.</span></li>
<li><span class="act">finalize</span> — commit {MGMB, MPPB, LogD}, kmedoids, n=25, with a written rationale. <span class="obs">Held-out test ρ 0.67.</span></li>
</ol>
<div class="cap">A single autoresearch run on MBPB. The agent reasons from the correlation table, builds the source set incrementally, checks its own hypothesis in the sandbox — hitting and recovering from a real error — then tunes acquisition and budget before committing. Every step is logged as natural language a chemist can audit.</div>
</div>

On the three sparsest endpoints — the genuinely label-starved ones, 222 to 1,300 labels — it
reaches **96% of the brute-force oracle** and **+56% over no transfer**, beating the floor on
all nine runs; the win concentrates where labels are scarcest. But it does not _beat_ the
strong human baseline. Our expert **greedy pipeline** — rank the candidate sources by their
correlation to the target, add them one at a time as long as the validation score keeps
rising, stop when it doesn't — lands in the same place: averaged over the three targets the
agent scores ρ≈0.69 against greedy's ρ≈0.70, a tie well inside the seed-to-seed noise.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-autoresearch" style="width:100%; height:460px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-autoresearch_vs_oracle.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">One agent driving the full pipeline on the three sparsest endpoints: it lands within 96% of a brute-force oracle and far above no transfer, ties the manual greedy pipeline, and edges past it on the hardest target (MPPB). Hover for exact values.</figcaption> -->
</figure>

The claim is automation, not dominance: one agent that also tunes the
knobs a human would, matching the expert and nearly reaching the oracle, while writing down
its reasoning. And on the _hardest_ target — MPPB, the lowest floor (ρ≈0.32 from scratch) —
it does edge past greedy, ρ≈0.68 to 0.66. The reasoning earns the most where transfer is
hardest.

**Can it pick which molecules to measure first (acquisition)?** This is the neighbouring question, and
arguably the more valuable one to a chemist: with _zero_ labels on a new target, which
molecules do you measure first to bootstrap the assay? Acquisition was already one knob in the
pipeline above, but buried there — the agent just picked a named algorithm (`kmedoids`,
`farthest_first`, …) to sub-sample a pool that _already had_ labels, and its effect was
tangled up with the source and budget choices in a single score. Here we strip it out and make
it harder: no labels at all, and the agent must reason about _individual_ molecules from their
structure rather than call a canned method — precisely the setting where a model's chemical
knowledge should pay off, if it ever does. We build it a per-molecule recommender — it reads
the other assays' values plus RDKit descriptors and names specific molecules, with a reason for
each ("unique scaffold and low LogD", "high Caco-2 efflux", "similar to m12, skip it").

We try the acquisition agent three ways,
each given more to work with: one **allocates a labeling budget across chemical clusters**,
one **names individual molecules** from a shortlist with a reason for each, and one gets
k-medoids'<d-footnote>k-medoids is a clustering method that picks <em>k</em> actual data points as cluster centres, so the chosen molecules are real, maximally-spread representatives of the pool. With no target labels to learn from, spreading the measurements evenly across chemical space — covering the range of structures instead of clumping — is the sensible default, which is why it is a strong baseline here.</d-footnote> _exact_ input — the full pool embedding — with the heuristic itself as a callable
tool. At the true cold start ($n=5$), representative sampling is what matters and **k-medoids
leads**; no agent variant beats it. Past a handful of picks the field just converges — the
gaps fall inside the seed-to-seed noise, and on a set as chemically homogeneous as OpenADMET
even _random_ selection catches up, edging ahead by $n=25$. Once you have more than a few
molecules, coverage is easy and how you choose stops mattering.

<figure class="expdisc-figure">
  <div class="expdisc-chart" id="expdisc-fig-coldstart" style="width:100%; height:470px;"></div>
  <noscript>
  {% include figure.liquid loading="eager" path="assets/img/expdisc-coldstart_acquisition.png" class="img-fluid rounded z-depth-1" %}
  </noscript>
  <!-- <figcaption class="caption">Cold-start molecule selection: mean test ρ over 9 targets, three seeds each. At n=5 k-medoids (gold) and the tool-armed agent (violet) lead; as the budget grows the methods converge and random (grey) catches up. No agent variant clearly beats the heuristic. Hover to compare.</figcaption> -->
</figure>

The lesson is that **k-medoids is a genuinely good heuristic**
for this job. Spreading picks to cover the embedding is close to the right objective for
"which molecules are worth labeling," and it costs nothing. Reasoning over each molecule's name
and descriptors — the thing the LLM adds — lands _below_ that at the cold start: guessing which
compound is informative from its structure is harder than simply covering the space, and even
handing the agent k-medoids as a tool only lets it match the heuristic, never beat it. Could a
model with deeper medicinal-chemistry knowledge do better — flag a redundant scaffold the
geometry misses? Maybe; on this data it didn't. (The per-molecule agent still earns its place
in the demo as the _interpretable_ layer — every pick comes with an auditable chemical reason —
but that's transparency, not accuracy.)

## Conclusion, demo and code

On transfer learning, the agent helps most with the judgment calls: choosing which assays to transfer from, and
running the whole selection-and-labeling pipeline on its own. It picks sources that make
chemical sense, routing a half-life target to clearance assays and a protein-binding target to
lipophilicity without being told any chemistry, and it holds up best where information is
thinnest: only a handful of labels, or candidate assays that share no molecules with the target
so the usual correlation can't be computed. Once there is enough data, though, the cheap
baselines catch up. Given enough co-measured labels to estimate a reliable correlation, a
twenty-line heuristic selects sources about as well as the agent, and a hand-tuned greedy
procedure runs the pipeline about as well; both come close to an oracle that is allowed to peek
at the test set. The agent's real advantage is in the low-data regime, not everywhere.

On data acquisition, it is no help when a simple algorithm already covers the problem. Deciding which molecules to
measure first is really just spreading the picks across chemical space, and k-medoids does that
directly; past the first few molecules even a random choice does as well. Giving the agent that
same embedding, plus k-medoids as a callable tool, changes nothing: it mostly just calls
k-medoids. So the rule we take away is a plain one. Use the model for the parts that call for
reading and judgment, and leave the well-posed numerical problems to the algorithms that
already solve them.

Try the agent [here](https://admet-demo-diffalign.2.rahtiapp.fi/): it suggests which molecules
to measure next and explains each pick. The [code](https://github.com/NajwaLaabid/assay-transfer-agent)
is on GitHub.

_Built with Halidu Abdulai (Åbo Akademi University), Anirudh Jain (Orion), Ilari Tulkki (CSC), and Gerardo Gonzalez (Silo AI) at the Exponential Discovery in Life Sciences hackathon._

<script src="{{ '/assets/js/expdisc-charts.js' | relative_url }}"></script>
