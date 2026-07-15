/* Interactive figures for the "where LLM agents help" post.
   One engine: loads ECharts once, reads theme colors from the site's CSS vars,
   re-renders on the light/dark toggle, and draws each figure whose <div> is present.
   Palette = the validated dataviz reference set (light/dark steps per mode). */
(function () {
  "use strict";

  // ---- validated palettes (see palette validator; do not hand-edit without re-running) ----
  var CAT = {
    // categorical, fixed slot order (blue, aqua, yellow, green, violet, red, magenta, orange)
    light: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
    dark: ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926"],
  };
  var ORD = {
    // ordinal blue ramp for n-sweeps (light->dark = more data)
    light: ["#86b6ef", "#5598e7", "#2a78d6", "#184f95"],
    dark: ["#b7d3f6", "#6da7ec", "#3987e5", "#256abf"],
  };

  function cssvar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function ctx() {
    var mode = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    return {
      mode: mode,
      ink: cssvar("--global-text-color", mode === "dark" ? "#e8e8e8" : "#1c1d20"),
      inkSoft: cssvar("--global-text-color-light", mode === "dark" ? "#9aa0a6" : "#828282"),
      grid: cssvar("--global-divider-color", mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"),
      surface: cssvar("--global-card-bg-color", mode === "dark" ? "#212529" : "#ffffff"),
      cat: CAT[mode],
      ord: ORD[mode],
    };
  }

  // ---- one-time card styling, injected so the post stays clean ----
  function injectStyle() {
    if (document.getElementById("expdisc-chart-style")) return;
    var s = document.createElement("style");
    s.id = "expdisc-chart-style";
    s.textContent =
      ".expdisc-chart{background:var(--global-card-bg-color);border:1px solid var(--global-divider-color);" +
      "border-radius:10px;padding:14px 12px 8px;margin:0;box-shadow:0 2px 10px rgba(0,0,0,.06);}" +
      ".expdisc-figure{margin:1.6rem 0;}" +
      ".expdisc-figure figcaption{margin-top:.6rem;}";
    document.head.appendChild(s);
  }

  // ---- ECharts loader (CDN, once) ----
  var loading = null;
  function withECharts(cb) {
    if (window.echarts) {
      cb();
      return;
    }
    if (loading) {
      loading.push(cb);
      return;
    }
    loading = [cb];
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js";
    s.onload = function () {
      loading.forEach(function (f) {
        f();
      });
      loading = null;
    };
    document.head.appendChild(s);
  }

  function render(id, build) {
    var el = document.getElementById(id);
    if (!el) return;
    withECharts(function () {
      var chart = echarts.init(el, null, { renderer: "svg" });
      function paint() {
        chart.setOption(build(ctx()), true);
      }
      paint();
      window.addEventListener("resize", function () {
        chart.resize();
      });
      new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    });
  }

  // shared axis/title/tooltip scaffolding so every figure looks like one system
  function base(c, title, subtext) {
    return {
      backgroundColor: "transparent",
      textStyle: { color: c.ink },
      title: {
        text: title,
        subtext: subtext,
        left: "center",
        textStyle: { color: c.ink, fontSize: 15, fontWeight: 600 },
        subtextStyle: { color: c.inkSoft, fontSize: 12 },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: c.surface,
        borderColor: c.grid,
        textStyle: { color: c.ink },
      },
    };
  }

  // ===================== FIGURES =====================
  var FIG = {};

  // ---- s1_dilution: best-of-size-k, n-sweep (ordinal) ----
  FIG["expdisc-fig-dilution"] = function () {
    var DATA = {
      sizes: [1, 2, 3, 4, 5, 6, 7, 8],
      series: {
        5: [0.502, 0.536, 0.529, 0.52, 0.504, 0.501, 0.451, 0.411],
        10: [0.532, 0.552, 0.52, 0.516, 0.527, 0.528, 0.466, 0.454],
        25: [0.52, 0.522, 0.557, 0.523, 0.525, 0.514, 0.482, 0.475],
        50: [0.516, 0.509, 0.539, 0.533, 0.517, 0.495, 0.492, 0.475],
      },
      topsources: {
        1: [
          ["LogD", 29],
          ["plasma bind.", 17],
          ["Caco-2 Papp", 11],
          ["Caco-2 efflux", 11],
        ],
        2: [
          ["LogD", 48],
          ["plasma bind.", 25],
          ["muscle bind.", 24],
          ["Caco-2 Papp", 21],
        ],
        3: [
          ["LogD", 63],
          ["muscle bind.", 37],
          ["brain bind.", 36],
          ["plasma bind.", 31],
        ],
        4: [
          ["LogD", 69],
          ["plasma bind.", 48],
          ["brain bind.", 46],
          ["muscle bind.", 45],
        ],
        5: [
          ["LogD", 75],
          ["muscle bind.", 63],
          ["brain bind.", 63],
          ["solubility", 54],
        ],
        6: [
          ["LogD", 81],
          ["muscle bind.", 71],
          ["Caco-2 Papp", 69],
          ["brain bind.", 69],
        ],
        7: [
          ["LogD", 87],
          ["brain bind.", 80],
          ["plasma bind.", 80],
          ["muscle bind.", 79],
        ],
        8: [
          ["Caco-2 Papp", 89],
          ["HLM cl.", 89],
          ["solubility", 89],
          ["LogD", 89],
        ],
      },
    };
    var NS = ["5", "10", "25", "50"];
    return function (c) {
      var o = base(c, "The best subset is small, then extra sources dilute", "OpenADMET, best-of-size-k averaged over 9 targets");
      o.legend = {
        top: 46,
        textStyle: { color: c.ink },
        data: NS.map(function (n) {
          return "n = " + n;
        }),
      };
      o.grid = { left: 66, right: 24, top: 96, bottom: 66 };
      o.tooltip.formatter = function (ps) {
        var k = ps[0].axisValue;
        var s = "<b>subset size k = " + k + "</b><br/>";
        ps.forEach(function (p) {
          s += p.marker + p.seriesName + ": <b>" + (p.value == null ? "—" : (+p.value).toFixed(3)) + "</b><br/>";
        });
        var t = DATA.topsources[k] || [];
        if (t.length) {
          s += '<span style="opacity:.6">sources most-picked at size ' + k + ":</span><br/>";
          s +=
            '<span style="opacity:.9">' +
            t
              .map(function (x) {
                return x[0] + " " + x[1] + "%";
              })
              .join(" · ") +
            "</span>";
        }
        return s;
      };
      o.xAxis = {
        type: "category",
        data: DATA.sizes,
        boundaryGap: false,
        name: "sources in the subset (k)",
        nameLocation: "middle",
        nameGap: 30,
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { show: false },
        axisLabel: { color: c.ink },
        nameTextStyle: { color: c.ink },
      };
      o.yAxis = {
        type: "value",
        name: "rank correlation ρ (test)",
        min: 0.4,
        max: 0.57,
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: 46,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: c.grid } },
        axisLabel: { color: c.ink },
        nameTextStyle: { color: c.ink },
      };
      o.series = NS.map(function (n, i) {
        return {
          name: "n = " + n,
          type: "line",
          smooth: true,
          symbolSize: 7,
          lineStyle: { width: 2.6, color: c.ord[i] },
          itemStyle: { color: c.ord[i] },
          emphasis: { focus: "series" },
          data: DATA.series[n],
          markArea:
            i === 0
              ? {
                  silent: true,
                  itemStyle: { color: c.mode === "dark" ? "rgba(144,133,233,0.14)" : "rgba(74,58,167,0.07)" },
                  data: [[{ xAxis: "2" }, { xAxis: "3" }]],
                }
              : undefined,
        };
      });
      return o;
    };
  };

  // ---- shared ladder builder: methods as lines vs few-shot budget n ----
  var LADDER_N = ["5", "10", "25", "50"];
  var LADDER = {
    // OpenADMET mean test Spearman over 9 targets (paper Table 1)
    floor: [0.053, 0.076, 0.091, 0.115],
    random: [0.202, 0.329, 0.35, 0.353],
    all: [0.39, 0.468, 0.482, 0.48],
    corr: [0.457, 0.509, 0.531, 0.508],
    agent: [0.495, 0.549, 0.53, 0.508],
    oracle: [0.531, 0.531, 0.553, 0.514],
    ceiling: 0.614,
  };
  function ladderLine(name, data, color, opts) {
    opts = opts || {};
    return {
      name: name,
      type: "line",
      data: data,
      smooth: true,
      symbolSize: opts.symbol || 7,
      lineStyle: { width: opts.width || 2.4, color: color, type: opts.dash || "solid" },
      itemStyle: { color: color },
      z: opts.z || 2,
      emphasis: { focus: "series" },
    };
  }
  function ladder(c, title, subtext, withAgent) {
    var o = base(c, title, subtext);
    o.grid = { left: 66, right: 96, top: 96, bottom: 64 };
    o.legend = { top: 46, textStyle: { color: c.ink } };
    o.tooltip.formatter = function (ps) {
      var s = "<b>n = " + ps[0].axisValue + " labels</b><br/>";
      ps.slice()
        .sort(function (a, b) {
          return (b.value || 0) - (a.value || 0);
        })
        .forEach(function (p) {
          if (p.value == null) return;
          s += p.marker + p.seriesName + ": <b>" + (+p.value).toFixed(3) + "</b><br/>";
        });
      return s;
    };
    o.xAxis = {
      type: "category",
      data: LADDER_N,
      boundaryGap: false,
      name: "few-shot budget (labels on the new assay)",
      nameLocation: "middle",
      nameGap: 30,
      axisLine: { lineStyle: { color: c.grid } },
      axisTick: { show: false },
      axisLabel: {
        color: c.ink,
        formatter: function (v) {
          return "n=" + v;
        },
      },
      nameTextStyle: { color: c.ink },
    };
    o.yAxis = {
      type: "value",
      name: "rank correlation ρ (test)",
      min: 0,
      max: 0.66,
      nameLocation: "middle",
      nameRotate: 90,
      nameGap: 42,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: c.grid } },
      axisLabel: { color: c.ink },
      nameTextStyle: { color: c.ink },
    };
    // ceiling as a horizontal reference on the first drawn series
    var ceil = {
      name: "ceiling (full labels)",
      type: "line",
      data: [null, null, null, null],
      lineStyle: { width: 0 },
      itemStyle: { color: c.inkSoft },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: c.inkSoft, type: "dotted", width: 1.5 },
        label: { color: c.inkSoft, formatter: "ceiling (full labels) " + LADDER.ceiling, position: "insideEndTop" },
        data: [{ yAxis: LADDER.ceiling }],
      },
    };
    o.series = [
      ceil,
      ladderLine("no transfer", LADDER.floor, c.inkSoft, { width: 1.8 }),
      ladderLine("random sources", LADDER.random, c.cat[7]),
      ladderLine("all sources", LADDER.all, c.cat[0]),
      ladderLine("correlation heuristic", LADDER.corr, c.cat[1]),
      ladderLine("oracle (best subset)", LADDER.oracle, c.ink, { dash: "dashed", width: 2 }),
    ];
    if (withAgent) {
      o.series.push(ladderLine("agent (ours)", LADDER.agent, c.cat[4], { width: 3.4, symbol: 9, z: 5 }));
    }
    return o;
  }

  FIG["expdisc-fig-baselines"] = function () {
    return function (c) {
      return ladder(
        c,
        "Transfer is the whole game, and the right subset adds more on top",
        "OpenADMET, mean test ρ over 9 targets (no agent yet)",
        false
      );
    };
  };
  FIG["expdisc-fig-methods"] = function () {
    return function (c) {
      return ladder(c, "The agent reaches the oracle and beats naive pooling", "OpenADMET, mean test ρ over 9 targets", true);
    };
  };

  // ---- generic line-vs-n option (used by TDC and cold-start) ----
  function linesOption(c, cfg) {
    var o = base(c, cfg.title, cfg.subtext);
    o.grid = { left: 66, right: cfg.legendRight || 24, top: cfg.top || 96, bottom: 64 };
    o.legend = { top: 46, textStyle: { color: c.ink } };
    o.tooltip.formatter = function (ps) {
      var s = "<b>" + cfg.xname + " = " + ps[0].axisValue + "</b><br/>";
      ps.slice()
        .sort(function (a, b) {
          return (b.value || 0) - (a.value || 0);
        })
        .forEach(function (p) {
          if (p.value != null) s += p.marker + p.seriesName + ": <b>" + (+p.value).toFixed(3) + "</b><br/>";
        });
      return s;
    };
    o.xAxis = {
      type: "category",
      data: cfg.xlabels,
      boundaryGap: false,
      name: cfg.xaxisName,
      nameLocation: "middle",
      nameGap: 30,
      axisLine: { lineStyle: { color: c.grid } },
      axisTick: { show: false },
      axisLabel: { color: c.ink, formatter: cfg.xfmt },
      nameTextStyle: { color: c.ink },
    };
    o.yAxis = {
      type: "value",
      name: cfg.yname,
      min: cfg.ymin,
      max: cfg.ymax,
      nameLocation: "middle",
      nameRotate: 90,
      nameGap: 46,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: c.grid } },
      axisLabel: { color: c.ink },
      nameTextStyle: { color: c.ink },
    };
    o.series = cfg.series;
    return o;
  }

  // horizontal reference line (e.g. full-label ceiling) for the line-vs-n charts
  function refLine(c, npts, y, label, dash) {
    return {
      name: label,
      type: "line",
      data: new Array(npts).fill(null),
      lineStyle: { width: 0 },
      itemStyle: { color: c.inkSoft },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { color: c.inkSoft, type: dash || "dashed", width: 1.5 },
        label: { color: c.inkSoft, formatter: label + " " + y.toFixed(2), position: "insideEndTop" },
        data: [{ yAxis: y }],
      },
    };
  }

  // vertical ±SEM whiskers for a line series, offset horizontally so methods don't overlap.
  // Shares the line's name so the legend toggles line + whiskers together.
  function errorBars(name, means, sems, color, xoffPx) {
    return {
      name: name,
      type: "custom",
      silent: true,
      z: 6,
      tooltip: { show: false },
      data: means.map(function (m, i) {
        return [i, m - sems[i], m + sems[i]];
      }),
      renderItem: function (params, api) {
        var lo = api.coord([api.value(0), api.value(1)]);
        var hi = api.coord([api.value(0), api.value(2)]);
        var x = lo[0] + (xoffPx || 0),
          cap = 4;
        var st = { stroke: color, lineWidth: 1.3, opacity: 0.8 };
        return {
          type: "group",
          children: [
            { type: "line", shape: { x1: x, y1: lo[1], x2: x, y2: hi[1] }, style: st },
            { type: "line", shape: { x1: x - cap, y1: lo[1], x2: x + cap, y2: lo[1] }, style: st },
            { type: "line", shape: { x1: x - cap, y1: hi[1], x2: x + cap, y2: hi[1] }, style: st },
          ],
        };
      },
    };
  }

  // ---- negative transfer (intro): one source at a time, LogD target ----
  FIG["expdisc-fig-negtransfer"] = function () {
    var D = {
      floor: -0.013,
      bars: [
        ["plasma bind.", 0.566],
        ["HLM cl.", 0.436],
        ["muscle bind.", 0.33],
        ["solubility", 0.18],
        ["brain bind.", 0.165],
        ["MLM cl.", -0.001],
        ["Caco-2 Papp", -0.017],
        ["Caco-2 efflux", -0.09],
      ],
    };
    return function (c) {
      var o = base(
        c,
        "One source at a time: the right assay lifts LogD, the wrong one hurts",
        "LogD target, n=5; each bar is pretraining on a single source assay"
      );
      o.grid = { left: 60, right: 24, top: 82, bottom: 76 };
      o.tooltip.trigger = "item";
      o.tooltip.formatter = function (p) {
        return (
          "<b>" +
          p.name +
          "</b><br/>ρ = <b>" +
          (+p.value).toFixed(3) +
          "</b><br/>" +
          '<span style="opacity:.7">' +
          (p.value >= D.floor ? "helps — above no transfer" : "hurts — below no transfer") +
          "</span>"
        );
      };
      o.xAxis = {
        type: "category",
        data: D.bars.map(function (b) {
          return b[0];
        }),
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { show: false },
        axisLabel: { color: c.ink, interval: 0, rotate: 30 },
      };
      o.yAxis = {
        type: "value",
        name: "rank correlation ρ (test)",
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: 44,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: c.grid } },
        axisLabel: { color: c.ink },
        nameTextStyle: { color: c.ink },
      };
      o.series = [
        {
          type: "bar",
          barWidth: "58%",
          data: D.bars.map(function (b) {
            return { value: b[1], itemStyle: { color: b[1] >= D.floor ? c.cat[4] : c.cat[5], borderRadius: 3 } };
          }),
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: c.ink, type: "dashed", width: 1.4 },
            label: { color: c.ink, formatter: "no transfer (ρ≈0)", position: "insideEndTop" },
            data: [{ yAxis: D.floor }],
          },
        },
      ];
      return o;
    };
  };

  // ---- data coverage (setup): per-endpoint train coverage, source vs target ----
  // ---- setup: the two evaluation datasets, side by side (two grids) ----
  // Left  = OpenADMET, 9 densely co-measured assays (correlation is a strong
  //         source-selection signal), colored by role.
  // Right = TDC, 22 molecule-disjoint assays (metadata replaces correlation),
  //         split into regression vs classification blocks. Same x-axis on both.
  FIG["expdisc-fig-coverage"] = function () {
    // [label, molecules, coverage%, role] — ascending, so first item sits at bottom
    var OA = [
      ["muscle binding", 222, 4, "target"],
      ["brain binding", 975, 18, "target"],
      ["plasma binding", 1302, 24, "target"],
      ["Caco-2 Papp", 2157, 40, "source"],
      ["Caco-2 efflux", 2161, 41, "source"],
      ["HLM clearance", 3759, 71, "source"],
      ["MLM clearance", 4522, 85, "source"],
      ["LogD", 5039, 95, "source"],
      ["KSOL (solubility)", 5128, 96, "source"],
    ];
    // [label, molecules, type] — regression block then classification block,
    // each ascending, so the two color blocks stack cleanly (reg bottom, cls top)
    var TDC = [
      ["half-life", 667, "regression"],
      ["Caco-2 permeability", 910, "regression"],
      ["clearance (microsome)", 1102, "regression"],
      ["volume of distribution", 1130, "regression"],
      ["clearance (hepatocyte)", 1213, "regression"],
      ["plasma protein binding", 2790, "regression"],
      ["lipophilicity", 4200, "regression"],
      ["acute toxicity (LD50)", 7385, "regression"],
      ["solubility", 9982, "regression"],
      ["liver injury (DILI)", 475, "classification"],
      ["intestinal absorption", 578, "classification"],
      ["bioavailability", 640, "classification"],
      ["hERG blockade", 655, "classification"],
      ["CYP2D6 substrate", 667, "classification"],
      ["CYP2C9 substrate", 669, "classification"],
      ["CYP3A4 substrate", 670, "classification"],
      ["P-gp inhibition", 1218, "classification"],
      ["blood-brain barrier", 2030, "classification"],
      ["mutagenicity (Ames)", 7278, "classification"],
      ["CYP2C9 inhibition", 12092, "classification"],
      ["CYP3A4 inhibition", 12328, "classification"],
      ["CYP2D6 inhibition", 13130, "classification"],
    ];
    var nReg = 0;
    TDC.forEach(function (r) {
      if (r[2] === "regression") nReg++;
    });
    return function (c) {
      var oaSrc = c.cat[1],
        oaTgt = c.cat[7]; // aqua-green / orange
      var tReg = c.cat[4],
        tCls = c.cat[2]; // violet / yellow

      function oaBar(role, color, name) {
        return {
          name: name,
          type: "bar",
          xAxisIndex: 0,
          yAxisIndex: 0,
          barWidth: "64%",
          barGap: "-100%",
          color: color,
          data: OA.map(function (r) {
            return r[3] === role ? { value: r[1], cov: r[2], itemStyle: { borderRadius: 3 } } : "-";
          }),
          label: {
            show: true,
            position: "right",
            color: c.inkSoft,
            fontSize: 10,
            formatter: function (p) {
              return p.data && p.data.cov != null ? p.data.cov + "%" : "";
            },
          },
        };
      }
      function tBar(ty, color, name, withSplit) {
        var s = {
          name: name,
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          barWidth: "70%",
          barGap: "-100%",
          color: color,
          data: TDC.map(function (r) {
            return r[2] === ty ? { value: r[1], itemStyle: { borderRadius: 3 } } : "-";
          }),
          label: {
            show: true,
            position: "right",
            color: c.inkSoft,
            fontSize: 8.5,
            formatter: function (p) {
              return p.value ? p.value.toLocaleString() : "";
            },
          },
        };
        if (withSplit) {
          s.markLine = {
            silent: true,
            symbol: "none",
            lineStyle: { color: c.inkSoft, type: "dashed", opacity: 0.5 },
            label: { show: false },
            data: [{ yAxis: nReg - 0.5 }],
          };
        }
        return s;
      }

      return {
        backgroundColor: "transparent",
        textStyle: { color: c.ink },
        title: [
          {
            text: "Two evaluation datasets: dense co-measurement vs. a molecule-disjoint benchmark",
            left: "center",
            top: 2,
            textStyle: { color: c.ink, fontSize: 15, fontWeight: 600 },
          },
          {
            text: "OpenADMET · 9 co-measured assays",
            left: "22%",
            top: 30,
            textAlign: "center",
            textStyle: { color: c.ink, fontSize: 13, fontWeight: 600 },
          },
          {
            text: "every molecule measured on all 9 → correlation picks sources",
            left: "22%",
            top: 49,
            textAlign: "center",
            textStyle: { color: c.inkSoft, fontSize: 10.5, fontWeight: 400 },
          },
          {
            text: "TDC · 22 molecule-disjoint assays",
            left: "76%",
            top: 30,
            textAlign: "center",
            textStyle: { color: c.ink, fontSize: 13, fontWeight: 600 },
          },
          {
            text: "separate studies, few shared molecules → metadata instead",
            left: "76%",
            top: 49,
            textAlign: "center",
            textStyle: { color: c.inkSoft, fontSize: 10.5, fontWeight: 400 },
          },
        ],
        tooltip: {
          trigger: "item",
          backgroundColor: c.surface,
          borderColor: c.grid,
          textStyle: { color: c.ink },
          formatter: function (p) {
            var head = "<b>" + p.name + "</b><br/>" + p.value.toLocaleString() + " molecules";
            if (p.data && p.data.cov != null) head += " (" + p.data.cov + "% of set)";
            return head + '<br/><span style="opacity:.7">' + p.seriesName + "</span>";
          },
        },
        legend: [
          {
            data: ["data-rich source", "few-shot target"],
            left: "5%",
            bottom: 6,
            textStyle: { color: c.ink },
            itemWidth: 14,
            itemHeight: 10,
          },
          {
            data: ["regression (9)", "classification (13)"],
            right: "5%",
            bottom: 6,
            textStyle: { color: c.ink },
            itemWidth: 14,
            itemHeight: 10,
          },
        ],
        grid: [
          { left: 116, width: "24%", top: 78, bottom: 66 },
          { left: "58%", right: 62, top: 78, bottom: 66 },
        ],
        xAxis: [
          {
            type: "log",
            gridIndex: 0,
            min: 100,
            max: 20000,
            name: "labelled molecules (log)",
            nameLocation: "middle",
            nameGap: 30,
            nameTextStyle: { color: c.ink },
            axisLine: { show: false },
            splitLine: { lineStyle: { color: c.grid } },
            axisLabel: { color: c.inkSoft },
          },
          {
            type: "log",
            gridIndex: 1,
            min: 300,
            max: 60000,
            name: "labelled molecules (log)",
            nameLocation: "middle",
            nameGap: 30,
            nameTextStyle: { color: c.ink },
            axisLine: { show: false },
            splitLine: { lineStyle: { color: c.grid } },
            axisLabel: { color: c.inkSoft },
          },
        ],
        yAxis: [
          {
            type: "category",
            gridIndex: 0,
            data: OA.map(function (r) {
              return r[0];
            }),
            axisLine: { lineStyle: { color: c.grid } },
            axisTick: { show: false },
            axisLabel: { color: c.ink, fontSize: 10 },
          },
          {
            type: "category",
            gridIndex: 1,
            data: TDC.map(function (r) {
              return r[0];
            }),
            axisLine: { lineStyle: { color: c.grid } },
            axisTick: { show: false },
            axisLabel: { color: c.ink, fontSize: 9 },
          },
        ],
        series: [
          oaBar("source", oaSrc, "data-rich source"),
          oaBar("target", oaTgt, "few-shot target"),
          tBar("regression", tReg, "regression (9)", false),
          tBar("classification", tCls, "classification (13)", true),
        ],
      };
    };
  };

  // full-label ceiling: supervised MLP on all target labels, mean test ρ over the 9 TDC
  // regression tasks (results/coldstart_acq_tdc) — matches the OpenADMET "ceiling (full labels)"
  var TDC_CEILING = { supervised: 0.505 };

  // ---- TDC baselines (regression): the plain agent vs every non-LLM baseline ----
  // Same ladder view as OpenADMET, but molecule-disjoint tasks — no oracle here.
  FIG["expdisc-fig-tdc-baselines"] = function () {
    var D = {
      ns: [10, 25, 50],
      floor: [0.141, 0.206, 0.254],
      random: [0.124, 0.124, 0.137],
      all: [0.202, 0.185, 0.189],
      heuristic: [0.204, 0.24, 0.236],
      agent_full: [0.225, 0.253, 0.296],
      sem: {
        floor: [0.032, 0.026, 0.033],
        random: [0.026, 0.017, 0.019],
        all: [0.03, 0.035, 0.034],
        heuristic: [0.046, 0.035, 0.046],
        agent_full: [0.045, 0.04, 0.049],
      },
    };
    return function (c) {
      var rows = [
        ["floor", "no transfer", D.floor, c.inkSoft, { width: 1.8 }],
        ["random", "random sources", D.random, c.cat[7], {}],
        ["all", "all sources", D.all, c.cat[0], {}],
        ["heuristic", "correlation heuristic (no LLM)", D.heuristic, c.cat[1], {}],
        ["agent_full", "agent (ours)", D.agent_full, c.cat[4], { width: 3.4, symbol: 9, z: 5 }],
      ];
      var lines = rows.map(function (r) {
        return ladderLine(r[1], r[2], r[3], r[4]);
      });
      var bars = rows.map(function (r, i) {
        return errorBars(r[1], r[2], D.sem[r[0]], r[3], (i - (rows.length - 1) / 2) * 5);
      });
      return linesOption(c, {
        title: "The agent leads every baseline on molecule-disjoint tasks",
        subtext: "TDC regression (9 ADMET tasks), mean test ρ ±1 SEM; naive pooling and random selection sink below no-transfer",
        xlabels: D.ns,
        xname: "n",
        xaxisName: "few-shot budget (labels on the new task)",
        xfmt: function (v) {
          return "n=" + v;
        },
        yname: "rank correlation ρ (test)",
        ymin: 0.08,
        ymax: 0.56,
        legendRight: 24,
        series: [refLine(c, D.ns.length, TDC_CEILING.supervised, "ceiling (full labels)", "dotted")].concat(lines).concat(bars),
      });
    };
  };

  // ---- TDC ablation (regression): metadata reasoning drives the agent's gains ----
  FIG["expdisc-fig-tdc"] = function () {
    var D = {
      ns: [10, 25, 50],
      heuristic: [0.204, 0.24, 0.236],
      agent_corr: [0.241, 0.281, 0.217],
      agent_meta: [0.204, 0.239, 0.282],
      agent_full: [0.225, 0.253, 0.296],
      sem: { heuristic: [0.046, 0.035, 0.046], agent_corr: [0.04, 0.03, 0.05], agent_meta: [0.055, 0.036, 0.049], agent_full: [0.045, 0.04, 0.049] },
    };
    return function (c) {
      var rows = [
        ["heuristic", "correlation heuristic (no LLM)", D.heuristic, c.inkSoft, { width: 1.6 }],
        ["agent_corr", "agent — corr only (no metadata)", D.agent_corr, c.cat[7], {}],
        ["agent_meta", "agent — metadata only (no corr)", D.agent_meta, c.cat[1], {}],
        ["agent_full", "agent — full (ours)", D.agent_full, c.cat[4], { width: 3.4, symbol: 9, z: 5 }],
      ];
      var lines = rows.map(function (r) {
        return ladderLine(r[1], r[2], r[3], r[4]);
      });
      var bars = rows.map(function (r, i) {
        return errorBars(r[1], r[2], D.sem[r[0]], r[3], (i - (rows.length - 1) / 2) * 5);
      });
      return linesOption(c, {
        title: "Ablation: metadata reasoning is what the agent's edge is made of",
        subtext: "TDC regression, mean test ρ ±1 SEM: strip the assay descriptions and the agent collapses to the correlation heuristic at n=50",
        xlabels: D.ns,
        xname: "n",
        xaxisName: "few-shot budget (labels on the new task)",
        xfmt: function (v) {
          return "n=" + v;
        },
        yname: "rank correlation ρ (test)",
        ymin: 0.1,
        ymax: 0.56,
        legendRight: 24,
        series: [refLine(c, D.ns.length, TDC_CEILING.supervised, "ceiling (full labels)", "dotted")].concat(lines).concat(bars),
      });
    };
  };

  // ---- autoresearch: autonomous agent vs floor/greedy/oracle on sparse endpoints ----
  FIG["expdisc-fig-autoresearch"] = function () {
    // equal-budget (n=25) comparison. agent/greedy = CPU re-score over 5 support seeds
    // (mean; sd = error bars); floor/oracle = oracle_pf reference at n=25.
    var D = {
      targets: [
        ["MGMB", 222],
        ["MBPB", 975],
        ["MPPB", 1302],
      ],
      floor: [0.497, 0.493, 0.323],
      greedy: [0.73, 0.731, 0.698],
      greedy_sd: [0.015, 0.029, 0.013],
      agent: [0.714, 0.608, 0.652],
      agent_sd: [0.022, 0.122, 0.044],
      oracle: [0.752, 0.72, 0.697],
    };
    var SD = { "greedy (manual)": D.greedy_sd, "autoresearch agent (ours)": D.agent_sd };
    return function (c) {
      var o = base(
        c,
        "At equal budget (25 shots), correlation-greedy matches or beats the agent",
        "sparsest OpenADMET endpoints, mean test ρ over 5 support seeds (bars = ±1 s.d.)"
      );
      o.grid = { left: 62, right: 24, top: 104, bottom: 70 };
      o.legend = {
        top: 44,
        textStyle: { color: c.ink, fontSize: 11 },
        itemGap: 12,
        data: ["no transfer", "greedy (manual)", "autoresearch agent (ours)", "oracle (brute force)"],
      };
      o.tooltip.formatter = function (ps) {
        return (
          "<b>" +
          ps[0].axisValue.replace("\n", " ") +
          "</b><br/>" +
          ps
            .filter(function (p) {
              return p.seriesName.indexOf("±") === -1;
            })
            .map(function (p) {
              var sd = SD[p.seriesName];
              var tail = sd ? " ± " + sd[p.dataIndex].toFixed(3) : "";
              return p.marker + p.seriesName + ": <b>" + (+p.value).toFixed(3) + "</b>" + tail;
            })
            .join("<br/>")
        );
      };
      o.xAxis = {
        type: "category",
        data: D.targets.map(function (t) {
          return t[0] + "\n(" + t[1] + " labels)";
        }),
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { show: false },
        axisLabel: { color: c.ink },
      };
      o.yAxis = {
        type: "value",
        name: "rank correlation ρ (test)",
        max: 0.82,
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: 44,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: c.grid } },
        axisLabel: { color: c.ink },
        nameTextStyle: { color: c.ink },
      };
      function bar(name, data, color, opts) {
        return {
          name: name,
          type: "bar",
          data: data,
          color: color,
          itemStyle: { borderRadius: 3, borderColor: c.surface, borderWidth: 1 },
          z: (opts && opts.z) || 2,
        };
      }
      // error bars: custom series, x-shifted to sit on the greedy/agent sub-bars
      // (4 bars per category, default gaps -> sub-bar centers at ~±0.106 of the band).
      function ebars(name, means, sds, offset) {
        return {
          name: name + " ±sd",
          type: "custom",
          silent: true,
          z: 10,
          data: means.map(function (m, i) {
            return [i, m + sds[i], m - sds[i]];
          }),
          renderItem: function (params, api) {
            var ci = api.value(0);
            var hi = api.coord([ci, api.value(1)]);
            var lo = api.coord([ci, api.value(2)]);
            var band = api.size([1, 0])[0];
            var x = hi[0] + offset * band;
            var cap = band * 0.035;
            var st = { stroke: c.ink, lineWidth: 1.1, opacity: 0.6 };
            return {
              type: "group",
              children: [
                { type: "line", shape: { x1: x, y1: hi[1], x2: x, y2: lo[1] }, style: st },
                { type: "line", shape: { x1: x - cap, y1: hi[1], x2: x + cap, y2: hi[1] }, style: st },
                { type: "line", shape: { x1: x - cap, y1: lo[1], x2: x + cap, y2: lo[1] }, style: st },
              ],
            };
          },
        };
      }
      o.series = [
        bar("no transfer", D.floor, c.inkSoft),
        bar("greedy (manual)", D.greedy, c.cat[7]),
        bar("autoresearch agent (ours)", D.agent, c.cat[4], { z: 5 }),
        bar("oracle (brute force)", D.oracle, c.cat[0]),
        ebars("greedy (manual)", D.greedy, D.greedy_sd, -0.106),
        ebars("autoresearch agent (ours)", D.agent, D.agent_sd, 0.106),
      ];
      return o;
    };
  };

  // ---- cold-start acquisition: k-medoids ties the agent ----
  FIG["expdisc-fig-coldstart"] = function () {
    var D = {
      ns: [5, 10, 25, 50],
      random: [0.321, 0.424, 0.501, 0.471],
      agent_cluster: [0.385, 0.454, 0.461, 0.438],
      agent_permol: [0.417, 0.437, 0.445, 0.432],
      agent_sandbox: [0.495, 0.44, 0.478, 0.44],
      kmedoids: [0.497, 0.46, 0.46, 0.464],
      sem: {
        random: [0.047, 0.039, 0.034, 0.034],
        agent_cluster: [0.047, 0.039, 0.036, 0.041],
        agent_permol: [0.044, 0.043, 0.041, 0.04],
        agent_sandbox: [0.025, 0.051, 0.036, 0.036],
        kmedoids: [0.025, 0.047, 0.037, 0.035],
      },
    };
    return function (c) {
      var rows = [
        ["random", "random", D.random, c.inkSoft, { width: 1.8 }],
        ["agent_cluster", "cluster agent", D.agent_cluster, c.cat[0], {}],
        ["agent_permol", "named-mol agent", D.agent_permol, c.cat[1], {}],
        ["agent_sandbox", "sandbox agent", D.agent_sandbox, c.cat[4], { width: 2.6, symbol: 8 }],
        ["kmedoids", "k-medoids", D.kmedoids, c.cat[2], { width: 3, symbol: 9, z: 5 }],
      ];
      var lines = rows.map(function (r) {
        return ladderLine(r[1], r[2], r[3], r[4]);
      });
      var bars = rows.map(function (r, i) {
        return errorBars(r[1], r[2], D.sem[r[0]], r[3], (i - (rows.length - 1) / 2) * 5);
      });
      return linesOption(c, {
        title: "OpenADMET · which molecules to measure first",
        subtext: "cold start (zero target labels), mean test ρ over 9 targets",
        xlabels: D.ns,
        xname: "molecules measured",
        xaxisName: "molecules measured first (cold start)",
        xfmt: function (v) {
          return "n=" + v;
        },
        yname: "rank correlation ρ (test)",
        ymin: 0.24,
        ymax: 0.58,
        legendRight: 24,
        series: lines.concat(bars),
      });
    };
  };

  // ---- cold-start acquisition, both datasets side by side (two grids) ----
  // OpenADMET (left, 9 regression targets) + TDC regression (right, 9 targets).
  // Same two-grid render as the coverage figure so both panels sit side by side at
  // any column width; violet = LLM agent, gold = winning label-free heuristic.
  FIG["expdisc-fig-coldstart-combined"] = function () {
    var NS = [5, 10, 25, 50];
    // All four label-free methods from one consistent run (results/coldstart_acq_baselines_pf,
    // 3 seeds) so ff/D-optimal sit on the same footing as k-medoids. The even-handed agent
    // (results/coldstart_sandbox_even, LUMI 19911669) ran on the same openadmet_pf trunks and so
    // shares that footing; the older agent draws were nondeterministic reruns and stay out.
    var OA = {
      random: [0.331, 0.422, 0.492, 0.458],
      farthest: [0.377, 0.458, 0.463, 0.461],
      voptimal: [0.366, 0.391, 0.493, 0.437],
      kmedoids: [0.411, 0.464, 0.496, 0.424],
      even: [0.385, 0.405, 0.492, 0.436],
      sem: {
        random: [0.052, 0.041, 0.029, 0.029],
        farthest: [0.058, 0.043, 0.036, 0.034],
        voptimal: [0.065, 0.056, 0.032, 0.033],
        kmedoids: [0.029, 0.042, 0.032, 0.033],
        even: [0.064, 0.053, 0.032, 0.032],
      },
    };
    var TDC = {
      random: [0.137, 0.229, 0.197, 0.167],
      farthest: [0.103, 0.183, 0.211, 0.229],
      kmedoids: [0.136, 0.127, 0.191, 0.202],
      sandbox: [0.131, 0.123, 0.193, 0.21],
      voptimal: [0.172, 0.206, 0.218, 0.275],
      sem: {
        random: [0.042, 0.027, 0.029, 0.029],
        farthest: [0.04, 0.025, 0.031, 0.035],
        kmedoids: [0.05, 0.04, 0.023, 0.025],
        sandbox: [0.049, 0.04, 0.024, 0.027],
        voptimal: [0.034, 0.03, 0.023, 0.028],
      },
    };
    return function (c) {
      // gi = grid index (0 = OpenADMET, 1 = TDC). tag keeps series names unique across
      // both panels; the legend formatter strips it back to a clean label.
      function ln(label, data, color, gi, opts) {
        opts = opts || {};
        return {
          name: label,
          type: "line",
          xAxisIndex: gi,
          yAxisIndex: gi,
          data: data,
          smooth: true,
          symbolSize: opts.symbol || 7,
          lineStyle: { width: opts.width || 2.4, color: color, type: opts.dash || "solid" },
          itemStyle: { color: color },
          z: opts.z || 2,
          emphasis: { focus: "series" },
        };
      }
      function eb(name, means, sems, color, gi, xoff) {
        return {
          name: name,
          type: "custom",
          silent: true,
          z: 6,
          xAxisIndex: gi,
          yAxisIndex: gi,
          tooltip: { show: false },
          data: means.map(function (m, i) {
            return [i, m - sems[i], m + sems[i]];
          }),
          renderItem: function (params, api) {
            var lo = api.coord([api.value(0), api.value(1)]);
            var hi = api.coord([api.value(0), api.value(2)]);
            var x = lo[0] + (xoff || 0),
              cap = 4;
            var st = { stroke: color, lineWidth: 1.3, opacity: 0.8 };
            return {
              type: "group",
              children: [
                { type: "line", shape: { x1: x, y1: lo[1], x2: x, y2: hi[1] }, style: st },
                { type: "line", shape: { x1: x - cap, y1: lo[1], x2: x + cap, y2: lo[1] }, style: st },
                { type: "line", shape: { x1: x - cap, y1: hi[1], x2: x + cap, y2: hi[1] }, style: st },
              ],
            };
          },
        };
      }
      // one style per method, shared by both panels, so a single legend reads across the figure.
      // k-medoids and D-optimal carry the story (representative sampling) and stay emphasised in
      // both. The agent is one series name across both panels so the legend reads as one method;
      // the two panels ran different prompts (OpenADMET even-handed, TDC k-medoids-anchored),
      // which the post covers in a footnote rather than the legend.
      var STYLE = {
        random: [c.inkSoft, { width: 1.8 }],
        "farthest-first": [c.cat[7], {}],
        "k-medoids": [c.cat[2], { width: 3, symbol: 9, z: 5 }],
        "D-optimal design": [c.cat[3], { width: 3, symbol: 9, z: 5 }],
        "sandbox agent": [c.cat[4], { width: 2.6, symbol: 8, z: 6 }],
      };
      var LEGEND = ["random", "farthest-first", "k-medoids", "D-optimal design", "sandbox agent"];
      var oaRows = [
        ["random", OA.random, OA.sem.random],
        ["farthest-first", OA.farthest, OA.sem.farthest],
        ["D-optimal design", OA.voptimal, OA.sem.voptimal],
        ["k-medoids", OA.kmedoids, OA.sem.kmedoids],
        ["sandbox agent", OA.even, OA.sem.even],
      ];
      var tdcRows = [
        ["random", TDC.random, TDC.sem.random],
        ["farthest-first", TDC.farthest, TDC.sem.farthest],
        ["k-medoids", TDC.kmedoids, TDC.sem.kmedoids],
        ["sandbox agent", TDC.sandbox, TDC.sem.sandbox],
        ["D-optimal design", TDC.voptimal, TDC.sem.voptimal],
      ];
      var series = [];
      oaRows.forEach(function (r, i) {
        series.push(ln(r[0], r[1], STYLE[r[0]][0], 0, STYLE[r[0]][1]));
        series.push(eb(r[0], r[1], r[2], STYLE[r[0]][0], 0, (i - 2) * 5));
      });
      tdcRows.forEach(function (r, i) {
        series.push(ln(r[0], r[1], STYLE[r[0]][0], 1, STYLE[r[0]][1]));
        series.push(eb(r[0], r[1], r[2], STYLE[r[0]][0], 1, (i - 2) * 5));
      });
      function axisX(gi) {
        return {
          type: "category",
          gridIndex: gi,
          data: NS,
          boundaryGap: false,
          axisLine: { lineStyle: { color: c.grid } },
          axisTick: { show: false },
          axisLabel: {
            color: c.ink,
            formatter: function (v) {
              return "n=" + v;
            },
          },
        };
      }
      function axisY(gi, min, max) {
        return {
          type: "value",
          gridIndex: gi,
          name: "rank correlation ρ (test)",
          min: min,
          max: max,
          nameLocation: "middle",
          nameRotate: 90,
          nameGap: 40,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: c.grid } },
          axisLabel: { color: c.ink },
          nameTextStyle: { color: c.ink },
        };
      }
      return {
        backgroundColor: "transparent",
        textStyle: { color: c.ink },
        title: [
          {
            text: "Cold start: which molecules to measure first (zero target labels)",
            left: "center",
            top: 2,
            textStyle: { color: c.ink, fontSize: 15, fontWeight: 600 },
          },
          {
            text: "OpenADMET · 9 regression targets",
            left: "27%",
            top: 28,
            textAlign: "center",
            textStyle: { color: c.ink, fontSize: 12.5, fontWeight: 600 },
          },
          {
            text: "TDC · 9 regression targets",
            left: "78%",
            top: 28,
            textAlign: "center",
            textStyle: { color: c.ink, fontSize: 12.5, fontWeight: 600 },
          },
        ],
        tooltip: {
          trigger: "item",
          backgroundColor: c.surface,
          borderColor: c.grid,
          textStyle: { color: c.ink },
          formatter: function (p) {
            if (p.value == null || p.seriesType === "custom") return "";
            return "<b>n=" + NS[p.dataIndex] + "</b><br/>" + p.marker + p.seriesName + ": <b>" + (+p.value).toFixed(3) + "</b>";
          },
        },
        legend: {
          data: LEGEND,
          left: "center",
          bottom: 6,
          itemGap: 14,
          textStyle: { color: c.ink, fontSize: 10.5 },
          itemWidth: 16,
          itemHeight: 8,
        },
        grid: [
          { left: 56, width: "36%", top: 56, bottom: 108 },
          { left: "56%", right: 28, top: 56, bottom: 108 },
        ],
        xAxis: [axisX(0), axisX(1)],
        yAxis: [axisY(0, 0.24, 0.58), axisY(1, 0.05, 0.34)],
        series: series,
      };
    };
  };

  // ===================== BOOT =====================
  function boot() {
    injectStyle();
    Object.keys(FIG).forEach(function (id) {
      if (document.getElementById(id)) render(id, FIG[id]());
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
