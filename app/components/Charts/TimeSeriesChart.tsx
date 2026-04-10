"use client";

import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory } from "../../lib/types";
import { EXPENSE_CATEGORIES } from "../../lib/types";

interface TimeSeriesChartProps {
  records: ExpenseRecord[];
  categories: ExpenseCategory[];
  quarters: string[];
}

export default function TimeSeriesChart({
  records,
  categories,
  quarters,
}: TimeSeriesChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aggregate data by quarter × category
  const chartData = useMemo(() => {
    const qMap = new Map<string, Record<string, number>>();
    for (const q of quarters) {
      const row: Record<string, number> = {};
      for (const cat of EXPENSE_CATEGORIES) {
        row[cat.key] = 0;
      }
      qMap.set(q, row);
    }

    for (const r of records) {
      const key = `${r.year}-${r.quarter}`;
      const row = qMap.get(key);
      if (!row) continue;
      for (const cat of EXPENSE_CATEGORIES) {
        row[cat.key] += r[cat.key] || 0;
      }
    }

    return quarters
      .filter((q) => qMap.has(q))
      .map((q) => ({ ...qMap.get(q)!, quarter: q }));
  }, [records, quarters]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || chartData.length === 0)
      return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 340;
    const margin = { top: 12, right: 20, bottom: 40, left: 60 };
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

    // Scales
    const x = d3
      .scalePoint<string>()
      .domain(chartData.map((d) => d.quarter))
      .range([0, innerWidth])
      .padding(0.5);

    const activeCats = EXPENSE_CATEGORIES.filter((c) =>
      categories.includes(c.key)
    );

    const stack = d3
      .stack<Record<string, number>>()
      .keys(activeCats.map((c) => c.key))
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const series = stack(chartData as unknown as Record<string, number>[]);

    const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 0;

    const y = d3
      .scaleLinear()
      .domain([0, yMax * 1.05])
      .range([innerHeight, 0])
      .nice();

    // Grid
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => "")
      );

    // Area generator
    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x((d) => x((d.data as unknown as Record<string, string>).quarter) || 0)
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX);

    // Color map
    const colorMap = new Map<string, string>(
      EXPENSE_CATEGORIES.map((c) => [c.key as string, c.color])
    );

    // Draw areas
    g.selectAll(".area")
      .data(series)
      .join("path")
      .attr("class", "area")
      .attr("d", area)
      .attr("fill", (d) => colorMap.get(d.key) || "#666")
      .attr("opacity", 0.7)
      .attr("stroke", (d) => colorMap.get(d.key) || "#666")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.9);

    // X axis
    const tickInterval = Math.max(1, Math.floor(chartData.length / 12));
    const tickValues = chartData
      .map((d) => d.quarter)
      .filter(
        (_, i) => i % tickInterval === 0 || i === chartData.length - 1
      );

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickValues)
          .tickSize(4)
      )
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-0.5em")
      .attr("dy", "0.25em");

    // Y axis
    g.append("g")
      .attr("class", "axis")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `$${d3.format(".2s")(d as number)}`)
      );

    // Tooltip overlay
    const tooltip = d3.select(tooltipRef.current);

    const bisectQuarter = (mx: number): string => {
      const domain = x.domain();
      let closest = domain[0];
      let minDist = Infinity;
      for (const q of domain) {
        const dist = Math.abs((x(q) || 0) - mx);
        if (dist < minDist) {
          minDist = dist;
          closest = q;
        }
      }
      return closest;
    };

    // Hover rect
    g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const quarter = bisectQuarter(mx);
        const datum = chartData.find((d) => d.quarter === quarter);
        if (!datum) return;

        // Vertical line
        g.selectAll(".hover-line").remove();
        g.append("line")
          .attr("class", "hover-line")
          .attr("x1", x(quarter)!)
          .attr("x2", x(quarter)!)
          .attr("y1", 0)
          .attr("y2", innerHeight)
          .attr("stroke", "rgba(255,255,255,0.2)")
          .attr("stroke-dasharray", "3,3");

        // Tooltip
        const total = activeCats.reduce(
          (sum, cat) => sum + (((datum as unknown as Record<string, number>)[cat.key]) || 0),
          0
        );

        let html = `<div class="tooltip-title">${quarter}</div>`;
        for (const cat of activeCats) {
          const val = ((datum as unknown as Record<string, number>)[cat.key]) || 0;
          html += `<div class="tooltip-row">
            <span class="dot" style="background:${cat.color}"></span>
            <span class="label">${cat.label}</span>
            <span class="value">$${d3.format(",.0f")(val)}</span>
          </div>`;
        }
        html += `<div class="tooltip-row" style="border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;padding-top:4px">
          <span class="label" style="font-weight:600;color:var(--text-primary)">Total</span>
          <span class="value" style="color:var(--accent-blue)">$${d3.format(",.0f")(total)}</span>
        </div>`;

        tooltip
          .style("opacity", 1)
          .style("left", `${event.clientX + 16}px`)
          .style("top", `${event.clientY - 16}px`)
          .html(html);
      })
      .on("mouseleave", () => {
        g.selectAll(".hover-line").remove();
        tooltip.style("opacity", 0);
      });
  }, [chartData, categories]);

  return (
    <div className="chart-container animate-fade-in stagger-2">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Quarterly Spending Over Time</h3>
          <p className="chart-subtitle">
            Stacked area showing total spend by category across all selected
            members
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
