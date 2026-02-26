import { promises as fs } from "node:fs";

const HANDLEBARS_RAW_VAR = /\{\{\{\s*([a-zA-Z0-9_]+)\s*\}\}\}/g;
const HANDLEBARS_VAR = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function renderTemplate(templatePath, context) {
  const template = await fs.readFile(templatePath, "utf8");
  const withRaw = template.replace(HANDLEBARS_RAW_VAR, (_, key) => {
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
