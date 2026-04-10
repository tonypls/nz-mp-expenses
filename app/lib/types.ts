// Types for the NZ MP Expenses Dashboard

export interface ExpenseRecord {
  year: number;
  quarter: string;
  party: string;
  name: string;
  wellington_accommodation: number;
  other_accommodation: number;
  domestic_air_travel: number;
  surface_travel: number;
  international_travel: number;
  total: number;
  source: "mp" | "minister";
}

export interface MemberInfo {
  name: string;
  parties: string[];
  roles: string[];
  yearsActive: number[];
}

export interface ExpenseData {
  records: ExpenseRecord[];
  parties: string[];
  members: MemberInfo[];
  yearRange: [number, number];
  quarters: string[];
}

export type DataSourceFilter = "mp" | "minister" | "combined";

export type ExpenseCategory =
  | "wellington_accommodation"
  | "other_accommodation"
  | "domestic_air_travel"
  | "surface_travel"
  | "international_travel";

export const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  color: string;
}[] = [
  { key: "wellington_accommodation", label: "Wellington Accommodation", color: "var(--cat-wellington)" },
  { key: "other_accommodation", label: "Other Accommodation", color: "var(--cat-other-accom)" },
  { key: "domestic_air_travel", label: "Domestic Air Travel", color: "var(--cat-air)" },
  { key: "surface_travel", label: "Surface Travel", color: "var(--cat-surface)" },
  { key: "international_travel", label: "International Travel", color: "var(--cat-international)" },
];

export const PARTY_COLORS: Record<string, string> = {
  National: "var(--party-national)",
  Labour: "var(--party-labour)",
  Green: "var(--party-green)",
  ACT: "var(--party-act)",
  "NZ First": "var(--party-nzfirst)",
  "Te Pāti Māori": "var(--party-maori)",
  "United Future": "var(--party-united)",
  Mana: "var(--party-mana)",
  Progressive: "var(--party-progressive)",
  Independent: "var(--party-independent)",
};

export const EMISSION_FACTORS: Partial<Record<ExpenseCategory, number>> = {
  // kg CO2e per NZD spent
  // Domestic: MfE 2024 NZ domestic aviation factor (~0.151 kgCO2e/pkm) at avg NZ airfare of ~$0.30/km
  domestic_air_travel: 0.3,
  // Surface: weighted blend of rental vehicles, taxis, and public transit
  surface_travel: 0.1,
  // International: MfE 2024 long-haul factor (~0.113 kgCO2e/pkm) at avg NZ international airfare of ~$0.12/km
  international_travel: 0.4,
  // Accommodation categories omitted — no reliable spend-to-emission factor
};

export const ACCOMMODATION_CATEGORIES: ExpenseCategory[] = [
  "wellington_accommodation",
  "other_accommodation",
];

export interface FilterState {
  dataSource: DataSourceFilter;
  selectedParties: string[];
  selectedCategories: ExpenseCategory[];
  yearStart: number;
  yearEnd: number;
  selectedMembers: string[];
  showEmissions: boolean;
}
