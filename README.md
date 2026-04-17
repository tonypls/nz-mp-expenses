# NZ Parliamentary Expenses

An interactive transparency dashboard for New Zealand Members of Parliament and Ministers' expense data, covering quarterly returns from 2008 onwards.

**Live site:** https://mpexpenses.nz

## About

This project visualises publicly available expense data from the New Zealand Parliamentary Service and Department of Internal Affairs. It is an **apolitical project** — the goal is simply to make public accountability data easier to explore and understand. No editorial judgement is made about any individual, party, or policy.

The data covers transport and accommodation expenses claimed by MPs and Ministers. By presenting it visually and interactively, we hope to lower the barrier for journalists, researchers, and members of the public who want to engage with this information.

## Contributing

Contributions are welcome. There are two main ways to help:

**Improve the visualisation**
- Open a pull request with UI improvements, new chart types, better filtering, or accessibility fixes
- Report bugs or suggest features via [GitHub Issues](https://github.com/tonypls/nz-mp-expenses/issues)

**Improve data quality**
- If you spot missing records, incorrect figures, or data formatting issues, please [open an issue](https://github.com/tonypls/nz-mp-expenses/issues) describing the problem and linking to the source if possible
- Corrections to party affiliations, name variations, or date ranges are especially valuable

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

```bash
npm run build   # produces static export in /out
```

## Data Sources

- [New Zealand Parliamentary Service](https://www.parliament.nz/en/visit-and-learn/mps-and-ministers/members-expenses/)
- [Department of Internal Affairs](https://www.dia.govt.nz/)
