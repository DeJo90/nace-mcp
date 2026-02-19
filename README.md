# nace-mcp

An MCP server exposing **NACE Rev. 2.1** economic activity classification codes for AI agents.

NACE (Nomenclature of Economic Activities) is the European standard for classifying economic activities. This server loads all 1,047 codes into memory at startup and provides four tools for browsing, looking up, searching, and fuzzy-matching codes — without ever dumping the full dataset to the agent.

## MCP Configuration

Add to your Claude (or any MCP-compatible client) config:

```json
{
  "mcpServers": {
    "nace-mcp": {
      "command": "npx",
      "args": ["nace-mcp"]
    }
  }
}
```

## Tools

### `nace_get(code)`

Returns full details for a single NACE code.

**Input:** `code` — e.g. `"A"`, `"01"`, `"25.1"`, `"25.11"`

**Example output:**
```json
{
  "code": "25.11",
  "label": "Manufacture of metal structures and parts of structures",
  "level": "class",
  "parent": "25.1"
}
```

---

### `nace_browse(parent_code?)`

Returns the direct children of a code (compact: code + label only). Omit `parent_code` to list all 22 top-level sections. Max 50 results.

**Input:** `parent_code` (optional) — e.g. `"C"`, `"25"`, `"25.1"`

**Example — `nace_browse()` (no argument):**
```json
[
  { "code": "A", "label": "Agriculture, forestry and fishing" },
  { "code": "B", "label": "Mining and quarrying" },
  ...
]
```

**Example — `nace_browse("25")`:**
```json
[
  { "code": "25.1", "label": "Manufacture of structural metal products" },
  { "code": "25.2", "label": "Manufacture of tanks, reservoirs and containers of metal" },
  ...
]
```

---

### `nace_search(query)`

Case-insensitive substring search across all activity labels. Returns up to 10 matches.

**Input:** `query` — e.g. `"repair"`, `"software"`, `"fishing"`

**Example — `nace_search("vehicle repair")`:**
```json
[
  { "code": "45.20", "label": "Maintenance and repair of motor vehicles", "level": "class" },
  { "code": "30.12", "label": "Building of pleasure and sporting boats", "level": "class" }
]
```

---

### `nace_suggest(activity_description)`

Fuzzy-matches a free-text description to NACE codes. Tokenizes the input, scores by matched terms, and returns the top 5 candidates with a brief explanation. Designed for AI agents doing classification.

**Input:** `activity_description` — e.g. `"vehicle maintenance and repair workshop"`, `"software development consultancy"`

**Example — `nace_suggest("vehicle maintenance and repair workshop")`:**
```json
[
  {
    "code": "45.20",
    "label": "Maintenance and repair of motor vehicles",
    "level": "class",
    "reason": "Matched: \"vehicle\", \"maintenance\", \"repair\""
  },
  {
    "code": "33.17",
    "label": "Repair and maintenance of other transport equipment",
    "level": "class",
    "reason": "Matched: \"maintenance\", \"repair\""
  }
]
```

> **Tip:** For non-English descriptions (e.g. German "KFZ Mechaniker"), rephrase in English before calling `nace_suggest`.

## Data

- **Source:** [jnsprnw/nace-codes](https://github.com/jnsprnw/nace-codes) — community-maintained JSON conversion of the official Eurostat NACE Rev. 2.1 classification
- **Coverage:** 1,047 entries across 22 sections (A–U), 4 levels (section → division → group → class)
- **Authority:** [Eurostat NACE Rev. 2.1](https://ec.europa.eu/eurostat/ramon/nomenclatures/index.cfm?TargetUrl=LST_NOM_DTL&StrNom=NACE_REV2)

## Development

```bash
npm install
npm run build    # compile TypeScript → dist/
node dist/index.js  # run the server (listens on stdio)
```

To inspect with the MCP Inspector:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
