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
  "code": "95.31",
  "label": "Repair and maintenance of motor vehicles",
  "level": "class",
  "parent": "95.3"
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
  { "code": "C", "label": "Manufacturing" },
  ...
]
```

**Example — `nace_browse("J")`:**
```json
[
  { "code": "58", "label": "Publishing activities" },
  { "code": "59", "label": "Motion picture, video and television programme production, sound recording and music publishing activities" },
  { "code": "60", "label": "Programming, broadcasting, news agency and other content distribution activities" },
  ...
]
```

---

### `nace_search(query)`

Case-insensitive substring search across all activity labels. Returns up to 10 matches.

**Input:** `query` — e.g. `"software"`, `"fishing"`, `"consulting"`

**Example — `nace_search("software")`:**
```json
[
  { "code": "58.1", "label": "Publishing of books, newspapers and other publishing activities, except software publishing", "level": "group" },
  { "code": "58.19", "label": "Other publishing activities, except software publishing", "level": "class" },
  { "code": "58.2", "label": "Software publishing", "level": "group" },
  { "code": "58.29", "label": "Other software publishing", "level": "class" }
]
```

---

### `nace_suggest(activity_description)`

Fuzzy-matches a free-text description to NACE codes. Tokenizes the input, scores by matched terms, and returns the top 5 candidates with a brief explanation. Designed for AI agents doing classification.

**Input:** `activity_description` — free-text description of the economic activity

**Example — `nace_suggest("computer programming software development consultancy")`:**
```json
[
  {
    "code": "62",
    "label": "Computer programming, consultancy and related activities",
    "level": "division",
    "reason": "Matched: \"computer\", \"programming\", \"consultancy\""
  },
  {
    "code": "62.1",
    "label": "Computer programming activities",
    "level": "group",
    "reason": "Matched: \"computer\", \"programming\""
  },
  {
    "code": "62.10",
    "label": "Computer programming activities",
    "level": "class",
    "reason": "Matched: \"computer\", \"programming\""
  },
  ...
]
```

> **Tip:** For non-English descriptions (e.g. German "KFZ Mechaniker"), rephrase in English before calling `nace_suggest`.

---

## Prompt Examples

These examples show how an AI agent uses the tools in practice.

---

### "What NACE code applies to a car repair shop?"

The agent calls `nace_suggest` with an English description:

```
nace_suggest("motor vehicle repair maintenance workshop")
```

```json
[
  {
    "code": "95",
    "label": "Repair and maintenance of computers, personal and household goods, and motor vehicles and motorcycles",
    "level": "division",
    "reason": "Matched: \"motor\", \"vehicle\", \"repair\", \"maintenance\""
  },
  {
    "code": "95.3",
    "label": "Repair and maintenance of motor vehicles and motorcycles",
    "level": "group",
    "reason": "Matched: \"motor\", \"vehicle\", \"repair\", \"maintenance\""
  },
  {
    "code": "95.31",
    "label": "Repair and maintenance of motor vehicles",
    "level": "class",
    "reason": "Matched: \"motor\", \"vehicle\", \"repair\", \"maintenance\""
  }
]
```

The agent then drills into the best match with `nace_get("95.31")` to confirm the parent chain:

```json
{
  "code": "95.31",
  "label": "Repair and maintenance of motor vehicles",
  "level": "class",
  "parent": "95.3"
}
```

**Result:** `95.31` is the correct class-level code for a car repair shop.

---

### "What NACE code covers a bakery?"

```
nace_suggest("bakery bread pastry production")
```

```json
[
  {
    "code": "10.71",
    "label": "Manufacture of bread; manufacture of fresh pastry goods and cakes",
    "level": "class",
    "reason": "Matched: \"bread\", \"pastry\""
  }
]
```

**Result:** `10.71` — first candidate is an exact match, no further navigation needed.

---

### "Explore the information & communication sector"

The agent browses the hierarchy top-down:

```
nace_browse("J")
```

```json
[
  { "code": "58", "label": "Publishing activities" },
  { "code": "59", "label": "Motion picture, video and television programme production, sound recording and music publishing activities" },
  { "code": "60", "label": "Programming, broadcasting, news agency and other content distribution activities" },
  { "code": "61", "label": "Telecommunications" },
  { "code": "62", "label": "Computer programming, consultancy and related activities" },
  { "code": "63", "label": "Information service activities" }
]
```

Then zooms into division 62:

```
nace_browse("62")
```

```json
[
  { "code": "62.1", "label": "Computer programming activities" },
  { "code": "62.2", "label": "Computer consultancy and computer facilities management activities" },
  { "code": "62.3", "label": "Computer facilities management activities" },
  { "code": "62.9", "label": "Other information technology and computer service activities" }
]
```

---

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
