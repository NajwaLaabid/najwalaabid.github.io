---
layout: distill
title: "Breaking Symmetry: Aligned Equivariance for Graph Diffusion Models"
date: 2025-03-10 16:40:16
description: Presenting our model DiffAlign (ICLR 2025)
tags: retrosynthesis diffusion
categories: research
giscus_comments: true
featured: true
mermaid:
  enabled: true
  zoomable: true
code_diff: true
map: true
chart:
  chartjs: true
  echarts: true
  vega_lite: true
tikzjax: true
typograms: true

authors:
  - name: Najwa Laabid
    url: "najwalaabid.github.io"
    affiliations:
      name: Aalto University

bibliography: 2025-03-11.bib

# Optionally, you can add a table of contents to your post.
# NOTES:
#   - make sure that TOC names match the actual section names
#     for hyperlinks within the post to work correctly.
#   - we may want to automate TOC generation in the future using
#     jekyll-toc plugin (https://github.com/toshimaru/jekyll-toc).
toc:
  - name: Equations
    # if a section has subsections, you can add them as follows:
    # subsections:
    #   - name: Example Child Subsection 1
    #   - name: Example Child Subsection 2
  - name: Citations
  - name: Footnotes
  - name: Code Blocks
  - name: Interactive Plots
  - name: Mermaid
  - name: Diff2Html
  - name: Leaflet
  - name: Chartjs, Echarts and Vega-Lite
  - name: TikZ
  - name: Typograms
  - name: Layouts
  - name: Other Typography?

# Below is an example of injecting additional post-specific styles.
# If you use this post as a template, delete this _styles block.
_styles: >
  .fake-img {
    background: #bbb;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 0px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 12px;
  }
  .fake-img p {
    font-family: monospace;
    color: white;
    text-align: left;
    margin: 12px 0;
    text-align: center;
    font-size: 16px;
  }
---
## Diffusion for Graph Translation
- why
- advantages
- retrosynthesis as an example
- diffusion with its classical components (i.e. equivariant denoiser) practically fails.
## Symmetry and Equivariance
### Equivariance illustrated
### What happens when the input is symmetrical?
### Example: copying graphs
### The limitations of equivariance in a theorem
## Solution: Aligned Equivariance
- relax equivariance just enough with node identifiers
- solutions from different papers studying equivariance
- aligned equivariance for graph translation in particular: identify nodes + extra inductive biases/information for graphs
### Alignment methods
### Mathematical properites of the aligned equivariant denoiser
## Results
### Retrosynthesis
### Inpainting
### Guidance
## Try it yourself


