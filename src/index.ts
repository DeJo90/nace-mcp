#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

type NaceLevel = "section" | "division" | "group" | "class";

interface RawEntry {
  Section: string;
  Division: string | null;
  Group: string | null;
  Class: string | null;
  Activity: string;
}

interface NaceEntry {
  code: string;
  label: string;
  level: NaceLevel;
  parent: string | null;
}

// ── Data loading ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, "../data/codes-2.1.json");

const raw: RawEntry[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

// ── Index building ────────────────────────────────────────────────────────────

const ROOT_KEY = "ROOT";
const byCode = new Map<string, NaceEntry>();
const children = new Map<string, string[]>();

for (const row of raw) {
  let code: string;
  let level: NaceLevel;
  let parent: string | null;

  if (row.Class !== null) {
    code = row.Class;
    level = "class";
    parent = row.Group!;
  } else if (row.Group !== null) {
    code = row.Group;
    level = "group";
    parent = row.Division!;
  } else if (row.Division !== null) {
    code = row.Division;
    level = "division";
    parent = row.Section;
  } else {
    code = row.Section;
    level = "section";
    parent = null;
  }

  byCode.set(code, { code, label: row.Activity, level, parent });

  const parentKey = parent ?? ROOT_KEY;
  if (!children.has(parentKey)) children.set(parentKey, []);
  children.get(parentKey)!.push(code);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveCode(input: string): string | undefined {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (byCode.has(upper)) return upper; // sections (single uppercase letter)
  if (byCode.has(trimmed)) return trimmed; // numeric codes (01, 01.1, 01.11)
  return undefined;
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function errorText(content: string) {
  return { content: [{ type: "text" as const, text: content }], isError: true };
}

// ── MCP server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "nace-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "nace_get",
      description:
        "Returns full details for a single NACE Rev. 2.1 code: code, label, level (section/division/group/class), and parent code.",
      inputSchema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "NACE code — e.g. 'A', '01', '01.1', '01.11'",
          },
        },
        required: ["code"],
      },
    },
    {
      name: "nace_browse",
      description:
        "Returns direct children of a NACE code (code + label only). Omit parent_code to get all 22 top-level sections. Max 50 results.",
      inputSchema: {
        type: "object",
        properties: {
          parent_code: {
            type: "string",
            description: "Parent NACE code. Omit to list top-level sections.",
          },
        },
      },
    },
    {
      name: "nace_search",
      description:
        "Case-insensitive substring search across all 1,047 NACE Rev. 2.1 activity labels. Returns up to 10 matches with code, label, and level.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Substring to search for in activity labels",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "nace_suggest",
      description:
        "Fuzzy-match a free-text activity description to NACE Rev. 2.1 codes. Tokenizes the input, scores by matched terms, and returns the top 5 candidates with a reason. Ideal for AI agents classifying business activities.",
      inputSchema: {
        type: "object",
        properties: {
          activity_description: {
            type: "string",
            description: "Free-text description of the economic activity to classify",
          },
        },
        required: ["activity_description"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  // ── nace_get ────────────────────────────────────────────────────────────────
  if (name === "nace_get") {
    const code = String(args.code ?? "");
    const resolved = resolveCode(code);
    if (!resolved) {
      return errorText(
        `Code "${code}" not found. Use nace_browse() to explore available codes.`
      );
    }
    const entry = byCode.get(resolved)!;
    return text(
      JSON.stringify(
        { code: entry.code, label: entry.label, level: entry.level, parent: entry.parent },
        null,
        2
      )
    );
  }

  // ── nace_browse ─────────────────────────────────────────────────────────────
  if (name === "nace_browse") {
    const rawParent = args.parent_code ? String(args.parent_code) : "";

    if (!rawParent.trim()) {
      const codes = (children.get(ROOT_KEY) ?? []).slice(0, 50);
      const results = codes.map((c) => {
        const e = byCode.get(c)!;
        return { code: e.code, label: e.label };
      });
      return text(JSON.stringify(results, null, 2));
    }

    const resolved = resolveCode(rawParent);
    if (!resolved) return errorText(`Code "${rawParent}" not found.`);

    const childCodes = (children.get(resolved) ?? []).slice(0, 50);
    const results = childCodes.map((c) => {
      const e = byCode.get(c)!;
      return { code: e.code, label: e.label };
    });
    return text(JSON.stringify(results, null, 2));
  }

  // ── nace_search ─────────────────────────────────────────────────────────────
  if (name === "nace_search") {
    const q = String(args.query ?? "").trim();
    if (!q) return errorText("Query must not be empty.");

    const needle = q.toLowerCase();
    const results: { code: string; label: string; level: NaceLevel }[] = [];

    for (const entry of byCode.values()) {
      if (entry.label.toLowerCase().includes(needle)) {
        results.push({ code: entry.code, label: entry.label, level: entry.level });
        if (results.length === 10) break;
      }
    }
    return text(JSON.stringify(results, null, 2));
  }

  // ── nace_suggest ─────────────────────────────────────────────────────────────
  if (name === "nace_suggest") {
    const STOP = new Set([
      "and", "the", "for", "with", "are", "its", "this", "that",
      "into", "from", "not", "all", "but", "other", "than",
    ]);

    const desc = String(args.activity_description ?? "").trim();
    if (!desc) return errorText("activity_description must not be empty.");

    const tokens = desc
      .toLowerCase()
      .split(/\s+/)
      .filter((t: string) => t.length >= 3 && !STOP.has(t));

    if (tokens.length === 0) {
      return text("No meaningful tokens found. Try a more descriptive phrase.");
    }

    const candidates: {
      code: string;
      label: string;
      level: NaceLevel;
      reason: string;
      score: number;
    }[] = [];

    for (const entry of byCode.values()) {
      const labelLower = entry.label.toLowerCase();
      const matched = tokens.filter((t: string) => labelLower.includes(t));
      if (matched.length === 0) continue;
      candidates.push({
        code: entry.code,
        label: entry.label,
        level: entry.level,
        reason: `Matched: ${matched.map((t: string) => `"${t}"`).join(", ")}`,
        score: matched.length,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const top5 = candidates.slice(0, 5).map(({ code, label, level, reason }) => ({
      code,
      label,
      level,
      reason,
    }));
    return text(JSON.stringify(top5, null, 2));
  }

  return errorText(`Unknown tool: ${name}`);
});

// ── Connect ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
