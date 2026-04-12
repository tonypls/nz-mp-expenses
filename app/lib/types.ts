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

// Source: Market Economics, "Consumption Emissions Modelling" (March 2023), prepared for Auckland Council.
// https://www.knowledgeauckland.org.nz/media/2593/consumption-emissions-modelling-market-economics-march-2023.pdf
// Factors are stored as kg CO2e per NZD (the display layer divides by 1000 to show tonnes).
export const EMISSION_FACTORS: Partial<Record<ExpenseCategory, number>> = {
  // Air travel (domestic & international): 0.00078778 t CO2e per NZD = 0.78778 kg CO2e per NZD
  domestic_air_travel: 0.78778,
  international_travel: 0.78778,
  // Surface travel: 0.00023017 t CO2e per NZD = 0.23017 kg CO2e per NZD
  surface_travel: 0.23017,
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
