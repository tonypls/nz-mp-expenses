const fs = require('fs');
const path = require('path');

const filePath = '/Users/tvs/.gemini/antigravity/brain/24b18550-46af-47af-9b36-e4510ba6e649/browser/scratchpad_ofjxziwn.md';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
const jsonLine = lines.find(line => line.startsWith('[{"filename"'));

if (!jsonLine) {
  console.error("Could not find JSON structure");
  process.exit(1);
}

const data = JSON.parse(jsonLine);

for (const item of data) {
  const outPath = path.join(__dirname, 'expenses', item.filename);
  fs.writeFileSync(outPath, item.csv);
  console.log(`Saved ${item.filename}`);
}

console.log("All legacy CSV files saved!");
