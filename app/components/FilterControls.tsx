"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type {
  FilterState,
  DataSourceFilter,
  ExpenseCategory,
  MemberInfo,
} from "../lib/types";
import { EXPENSE_CATEGORIES, PARTY_COLORS, EMISSION_FACTORS, ACCOMMODATION_CATEGORIES } from "../lib/types";

interface FilterControlsProps {
  parties: string[];
  members: MemberInfo[];
  yearRange: [number, number];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

/* ─── Dual-Thumb Range Slider ──────────────────────────────────────── */
function DualRangeSlider({
  min,
  max,
  valueStart,
  valueEnd,
  onChange,
}: {
  min: number;
  max: number;
  valueStart: number;
  valueEnd: number;
  onChange: (start: number, end: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | null>(null);

  const range = max - min || 1;
  const startPercent = ((valueStart - min) / range) * 100;
  const endPercent = ((valueEnd - min) / range) * 100;

  const getValueFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(min + pct * range);
    },
    [min, range]
  );

  const handlePointerDown = useCallback(
    (thumb: "start" | "end") => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      draggingRef.current = thumb;
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const val = getValueFromEvent(e.clientX);
      if (draggingRef.current === "start") {
        onChange(Math.min(val, valueEnd), valueEnd);
      } else {
        onChange(valueStart, Math.max(val, valueStart));
      }
    },
    [getValueFromEvent, onChange, valueStart, valueEnd]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  // Generate tick marks
  const ticks: number[] = [];
  const step = range <= 10 ? 1 : range <= 20 ? 2 : 5;
  for (let v = min; v <= max; v += step) {
    ticks.push(v);
  }
  const lastTick = ticks[ticks.length - 1];
  if (lastTick !== max && max - lastTick >= step) {
    ticks.push(max);
  }

  return (
    <div className="dual-range-wrapper">
      <div
        ref={trackRef}
        className="dual-range-track"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Inactive track */}
        <div className="dual-range-rail" />
        {/* Active range fill */}
        <div
          className="dual-range-fill"
          style={{
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
          }}
        />
        {/* Start thumb */}
        <div
          className="dual-range-thumb"
          style={{ left: `${startPercent}%`, zIndex: valueStart === valueEnd ? 3 : undefined }}
          onPointerDown={handlePointerDown("start")}
          role="slider"
          aria-label="Start year"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valueStart}
          tabIndex={0}
        >
          <span className="dual-range-thumb-label">{valueStart}</span>
        </div>
        {/* End thumb */}
        <div
          className="dual-range-thumb"
          style={{ left: `${endPercent}%` }}
          onPointerDown={handlePointerDown("end")}
          role="slider"
          aria-label="End year"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valueEnd}
          tabIndex={0}
        >
          <span className="dual-range-thumb-label">{valueEnd}</span>
        </div>
      </div>
      {/* Tick marks */}
      <div className="dual-range-ticks">
        {ticks.map((v) => (
          <span
            key={v}
            className="dual-range-tick"
            style={{ left: `${((v - min) / range) * 100}%` }}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Collapse Chevron Icon ──────────────────────────────────────── */
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.25s ease",
      }}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Filter Icon ────────────────────────────────────────────────── */
function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

/* ─── Emissions Info Tooltip ─────────────────────────────────────── */
const TRANSPORT_FACTORS: { key: string; label: string; color: string; factor: number }[] = [
  { key: "domestic_air_travel",  label: "Domestic Air Travel",  color: "var(--cat-air)",           factor: 0.30 },
  { key: "surface_travel",       label: "Surface Travel",       color: "var(--cat-surface)",        factor: 0.10 },
  { key: "international_travel", label: "International Travel", color: "var(--cat-international)", factor: 0.40 },
];

function EmissionsInfoTooltip() {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.top, left: r.left + r.width / 2 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-label="How emissions are estimated"
        style={{
          background: "none",
          border: "1px solid var(--border-subtle)",
          borderRadius: "50%",
          width: "14px",
          height: "14px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          color: "var(--text-muted)",
          fontSize: "9px",
          fontWeight: "700",
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {pos && createPortal(
        <div
          style={{
            position: "fixed",
            top: `${pos.top - 8}px`,
            left: `${pos.left}px`,
            transform: "translate(-50%, -100%)",
            zIndex: 9999,
            width: "280px",
            background: "var(--surface-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "var(--text-secondary)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            pointerEvents: "none",
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
            How emissions are estimated
          </p>
          <p style={{ marginBottom: "8px" }}>
            Transport spending is converted to estimated CO₂e using spend-based
            emission factors derived from NZ Ministry for the Environment 2024
            emission factors and average NZ transport costs:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "8px" }}>
            {TRANSPORT_FACTORS.map(({ key, label, color, factor }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{
                  width: "8px", height: "8px", borderRadius: "2px",
                  background: color, flexShrink: 0,
                }} />
                <span style={{ flex: 1, color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-geist-mono), monospace" }}>
                  {factor} kg CO₂e / NZD
                </span>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--text-muted)" }}>
            Accommodation is excluded — no reliable spend-to-emissions factor
            exists. Results are estimates only and shown in tonnes CO₂e (t).
          </p>
        </div>,
        document.body
      )}
    </span>
  );
}

export default function FilterControls({
  parties,
  members,
  yearRange,
  filters,
  onChange,
}: FilterControlsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const setDataSource = useCallback(
    (ds: DataSourceFilter) => onChange({ ...filters, dataSource: ds }),
    [filters, onChange]
  );

  const toggleParty = useCallback(
    (party: string) => {
      // All selected + click one → solo that party
      if (filters.selectedParties.length === parties.length) {
        onChange({ ...filters, selectedParties: [party] });
        return;
      }
      const selected = filters.selectedParties.includes(party)
        ? filters.selectedParties.filter((p) => p !== party)
        : [...filters.selectedParties, party];
      onChange({ ...filters, selectedParties: selected });
    },
    [filters, onChange, parties]
  );

  const toggleCategory = useCallback(
    (cat: ExpenseCategory) => {
      if (filters.selectedCategories.length === EXPENSE_CATEGORIES.length) {
        onChange({ ...filters, selectedCategories: [cat] });
        return;
      }
      const selected = filters.selectedCategories.includes(cat)
        ? filters.selectedCategories.filter((c) => c !== cat)
        : [...filters.selectedCategories, cat];
      onChange({ ...filters, selectedCategories: selected });
    },
    [filters, onChange]
  );

  const selectAllParties = useCallback(() => {
    onChange({ ...filters, selectedParties: [...parties] });
  }, [filters, onChange, parties]);

  const deselectAllParties = useCallback(() => {
    onChange({ ...filters, selectedParties: [] });
  }, [filters, onChange]);

  // Filter members for search (exclude already selected)
  const filteredMembers = searchQuery.trim()
    ? members
        .filter(
          (m) =>
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !filters.selectedMembers.includes(m.name)
        )
        .slice(0, 20)
    : [];

  const dataSources: { key: DataSourceFilter; label: string }[] = [
    { key: "mp", label: "MP" },
    { key: "minister", label: "Minister" },
    { key: "combined", label: "Combined" },
  ];

  // Active filter count for the collapsed badge
  const activeFilterCount =
    (filters.dataSource !== "combined" ? 1 : 0) +
    (filters.selectedParties.length !== parties.length
      ? 1
      : 0) +
    (filters.selectedCategories.length !== EXPENSE_CATEGORIES.length
      ? 1
      : 0) +
    (filters.yearStart !== yearRange[0] || filters.yearEnd !== yearRange[1]
      ? 1
      : 0) +
    filters.selectedMembers.length;

  return (
    <div className="filter-bar sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto">
        {/* ── Collapsible header (visible on mobile) ── */}
        <button
          className="filter-collapse-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="filter-panel"
        >
          <div className="filter-collapse-left">
            <FilterIcon />
            <span className="filter-collapse-title">Filters</span>
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </div>
          <ChevronIcon isOpen={isExpanded} />
        </button>

        {/* ── Filter panel body ── */}
        <div
          id="filter-panel"
          className={`filter-panel ${isExpanded ? "filter-panel--open" : ""}`}
        >
          <div className="filter-panel-inner">
            {/* Row 1: Data source + Year range + Search */}
            <div className="filter-row">
              {/* Data Source */}
              <div className="filter-group">
                <div className="filter-section-label">Data Source</div>
                <div className="toggle-group">
                  {dataSources.map(({ key, label }) => (
                    <button
                      key={key}
                      className={`toggle-btn ${filters.dataSource === key ? "active" : ""}`}
                      onClick={() => setDataSource(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year Range — Dual-thumb slider */}
              <div className="filter-group filter-group--range">
                <div className="filter-section-label">
                  Time Range: {filters.yearStart} – {filters.yearEnd}
                </div>
                <DualRangeSlider
                  min={yearRange[0]}
                  max={yearRange[1]}
                  valueStart={filters.yearStart}
                  valueEnd={filters.yearEnd}
                  onChange={(start, end) =>
                    onChange({ ...filters, yearStart: start, yearEnd: end })
                  }
                />
              </div>

              {/* Member Search */}
              <div
                className="filter-group filter-group--search"
                ref={searchRef}
              >
                <div className="filter-section-label flex items-center gap-2">
                  Compare Members
                  {filters.selectedMembers.length > 0 && (
                    <button
                      onClick={() => {
                        onChange({ ...filters, selectedMembers: [] });
                        setSearchQuery("");
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer font-normal normal-case tracking-normal"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {filters.selectedMembers.map((name) => (
                    <div key={name} className="selected-member-badge">
                      {name}
                      <button
                        onClick={() => {
                          onChange({
                            ...filters,
                            selectedMembers: filters.selectedMembers.filter(
                              (n) => n !== name
                            ),
                          });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  className="search-input"
                  placeholder={
                    filters.selectedMembers.length > 0
                      ? "Add another member..."
                      : "Search by name..."
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => searchQuery && setShowDropdown(true)}
                />
                {showDropdown && filteredMembers.length > 0 && (
                  <div className="search-dropdown">
                    {filteredMembers.map((m) => (
                      <div
                        key={m.name}
                        className="search-option"
                        onClick={() => {
                          if (!filters.selectedMembers.includes(m.name)) {
                            onChange({
                              ...filters,
                              selectedMembers: [
                                ...filters.selectedMembers,
                                m.name,
                              ],
                            });
                          }
                          setSearchQuery("");
                          setShowDropdown(false);
                        }}
                      >
                        <span>{m.name}</span>
                        <span
                          className="party-tag"
                          style={{
                            color:
                              PARTY_COLORS[m.parties[0]] || "var(--text-muted)",
                          }}
                        >
                          {m.parties[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Parties */}
            <div className="filter-row filter-row--parties">
              <div className="filter-group filter-group--full">
                <div className="filter-row-header">
                  <span className="filter-section-label" style={{ margin: 0 }}>
                    Parties
                    {filters.selectedParties.length !== parties.length && (
                      <span className="filter-section-count">
                        {filters.selectedParties.length}/{parties.length}
                      </span>
                    )}
                  </span>
                  <div className="filter-row-actions">
                    <button onClick={selectAllParties} className="filter-action-btn">
                      All
                    </button>
                    <button onClick={deselectAllParties} className="filter-action-btn">
                      None
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parties.map((party) => (
                    <button
                      key={party}
                      className={`party-chip ${filters.selectedParties.includes(party) ? "active" : ""}`}
                      style={
                        {
                          "--chip-color": PARTY_COLORS[party] || "var(--text-muted)",
                        } as React.CSSProperties
                      }
                      onClick={() => toggleParty(party)}
                    >
                      <span className="dot" />
                      {party}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Categories + Emissions Toggle */}
            <div className="filter-row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
              <div className="filter-group filter-group--full" style={{ flex: 1, minWidth: 0 }}>
                <div className="filter-section-label">Expense Categories</div>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map(({ key, label, color }) => {
                    const isAccommodation = ACCOMMODATION_CATEGORIES.includes(key);
                    const disabledByEmissions = filters.showEmissions && isAccommodation;
                    return (
                      <button
                        key={key}
                        className={`category-toggle ${filters.selectedCategories.includes(key) && !disabledByEmissions ? "active" : ""}`}
                        style={{
                          "--cat-color": color,
                          opacity: disabledByEmissions ? 0.35 : 1,
                          cursor: disabledByEmissions ? "not-allowed" : undefined,
                        } as React.CSSProperties}
                        onClick={() => !disabledByEmissions && toggleCategory(key)}
                        title={disabledByEmissions ? "Accommodation has no emissions factor" : undefined}
                      >
                        <span className="bar" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Emissions toggle */}
              <div className="filter-group" style={{ flexShrink: 0 }}>
                <div className="filter-section-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  View
                  <EmissionsInfoTooltip />
                </div>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${!filters.showEmissions ? "active" : ""}`}
                    onClick={() => onChange({ ...filters, showEmissions: false })}
                  >
                    Spending
                  </button>
                  <button
                    className={`toggle-btn ${filters.showEmissions ? "active" : ""}`}
                    onClick={() => onChange({ ...filters, showEmissions: true })}
                  >
                    Emissions
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
