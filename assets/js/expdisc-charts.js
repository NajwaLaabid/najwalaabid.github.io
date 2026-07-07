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
      var o = base(c, "The best subset is small, then extra sources dilute", "best-of-size-k, averaged over 9 targets");
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
  FIG["expdisc-fig-coverage"] = function () {
    var D = [
      ["KSOL (solubility)", 96, 5128, "source"],
      ["LogD", 95, 5039, "source"],
      ["MLM clearance", 85, 4522, "source"],
      ["HLM clearance", 71, 3759, "source"],
      ["Caco-2 Papp", 40, 2157, "source"],
      ["Caco-2 efflux", 41, 2161, "source"],
      ["plasma binding", 24, 1302, "target"],
      ["brain binding", 18, 975, "target"],
      ["muscle binding", 4, 222, "target"],
    ];
    return function (c) {
      var o = base(c, "One dataset, a steep coverage gradient", "OpenADMET: % of training molecules with a measured label");
      o.grid = { left: 118, right: 60, top: 88, bottom: 52 };
      o.tooltip.trigger = "item";
      o.tooltip.formatter = function (p) {
        var row = D[p.dataIndex];
        return (
          "<b>" +
          row[0] +
          "</b><br/>" +
          row[1] +
          "% measured (" +
          row[2].toLocaleString() +
          " molecules)<br/>" +
          '<span style="opacity:.7">' +
          (row[3] === "source" ? "data-rich → transfer source" : "data-poor → few-shot target") +
          "</span>"
        );
      };
      o.legend = {
        top: 46,
        textStyle: { color: c.ink },
        data: [{ name: "data-rich source" }, { name: "data-poor target" }],
      };
      o.xAxis = {
        type: "value",
        max: 100,
        name: "% of molecules measured",
        nameLocation: "middle",
        nameGap: 26,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: c.grid } },
        axisLabel: { color: c.ink, formatter: "{value}%" },
        nameTextStyle: { color: c.ink },
      };
      o.yAxis = {
        type: "category",
        inverse: true,
        data: D.map(function (r) {
          return r[0];
        }),
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { show: false },
        axisLabel: { color: c.ink },
      };
      function bars(role, color, name) {
        return {
          name: name,
          type: "bar",
          barWidth: "62%",
          stack: "x",
          color: color,
          data: D.map(function (r) {
            return r[3] === role ? { value: r[1], itemStyle: { borderRadius: 3 } } : "-";
          }),
          label: {
            show: true,
            position: "right",
            color: c.inkSoft,
            formatter: function (p) {
              return D[p.dataIndex][1] + "%";
            },
          },
        };
      }
      o.series = [bars("source", c.cat[0], "data-rich source"), bars("target", c.cat[4], "data-poor target")];
      return o;
    };
  };

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
        ymax: 0.35,
        legendRight: 24,
        series: lines.concat(bars),
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
        ["heuristic", "correlation heuristic (no LLM)", D.heuristic, c.inkSoft, { dash: "dashed", width: 1.6 }],
        ["agent_corr", "agent — corr only (no metadata)", D.agent_corr, c.cat[7], { dash: "dashed" }],
        ["agent_meta", "agent — metadata only (no corr)", D.agent_meta, c.cat[1], { dash: "dashed" }],
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
        ymax: 0.35,
        legendRight: 24,
        series: lines.concat(bars),
      });
    };
  };

  // ---- autoresearch: autonomous agent vs floor/greedy/oracle on sparse endpoints ----
  FIG["expdisc-fig-autoresearch"] = function () {
    var D = {
      targets: [
        ["MGMB", 222],
        ["MBPB", 975],
        ["MPPB", 1302],
      ],
      floor: [0.518, 0.493, 0.321],
      greedy: [0.722, 0.719, 0.657],
      agent: [0.714, 0.686, 0.675],
      oracle: [0.747, 0.72, 0.706],
    };
    return function (c) {
      var o = base(
        c,
        "One autonomous agent reaches 96% of the brute-force oracle",
        "sparsest OpenADMET endpoints, mean test ρ (+56% over no transfer)"
      );
      o.grid = { left: 62, right: 24, top: 104, bottom: 70 };
      o.legend = { top: 44, textStyle: { color: c.ink, fontSize: 11 }, itemGap: 12 };
      o.tooltip.formatter = function (ps) {
        return (
          "<b>" +
          ps[0].axisValue.replace("\n", " ") +
          "</b><br/>" +
          ps
            .map(function (p) {
              return p.marker + p.seriesName + ": <b>" + (+p.value).toFixed(3) + "</b>";
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
      o.series = [
        bar("no transfer", D.floor, c.inkSoft),
        bar("greedy (manual)", D.greedy, c.cat[7]),
        bar("autoresearch agent (ours)", D.agent, c.cat[4], { z: 5 }),
        bar("oracle (brute force)", D.oracle, c.cat[0]),
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
        ["agent_cluster", "agent — cluster budget", D.agent_cluster, c.cat[0], {}],
        ["agent_permol", "agent — named molecules", D.agent_permol, c.cat[1], {}],
        ["agent_sandbox", "agent — embedding + k-medoids tool", D.agent_sandbox, c.cat[4], { width: 2.6, symbol: 8 }],
        ["kmedoids", "k-medoids (label-free)", D.kmedoids, c.cat[2], { width: 3, symbol: 9, z: 5 }],
      ];
      var lines = rows.map(function (r) {
        return ladderLine(r[1], r[2], r[3], r[4]);
      });
      var bars = rows.map(function (r, i) {
        return errorBars(r[1], r[2], D.sem[r[0]], r[3], (i - (rows.length - 1) / 2) * 5);
      });
      return linesOption(c, {
        title: "Cold start: k-medoids leads at n=5, then everything converges",
        subtext: "which molecules to measure first (zero target labels), mean test ρ over 9 targets; ±1 SEM whiskers overlap",
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
