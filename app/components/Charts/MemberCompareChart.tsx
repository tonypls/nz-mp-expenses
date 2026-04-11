"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory, MemberInfo } from "../../lib/types";
import { PARTY_COLORS, EMISSION_FACTORS } from "../../lib/types";

// Distinct colors for up to 10 compared members
const COMPARE_COLORS = [
  "#38bdf8", "#fb923c", "#a78bfa", "#34d399", "#fb7185",
  "#fbbf24", "#22d3ee", "#e879f9", "#4ade80", "#f97316",
];

interface MemberCompareChartProps {
  records: ExpenseRecord[];
  categories: ExpenseCategory[];
  members: MemberInfo[];
  quarters: string[];
  onRemoveMember: (name: string) => void;
  onClearAll: () => void;
  showEmissions?: boolean;
}

export default function MemberCompareChart({
  records,
  categories,
  members,
  quarters,
  onRemoveMember,
  onClearAll,
  showEmissions = false,
}: MemberCompareChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build per-member quarterly totals
  const { memberData, allQuarters } = useMemo(() => {
    const memberMap = new Map<
      string,
      Map<string, number>
    >();

    for (const m of members) {
      memberMap.set(m.name, new Map());
    }

    for (const r of records) {
      const mMap = memberMap.get(r.name);
      if (!mMap) continue;
      const key = `${r.year}-${r.quarter}`;
      const sum = categories.reduce((acc, cat) => {
        const raw = r[cat] || 0;
        return acc + (showEmissions ? raw * (EMISSION_FACTORS[cat] || 0) / 1000 : raw);
      }, 0);
      mMap.set(key, (mMap.get(key) || 0) + sum);
    }

    // Find quarters where at least one member has data
    const activeQuarters = quarters.filter((q) =>
      members.some((m) => memberMap.get(m.name)?.has(q))
    );

    const memberData = members.map((m, i) => ({
      name: m.name,
      party: m.parties[0],
      color: COMPARE_COLORS[i % COMPARE_COLORS.length],
      data: activeQuarters.map((q) => ({
        quarter: q,
        value: memberMap.get(m.name)?.get(q) || 0,
      })),
      total: [...(memberMap.get(m.name)?.values() || [])].reduce(
        (a, b) => a + b,
        0
      ),
    }));

    return { memberData, allQuarters: activeQuarters };
  }, [records, categories, members, quarters, showEmissions]);

  // Draw comparison chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || allQuarters.length === 0 || !containerWidth)
      return;

    const width = containerWidth;
    const isMobile = width < 500;
    const height = isMobile ? 220 : 300;
    const margin = {
      top: 12,
      right: isMobile ? 12 : 20,
      bottom: isMobile ? 46 : 40,
      left: isMobile ? 46 : 60,
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("class", "chart-svg");

    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scalePoint<string>()
      .domain(allQuarters)
      .range([0, innerWidth])
      .padding(0.5);

    const yMax =
      d3.max(memberData, (m) => d3.max(m.data, (d) => d.value)) || 0;

    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([innerHeight, 0])
      .nice();

    // Grid
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => "")
      );

    const tooltip = d3.select(tooltipRef.current);
    const fmt = (v: number) => showEmissions ? `${d3.format(",.2f")(v)} t` : `$${d3.format(",.0f")(v)}`;

    // Draw lines for each member (no per-dot tooltip — handled by hover overlay)
    for (const member of memberData) {
      const filteredData = member.data.filter((d) => d.value > 0);
      if (filteredData.length === 0) continue;

      const line = d3
        .line<{ quarter: string; value: number }>()
        .x((d) => x(d.quarter) || 0)
        .y((d) => y(d.value))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(filteredData)
        .attr("fill", "none")
        .attr("stroke", member.color)
        .attr("stroke-width", 2.5)
        .attr("stroke-opacity", 0.9)
        .attr("d", line);

      g.selectAll(`.dot-${member.name.replace(/\W/g, "")}`)
        .data(filteredData)
        .join("circle")
        .attr("cx", (d) => x(d.quarter) || 0)
        .attr("cy", (d) => y(d.value))
        .attr("r", 3.5)
        .attr("fill", member.color)
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 2)
        .style("pointer-events", "none");
    }

    // Hover overlay — snaps to nearest quarter, shows all members
    const bisect = (mx: number) => {
      const domain = x.domain();
      let closest = domain[0];
      let minDist = Infinity;
      for (const q of domain) {
        const dist = Math.abs((x(q) || 0) - mx);
        if (dist < minDist) { minDist = dist; closest = q; }
      }
      return closest;
    };

    const showTooltip = (clientX: number, clientY: number, mx: number) => {
      const quarter = bisect(mx);

      g.selectAll(".hover-line").remove();
      g.append("line")
        .attr("class", "hover-line")
        .attr("x1", x(quarter)!).attr("x2", x(quarter)!)
        .attr("y1", 0).attr("y2", innerHeight)
        .attr("stroke", "rgba(255,255,255,0.2)")
        .attr("stroke-dasharray", "3,3");

      const entries = memberData
        .map((m) => ({ name: m.name, color: m.color, value: m.data.find((d) => d.quarter === quarter)?.value || 0 }))
        .filter((e) => e.value > 0)
        .sort((a, b) => b.value - a.value);

      if (entries.length === 0) return;

      let html = `<div class="tooltip-title">${quarter}</div>`;
      for (const e of entries) {
        html += `<div class="tooltip-row">
          <span class="dot" style="background:${e.color}"></span>
          <span class="label">${e.name}</span>
          <span class="value">${fmt(e.value)}</span>
        </div>`;
      }

      tooltip.style("opacity", 1).html(html);
      const el = tooltipRef.current!;
      const left = Math.min(clientX + 16, window.innerWidth - el.offsetWidth - 8);
      const top = clientY - el.offsetHeight - 8 >= 0 ? clientY - el.offsetHeight - 8 : clientY + 16;
      tooltip.style("left", `${left}px`).style("top", `${top}px`);
    };

    const hideTooltip = () => {
      g.selectAll(".hover-line").remove();
      tooltip.style("opacity", 0);
    };

    g.append("rect")
      .attr("width", innerWidth).attr("height", innerHeight)
      .attr("fill", "transparent")
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        showTooltip(event.clientX, event.clientY, mx);
      })
      .on("mouseleave", hideTooltip)
      .on("touchstart", (event: TouchEvent) => {
        event.preventDefault();
        const t = event.touches[0];
        if (!t || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        showTooltip(t.clientX, t.clientY, t.clientX - rect.left - margin.left);
      })
      .on("touchmove", (event: TouchEvent) => {
        event.preventDefault();
        const t = event.touches[0];
        if (!t || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        showTooltip(t.clientX, t.clientY, t.clientX - rect.left - margin.left);
      })
      .on("touchend", hideTooltip)
      .on("touchcancel", hideTooltip);

    // Axes
    const maxTicks = Math.max(4, Math.floor(width / 55));
    const tickInterval = Math.max(1, Math.ceil(allQuarters.length / maxTicks));
    const tickValues = allQuarters.filter(
      (_, i) => i % tickInterval === 0 || i === allQuarters.length - 1
    );

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(tickValues).tickSize(4))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-0.5em")
      .attr("dy", "0.25em");

    g.append("g")
      .attr("class", "axis")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) =>
        showEmissions
          ? `${d3.format(".2s")(d as number)}t`
          : `$${d3.format(".2s")(d as number)}`
      )
      );
  }, [memberData, allQuarters, containerWidth, showEmissions]);

  return (
    <>
    <div
      className="chart-container animate-fade-in"
      style={{ borderColor: "var(--border-active)" }}
    >
      <div className="chart-header">
        <div>
          <h3 className="chart-title">
            Member Comparison ({members.length})
          </h3>
          <p className="chart-subtitle">
            {showEmissions
              ? "Estimated quarterly CO₂e (tonnes) overlaid for selected members"
              : "Total quarterly spend overlaid for selected members"}
          </p>
        </div>
        <button
          onClick={onClearAll}
          className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-subtle)] cursor-pointer"
        >
          ✕ Clear All
        </button>
      </div>
      <div className="chart-body">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {memberData.map((m) => (
            <div
              key={m.name}
              className="flex items-center gap-2 text-xs group cursor-pointer"
              onClick={() => onRemoveMember(m.name)}
            >
              <span
                className="w-3 h-[3px] rounded-full"
                style={{ background: m.color }}
              />
              <span className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                {m.name}
              </span>
              <span
                className="font-mono text-[var(--text-muted)]"
                style={{
                  color:
                    PARTY_COLORS[m.party] || "var(--text-muted)",
                }}
              >
                {m.party}
              </span>
              <span className="font-mono text-[var(--text-muted)]">
                {showEmissions
                  ? `${d3.format(",.1f")(m.total)} t`
                  : `$${d3.format(",.0f")(m.total)}`}
              </span>
              <span className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                ✕
              </span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div ref={containerRef}>
          <svg ref={svgRef} />
        </div>
      </div>
    </div>
    <div ref={tooltipRef} className="chart-tooltip" style={{ opacity: 0 }} />
    </>
  );
}
