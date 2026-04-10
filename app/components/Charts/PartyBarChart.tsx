"use client";

import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory } from "../../lib/types";
import { PARTY_COLORS } from "../../lib/types";

interface PartyBarChartProps {
  records: ExpenseRecord[];
  categories: ExpenseCategory[];
  parties: string[];
}

export default function PartyBarChart({
  records,
  categories,
  parties,
}: PartyBarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    const partyData = new Map<
      string,
      { total: number; memberCount: number; perCapita: number }
    >();

    // Get unique member-quarter combos per party for proper per-capita
    const membersByParty = new Map<string, Set<string>>();

    for (const r of records) {
      if (!parties.includes(r.party)) continue;
      const sum = categories.reduce(
        (acc, cat) => acc + (r[cat] || 0),
        0
      );

      if (!partyData.has(r.party)) {
        partyData.set(r.party, { total: 0, memberCount: 0, perCapita: 0 });
        membersByParty.set(r.party, new Set());
      }
      partyData.get(r.party)!.total += sum;
      membersByParty.get(r.party)!.add(r.name);
    }

    // Calculate per-capita
    for (const [party, data] of partyData) {
      data.memberCount = membersByParty.get(party)?.size || 1;
      data.perCapita = data.total / data.memberCount;
    }

    return [...partyData.entries()]
      .map(([party, data]) => ({ party, ...data }))
      .sort((a, b) => b.perCapita - a.perCapita);
  }, [records, categories, parties]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || chartData.length === 0)
      return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const barHeight = 32;
    const gap = 6;
    const height = Math.max(
      200,
      chartData.length * (barHeight + gap) + 40
    );
    const margin = { top: 8, right: 80, bottom: 8, left: 110 };
    const innerWidth = width - margin.left - margin.right;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("class", "chart-svg");

    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const maxVal = d3.max(chartData, (d) => d.perCapita) || 1;

    const x = d3
      .scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([0, innerWidth]);

    const y = d3
      .scaleBand<string>()
      .domain(chartData.map((d) => d.party))
      .range([0, chartData.length * (barHeight + gap)])
      .padding(0.15);

    const tooltip = d3.select(tooltipRef.current);

    // Bars
    g.selectAll(".bar")
      .data(chartData)
      .join("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", (d) => y(d.party) || 0)
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", (d) => PARTY_COLORS[d.party] || "#666")
      .attr("opacity", 0.85)
      .attr("width", 0)
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr("width", (d) => x(d.perCapita));

    // Party labels
    g.selectAll(".party-label")
      .data(chartData)
      .join("text")
      .attr("x", -8)
      .attr("y", (d) => (y(d.party) || 0) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("fill", "var(--text-secondary)")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text((d) => d.party);

    // Value labels
    g.selectAll(".value-label")
      .data(chartData)
      .join("text")
      .attr("x", (d) => x(d.perCapita) + 8)
      .attr("y", (d) => (y(d.party) || 0) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("fill", "var(--text-muted)")
      .style("font-size", "11px")
      .style("font-family", "var(--font-geist-mono), monospace")
      .text((d) => `$${d3.format(",.0f")(d.perCapita)}`);

    // Hover
    g.selectAll(".bar-hover")
      .data(chartData)
      .join("rect")
      .attr("x", -margin.left)
      .attr("y", (d) => y(d.party) || 0)
      .attr("width", width)
      .attr("height", y.bandwidth())
      .attr("fill", "transparent")
      .on("mousemove", (event: MouseEvent, d) => {
        tooltip
          .style("opacity", 1)
          .style("left", `${event.clientX + 16}px`)
          .style("top", `${event.clientY - 16}px`)
          .html(
            `<div class="tooltip-title">${d.party}</div>
            <div class="tooltip-row"><span class="label">Total Spend</span><span class="value">$${d3.format(",.0f")(d.total)}</span></div>
            <div class="tooltip-row"><span class="label">Members</span><span class="value">${d.memberCount}</span></div>
            <div class="tooltip-row"><span class="label">Per Member</span><span class="value" style="color:var(--accent-blue)">$${d3.format(",.0f")(d.perCapita)}</span></div>`
          );
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });
  }, [chartData]);

  return (
    <div className="chart-container animate-fade-in stagger-3">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Spending by Party</h3>
          <p className="chart-subtitle">
            Average total spend per member (normalized for party size)
          </p>
        </div>
      </div>
      <div className="chart-body" ref={containerRef}>
        <svg ref={svgRef} />
      </div>
      <div ref={tooltipRef} className="chart-tooltip" style={{ opacity: 0 }} />
    </div>
  );
}
