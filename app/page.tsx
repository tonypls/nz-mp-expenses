import { readFileSync } from "fs";
import { join } from "path";
import type { ExpenseData } from "./lib/types";
import Dashboard from "./components/Dashboard";

export default function Home() {
  // Load preprocessed data at build/request time (server component)
  const dataPath = join(process.cwd(), "public/data/expenses.json");
  const rawData = readFileSync(dataPath, "utf-8");
  const data: ExpenseData = JSON.parse(rawData);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["Dataset", "WebApplication"],
    "name": "New Zealand Parliamentary Expenses Dataset",
    "description": "Quarterly returns of Members of Parliament and Ministers' expenses for transport and accommodation from 2008 to 2025.",
    "keywords": ["New Zealand", "Aotearoa", "Parliament", "MP expenses", "Accountability", "Open Data"],
    "creator": {
      "@type": "Organization",
      "name": "New Zealand Parliamentary Service & Department of Internal Affairs"
    },
    "spatialCoverage": {
      "@type": "Place",
      "name": "New Zealand"
    },
    "temporalCoverage": "2008-01-01/2025-12-31",
    "applicationCategory": "Dashboard",
    "operatingSystem": "All"
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Dashboard data={data} />
    </>
  );
}
