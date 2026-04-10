"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import type { ExpenseRecord, ExpenseCategory } from "../../lib/types";
import { PARTY_COLORS } from "../../lib/types";

interface TopSpendersChartProps {
  records: ExpenseRecord[];
  categories: ExpenseCategory[];
  selectedMembers: string[];
  onSelectMember: (name: string) => void;
}

export default function TopSpendersChart({
  records,
  categories,
  selectedMembers,
  onSelectMember,
}: TopSpendersChartProps) {
  const topSpenders = useMemo(() => {
    const memberTotals = new Map<
      string,
      { total: number; party: string; quarters: number }
    >();

    for (const r of records) {
      const sum = categories.reduce(
        (acc, cat) => acc + (r[cat] || 0),
        0
      );
      if (!memberTotals.has(r.name)) {
        memberTotals.set(r.name, { total: 0, party: r.party, quarters: 0 });
      }
      const m = memberTotals.get(r.name)!;
      m.total += sum;
      m.quarters += 1;
      // Use most recent party
      m.party = r.party;
    }

    return [...memberTotals.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 25);
  }, [records, categories]);

  const maxTotal = topSpenders[0]?.total || 1;

  return (
    <div className="chart-container animate-fade-in stagger-4">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Top Spenders</h3>
          <p className="chart-subtitle">
            Highest total spend in selected period and filters. Click to view
            details.
          </p>
        </div>
      </div>
      <div className="chart-body">
        <div className="space-y-0.5">
          {topSpenders.map((s, i) => (
            <div
              key={s.name}
              className={`spender-row${selectedMembers.includes(s.name) ? " spender-row--selected" : ""}`}
              onClick={() => onSelectMember(s.name)}
            >
              <span className="spender-rank">{i + 1}</span>
              <span className="spender-name">
                {s.name}
                <span className="party-tag" style={{ color: PARTY_COLORS[s.party] || "var(--text-muted)" }}>{s.party}</span>
              </span>
              <div className="spender-bar-container">
                <div
                  className="spender-bar"
                  style={{
                    width: `${(s.total / maxTotal) * 100}%`,
                    background: `linear-gradient(90deg, ${PARTY_COLORS[s.party] || "var(--accent-blue)"}, ${PARTY_COLORS[s.party] || "var(--accent-cyan)"}88)`,
                  }}
                />
              </div>
              <span className="spender-amount">
                ${d3.format(",.0f")(s.total)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
