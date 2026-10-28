# revenuecat-mcp

An optional third-party, legacy stdio wrapper for RevenueCat's Charts API.

This project is not affiliated with or endorsed by RevenueCat. The current
[official RevenueCat MCP server](https://www.revenuecat.com/docs/tools/mcp) supports
analytics, including chart data, chart options, overview metrics and experiment
results, as documented in its [tools reference](https://www.revenuecat.com/docs/tools/mcp/tools-reference).
Use the official connector when it covers your needs; the earlier claim that it had
no analytics tools is obsolete.

This package connects [RevenueCat's Charts API](https://www.revenuecat.com/docs/api-v2)
to compatible local MCP clients. Its four tools request API data and format a report.
Current authenticated API behavior has not been reverified in this documentation
review. Example questions include:

> *"How is my MRR trending over the last 6 months?"*
> *"What's my current churn rate and is it healthy?"*
> *"Run a full subscription health check."*

Results depend on the supplied project's permissions and the upstream API response.

---

## Tools

| Tool | What it does |
|------|-------------|
| `get_overview` | Snapshot of all key metrics: MRR, revenue, subscribers, trials, new customers |
| `get_chart` | Requests time-series data for a named chart; availability follows the upstream API |
| `get_chart_options` | Discover available resolutions, segments, and filters for a chart |
| `analyze_subscription_health` | Formats MRR, churn and trial-conversion data with fixed heuristic indicators |

### Chart identifiers listed by this package

`mrr` · `revenue` · `actives` · `arr` · `churn` · `conversion_to_paying` ·
`customers_new` · `ltv_per_customer` · `ltv_per_paying_customer` · `mrr_movement` ·
`refund_rate` · `subscription_retention` · `subscription_status` · `trials` ·
`trials_movement` · `trials_new` · `actives_movement` · `actives_new` ·
`customers_active` · `trial_conversion_rate` · `cohort_explorer`

These are identifiers named in the source, not a current compatibility guarantee for
every RevenueCat project. Health colors and thresholds are package heuristics, not
a validated diagnosis or a prediction of business results.

---

## Requirements

- Node.js 18+
- A RevenueCat V2 secret key with `charts_metrics:charts:read` and `charts_metrics:overview:read` permissions
- Your RevenueCat project ID (find it in **Project Settings → API Keys**)

### Credential handling in this package

Every tool requires `api_key` as an ordinary tool argument. The setup examples below
only launch the server; they do not configure credentials through environment
variables or OAuth. A key supplied in a tool call is exposed to the MCP host and may
enter the model context or the host's logs/history. Do not paste a secret into chat
to try this package. Prefer the official connector's documented authentication when
it meets your needs.

This is a disclosure of the existing implementation, not a credential-handling fix.
The npm package is `revenuecat-analytics-mcp@1.0.2`; its MCP initialization currently
reports `revenuecat-mcp` version `1.0.0`.

---

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "revenuecat": {
      "command": "npx",
      "args": ["-y", "revenuecat-analytics-mcp"]
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

These describe tool selection, not a secure credential setup. Do not put real keys
in these prompts. The current API-key argument requirement is described above.

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

RevenueCat's [API v2 documentation](https://www.revenuecat.com/docs/api-v2#section/Rate-Limit) lists 25 requests per minute for Charts & Metrics as of October 28, 2026. Follow the actual response headers and any current account limits. The `analyze_subscription_health` implementation starts four requests in parallel; this review did not test authenticated rate-limit handling.

---

## Built by

This server was built by **Ainsley**, an AI agent, as part of a take-home assignment for the RevenueCat Agentic AI Developer & Growth Advocate role. All code was generated autonomously using Claude Code.

*Ainsley is an AI agent built on [OpenClaw](https://openclaw.ai). This disclosure is required — and proudly made.*

---

## License

MIT
