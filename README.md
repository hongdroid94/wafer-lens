# Wafer Lens

Wafer Lens is an interactive prototype for exploring wafer defect maps and reviewing candidate spatial patterns. Users can load a sample or a rectangular CSV die map, edit die states, and inspect the closest labeled examples and uncertainty. It is an independent hackathon project using public data; it has no access to SK hynix internal data and makes no claim of fab deployment or production impact.

## Status

The final v2 report is in [`public/data/metrics.json`](public/data/metrics.json): accuracy 60.4% across 351 test wafers from 302 lots, macro-F1 0.661, with 22.8% abstentions and 78.2% accuracy on the 271 accepted cases. Recall is weakest for Loc, Scratch, and Edge-Loc patterns. While v2 train, validation, and final test lots are disjoint, 36 of the 351 final-test wafer IDs appeared in v1 training; these results are exploratory, not a fully independent test across the full development history. Demo: [wafer-lens-lilac.vercel.app](https://wafer-lens-lilac.vercel.app).

## Data and attribution

The model uses public WM-811K wafer map samples from a Kaggle listing. The listing describes the data as CC0; that upstream license and provenance have not been independently verified. Treat the dataset as research material, retain attribution, and check the source terms before reuse. No SK hynix or other proprietary fab data is included.

## Reproduce

Install dependencies with `npm install`, start the local app with `npm run dev`, and create a production build with `npm run build`. With Node.js 24 or newer, regenerate final metrics using `node scripts/data/evaluate.mjs`. The evaluation selects train, validation, and final test groups by wafer lot; details and limitations are recorded in `public/data/metrics.json`. The browser accepts a rectangular CSV matrix where `0` means outside the wafer, `1` means pass, and `2` means fail. Uploaded files stay in the browser session. Live pattern scores are relative support from nearby examples, not calibrated probabilities.

## Portfolio and application materials

After the model evaluation and demo URL are verified, place a JSON input file following [`docs/PORTFOLIO_INPUT.md`](docs/PORTFOLIO_INPUT.md) at `output/portfolio-input.json`, then run:

```sh
python3 -m pip install reportlab
python3 scripts/portfolio/build.py output/portfolio-input.json
```

The script writes a single PDF portfolio and a separate AI-use statement text file under `output/`. It takes the measured values and limitations from `public/data/metrics.json`; add a verified demo URL and accurate AI-use statement to the input JSON. Submit the PDF as the portfolio attachment and paste the AI-use statement into the application form. Check the final PDF before submission. The [official application page](https://skhynix-hackathon.com/ai-2026) lists the deadline as September 28, 2026 at 17:00 KST. The application allows one PDF/ZIP/PNG/JPG up to 50 MB; the AI-use statement must be 50–2,000 characters.

## Scope and limitations

This prototype demonstrates a public-data experiment, not manufacturing-grade defect detection. Dataset labeling quality, domain shift, false-positive cost, process context, and real-fab validation remain open questions. Report only measured results and describe the exact evaluation setup.
