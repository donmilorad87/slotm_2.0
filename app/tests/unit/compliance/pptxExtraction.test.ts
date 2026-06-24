import { describe, it, expect } from "@jest/globals";
import JSZip from "jszip";

import { PptxDocument } from "../../../src/compliance/PptxDocument.js";
import { evaluateDeterministicRules } from "../../../src/compliance/deterministic.js";
import type { ParsedDeck } from "../../../src/compliance/model.js";
import type { DeterministicRuleRecord } from "../../../src/types/compliance.js";

// --- Minimal OOXML fixtures ------------------------------------------------
// We hand-build just enough of a .pptx for the parser: a presentation that
// orders one slide, a slide with a chart graphicFrame, a diagram graphicFrame,
// and a group shape, plus the chart and diagram parts those frames reference.

const PRESENTATION_XML = `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
</p:presentation>`;

const PRESENTATION_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;

const SLIDE_XML = `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
      <p:txBody><a:p><a:r><a:t>Ordinary Title</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:graphicFrame>
      <p:xfrm><a:off x="100" y="100"/><a:ext cx="200" cy="200"/></p:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
        <c:chart r:id="rId2"/>
      </a:graphicData></a:graphic>
    </p:graphicFrame>
    <p:graphicFrame>
      <p:xfrm><a:off x="300" y="300"/><a:ext cx="200" cy="200"/></p:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
        <dgm:relIds r:dm="rId3" r:lo="rId4" r:qs="rId5" r:cs="rId6"/>
      </a:graphicData></a:graphic>
    </p:graphicFrame>
    <p:grpSp>
      <p:nvGrpSpPr/><p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:nvPr/></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>Grouped TGT label</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:grpSp>
  </p:spTree></p:cSld>
</p:sld>`;

const SLIDE_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/data1.xml"/>
</Relationships>`;

const CHART_XML = `<?xml version="1.0"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title><c:tx><c:rich><a:p><a:r><a:t>Percentile Distribution</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea>
      <c:barChart>
        <c:ser>
          <c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:pt idx="0"><c:v>Base Salary</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:cat><c:strRef><c:f>Sheet1!$A$2:$A$3</c:f><c:strCache>
            <c:pt idx="0"><c:v>25th %ile</c:v></c:pt>
            <c:pt idx="1"><c:v>Median Group</c:v></c:pt>
          </c:strCache></c:strRef></c:cat>
          <c:val><c:numRef><c:f>Sheet1!$B$2:$B$3</c:f><c:numCache>
            <c:pt idx="0"><c:v>123456</c:v></c:pt>
          </c:numCache></c:numRef></c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
  </c:chart>
</c:chartSpace>`;

const DIAGRAM_XML = `<?xml version="1.0"?>
<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <dgm:ptLst>
    <dgm:pt><dgm:t><a:bodyPr/><a:p><a:r><a:t>Diagram Node One</a:t></a:r></a:p></dgm:t></dgm:pt>
    <dgm:pt><dgm:t><a:bodyPr/><a:p><a:r><a:t>Second Node</a:t></a:r></a:p></dgm:t></dgm:pt>
  </dgm:ptLst>
