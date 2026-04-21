# Demo Video Script — revenuecat-mcp
*Target length: 90 seconds. Screen recording of Claude Desktop.*

---

## Setup (before recording)

1. Add to `claude_desktop_config.json`:
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
2. Restart Claude Desktop
3. Verify the revenuecat tools appear in the tools panel

---

## Script

**[0:00 — Open Claude Desktop, new conversation]**

*Type visibly, slowly enough to read:*

> "Run a subscription health check for project proj058a6330"

*(Have the API key ready to paste when Claude asks, or pre-configure it in a system prompt)*

**[0:10 — Claude calls analyze_subscription_health]**

Let the tool call animation play. Don't narrate. The tool output speaks for itself.

**[0:25 — Health report appears]**

The output should show:
- MRR: $4,562 🟡
- Churn: ~6.48% 🟡
- Trial conversion: ~38% 🟡
- Signal text at the bottom

Pause here for 3 seconds. Let the viewer read it.

**[0:35 — Follow-up query]**

Type:

> "Show me MRR trend over the last 6 months"

**[0:45 — get_chart result appears]**

The monthly MRR values appear as a list with dates. Pause briefly.

**[0:55 — One more]**

Type:

> "What's churn segmented by country?"

**[1:05 — Country-segmented churn appears]**

**[1:20 — End card / voiceover if desired]**

If adding a voiceover: *"RevenueCat's official MCP gives you 26 tools to build your subscription infrastructure. This one gives you the analytics layer it's missing. github.com/gbrussich52/revenuecat-mcp"*

---

## Recording notes

- Use a clean Claude Desktop window with nothing else visible
- Terminal font size: bump up 2pt for readability
- No need to show typing the API key — can cut that with a jump cut
- Keep cursor movements deliberate and slow
- Total runtime target: 60–90 seconds (YouTube and Loom both work; Loom is easier to share)
