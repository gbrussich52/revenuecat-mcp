# Changelog

## 2.0.0 — 2026-10-29

Breaking security repair: the old tools required an API key and project ID in model-facing arguments. They now use only trusted `REVENUECAT_API_KEY` and `REVENUECAT_PROJECT_ID` process configuration, reject legacy/unknown arguments, and pin all reads to one configured project. Missing configuration fails closed. Existing users must migrate their host configuration and rotate any previously disclosed key.

Fixed raw upstream-error/exception disclosure, unconstrained redirect/body/time boundaries, stale runtime version, and unsafe scalar/date/path validation. Added bounded GET-only requests, safe errors, successful-response key redaction, read-only/open-world annotations, package allowlist and regression tests with fictional data. Updated existing SDK/transitive dependencies to resolve native audit findings.

Removed unsupported fixed business-health thresholds and default-zero/misleading decline calculations. Missing/ambiguous data stays unavailable; actual zero remains zero, non-USD currency and API periods are preserved, and conversion/churn units are not guessed. The legacy health tool name remains for discovery compatibility. No live authenticated RevenueCat certification is claimed.

Preserve raw chart rows alongside period/measure/segment metadata instead of relabeling counts as currency. Support documented hyphenated chart IDs and nullable summaries; malformed chart options remain unavailable. Use actual response currency and reject non-finite numeric payloads. Added event-driven read-only CI in place of no regression gate; no schedule or new publishing trust.

---

## 2026-10-28 — Documentation accuracy

The README previously claimed RevenueCat's official MCP lacked analytics. Current
vendor documentation lists analytics tools, so the README now links that supported
option and identifies this repository as an optional third-party legacy wrapper.
It also explains that every existing tool takes an API key in its arguments,
which exposes the key to the MCP host and potentially model context/history, and
records the npm 1.0.2 versus MCP initialization 1.0.0 version mismatch.

No runtime, credential handling, package version or dependency changed. This is not
a security fix or a new authenticated API compatibility claim. Validation used
public source/npm metadata and official vendor documentation; no RevenueCat
account, key or private subscription data was used.

The review also removes an unqualified report statistic, describes the listed chart
IDs and health thresholds as unverified identifiers/heuristics, and corrects the
old five-request rate-limit claim against the current primary API documentation.
