"use client";

import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory, MemberInfo } from "../../lib/types";
import { EXPENSE_CATEGORIES, PARTY_COLORS } from "../../lib/types";

interface MemberDetailChartProps {
  records: ExpenseRecord[];
  categories: ExpenseCategory[];
  member: MemberInfo;
  quarters: string[];
  onClose: () => void;
}

export default function MemberDetailChart({
  records,
  categories,
  member,
  quarters,
  onClose,
}: MemberDetailChartProps) {
  const lineRef = useRef<SVGSVGElement>(null);
  const donutRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Filter records for this member
  const memberRecords = useMemo(
    () => records.filter((r) => r.name === member.name),
    [records, member.name]
  );

  // Timeline data
  const timelineData = useMemo(() => {
    const qMap = new Map<string, Record<string, number>>();
    for (const r of memberRecords) {
      const key = `${r.year}-${r.quarter}`;
      if (!qMap.has(key)) {
        const row: Record<string, number> = {};
        for (const cat of EXPENSE_CATEGORIES) {
          row[cat.key] = 0;
        }
        qMap.set(key, row);
      }
      const row = qMap.get(key)!;
      for (const cat of EXPENSE_CATEGORIES) {
        row[cat.key] += r[cat.key] || 0;
      }
    }
    return quarters
      .filter((q) => qMap.has(q))
      .map((q) => ({ quarter: q, ...qMap.get(q)! }));
  }, [memberRecords, quarters]);

  // Category totals for donut
  const categoryTotals = useMemo(() => {
    const totals: { key: string; label: string; color: string; value: number }[] = [];
    for (const cat of EXPENSE_CATEGORIES) {
      if (!categories.includes(cat.key)) continue;
      const val = memberRecords.reduce((sum, r) => sum + (r[cat.key] || 0), 0);
      if (val > 0) {
        totals.push({ key: cat.key, label: cat.label, color: cat.color, value: val });
      }
    }
    return totals;
  }, [memberRecords, categories]);

  const grandTotal = categoryTotals.reduce((s, c) => s + c.value, 0);

  // Draw timeline
  useEffect(() => {
    if (!lineRef.current || !containerRef.current || timelineData.length === 0)
      return;

    const width = containerRef.current.clientWidth;
    const height = 220;
    const margin = { top: 12, right: 16, bottom: 36, left: 56 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(lineRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("class", "chart-svg");

    svg.selectAll("*").remove();
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scalePoint<string>()
      .domain(timelineData.map((d) => d.quarter))
      .range([0, innerWidth])
      .padding(0.5);

    const activeCats = EXPENSE_CATEGORIES.filter((c) =>
      categories.includes(c.key)
    );

    const allVals = timelineData.flatMap((d) =>
      activeCats.map((c) => ((d as unknown as Record<string, number>)[c.key]) || 0)
    );
    const yMax = d3.max(allVals) || 0;

    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([innerHeight, 0])
      .nice();

    // Grid
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y).ticks(4).tickSize(-innerWidth).tickFormat(() => "")
      );

    // Lines
    const tooltip = d3.select(tooltipRef.current);

    for (const cat of activeCats) {
      const line = d3
        .line<Record<string, number | string>>()
        .x((d) => x(d.quarter as string) || 0)
        .y((d) => y((d[cat.key] as number) || 0))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timelineData)
        .attr("fill", "none")
        .attr("stroke", cat.color)
        .attr("stroke-width", 2)
        .attr("d", line as unknown as string);

      // Dots
      g.selectAll(`.dot-${cat.key}`)
        .data(timelineData)
        .join("circle")
        .attr("cx", (d) => x(d.quarter) || 0)
        .attr("cy", (d) => y(((d as unknown as Record<string, number>)[cat.key]) || 0))
        .attr("r", 3)
        .attr("fill", cat.color)
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 1.5)
        .on("mousemove", (event: MouseEvent, d) => {
          const val = ((d as unknown as Record<string, number>)[cat.key]) || 0;
          tooltip
            .style("opacity", 1)
            .style("left", `${event.clientX + 12}px`)
            .style("top", `${event.clientY - 12}px`)
            .html(
              `<div class="tooltip-title">${d.quarter}</div>
              <div class="tooltip-row">
                <span class="dot" style="background:${cat.color}"></span>
                <span class="label">${cat.label}</span>
                <span class="value">$${d3.format(",.0f")(val)}</span>
              </div>`
            );
        })
        .on("mouseleave", () => tooltip.style("opacity", 0));
    }

    // Axes
    const tickInterval = Math.max(1, Math.floor(timelineData.length / 8));
    const tickValues = timelineData
      .map((d) => d.quarter)
      .filter((_, i) => i % tickInterval === 0);

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
          .ticks(4)
          .tickFormat((d) => `$${d3.format(".2s")(d as number)}`)
      );
  }, [timelineData, categories]);

  // Draw donut
  useEffect(() => {
    if (!donutRef.current || categoryTotals.length === 0) return;

    const size = 200;
    const radius = size / 2;
    const innerRadius = radius * 0.6;

    const svg = d3
      .select(donutRef.current)
      .attr("width", size)
      .attr("height", size)
      .attr("class", "chart-svg");

    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${radius},${radius})`);

    const pie = d3
      .pie<(typeof categoryTotals)[0]>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<(typeof categoryTotals)[0]>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 4)
      .padAngle(0.02)
      .cornerRadius(3);

    g.selectAll("path")
      .data(pie(categoryTotals))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      .attr("opacity", 0.85)
      .attr("stroke", "var(--bg-card)")
      .attr("stroke-width", 2);

    // Center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "var(--text-primary)")
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("font-family", "var(--font-geist-mono), monospace")
      .text(`$${d3.format(".3s")(grandTotal)}`);
  }, [categoryTotals, grandTotal]);

  return (
    <div className="chart-container animate-fade-in" style={{ borderColor: "var(--border-active)" }}>
      <div className="chart-header">
        <div>
          <h3 className="chart-title">{member.name}</h3>
          <p className="chart-subtitle">
            {member.parties.join(", ")} · {member.roles.map(r => r === "mp" ? "MP" : "Minister").join(" & ")} · {member.yearsActive[0]}–{member.yearsActive[member.yearsActive.length - 1]}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-subtle)] cursor-pointer"
        >
          ✕ Close
        </button>
      </div>
      <div className="chart-body">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Timeline */}
          <div className="flex-1 w-full" ref={containerRef}>
            <p className="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider font-semibold">
              Spending Timeline
            </p>
            <svg ref={lineRef} />
          </div>

          {/* Donut + Legend */}
          <div className="flex flex-col items-center gap-3 min-w-[220px]">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              Category Breakdown
            </p>
            <svg ref={donutRef} />
            <div className="space-y-1.5">
              {categoryTotals.map((cat) => (
                <div key={cat.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: cat.color }}
                  />
                  <span className="text-[var(--text-secondary)] flex-1">
                    {cat.label}
                  </span>
                  <span className="font-mono text-[var(--text-muted)]">
                    {((cat.value / grandTotal) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div ref={tooltipRef} className="chart-tooltip" style={{ opacity: 0 }} />
    </div>
  );
}
