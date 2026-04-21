# revenuecat-mcp

**Ask your AI agent about your MRR. In plain English.**

An MCP (Model Context Protocol) server that connects [RevenueCat's Charts API](https://www.revenuecat.com/docs/api-v2) to any AI agent — Claude, Cursor, Windsurf, and more.

Instead of logging into the RevenueCat dashboard, you can ask:

> *"How is my MRR trending over the last 6 months?"*
> *"What's my current churn rate?"*
> *"Run a full subscription health check."*

And get a real answer, backed by live data.

---

## Tools

| Tool | What it does |
|------|-------------|
| `get_overview` | Snapshot of all key metrics: MRR, revenue, subscribers, trials, new customers |
| `get_chart` | Time-series data for any of 21 available charts |
| `get_chart_options` | Discover available resolutions, segments, and filters for a chart |
| `analyze_subscription_health` | Full health report: MRR trend + churn + trial conversion with 🟢🟡🔴 indicators |

### Available Charts (21 total)

`mrr` · `revenue` · `actives` · `arr` · `churn` · `conversion_to_paying` ·
`customers_new` · `ltv_per_customer` · `ltv_per_paying_customer` · `mrr_movement` ·
`refund_rate` · `subscription_retention` · `subscription_status` · `trials` ·
`trials_movement` · `trials_new` · `actives_movement` · `actives_new` ·
`customers_active` · `trial_conversion_rate` · `cohort_explorer`

---

## Requirements

- Node.js 18+
- A RevenueCat V2 secret key with `charts_metrics:charts:read` and `charts_metrics:overview:read` permissions
- Your RevenueCat project ID (find it in **Project Settings → API Keys**)

---

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "revenuecat": {
      "command": "npx",
      "args": ["-y", "revenuecat-mcp"]
    }
  }
}
```

### Cursor / Windsurf / Other MCP clients

```json
{
  "mcpServers": {
    "revenuecat": {
      "command": "node",
      "args": ["/path/to/revenuecat-mcp/dist/index.js"]
    }
  }
}
```

### Run locally

```bash
git clone https://github.com/gbrussich52/revenuecat-mcp
cd revenuecat-mcp
npm install
npm run build
node dist/index.js
```

---

## Usage Examples

Once connected, prompt your AI agent naturally:

```
What's the current MRR for project proj058a6330?
→ Calls get_overview with your project ID and API key

Show me monthly revenue for the last year.
→ Calls get_chart(chart_name="revenue", start_date="2025-04-01", resolution="2")

Run a subscription health check.
→ Calls analyze_subscription_health — pulls MRR trend, churn, and trial conversion

What's my churn rate segmented by country?
→ Calls get_chart(chart_name="churn", segment="country")
```

---

## Getting Your Credentials

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com) → **Project Settings** → **API Keys**
2. Create a new **V2 Secret Key**
3. Enable permissions: `charts_metrics:charts:read` + `charts_metrics:overview:read`
4. Your **Project ID** is in the URL: `app.revenuecat.com/projects/YOUR_PROJECT_ID/`

---

## Architecture

```
Your AI Agent (Claude / Cursor / etc.)
        ↓  MCP tool call
  revenuecat-mcp (this server)
        ↓  HTTPS
  RevenueCat Charts API V2
        ↓
  Your subscription data
```

The server acts as a translation layer: it takes natural-language-adjacent tool calls from your AI agent, maps them to the correct RevenueCat API endpoints, and returns clean markdown-formatted results.

---

## Rate Limits

RevenueCat's Charts API has a 5 requests/minute rate limit on the charts domain. The `analyze_subscription_health` tool makes 4 parallel requests — be mindful if calling it frequently.

---

## Built by

This server was built by **Ainsley**, an AI agent, as part of a take-home assignment for the RevenueCat Agentic AI Developer & Growth Advocate role. All code was generated autonomously using Claude Code.

*Ainsley is an AI agent built on [OpenClaw](https://openclaw.ai). This disclosure is required — and proudly made.*

---

## License

MIT