</dgm:dataModel>`;

async function buildPptx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", PRESENTATION_XML);
  zip.file("ppt/_rels/presentation.xml.rels", PRESENTATION_RELS);
  zip.file("ppt/slides/slide1.xml", SLIDE_XML);
  zip.file("ppt/slides/_rels/slide1.xml.rels", SLIDE_RELS);
  zip.file("ppt/charts/chart1.xml", CHART_XML);
  zip.file("ppt/diagrams/data1.xml", DIAGRAM_XML);
  return zip.generateAsync({ type: "nodebuffer" });
}

function forbiddenTextRule(needle: string): DeterministicRuleRecord {
  return {
    id: 1,
    ruleType: "forbidden_text",
    scope: "any",
    numberValue: null,
    textValue: needle,
    replaceValue: null,
    severity: "warning",
    autoFix: true, // even with autoFix on, extracted text must stay flag-only
    enabled: true,
    name: `No "${needle}"`,
  };
}

function searchReplaceRule(find: string, replace: string): DeterministicRuleRecord {
  return {
    id: 2,
    ruleType: "search_replace",
    scope: "any",
    numberValue: null,
    textValue: find,
    replaceValue: replace,
    severity: "warning",
    autoFix: true,
    enabled: true,
    name: `Replace ${find}`,
  };
}

describe("PptxDocument chart/diagram/group extraction", () => {
  it("extracts chart label text (titles, series, categories), skipping numeric data", async () => {
    const doc = await PptxDocument.load(await buildPptx());
    const deck = doc.getDeck();
    const chart = deck.slides[0]?.shapes.find((s) => s.kind === "chart");
    expect(chart).toBeDefined();
    expect(chart?.text).toContain("Percentile Distribution");
    expect(chart?.text).toContain("Base Salary");
    expect(chart?.text).toContain("25th %ile");
    expect(chart?.text).toContain("Median Group");
    // Numeric data values must NOT be pulled in.
    expect(chart?.text).not.toContain("123456");
    // Formula refs must not leak.
    expect(chart?.text).not.toContain("Sheet1");
    // Surfaced read-only.
    expect(chart?.editable).toBe(false);
  });

  it("extracts SmartArt/diagram node text", async () => {
    const doc = await PptxDocument.load(await buildPptx());
    const deck = doc.getDeck();
    const diagram = deck.slides[0]?.shapes.find((s) => s.kind === "diagram");
    expect(diagram).toBeDefined();
    expect(diagram?.text).toContain("Diagram Node One");
    expect(diagram?.text).toContain("Second Node");
    expect(diagram?.editable).toBe(false);
  });

  it("extracts text from grouped shapes", async () => {
    const doc = await PptxDocument.load(await buildPptx());
    const deck = doc.getDeck();
    const group = deck.slides[0]?.shapes.find((s) => s.kind === "group");
    expect(group).toBeDefined();
    expect(group?.text).toContain("Grouped TGT label");
    expect(group?.editable).toBe(false);
  });

  it("keeps ordinary editable text working", async () => {
    const doc = await PptxDocument.load(await buildPptx());
    const deck = doc.getDeck();
    const title = deck.slides[0]?.shapes.find((s) => s.kind === "text");
    expect(title?.text).toBe("Ordinary Title");
    expect(title?.editable).toBe(true);
  });

  it("deterministic forbidden_text flags chart text, but flag-only (no auto-fix)", async () => {
    const doc = await PptxDocument.load(await buildPptx());
    const deck = doc.getDeck();
    const flags = evaluateDeterministicRules(deck, [forbiddenTextRule("Percentile")]);
    expect(flags.length).toBeGreaterThan(0);
    const chartFlag = flags[0];
    expect(chartFlag?.autoFixable).toBe(false);
    expect(chartFlag?.fixOps ?? []).toHaveLength(0);
  });

  it("deterministic forbidden_text flags grouped text (TGT)", async () => {
    const doc = await PptxDocument.load(await buildPptx());
    const deck = doc.getDeck();
    const flags = evaluateDeterministicRules(deck, [forbiddenTextRule("TGT")]);
    expect(flags.some((f) => !f.autoFixable)).toBe(true);
  });

  // Regression: the same run position in different table cells must produce
  // distinct dedupe keys, else the unique (analysis_set_id, dedupe_key) insert
  // throws "Unique constraint failed" and analyze returns 400.
  it("repeated table matches yield unique dedupe keys", () => {
    const word = "Percentile";
    const deck: ParsedDeck = {
      slideSize: { cx: 100, cy: 100 },
      themeFonts: { major: null, minor: null },
      slides: [
        {
          slideIndex: 0,
          text: word,
          shapes: [
            {
              shapeIndex: 0,
              kind: "table",
              placeholder: null,
              bbox: null,
              text: word,
              paragraphs: [],
              editable: true,
              table: {
                rows: [0, 1, 2].map((rowIndex) => ({
                  rowIndex,
                  text: word,
                  cells: [
                    {
                      rowIndex,
                      cellIndex: 0,
                      fillHex: null,
                      text: word,
                      runs: [
                        {
                          text: word,
                          sizeHundredths: null,
                          bold: false,
                          italic: false,
                          colorHex: null,
                          typeface: null,
                          paraIndex: 0,
                          runIndex: 0,
                        },
                      ],
                    },
                  ],
                })),
              },
            },
          ],
        },
      ],
    };
    const flags = evaluateDeterministicRules(deck, [forbiddenTextRule(word)]);
    expect(flags).toHaveLength(3);
    const keys = new Set(flags.map((f) => f.dedupeKey));
    expect(keys.size).toBe(flags.length);
  });

  it("search_replace auto-fixes editable table text (Percentile → %ile)", () => {
    const deck: ParsedDeck = {
      slideSize: { cx: 100, cy: 100 },
      themeFonts: { major: null, minor: null },
      slides: [
        {
          slideIndex: 0,
          text: "Percentile",
          shapes: [
            {
              shapeIndex: 0,
              kind: "table",
              placeholder: null,
              bbox: null,
              text: "Percentile",
              paragraphs: [],
              editable: true,
              table: {
                rows: [
                  {
                    rowIndex: 0,
                    text: "Percentile",
                    cells: [
                      {
                        rowIndex: 0,
                        cellIndex: 0,
                        fillHex: null,
                        text: "Percentile",
                        runs: [
                          {
                            text: "25th Percentile",
                            sizeHundredths: null,
                            bold: false,
                            italic: false,
                            colorHex: null,
                            typeface: null,
                            paraIndex: 0,
                            runIndex: 0,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const flags = evaluateDeterministicRules(deck, [searchReplaceRule("Percentile", "%ile")]);
    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag?.autoFixable).toBe(true);
    expect(flag?.fixOps).toEqual([
      {
        op: "setRunText",
        addr: { slideIndex: 0, shapeIndex: 0, rowIndex: 0, cellIndex: 0, paraIndex: 0, runIndex: 0 },
        find: "Percentile",
        replace: "%ile",
      },
    ]);
  });

  it("search_replace on read-only chart text is flag-only", async () => {
    const doc = await PptxDocument.load(await buildPptx());
    const deck = doc.getDeck();
    const flags = evaluateDeterministicRules(deck, [searchReplaceRule("Percentile", "%ile")]);
    // The chart title "Percentile Distribution" matches, but chart text is read-only.
    const chartFlag = flags.find((f) => f.message.includes("Percentile"));
    expect(chartFlag).toBeDefined();
    expect(chartFlag?.autoFixable).toBe(false);
    expect(chartFlag?.fixOps ?? []).toHaveLength(0);
  });
});
