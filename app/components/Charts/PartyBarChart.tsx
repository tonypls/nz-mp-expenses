"use client";

import { useRef, useEffect, useMemo, useState } from "react";
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
  const [containerWidth, setContainerWidth] = useState(0);
  const [mode, setMode] = useState<"perMember" | "total">("perMember");

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

  const chartData = useMemo(() => {
    const partyData = new Map<
      string,
      { total: number; memberCount: number; quarterRecords: number; perCapita: number }
    >();

    const membersByParty = new Map<string, Set<string>>();

    for (const r of records) {
      if (!parties.includes(r.party)) continue;
      const sum = categories.reduce(
        (acc, cat) => acc + (r[cat] || 0),
        0
      );

      if (!partyData.has(r.party)) {
        partyData.set(r.party, { total: 0, memberCount: 0, quarterRecords: 0, perCapita: 0 });
        membersByParty.set(r.party, new Set());
      }
      const d = partyData.get(r.party)!;
      d.total += sum;
      d.quarterRecords += 1;
      membersByParty.get(r.party)!.add(r.name);
    }

    // perCapita = avg spend per member per quarter
    for (const [party, data] of partyData) {
      data.memberCount = membersByParty.get(party)?.size || 1;
      data.perCapita = data.total / (data.quarterRecords || 1);
    }

    return [...partyData.entries()]
      .map(([party, data]) => ({ party, ...data }));
  }, [records, categories, parties]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || chartData.length === 0 || !containerWidth)
      return;

    const sorted = [...chartData].sort((a, b) =>
      mode === "total" ? b.total - a.total : b.perCapita - a.perCapita
    );
    const getValue = (d: (typeof sorted)[0]) =>
      mode === "total" ? d.total : d.perCapita;

    const width = containerWidth;
    const isMobile = width < 500;
    const barHeight = isMobile ? 26 : 32;
    const gap = 6;
    const height = Math.max(200, sorted.length * (barHeight + gap) + 40);
    const margin = {
      top: 8,
      right: isMobile ? 56 : 80,
      bottom: 8,
      left: isMobile ? 96 : 110,
    };
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

    const maxVal = d3.max(sorted, getValue) || 1;

    const x = d3
      .scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([0, innerWidth]);

    const y = d3
      .scaleBand<string>()
      .domain(sorted.map((d) => d.party))
      .range([0, sorted.length * (barHeight + gap)])
      .padding(0.15);

    const tooltip = d3.select(tooltipRef.current);

    // Bars
    g.selectAll(".bar")
      .data(sorted)
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
      .duration(500)
      .ease(d3.easeCubicOut)
      .attr("width", (d) => x(getValue(d)));

    // Party labels — truncate if narrow
    const maxLabelChars = isMobile ? 15 : 20;
    g.selectAll(".party-label")
      .data(sorted)
      .join("text")
      .attr("x", -8)
      .attr("y", (d) => (y(d.party) || 0) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("fill", "var(--text-secondary)")
      .style("font-size", isMobile ? "11px" : "12px")
      .style("font-weight", "500")
      .text((d) =>
        d.party.length > maxLabelChars
          ? d.party.slice(0, maxLabelChars - 1) + "…"
          : d.party
      );

    // Value labels
    g.selectAll(".value-label")
      .data(sorted)
      .join("text")
      .attr("x", (d) => x(getValue(d)) + 6)
      .attr("y", (d) => (y(d.party) || 0) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("fill", "var(--text-muted)")
      .style("font-size", isMobile ? "10px" : "11px")
      .style("font-family", "var(--font-geist-mono), monospace")
      .text((d) => `$${d3.format(".2s")(getValue(d))}`);

    // Hover
    g.selectAll(".bar-hover")
      .data(sorted)
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
            <div class="tooltip-row"><span class="label">Avg / Member / Qtr</span><span class="value" style="color:var(--accent-blue)">$${d3.format(",.0f")(d.perCapita)}</span></div>`
          );
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });
  }, [chartData, containerWidth, mode]);

  return (
    <>
      <div className="chart-container animate-fade-in stagger-3">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">Spending by Party</h3>
            <p className="chart-subtitle">
              {mode === "perMember"
                ? "Average spend per member per quarter"
                : "Total spend across all members in the selected period"}
            </p>
          </div>
          <div className="toggle-group" style={{ flexShrink: 0 }}>
            <button
              className={`toggle-btn ${mode === "perMember" ? "active" : ""}`}
              onClick={() => setMode("perMember")}
            >
              Avg / Quarter
            </button>
            <button
              className={`toggle-btn ${mode === "total" ? "active" : ""}`}
              onClick={() => setMode("total")}
            >
              Total
            </button>
          </div>
        </div>
        <div className="chart-body" ref={containerRef}>
          <svg ref={svgRef} />
        </div>
      </div>
      <div ref={tooltipRef} className="chart-tooltip" style={{ opacity: 0 }} />
    </>
  );
}
