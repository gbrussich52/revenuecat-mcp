# revenuecat-analytics-mcp

A third-party, read-only **local stdio** adapter for RevenueCat's Charts API. It is not affiliated with or endorsed by RevenueCat. Prefer [RevenueCat's official MCP server](https://www.revenuecat.com/docs/tools/mcp) when it covers your needs: its [tools reference](https://www.revenuecat.com/docs/tools/mcp/tools-reference) includes analytics. This adapter is optional, not an exclusive analytics integration.

## Version 2: credentials stay in server configuration

This source targets **2.0.1**, a breaking security release. Check registry availability with `npm view revenuecat-analytics-mcp version` before selecting an npm release; **1.x still accepts keys in tool arguments and is not recommended**. A local source build uses the repaired implementation described here.

Set `REVENUECAT_API_KEY` and `REVENUECAT_PROJECT_ID` through your MCP host's trusted local environment/secret settings. The process is restricted to that configured project. No tool accepts an API key or project selector. Never paste a key into chat, tool arguments, GitHub, or a support request. Use a V2 key with only the read permissions needed: `charts_metrics:charts:read` and `charts_metrics:overview:read`.

The local MCP host and this process can access their configured environment. Server-side configuration removes keys from model-facing tool calls; it does not make an untrusted host safe. Changing projects requires changing trusted configuration and restarting. Use a separate server instance for another project.

If a real key was previously placed in chat/tool calls, rotate it in RevenueCat and review your host's history/log retention. This release cannot erase previous disclosures.

## Setup

Requirements: Node.js 20+, a RevenueCat project, and its scoped V2 secret key. [RevenueCat documents key creation and permissions](https://www.revenuecat.com/docs/api-v2). The adapter performs no writes, payments, customer changes, or account setup.

```sh
git clone https://github.com/gbrussich52/revenuecat-mcp
cd revenuecat-mcp
npm ci
npm test
```

Configure your MCP client to launch the absolute path of `dist/index.js`:

```json
{
  "mcpServers": {
    "revenuecat": {
      "command": "node",
      "args": ["/absolute/path/to/revenuecat-mcp/dist/index.js"]
    }
  }
}
```

Supply the two environment variables through the client's local environment/secret configuration before launching. The empty `.env.example` only documents variable names; this server does **not** load dotenv files automatically. Missing/invalid configuration fails at startup without printing the values. No credentials or private account connection are included in the repository.

## Tools

| Tool | Arguments | Behavior |
| --- | --- | --- |
| `get_overview` | optional `currency` | Formats the returned overview metrics and their reported periods. |
| `get_chart` | `chart_name`, `start_date`; optional `end_date`, `resolution`, `currency`, `segment` | Returns the last 12 raw API rows with period/measure/segment metadata and optional summary. No units or scaling are inferred. Chart availability follows RevenueCat permissions/API behavior. |
| `get_chart_options` | `chart_name` | Requests chart metadata for interpreting resolutions, segments and filters. Missing metadata is unavailable, not a claim of no options. |
| `analyze_subscription_health` | optional `currency` | Legacy tool name retained; returns a neutral metrics summary, not a business-health diagnosis. |

Examples: `get_overview({"currency":"CAD"})`, or `get_chart({"chart_name":"mrr","start_date":"2026-01-01","end_date":"2026-10-01","resolution":"2"})`. Dates must be real `YYYY-MM-DD` dates in order; currency must be three uppercase letters. Resolution accepts `0`, `1`, or `2`; confirm supported metadata with `get_chart_options`. Chart identifiers accept lowercase letters, numbers, underscores and hyphens, starting with a letter, up to 64 characters. Segment identifiers use the same rule without hyphens. Unknown fields and invalid scalar inputs are rejected before any API request.

The summary leaves missing values unavailable, preserves actual zero values, excludes incomplete periods, and does not sum segmented values or combine multiple measures. MRR change is calculated only for an unambiguous scalar series with distinct dates and a positive baseline. Churn/conversion are labeled raw API values; the adapter does not assume percentage scaling. Overview monetary values use the currency actually reported by RevenueCat, even if it differs from the requested currency; a missing/invalid response currency is an error. Revenue uses its reported API period. There are no traffic-light health scores, universal thresholds, or revenue predictions.

## Request and error boundaries

Requests are GET-only to `https://api.revenuecat.com/v2`, under the configured project. Redirects are refused; each request has a 12-second deadline, a 2 MiB response limit, and a 64 KiB formatted-output limit. Upstream error bodies and exception messages are not returned. The configured key is redacted if echoed in successful report text. This does not certify the upstream service or every MCP host's logging behavior.

The [API documentation](https://www.revenuecat.com/docs/api-v2#section/Rate-Limit) lists a shared Charts & Metrics rate limit of 25 requests/minute, checked October 29, 2026. The summary starts four requests in parallel. A rejected request returns a safe error; there is no hidden retry loop.

## Validation and limitations

`npm test` uses fictional keys and synthetic API responses, plus real SDK in-memory and stdio clients. It checks schemas, rejected legacy credentials/cross-project arguments, request destinations, redirect policy, timeout, response limits, error redaction, currency, missing data and version consistency. These tests do **not** certify live authenticated RevenueCat behavior. No real API key, customer record, or paid API request is required.

Version 2 retires the legacy model-facing credential contract and fixed health heuristics. An event-driven GitHub test workflow replaces the absence of a regression gate; it uses fictional fixtures, read-only repository permissions and no secrets. There is no hosted service or scheduled job. See [CHANGELOG.md](CHANGELOG.md).

## Provenance and license

Originally built by Ainsley, an AI agent, for a RevenueCat Agentic AI Developer & Growth Advocate take-home assignment. Security and accuracy repairs are maintained in this repository. MIT.
