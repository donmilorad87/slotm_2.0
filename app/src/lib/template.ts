import { promises as fs } from "node:fs";

const HANDLEBARS_IF_BLOCK = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;
const HANDLEBARS_RAW_VAR = /\{\{\{\s*([a-zA-Z0-9_]+)\s*\}\}\}/g;
const HANDLEBARS_VAR = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const ELSE_TAG = "{{else}}";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isTruthy(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && value !== false && value !== 0;
}

function processConditionals(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(HANDLEBARS_IF_BLOCK, (_match, key: string, body: string) => {
    const elseIdx = body.indexOf(ELSE_TAG);
    const truthyBranch = elseIdx >= 0 ? body.slice(0, elseIdx) : body;
    const falsyBranch = elseIdx >= 0 ? body.slice(elseIdx + ELSE_TAG.length) : "";
    return isTruthy(context[key]) ? truthyBranch : falsyBranch;
  });
}

export async function renderTemplate(
  templatePath: string,
  context: Record<string, unknown>,
): Promise<string> {
  const template = await fs.readFile(templatePath, "utf8");

  const withConditionals = processConditionals(template, context);

  const withRaw = withConditionals.replace(HANDLEBARS_RAW_VAR, (_, key) => {
    if (!(key in context)) {
      return "";
    }
    return String(context[key]);
  });

  return withRaw.replace(HANDLEBARS_VAR, (_, key) => {
    if (!(key in context)) {
      return "";
    }
    return escapeHtml(context[key]);
  });
}
