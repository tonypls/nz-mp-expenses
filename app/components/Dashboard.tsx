"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import * as d3 from "d3";
import type {
  ExpenseData,
  FilterState,
  ExpenseRecord,
  ExpenseCategory,
} from "../lib/types";
import { EXPENSE_CATEGORIES } from "../lib/types";
import FilterControls from "./FilterControls";
import TimeSeriesChart from "./Charts/TimeSeriesChart";
import PartyBarChart from "./Charts/PartyBarChart";
import TopSpendersChart from "./Charts/TopSpendersChart";
import MemberDetailChart from "./Charts/MemberDetailChart";
import MemberCompareChart from "./Charts/MemberCompareChart";

interface DashboardProps {
  data: ExpenseData;
}

export default function Dashboard({ data }: DashboardProps) {
  const [filters, setFilters] = useState<FilterState>({
    dataSource: "combined",
    selectedParties: [...data.parties],
    selectedCategories: EXPENSE_CATEGORIES.map((c) => c.key),
    yearStart: Math.max(data.yearRange[0], 2020),
    yearEnd: data.yearRange[1],
    selectedMembers: [],
  });

  // Apply filters to records — DON'T filter by selectedMembers here
  // so the aggregate charts still show full data context
  const filteredRecords = useMemo(() => {
    return data.records.filter((r: ExpenseRecord) => {
      // Data source filter
      if (filters.dataSource === "mp" && r.source !== "mp") return false;
      if (filters.dataSource === "minister" && r.source !== "minister")
        return false;

      // Party filter
      if (
        filters.selectedParties.length > 0 &&
        !filters.selectedParties.includes(r.party)
      )
        return false;

      // Year filter
      if (r.year < filters.yearStart || r.year > filters.yearEnd)
        return false;

      return true;
    });
  }, [data.records, filters]);

  // Filtered quarters for time series
  const filteredQuarters = useMemo(() => {
    return data.quarters.filter((q: string) => {
      const year = parseInt(q.split("-")[0]);
      return year >= filters.yearStart && year <= filters.yearEnd;
    });
  }, [data.quarters, filters.yearStart, filters.yearEnd]);

  // Stats
  const stats = useMemo(() => {
    const activeCategories = filters.selectedCategories;
    let totalSpend = 0;
    const memberQuarterCount = new Map<string, number>();
    const memberTotals = new Map<string, number>();

    for (const r of filteredRecords) {
      const sum = activeCategories.reduce(
        (acc: number, cat: ExpenseCategory) => acc + (r[cat] || 0),
        0
      );
      totalSpend += sum;

      if (!memberQuarterCount.has(r.name)) {
        memberQuarterCount.set(r.name, 0);
        memberTotals.set(r.name, 0);
      }
      memberQuarterCount.set(r.name, memberQuarterCount.get(r.name)! + 1);
      memberTotals.set(r.name, memberTotals.get(r.name)! + sum);
    }

    const memberCount = memberQuarterCount.size;
    const totalQuarterRecords = filteredRecords.length;
    const avgPerMemberPerQuarter =
      totalQuarterRecords > 0 ? totalSpend / totalQuarterRecords : 0;

    let highestSpender = { name: "—", total: 0 };
    for (const [name, total] of memberTotals) {
      if (total > highestSpender.total) {
        highestSpender = { name, total };
      }
    }

    return {
      totalSpend,
      avgPerMemberPerQuarter,
      highestSpender,
      memberCount,
    };
  }, [filteredRecords, filters.selectedCategories]);

  const handleSelectMember = useCallback((name: string) => {
    setFilters((prev) => {
      if (prev.selectedMembers.includes(name)) return prev;
      return { ...prev, selectedMembers: [...prev.selectedMembers, name] };
    });
  }, []);

  const handleRemoveMember = useCallback((name: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedMembers: prev.selectedMembers.filter((n) => n !== name),
    }));
  }, []);

  const handleClearMembers = useCallback(() => {
    setFilters((prev) => ({ ...prev, selectedMembers: [] }));
  }, []);

  const [shareLabel, setShareLabel] = useState<"share" | "copied">("share");
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const shareData = {
      title: "NZ Parliamentary Expenses",
      url,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setShareLabel("copied");
    if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    shareTimeoutRef.current = setTimeout(() => setShareLabel("share"), 2000);
  }, []);

  // Resolved member info objects for selected members
  const selectedMemberInfos = useMemo(
    () =>
      filters.selectedMembers
        .map((name) => data.members.find((m) => m.name === name))
        .filter(Boolean) as typeof data.members,
    [filters.selectedMembers, data.members]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="app-header px-4 py-4 md:px-6">
        <div className="max-w-screen-2xl mx-auto flex items-start justify-between gap-3">
          <div>
            <h1 className="header-title">NZ Parliamentary Expenses</h1>
            <p className="header-subtitle">
              Transport & accommodation spending transparency ·{" "}
              <span style={{ whiteSpace: "nowrap" }}>2008–2025</span>
            </p>
          </div>
          <button
            onClick={handleShare}
            className="share-btn"
            aria-label="Share this page"
          >
            {shareLabel === "copied" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Filters */}
      <FilterControls
        parties={data.parties}
        members={data.members}
        yearRange={data.yearRange}
        filters={filters}
        onChange={setFilters}
      />

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 md:px-6">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="stat-card animate-fade-in stagger-1">
              <div className="stat-value">
                ${d3.format(".3s")(stats.totalSpend)}
              </div>
              <div className="stat-label">Total Spend</div>
            </div>
            <div className="stat-card animate-fade-in stagger-2">
              <div className="stat-value">
                ${d3.format(",.0f")(stats.avgPerMemberPerQuarter)}
              </div>
              <div className="stat-label">Avg per Member / Quarter</div>
            </div>
            <div className="stat-card animate-fade-in stagger-3">
              <div className="stat-value">{stats.memberCount}</div>
              <div className="stat-label">Active Members</div>
            </div>
            <div className="stat-card animate-fade-in stagger-4">
              <div
                className="stat-value text-lg! font-semibold!"
                style={{
                  fontSize: "1.125rem",
                  background: "linear-gradient(135deg, var(--text-primary), var(--accent-amber))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {stats.highestSpender.name}
              </div>
              <div className="stat-label">
                Highest Spender ·{" "}
                ${d3.format(",.0f")(stats.highestSpender.total)}
              </div>
            </div>
          </div>

          {/* Single Member Detail (1 selected — timeline + donut) */}
          {selectedMemberInfos.length === 1 && (
            <MemberDetailChart
              records={filteredRecords}
              categories={filters.selectedCategories}
              member={selectedMemberInfos[0]}
              quarters={filteredQuarters}
              onClose={handleClearMembers}
            />
          )}

          {/* Multi-Member Comparison (2+ selected — overlaid lines) */}
          {selectedMemberInfos.length >= 2 && (
            <MemberCompareChart
              records={filteredRecords}
              categories={filters.selectedCategories}
              members={selectedMemberInfos}
              quarters={filteredQuarters}
              onRemoveMember={handleRemoveMember}
              onClearAll={handleClearMembers}
            />
          )}

          {/* Time Series */}
          <TimeSeriesChart
            records={filteredRecords}
            categories={filters.selectedCategories}
            quarters={filteredQuarters}
          />

          {/* Two Column: Party Bar + Top Spenders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PartyBarChart
              records={filteredRecords}
              categories={filters.selectedCategories}
              parties={filters.selectedParties}
            />
            <TopSpendersChart
              records={filteredRecords}
              categories={filters.selectedCategories}
              onSelectMember={handleSelectMember}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-4 md:px-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>
            Data sourced from New Zealand Parliamentary Service & Department of
            Internal Affairs
          </span>
          <span>
            {data.records.length.toLocaleString()} records ·{" "}
            {data.members.length} members
          </span>
        </div>
        <div className="max-w-screen-2xl mx-auto mt-2 text-xs text-[var(--text-muted)]">
          See a problem or want to help improve this site?{" "}
          <a
            href="https://github.com/tonypls/nz-mp-expenses"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--text-secondary)] transition-colors"
          >
            Visit us on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
