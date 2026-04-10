"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory, MemberInfo } from "../../lib/types";
import { PARTY_COLORS } from "../../lib/types";

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
}

export default function MemberCompareChart({
  records,
  categories,
  members,
  quarters,
  onRemoveMember,
  onClearAll,
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
      const sum = categories.reduce(
        (acc, cat) => acc + (r[cat] || 0),
        0
      );
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
  }, [records, categories, members, quarters]);

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

    // Draw lines for each member
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

      // Dots
      g.selectAll(`.dot-${member.name.replace(/\W/g, "")}`)
        .data(filteredData)
        .join("circle")
        .attr("cx", (d) => x(d.quarter) || 0)
        .attr("cy", (d) => y(d.value))
        .attr("r", 3.5)
        .attr("fill", member.color)
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 2)
        .on("mousemove", (event: MouseEvent, d) => {
          tooltip
            .style("opacity", 1)
            .style("left", `${event.clientX + 14}px`)
            .style("top", `${event.clientY - 14}px`)
            .html(
              `<div class="tooltip-title">${d.quarter}</div>
              <div class="tooltip-row">
                <span class="dot" style="background:${member.color}"></span>
                <span class="label">${member.name}</span>
                <span class="value">$${d3.format(",.0f")(d.value)}</span>
              </div>`
            );
        })
        .on("mouseleave", () => tooltip.style("opacity", 0));
    }

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
          .tickFormat((d) => `$${d3.format(".2s")(d as number)}`)
      );
  }, [memberData, allQuarters, containerWidth]);

  return (
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
            Total quarterly spend overlaid for selected members
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
                ${d3.format(",.0f")(m.total)}
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
      <div ref={tooltipRef} className="chart-tooltip" style={{ opacity: 0 }} />
    </div>
  );
}
