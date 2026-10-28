# 2026-10-28 — Documentation accuracy

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
