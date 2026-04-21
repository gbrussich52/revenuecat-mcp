#!/usr/bin/env node
/**
 * revenuecat-mcp — MCP Server for RevenueCat Charts API
 *
 * Exposes RevenueCat subscription analytics as MCP tools so any AI agent
 * (Claude, Cursor, Windsurf, etc.) can query your app's MRR, churn,
 * revenue, and subscriber data in plain language.
 *
 * Built by Ainsley (an AI agent) for the RevenueCat Agentic AI Developer
 * & Growth Advocate take-home assignment.
 *
 * https://github.com/gbrussich52/revenuecat-mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const RC_API_BASE = "https://api.revenuecat.com/v2";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverviewMetric {
  id: string;
  name: string;
  description: string;
  unit: string;
  period: string;
  value: number;
  last_updated_at_iso8601: string | null;
}

interface ChartValue {
  cohort: number;
  value: number;
  incomplete: boolean;
  measure?: number;
}

interface ChartData {
  object: string;
  category: string;
  display_name: string;
  description: string;
  resolution: string;
  start_date: number;
  end_date: number;
  values: ChartValue[];
  summary: Record<string, unknown>;
  segments: unknown[] | null;
  yaxis_currency?: string;
}

// ── API Client ────────────────────────────────────────────────────────────────

async function rcFetch(path: string, apiKey: string): Promise<unknown> {
  const url = `${RC_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RevenueCat API error ${res.status}: ${err}`);
  }

  return res.json();
}

// ── Tool Handlers ─────────────────────────────────────────────────────────────

async function getOverview(
  projectId: string,
  apiKey: string,
  currency = "USD"
): Promise<string> {
  const data = (await rcFetch(
    `/projects/${projectId}/metrics/overview?currency=${currency}`,
    apiKey
  )) as { metrics: OverviewMetric[] };

  const lines = data.metrics.map((m) => {
    const val =
      m.unit === "$" ? `${m.unit}${m.value.toLocaleString()}` : m.value.toLocaleString();
    const period = m.period === "P0D" ? "current" : "last 28 days";
    return `• ${m.name}: ${val} (${period})`;
  });

  return `## RevenueCat Overview — ${currency}\n\n${lines.join("\n")}`;
}

async function getChart(
  projectId: string,
  apiKey: string,
  chartName: string,
  startDate: string,
  endDate: string,
  resolution: string,
  currency: string,
  segment?: string
): Promise<string> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    resolution,
    currency,
  });
  if (segment) params.set("segment", segment);

  const data = (await rcFetch(
    `/projects/${projectId}/charts/${chartName}?${params}`,
    apiKey
  )) as ChartData;

  const currency_prefix = data.yaxis_currency ? `${data.yaxis_currency} ` : "";
  const values = data.values
    .slice(-12) // last 12 data points for readability
    .map((v) => {
      const date = new Date(v.cohort * 1000).toISOString().split("T")[0];
      const val = typeof v.value === "number" ? v.value.toFixed(2) : v.value;
      return `  ${date}: ${currency_prefix}${val}${v.incomplete ? " ⚠️ (incomplete)" : ""}`;
    });

  const summaryLines = Object.entries(data.summary).flatMap(([key, vals]) =>
    Object.entries(vals as Record<string, number>).map(
      ([metric, val]) =>
        `  ${key} ${metric}: ${typeof val === "number" ? val.toFixed(2) : val}`
    )
  );

  return [
    `## ${data.display_name} Chart`,
    `**Resolution:** ${data.resolution} | **Period:** ${startDate} → ${endDate}`,
    ``,
    `**Recent values (last 12 periods):**`,
    ...values,
    ``,
    summaryLines.length > 0
      ? `**Summary:**\n${summaryLines.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function getChartOptions(
  projectId: string,
  apiKey: string,
  chartName: string
): Promise<string> {
  const data = (await rcFetch(
    `/projects/${projectId}/charts/${chartName}/options`,
    apiKey
  )) as {
    resolutions: Array<{ id: string; display_name: string }>;
    segments: Array<{ id: string; display_name: string }> | null;
    filters: Array<{ id: string; display_name: string }> | null;
  };

  const resolutions = data.resolutions?.map((r) => `${r.id}=${r.display_name}`).join(", ");
  const segments = data.segments?.map((s) => s.id).join(", ") || "none";
  const filters = data.filters?.map((f) => f.id).join(", ") || "none";

  return [
    `## Chart Options: ${chartName}`,
    `**Available resolutions:** ${resolutions}`,
    `**Segmentable by:** ${segments}`,
    `**Filterable by:** ${filters}`,
  ].join("\n");
}

async function analyzeHealth(
  projectId: string,
  apiKey: string,
  currency = "USD"
): Promise<string> {
  // Pull overview + MRR + churn in parallel
  const [overview, mrrData, churnData, conversionData] = await Promise.all([
    rcFetch(`/projects/${projectId}/metrics/overview?currency=${currency}`, apiKey) as Promise<{ metrics: OverviewMetric[] }>,
    rcFetch(`/projects/${projectId}/charts/mrr?start_date=${nMonthsAgo(3)}&end_date=${today()}&resolution=2&currency=${currency}`, apiKey) as Promise<ChartData>,
    rcFetch(`/projects/${projectId}/charts/churn?start_date=${nMonthsAgo(3)}&end_date=${today()}&resolution=2&currency=${currency}`, apiKey) as Promise<ChartData>,
    rcFetch(`/projects/${projectId}/charts/conversion_to_paying?start_date=${nMonthsAgo(3)}&end_date=${today()}&resolution=2&currency=${currency}`, apiKey) as Promise<ChartData>,
  ]);

  const metrics = Object.fromEntries(
    overview.metrics.map((m) => [m.id, m])
  );

  const mrr = metrics["mrr"]?.value ?? 0;
  const subs = metrics["active_subscriptions"]?.value ?? 0;
  const trials = metrics["active_trials"]?.value ?? 0;
  const revenue28 = metrics["revenue"]?.value ?? 0;

  // MRR trend
  const mrrValues = mrrData.values.filter((v) => !v.incomplete);
  const mrrTrend =
    mrrValues.length >= 2
      ? ((mrrValues[mrrValues.length - 1].value - mrrValues[0].value) /
          mrrValues[0].value) *
        100
      : 0;

  // Churn
  const churnValues = churnData.values.filter((v) => !v.incomplete);
  const latestChurn =
    churnValues.length > 0 ? churnValues[churnValues.length - 1].value : null;

  // Conversion
  const convValues = conversionData.values.filter((v) => !v.incomplete);
  const latestConversion =
    convValues.length > 0 ? convValues[convValues.length - 1].value : null;

  const healthScore = [
    mrrTrend > 5 ? "🟢" : mrrTrend > 0 ? "🟡" : "🔴",
    latestChurn !== null && latestChurn < 3 ? "🟢" : latestChurn !== null && latestChurn < 6 ? "🟡" : "🔴",
    latestConversion !== null && latestConversion > 40 ? "🟢" : latestConversion !== null && latestConversion > 25 ? "🟡" : "🔴",
  ];

  return [
    `## Subscription Health Report`,
    ``,
    `### Key Metrics`,
    `• **MRR:** $${mrr.toLocaleString()} ${healthScore[0]}`,
    `• **MRR Trend (3mo):** ${mrrTrend >= 0 ? "+" : ""}${mrrTrend.toFixed(1)}%`,
    `• **Active Subscriptions:** ${subs.toLocaleString()}`,
    `• **Active Trials:** ${trials.toLocaleString()}`,
    `• **Revenue (28d):** $${revenue28.toLocaleString()}`,
    ``,
    `### Health Indicators`,
    latestChurn !== null
      ? `• **Churn Rate:** ${latestChurn.toFixed(2)}% ${healthScore[1]}`
      : "• **Churn Rate:** data unavailable",
    latestConversion !== null
      ? `• **Trial → Paid Conversion:** ${latestConversion.toFixed(1)}% ${healthScore[2]}`
      : "• **Trial Conversion:** data unavailable",
    ``,
    `### Signal`,
    mrrTrend > 5
      ? `✅ MRR is growing strongly (+${mrrTrend.toFixed(1)}% over 3 months)`
      : mrrTrend > 0
      ? `⚠️ MRR is growing but slowly (+${mrrTrend.toFixed(1)}% over 3 months)`
      : `🚨 MRR is declining (${mrrTrend.toFixed(1)}% over 3 months)`,
    latestChurn !== null && latestChurn > 6
      ? `🚨 Churn rate (${latestChurn.toFixed(2)}%) is above healthy threshold (6%)`
      : latestChurn !== null
      ? `✅ Churn rate (${latestChurn.toFixed(2)}%) is within healthy range`
      : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function nMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}

// ── Tool Definitions ──────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "get_overview",
    description:
      "Get a snapshot of all key RevenueCat metrics: MRR, revenue, active subscriptions, active trials, new customers, and active users.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Your RevenueCat project ID (e.g. proj058a6330)",
        },
        api_key: {
          type: "string",
          description: "Your RevenueCat V2 secret key with charts_metrics:overview:read permission",
        },
        currency: {
          type: "string",
          description: "Currency code (default: USD). Options: USD, EUR, GBP, CAD, AUD, JPY",
          default: "USD",
        },
      },
      required: ["project_id", "api_key"],
    },
  },
  {
    name: "get_chart",
    description:
      "Get time-series chart data from RevenueCat for a specific metric. Available charts: mrr, revenue, actives, churn, arr, conversion_to_paying, trials, customers_new, refund_rate, subscription_retention, mrr_movement, ltv_per_customer, trial_conversion_rate, actives_movement, actives_new, trials_movement, trials_new, customers_active, ltv_per_paying_customer, cohort_explorer, subscription_status",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Your RevenueCat project ID" },
        api_key: { type: "string", description: "Your RevenueCat V2 secret key" },
        chart_name: {
          type: "string",
          description:
            "Chart to fetch. One of: mrr, revenue, actives, churn, arr, conversion_to_paying, trials, customers_new, refund_rate, subscription_retention, mrr_movement, ltv_per_customer, trial_conversion_rate",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (default: today)",
        },
        resolution: {
          type: "string",
          description: "Time resolution: 0=day, 1=week, 2=month (default: 2)",
          default: "2",
        },
        currency: {
          type: "string",
          description: "Currency code (default: USD)",
          default: "USD",
        },
        segment: {
          type: "string",
          description: "Optional: segment data by 'country', 'store', 'product', etc.",
        },
      },
      required: ["project_id", "api_key", "chart_name", "start_date"],
    },
  },
  {
    name: "get_chart_options",
    description:
      "Discover available resolutions, segments, and filters for a specific RevenueCat chart before querying it.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Your RevenueCat project ID" },
        api_key: { type: "string", description: "Your RevenueCat V2 secret key" },
        chart_name: {
          type: "string",
          description: "Chart name to get options for (e.g. mrr, churn, revenue)",
        },
      },
      required: ["project_id", "api_key", "chart_name"],
    },
  },
  {
    name: "analyze_subscription_health",
    description:
      "Run a complete subscription health analysis: pulls MRR trend, churn rate, and trial conversion, then returns a structured health report with traffic-light indicators (🟢🟡🔴). Great for a quick executive summary of how your subscription business is performing.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Your RevenueCat project ID" },
        api_key: { type: "string", description: "Your RevenueCat V2 secret key" },
        currency: {
          type: "string",
          description: "Currency code (default: USD)",
          default: "USD",
        },
      },
      required: ["project_id", "api_key"],
    },
  },
];

// ── Server ────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "revenuecat-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    if (name === "get_overview") {
      const { project_id, api_key, currency = "USD" } = args as {
        project_id: string;
        api_key: string;
        currency?: string;
      };
      result = await getOverview(project_id, api_key, currency);
    } else if (name === "get_chart") {
      const {
        project_id,
        api_key,
        chart_name,
        start_date,
        end_date = today(),
        resolution = "2",
        currency = "USD",
        segment,
      } = args as {
        project_id: string;
        api_key: string;
        chart_name: string;
        start_date: string;
        end_date?: string;
        resolution?: string;
        currency?: string;
        segment?: string;
      };
      result = await getChart(
        project_id,
        api_key,
        chart_name,
        start_date,
        end_date,
        resolution,
        currency,
        segment
      );
    } else if (name === "get_chart_options") {
      const { project_id, api_key, chart_name } = args as {
        project_id: string;
        api_key: string;
        chart_name: string;
      };
      result = await getChartOptions(project_id, api_key, chart_name);
    } else if (name === "analyze_subscription_health") {
      const { project_id, api_key, currency = "USD" } = args as {
        project_id: string;
        api_key: string;
        currency?: string;
      };
      result = await analyzeHealth(project_id, api_key, currency);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RevenueCat MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
