# Draft: a safer optional RevenueCat analytics adapter

Updated October 29, 2026. This replaces the historical launch draft; it is not a record of a published article or a customer integration test.

RevenueCat's [official MCP tools reference](https://www.revenuecat.com/docs/tools/mcp/tools-reference) includes analytics. Start with its supported connector when it meets your needs. This repository is an optional third-party local stdio adapter, not an exclusive analytics integration and not endorsed by RevenueCat.

Version 2 exposes four read-only tools: overview metrics, raw chart rows with period/measure/segment metadata, chart options, and a neutral subscription-metrics summary. Configure one project and its scoped key in the trusted MCP host environment. No tool accepts a key or project selector.

The earlier package put keys in model-facing arguments and could disclose raw upstream errors. The repaired implementation pins reads to one configured project and fixed HTTPS origin, refuses redirects, bounds requests and responses, and returns safe errors. The legacy health-tool name remains, but unsupported traffic-light diagnoses have been removed. Missing values stay unavailable; counts are not relabeled as currency.

The [compiled 2.0.0 release](https://github.com/gbrussich52/revenuecat-mcp/releases/tag/v2.0.0) has been tested with fictional data and real MCP protocol clients. This does not establish authenticated RevenueCat account compatibility, business results, savings or legal/security certification. No named customer account or real financial result is used as promotional evidence.

Follow the current [README](https://github.com/gbrussich52/revenuecat-mcp#readme) for requirements and migration. Check npm version availability before recommending a registry install;1.x is the legacy credential contract. Connected RevenueCat services may have their own terms and charges.
