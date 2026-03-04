import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { renderTemplate } from "../../../src/lib/template.js";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "template-test-"));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeTmp(name: string, content: string): Promise<string> {
  const filePath = path.join(tmpDir, name);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

describe("renderTemplate", () => {
  it("substitutes simple variables with HTML escaping", async () => {
    const file = await writeTmp("simple.hbs", "Hello {{name}}!");
    const result = await renderTemplate(file, { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("escapes HTML in regular variables", async () => {
    const file = await writeTmp("escape.hbs", "Value: {{value}}");
    const result = await renderTemplate(file, { value: "<script>alert('xss')</script>" });
    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("does not escape raw triple-brace variables", async () => {
    const file = await writeTmp("raw.hbs", "Raw: {{{html}}}");
    const result = await renderTemplate(file, { html: "<b>bold</b>" });
    expect(result).toBe("Raw: <b>bold</b>");
  });

  it("renders if-block truthy branch", async () => {
    const file = await writeTmp("if.hbs", "{{#if show}}visible{{/if}}");
    const result = await renderTemplate(file, { show: true });
    expect(result).toBe("visible");
  });

  it("renders if-block falsy branch as empty", async () => {
    const file = await writeTmp("if-false.hbs", "{{#if show}}visible{{/if}}");
    const result = await renderTemplate(file, { show: false });
    expect(result).toBe("");
  });

  it("renders else branch when condition is falsy", async () => {
    const file = await writeTmp("else.hbs", "{{#if show}}yes{{else}}no{{/if}}");
    const result = await renderTemplate(file, { show: false });
    expect(result).toBe("no");
  });

  it("renders else branch for undefined variable", async () => {
    const file = await writeTmp("else-undef.hbs", "{{#if missing}}yes{{else}}no{{/if}}");
    const result = await renderTemplate(file, {});
    expect(result).toBe("no");
  });

  it("treats empty string as falsy", async () => {
    const file = await writeTmp("empty.hbs", "{{#if val}}yes{{else}}no{{/if}}");
    const result = await renderTemplate(file, { val: "" });
    expect(result).toBe("no");
  });

  it("treats 0 as falsy", async () => {
    const file = await writeTmp("zero.hbs", "{{#if val}}yes{{else}}no{{/if}}");
    const result = await renderTemplate(file, { val: 0 });
    expect(result).toBe("no");
  });

  it("replaces missing variables with empty string", async () => {
    const file = await writeTmp("missing.hbs", "Hello {{name}}!");
    const result = await renderTemplate(file, {});
    expect(result).toBe("Hello !");
  });
});
