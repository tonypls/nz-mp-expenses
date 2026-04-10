"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  FilterState,
  DataSourceFilter,
  ExpenseCategory,
  MemberInfo,
} from "../lib/types";
import { EXPENSE_CATEGORIES, PARTY_COLORS } from "../lib/types";

interface FilterControlsProps {
  parties: string[];
  members: MemberInfo[];
  yearRange: [number, number];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
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
      const selected = filters.selectedParties.includes(party)
        ? filters.selectedParties.filter((p) => p !== party)
        : [...filters.selectedParties, party];
      onChange({ ...filters, selectedParties: selected });
    },
    [filters, onChange]
  );

  const toggleCategory = useCallback(
    (cat: ExpenseCategory) => {
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

  // Filter members for search
  const filteredMembers = searchQuery.trim()
    ? members
        .filter((m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 20)
    : [];

  const dataSources: { key: DataSourceFilter; label: string }[] = [
    { key: "mp", label: "MP" },
    { key: "minister", label: "Minister" },
    { key: "combined", label: "Combined" },
  ];

  return (
    <div className="filter-bar sticky top-0 z-40 px-4 py-3 md:px-6">
      <div className="max-w-[1600px] mx-auto space-y-3">
        {/* Row 1: Data source + Year range + Search */}
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          {/* Data Source */}
          <div>
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

          {/* Year Range */}
          <div className="flex-1 min-w-[200px] max-w-[360px]">
            <div className="filter-section-label">
              Time Range: {filters.yearStart} – {filters.yearEnd}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                className="range-slider flex-1"
                min={yearRange[0]}
                max={yearRange[1]}
                value={filters.yearStart}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    yearStart: Math.min(Number(e.target.value), filters.yearEnd),
                  })
                }
              />
              <input
                type="range"
                className="range-slider flex-1"
                min={yearRange[0]}
                max={yearRange[1]}
                value={filters.yearEnd}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    yearEnd: Math.max(Number(e.target.value), filters.yearStart),
                  })
                }
              />
            </div>
          </div>

          {/* Member Search */}
          <div className="relative min-w-[220px] flex-1 max-w-[460px]" ref={searchRef}>
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

        {/* Row 2: Parties + Categories */}
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          {/* Party filters */}
          <div className="flex-1">
            <div className="filter-section-label flex items-center gap-2">
              Parties
              <button
                onClick={selectAllParties}
                className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer font-normal normal-case tracking-normal"
              >
                All
              </button>
              <button
                onClick={deselectAllParties}
                className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer font-normal normal-case tracking-normal"
              >
                None
              </button>
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

          {/* Category toggles */}
          <div>
            <div className="filter-section-label">Expense Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map(({ key, label, color }) => {
                // Only show international if minister or combined
                if (
                  key === "international_travel" &&
                  filters.dataSource === "mp"
                )
                  return null;
                return (
                  <button
                    key={key}
                    className={`category-toggle ${filters.selectedCategories.includes(key) ? "active" : ""}`}
                    style={{ "--cat-color": color } as React.CSSProperties}
                    onClick={() => toggleCategory(key)}
                  >
                    <span className="bar" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
