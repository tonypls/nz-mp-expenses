import { readFileSync } from "fs";
import { join } from "path";
import type { ExpenseData } from "./lib/types";
import Dashboard from "./components/Dashboard";

export default function Home() {
  // Load preprocessed data at build/request time (server component)
  const dataPath = join(process.cwd(), "public/data/expenses.json");
  const rawData = readFileSync(dataPath, "utf-8");
  const data: ExpenseData = JSON.parse(rawData);

  return <Dashboard data={data} />;
}
