"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory } from "../../lib/types";
import { PARTY_COLORS, EMISSION_FACTORS } from "../../lib/types";
import {
  PARLIAMENT_TERMS,
  TERM_ORDER,
  getTermId,
} from "../../lib/parliamentTerms";

interface PartyBarChartProps {
  records: ExpenseRecord[];
  categories: ExpenseCategory[];
  parties: string[];
  showEmissions?: boolean;
}

export default function PartyBarChart({
  records,
  categories,
  parties,
  showEmissions = false,
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
      {
        total: number;
        memberCount: number;
        quarterRecords: number;
        perCapita: number;
        avgMpsPerQuarter: number;
        mpsByTermQuarter: Map<string, Map<string, Set<string>>>;
        medianMpsByTerm: Map<string, number>;
        uniqueQuarters: Set<string>;
      }
    >();

    const membersByParty = new Map<string, Set<string>>();

    for (const r of records) {
      if (!parties.includes(r.party)) continue;
      const sum = categories.reduce((acc, cat) => {
        const raw = r[cat] || 0;
        return acc + (showEmissions ? raw * (EMISSION_FACTORS[cat] || 0) / 1000 : raw);
      }, 0);

      if (!partyData.has(r.party)) {
        partyData.set(r.party, {
          total: 0,
          memberCount: 0,
          quarterRecords: 0,
          perCapita: 0,
          avgMpsPerQuarter: 0,
          mpsByTermQuarter: new Map(),
          medianMpsByTerm: new Map(),
          uniqueQuarters: new Set(),
        });
        membersByParty.set(r.party, new Set());
      }
      const d = partyData.get(r.party)!;
      d.total += sum;
      d.quarterRecords += 1;
      d.uniqueQuarters.add(`${r.year}-${r.quarter}`);
      membersByParty.get(r.party)!.add(r.name);

      const term = getTermId(r.year, r.quarter as "Q1" | "Q2" | "Q3" | "Q4");
      const qKey = `${r.year}-${r.quarter}`;
      if (!d.mpsByTermQuarter.has(term)) d.mpsByTermQuarter.set(term, new Map());
      const termQuarters = d.mpsByTermQuarter.get(term)!;
      if (!termQuarters.has(qKey)) termQuarters.set(qKey, new Set());
      termQuarters.get(qKey)!.add(r.name);
    }

    for (const [party, data] of partyData) {
      data.memberCount = membersByParty.get(party)?.size || 1;
      data.perCapita = data.total / (data.quarterRecords || 1);
      data.avgMpsPerQuarter = data.quarterRecords / (data.uniqueQuarters.size || 1);

      for (const [term, quarters] of data.mpsByTermQuarter) {
        const counts = [...quarters.values()].map((s) => s.size).sort((a, b) => a - b);
        const mid = Math.floor(counts.length / 2);
        const median = counts.length % 2 === 0
          ? (counts[mid - 1] + counts[mid]) / 2
          : counts[mid];
        data.medianMpsByTerm.set(term, Math.round(median));
      }
    }

    return [...partyData.entries()].map(([party, data]) => ({ party, ...data }));
  }, [records, categories, parties, showEmissions]);

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
    const barHeight = isMobile ? 28 : 38;
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

    // Party name labels
    const maxLabelChars = isMobile ? 15 : 20;
    g.selectAll(".party-label")
      .data(sorted)
      .join("text")
      .attr("x", -8)
      .attr("y", (d) =>
        (y(d.party) || 0) + (isMobile ? y.bandwidth() / 2 : y.bandwidth() / 2 - 7)
      )
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

    // Sub-label: avg MPs per quarter (desktop only)
    if (!isMobile) {
      g.selectAll(".party-mp-count")
        .data(sorted)
        .join("text")
        .attr("x", -8)
        .attr("y", (d) => (y(d.party) || 0) + y.bandwidth() / 2 + 8)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", "var(--text-muted)")
        .style("font-size", "10px")
        .text((d) => `avg ${Math.round(d.avgMpsPerQuarter)} MPs`);
    }

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
      .text((d) =>
        showEmissions
          ? `${d3.format(".2s")(getValue(d))}t`
          : `$${d3.format(".2s")(getValue(d))}`
      );

    // Hover targets
    g.selectAll(".bar-hover")
      .data(sorted)
      .join("rect")
      .attr("x", -margin.left)
      .attr("y", (d) => y(d.party) || 0)
      .attr("width", width)
      .attr("height", y.bandwidth())
      .attr("fill", "transparent")
      .on("mousemove", (event: MouseEvent, d) => {
        const seatsRows = PARLIAMENT_TERMS.filter(
          (t) => (t.partyComposition[d.party] ?? 0) > 0
        )
          .map((t) => {
            const seats = t.partyComposition[d.party];
            return `<div class="tooltip-row"><span class="label">${t.id}</span><span class="value">${seats} seat${seats !== 1 ? "s" : ""}</span></div>`;
          })
          .join("");

        const recordsRows = TERM_ORDER.filter((term) => d.medianMpsByTerm.has(term))
          .map((term) => {
            const count = d.medianMpsByTerm.get(term)!;
            return `<div class="tooltip-row"><span class="label">${term}</span><span class="value">${count} MP${count !== 1 ? "s" : ""}</span></div>`;
          })
          .join("");

        const seatsSection = seatsRows
          ? `<div class="tooltip-divider">Seats won (official)</div>${seatsRows}`
          : "";
        const recordsSection = recordsRows
          ? `<div class="tooltip-divider">Median MPs per quarter</div>${recordsRows}`
          : "";
        const termSection = `${seatsSection}${recordsSection}`;

        tooltip
          .style("opacity", 1)
          .style("left", `${event.clientX + 16}px`)
          .style("top", `${event.clientY - 16}px`)
          .html(
            showEmissions
              ? `<div class="tooltip-title">${d.party}</div>
                <div class="tooltip-row"><span class="label">Total CO₂e</span><span class="value">${d3.format(",.1f")(d.total)} t</span></div>
                <div class="tooltip-row"><span class="label">Avg per MP / Qtr</span><span class="value" style="color:var(--accent-blue)">${d3.format(",.2f")(d.perCapita)} t</span></div>
                ${termSection}`
              : `<div class="tooltip-title">${d.party}</div>
                <div class="tooltip-row"><span class="label">Total Spend</span><span class="value">$${d3.format(",.0f")(d.total)}</span></div>
                <div class="tooltip-row"><span class="label">Avg per MP / Qtr</span><span class="value" style="color:var(--accent-blue)">$${d3.format(",.0f")(d.perCapita)}</span></div>
                ${termSection}`
          );
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });
  }, [chartData, containerWidth, mode, showEmissions]);

  return (
    <>
      <div className="chart-container animate-fade-in stagger-3">
        <div className="chart-header">
          <div>
            <h3 className="chart-title">
              {showEmissions ? "Emissions by Party" : "Spending by Party"}
            </h3>
            <p className="chart-subtitle">
              {showEmissions
                ? mode === "perMember"
                  ? "Average CO₂e per MP per quarter — normalised for party size"
                  : "Total estimated CO₂e across all members in the selected period"
                : mode === "perMember"
                  ? "Average spend per MP per quarter — normalised for party size"
                  : "Total spend across all members in the selected period"}
            </p>
          </div>
          <div className="toggle-group" style={{ flexShrink: 0 }}>
            <button
              className={`toggle-btn ${mode === "perMember" ? "active" : ""}`}
              onClick={() => setMode("perMember")}
            >
              Per MP / Qtr
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
