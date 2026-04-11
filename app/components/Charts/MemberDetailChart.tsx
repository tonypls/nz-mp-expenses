"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory, MemberInfo } from "../../lib/types";
import { EXPENSE_CATEGORIES, PARTY_COLORS, EMISSION_FACTORS } from "../../lib/types";

interface MemberDetailChartProps {
  records: ExpenseRecord[];
  categories: ExpenseCategory[];
  member: MemberInfo;
  quarters: string[];
  onClose: () => void;
  showEmissions?: boolean;
}

export default function MemberDetailChart({
  records,
  categories,
  member,
  quarters,
  onClose,
  showEmissions = false,
}: MemberDetailChartProps) {
  const lineRef = useRef<SVGSVGElement>(null);
  const donutRef = useRef<SVGSVGElement>(null);
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
      const rawVal = memberRecords.reduce((sum, r) => sum + (r[cat.key] || 0), 0);
      const val = showEmissions
        ? rawVal * (EMISSION_FACTORS[cat.key] || 0) / 1000
        : rawVal;
      if (val > 0) {
        totals.push({ key: cat.key, label: cat.label, color: cat.color, value: val });
      }
    }
    return totals;
  }, [memberRecords, categories, showEmissions]);

  const grandTotal = categoryTotals.reduce((s, c) => s + c.value, 0);

  // Draw timeline
  useEffect(() => {
    if (!lineRef.current || !containerRef.current || timelineData.length === 0 || !containerWidth)
      return;

    const width = containerWidth;
    const isMobile = width < 400;
    const height = isMobile ? 180 : 220;
    const margin = {
      top: 12,
      right: isMobile ? 8 : 16,
      bottom: isMobile ? 40 : 36,
      left: isMobile ? 44 : 56,
    };
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

    const toDisplayVal = (raw: number, catKey: string) =>
      showEmissions ? raw * (EMISSION_FACTORS[catKey as keyof typeof EMISSION_FACTORS] || 0) / 1000 : raw;

    const allVals = timelineData.flatMap((d) =>
      activeCats.map((c) => toDisplayVal(((d as unknown as Record<string, number>)[c.key]) || 0, c.key))
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

    // Lines + dots (no per-dot tooltip — handled by hover overlay below)
    const tooltip = d3.select(tooltipRef.current);

    for (const cat of activeCats) {
      const line = d3
        .line<Record<string, number | string>>()
        .x((d) => x(d.quarter as string) || 0)
        .y((d) => y(toDisplayVal((d[cat.key] as number) || 0, cat.key)))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(timelineData)
        .attr("fill", "none")
        .attr("stroke", cat.color)
        .attr("stroke-width", 2)
        .attr("d", line as unknown as string);

      g.selectAll(`.dot-${cat.key}`)
        .data(timelineData)
        .join("circle")
        .attr("cx", (d) => x(d.quarter) || 0)
        .attr("cy", (d) => y(toDisplayVal(((d as unknown as Record<string, number>)[cat.key]) || 0, cat.key)))
        .attr("r", 3)
        .attr("fill", cat.color)
        .attr("stroke", "var(--bg-card)")
        .attr("stroke-width", 1.5)
        .style("pointer-events", "none");
    }

    // Hover overlay — snaps to nearest quarter, shows all categories
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
      const datum = timelineData.find((d) => d.quarter === quarter);
      if (!datum) return;

      g.selectAll(".hover-line").remove();
      g.append("line")
        .attr("class", "hover-line")
        .attr("x1", x(quarter)!).attr("x2", x(quarter)!)
        .attr("y1", 0).attr("y2", innerHeight)
        .attr("stroke", "rgba(255,255,255,0.2)")
        .attr("stroke-dasharray", "3,3");

      const fmt = (v: number) => showEmissions ? `${d3.format(",.2f")(v)} t` : `$${d3.format(",.0f")(v)}`;
      const total = activeCats.reduce((s, c) => s + toDisplayVal(((datum as unknown as Record<string, number>)[c.key]) || 0, c.key), 0);

      let html = `<div class="tooltip-title">${quarter}</div>`;
      for (const cat of activeCats) {
        const val = toDisplayVal(((datum as unknown as Record<string, number>)[cat.key]) || 0, cat.key);
        html += `<div class="tooltip-row">
          <span class="dot" style="background:${cat.color}"></span>
          <span class="label">${cat.label}</span>
          <span class="value">${fmt(val)}</span>
        </div>`;
      }
      html += `<div class="tooltip-row" style="border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;padding-top:4px">
        <span class="label" style="font-weight:600;color:var(--text-primary)">Total</span>
        <span class="value" style="color:var(--accent-blue)">${fmt(total)}</span>
      </div>`;

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
        if (!t || !lineRef.current) return;
        const rect = lineRef.current.getBoundingClientRect();
        showTooltip(t.clientX, t.clientY, t.clientX - rect.left - margin.left);
      })
      .on("touchmove", (event: TouchEvent) => {
        event.preventDefault();
        const t = event.touches[0];
        if (!t || !lineRef.current) return;
        const rect = lineRef.current.getBoundingClientRect();
        showTooltip(t.clientX, t.clientY, t.clientX - rect.left - margin.left);
      })
      .on("touchend", hideTooltip)
      .on("touchcancel", hideTooltip);

    // Axes
    const maxTicks = Math.max(3, Math.floor(width / 60));
    const tickInterval = Math.max(1, Math.ceil(timelineData.length / maxTicks));
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
          .tickFormat((d) =>
            showEmissions
              ? `${d3.format(".2s")(d as number)}t`
              : `$${d3.format(".2s")(d as number)}`
          )
      );
  }, [timelineData, categories, containerWidth, showEmissions]);

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

    const donutTooltip = d3.select(tooltipRef.current);
    const fmt = (v: number) => showEmissions ? `${d3.format(",.2f")(v)} t` : `$${d3.format(",.0f")(v)}`;

    g.selectAll("path")
      .data(pie(categoryTotals))
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      .attr("opacity", 0.85)
      .attr("stroke", "var(--bg-card)")
      .attr("stroke-width", 2)
      .style("cursor", "default")
      .on("mousemove", (event: MouseEvent, d) => {
        const pct = ((d.data.value / grandTotal) * 100).toFixed(1);
        donutTooltip
          .style("opacity", 1)
          .html(
            `<div class="tooltip-row">
              <span class="dot" style="background:${d.data.color}"></span>
              <span class="label">${d.data.label}</span>
              <span class="value">${fmt(d.data.value)}</span>
            </div>
            <div class="tooltip-row" style="margin-top:2px">
              <span class="label" style="color:var(--text-muted)">Share</span>
              <span class="value" style="color:var(--accent-blue)">${pct}%</span>
            </div>`
          );
        const el = tooltipRef.current!;
        const left = Math.min(event.clientX + 16, window.innerWidth - el.offsetWidth - 8);
        const top = event.clientY - el.offsetHeight - 8 >= 0 ? event.clientY - el.offsetHeight - 8 : event.clientY + 16;
        donutTooltip.style("left", `${left}px`).style("top", `${top}px`);
      })
      .on("mouseleave", () => donutTooltip.style("opacity", 0));

    // Center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "var(--text-primary)")
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("font-family", "var(--font-geist-mono), monospace")
      .text(
        showEmissions
          ? `${d3.format(".2s")(grandTotal)}t`
          : `$${d3.format(".3s")(grandTotal)}`
      );
  }, [categoryTotals, grandTotal, showEmissions]);

  return (
    <>
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
              {showEmissions ? "Emissions Timeline" : "Spending Timeline"}
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
    </div>
    <div ref={tooltipRef} className="chart-tooltip" style={{ opacity: 0 }} />
    </>
  );
}
