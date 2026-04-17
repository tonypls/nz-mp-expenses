export interface ParliamentTerm {
  id: string;
  parliamentNumber: number;
  electionDate: string;
  electionYear: number;
  totalSeats: number;
  partyComposition: Record<string, number>;
}

export const PARLIAMENT_TERMS: ParliamentTerm[] = [
  {
    id: "2008-11",
    parliamentNumber: 49,
    electionDate: "2008-11-08",
    electionYear: 2008,
    totalSeats: 122,
    partyComposition: {
      National: 58,
      Labour: 43,
      Green: 9,
      ACT: 5,
      "Te Pāti Māori": 5,
      Progressive: 1,
      "United Future": 1,
    },
  },
  {
    id: "2011-14",
    parliamentNumber: 50,
    electionDate: "2011-11-26",
    electionYear: 2011,
    totalSeats: 121,
    partyComposition: {
      National: 59,
      Labour: 34,
      Green: 14,
      "NZ First": 8,
      "Te Pāti Māori": 3,
      Mana: 1,
      ACT: 1,
      "United Future": 1,
    },
  },
  {
    id: "2014-17",
    parliamentNumber: 51,
    electionDate: "2014-09-20",
    electionYear: 2014,
    totalSeats: 121,
    partyComposition: {
      National: 60,
      Labour: 32,
      Green: 14,
      "NZ First": 11,
      "Te Pāti Māori": 2,
      ACT: 1,
      "United Future": 1,
    },
  },
  {
    id: "2017-20",
    parliamentNumber: 52,
    electionDate: "2017-09-23",
    electionYear: 2017,
    totalSeats: 120,
    partyComposition: {
      National: 56,
      Labour: 46,
      "NZ First": 9,
      Green: 8,
      ACT: 1,
    },
  },
  {
    id: "2020-23",
    parliamentNumber: 53,
    electionDate: "2020-10-17",
    electionYear: 2020,
    totalSeats: 120,
    partyComposition: {
      Labour: 65,
      National: 33,
      Green: 10,
      ACT: 10,
      "Te Pāti Māori": 2,
    },
  },
  {
    id: "2023-",
    parliamentNumber: 54,
    electionDate: "2023-10-14",
    electionYear: 2023,
    totalSeats: 123,
    partyComposition: {
      National: 49,
      Labour: 34,
      Green: 15,
      ACT: 11,
      "NZ First": 8,
      "Te Pāti Māori": 6,
    },
  },
];

export const TERM_ORDER: string[] = PARLIAMENT_TERMS.map((t) => t.id);

// Q4 of an election year belongs to the new parliament, since every NZ
// general election since 2008 has been held in Q3 or Q4.
export function getTermId(year: number, quarter: "Q1" | "Q2" | "Q3" | "Q4"): string {
  for (let i = PARLIAMENT_TERMS.length - 1; i >= 0; i--) {
    const term = PARLIAMENT_TERMS[i];
    if (year > term.electionYear) return term.id;
    if (year === term.electionYear && quarter === "Q4") return term.id;
  }
  return PARLIAMENT_TERMS[0].id;
}
