# Portfolio input

The generator accepts one UTF-8 JSON file. Fill it with verified project facts only. Do not put personal contact details in the portfolio input.

```json
{
  "title": "Wafer Lens",
  "problem": "A concise description of the problem being explored.",
  "solution": "What the working prototype does today.",
  "demo_url": "https://your-live-demo.example",
  "metrics_file": "../public/data/metrics.json",
  "runtime": "Node.js 24 or newer for model evaluation",
  "reproduce": ["npm install", "node scripts/data/evaluate.mjs", "npm run build"],
  "ai_use": "50–2,000 character statement describing how AI tools were used and what the applicant verified.",
  "screenshot": "Optional path to a product screenshot, relative to this JSON file"
}
```

The script requires a verified HTTPS deployment URL, the evaluation artifact, runtime requirement, exact reproduction commands, and a 50–2,000 character AI-use statement. Dataset attribution, split details, metrics, and limitations are read from the evidence JSON so they cannot drift through manual transcription. The screenshot is optional. Do not include identity details or replace the metrics artifact with estimates.
