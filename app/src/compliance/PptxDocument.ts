import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

import type {
  BBoxEmu,
  FixOp,
  ParsedCell,
  ParsedDeck,
  ParsedParagraph,
  ParsedRow,
  ParsedRun,
  ParsedShape,
  ParsedSlide,
  ParsedTable,
  RunAddress,
} from "./model.js";
import {
  allChildren,
  asNodeArray,
  childrenOf,
  collectLabelText,
  descend,
  elementNode,
  firstChild,
  gatherText,
  getAttr,
  isRecord,
  nodeTag,
  pushChild,
  setAttr,
  setChildren,
  textNode,
  type XmlNode,
} from "./xml.js";

const DRAWABLE_TAGS = new Set(["p:sp", "p:pic", "p:graphicFrame", "p:grpSp", "p:cxnSp"]);
const FILL_TAGS = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"]);
const DEFAULT_SLIDE_CX = 9144000;
const DEFAULT_SLIDE_CY = 6858000;

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  ignoreDeclaration: false,
  processEntities: true,
} as const;

const BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  suppressEmptyNode: true,
  format: false,
  processEntities: true,
} as const;

/**
 * Surgical reader/editor for a .pptx (OPC zip of OOXML). Parses slides into a
 * clean ParsedDeck for rules; edits are minimal node mutations addressed by the
 * same deterministic indices the parser records, so FixOps replay faithfully
 * against a freshly-loaded original.
 */
export class PptxDocument {
  private highlightCounter = 90000;

  private constructor(
    private readonly zip: JSZip,
    private readonly slideEntryNames: string[],
    private readonly slideTrees: XmlNode[][],
    private readonly slideSize: { cx: number; cy: number },
    private readonly themeFonts: { major: string | null; minor: string | null },
    private readonly parser: XMLParser,
    private readonly builder: XMLBuilder,
    /** Per-slide label text from referenced chart/diagram parts, keyed by relId. */
    private readonly partTextBySlide: Map<number, Map<string, string[]>>,
  ) {}

  static async load(buffer: Buffer): Promise<PptxDocument> {
    const parser = new XMLParser(PARSER_OPTIONS);
    const builder = new XMLBuilder(BUILDER_OPTIONS);
    const zip = await JSZip.loadAsync(buffer);

    const slideEntryNames = await PptxDocument.resolveSlideOrder(zip, parser);
    const slideTrees: XmlNode[][] = [];
    for (const name of slideEntryNames) {
      const xml = await PptxDocument.readEntry(zip, name);
      slideTrees.push(parser.parse(xml));
    }

    const slideSize = await PptxDocument.readSlideSize(zip, parser);
    const themeFonts = await PptxDocument.readThemeFonts(zip, parser);
    const partTextBySlide = await PptxDocument.extractPartText(zip, parser, slideEntryNames);
    return new PptxDocument(
      zip,
      slideEntryNames,
      slideTrees,
      slideSize,
      themeFonts,
      parser,
      builder,
      partTextBySlide,
    );
  }

  /**
   * Pre-reads each slide's chart and SmartArt-diagram parts (they live outside
   * the slide XML) and caches their label text keyed by the slide's relId, so
   * the synchronous slide parse can surface it. Failures are swallowed per part
   * — a malformed chart must not break analysis of the rest of the deck.
   */
  private static async extractPartText(
    zip: JSZip,
    parser: XMLParser,
    slideEntryNames: string[],
  ): Promise<Map<number, Map<string, string[]>>> {
    const bySlide = new Map<number, Map<string, string[]>>();
    for (let slideIndex = 0; slideIndex < slideEntryNames.length; slideIndex += 1) {
      const name = slideEntryNames[slideIndex];
      if (!name) {
        continue;
      }
      const byRel = new Map<string, string[]>();
      bySlide.set(slideIndex, byRel);
      const slash = name.lastIndexOf("/");
      const dir = slash >= 0 ? name.slice(0, slash) : "";
      const file = slash >= 0 ? name.slice(slash + 1) : name;
      const relsPath = `${dir}/_rels/${file}.rels`;
      const relsFile = zip.file(relsPath);
      if (!relsFile) {
        continue;
      }
      const relsRoot = firstChild(parser.parse(await relsFile.async("string")), "Relationships");
      if (!relsRoot) {
        continue;
      }
      for (const rel of allChildren(childrenOf(relsRoot), "Relationship")) {
        const type = getAttr(rel, "Type") ?? "";
        const id = getAttr(rel, "Id");
        const target = getAttr(rel, "Target");
        if (!id || !target) {
          continue;
        }
        // Only the parts that actually carry slide-visible label text.
        if (!type.endsWith("/chart") && !type.endsWith("/diagramData")) {
          continue;
        }
        const partPath = PptxDocument.resolvePartPath(name, target);
        const partFile = zip.file(partPath);
        if (!partFile) {
          continue;
        }
        try {
          const tree = parser.parse(await partFile.async("string"));
          const lines: string[] = [];
          for (const node of asNodeArray(tree)) {
            lines.push(...collectLabelText(node));
          }
          byRel.set(id, lines);
        } catch {
          // ignore an unreadable/garbled part
        }
      }
    }
    return bySlide;
  }

  /** Resolve an OPC relationship Target (relative to a part) to a zip entry path. */
  private static resolvePartPath(basePart: string, target: string): string {
    if (target.startsWith("/")) {
      return target.replace(/^\/+/, "");
    }
    const baseDir = basePart.includes("/") ? basePart.slice(0, basePart.lastIndexOf("/")) : "";
    const segments = baseDir.length > 0 ? baseDir.split("/") : [];
    for (const seg of target.split("/")) {
      if (seg === "..") {
        segments.pop();
      } else if (seg !== "." && seg !== "") {
        segments.push(seg);
      }
    }
    return segments.join("/");
  }

  private static async readEntry(zip: JSZip, name: string): Promise<string> {
    const file = zip.file(name);
    if (!file) {
      throw new Error(`Missing PPTX part: ${name}`);
    }
    return file.async("string");
  }

  private static async resolveSlideOrder(zip: JSZip, parser: XMLParser): Promise<string[]> {
    const fallback = (): string[] =>
      Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const na = Number(a.replace(/\D/g, ""));
          const nb = Number(b.replace(/\D/g, ""));
          return na - nb;
        });

    const presFile = zip.file("ppt/presentation.xml");
    const relsFile = zip.file("ppt/_rels/presentation.xml.rels");
    if (!presFile || !relsFile) {
      return fallback();
    }

    const relIdToTarget = new Map<string, string>();
    const relsTree = parser.parse(await relsFile.async("string"));
    const relsRoot = firstChild(relsTree, "Relationships");
    if (relsRoot) {
      for (const rel of allChildren(childrenOf(relsRoot), "Relationship")) {
        const id = getAttr(rel, "Id");
        const target = getAttr(rel, "Target");
        if (id && target) {
          relIdToTarget.set(id, target.replace(/^\//, ""));
        }
      }
    }

    const presTree = parser.parse(await presFile.async("string"));
    const presentation = firstChild(presTree, "p:presentation");
    const sldIdLst = presentation ? firstChild(childrenOf(presentation), "p:sldIdLst") : undefined;
    if (!sldIdLst) {
      return fallback();
    }

    const ordered: string[] = [];
    for (const sldId of allChildren(childrenOf(sldIdLst), "p:sldId")) {
      const rid = getAttr(sldId, "r:id");
      if (!rid) {
        continue;
      }
      const target = relIdToTarget.get(rid);
      if (!target) {
        continue;
      }
      const normalized = target.startsWith("ppt/") ? target : `ppt/${target}`;
      ordered.push(normalized);
    }
    return ordered.length > 0 ? ordered : fallback();
  }

  private static async readSlideSize(
    zip: JSZip,
    parser: XMLParser,
  ): Promise<{ cx: number; cy: number }> {
    const presFile = zip.file("ppt/presentation.xml");
    if (!presFile) {
      return { cx: DEFAULT_SLIDE_CX, cy: DEFAULT_SLIDE_CY };
    }
    const tree = parser.parse(await presFile.async("string"));
    const presentation = firstChild(tree, "p:presentation");
    const sldSz = presentation ? firstChild(childrenOf(presentation), "p:sldSz") : undefined;
    if (!sldSz) {
      return { cx: DEFAULT_SLIDE_CX, cy: DEFAULT_SLIDE_CY };
    }
    const cx = Number(getAttr(sldSz, "cx") ?? DEFAULT_SLIDE_CX);
    const cy = Number(getAttr(sldSz, "cy") ?? DEFAULT_SLIDE_CY);
    return {
      cx: Number.isFinite(cx) && cx > 0 ? cx : DEFAULT_SLIDE_CX,
      cy: Number.isFinite(cy) && cy > 0 ? cy : DEFAULT_SLIDE_CY,
    };
  }

  private static async readThemeFonts(
    zip: JSZip,
    parser: XMLParser,
  ): Promise<{ major: string | null; minor: string | null }> {
    const themeFile = zip.file("ppt/theme/theme1.xml");
    if (!themeFile) {
      return { major: null, minor: null };
    }
    const tree = parser.parse(await themeFile.async("string"));
    const theme = firstChild(tree, "a:theme");
    const fontScheme = theme
      ? descend(theme, ["a:themeElements", "a:fontScheme"])
      : undefined;
    if (!fontScheme) {
      return { major: null, minor: null };
    }
    const readFace = (group: string): string | null => {
      const g = firstChild(childrenOf(fontScheme), group);
      const latin = g ? firstChild(childrenOf(g), "a:latin") : undefined;
      return latin ? getAttr(latin, "typeface") ?? null : null;
    };
    return { major: readFace("a:majorFont"), minor: readFace("a:minorFont") };
  }

  // --- Public projection ----------------------------------------------------

  getDeck(): ParsedDeck {
    const slides: ParsedSlide[] = this.slideTrees.map((_tree, slideIndex) =>
      this.parseSlide(slideIndex),
    );
    return { slideSize: this.slideSize, slides, themeFonts: this.themeFonts };
  }

  get slideCount(): number {
    return this.slideTrees.length;
  }

  // --- Parsing --------------------------------------------------------------

  private spTreeNode(slideIndex: number): XmlNode | undefined {
    const root = this.slideTrees[slideIndex];
    if (!root) {
      return undefined;
    }
    const sld = firstChild(root, "p:sld");
    const cSld = sld ? firstChild(childrenOf(sld), "p:cSld") : undefined;
    return cSld ? firstChild(childrenOf(cSld), "p:spTree") : undefined;
  }

  private shapeNodes(slideIndex: number): XmlNode[] {
    const spTree = this.spTreeNode(slideIndex);
    if (!spTree) {
      return [];
    }
    return childrenOf(spTree).filter((child) => DRAWABLE_TAGS.has(nodeTag(child)));
  }

  private static bboxOf(shape: XmlNode): BBoxEmu | null {
    const xfrm =
      descend(shape, ["p:spPr", "a:xfrm"]) ?? firstChild(childrenOf(shape), "p:xfrm");
    if (!xfrm) {
      return null;
    }
    const off = firstChild(childrenOf(xfrm), "a:off");
    const ext = firstChild(childrenOf(xfrm), "a:ext");
    if (!off || !ext) {
      return null;
    }
    return {
      x: Number(getAttr(off, "x") ?? 0),
      y: Number(getAttr(off, "y") ?? 0),
      cx: Number(getAttr(ext, "cx") ?? 0),
      cy: Number(getAttr(ext, "cy") ?? 0),
    };
  }

  private static tableOf(shape: XmlNode): XmlNode | undefined {
    if (nodeTag(shape) !== "p:graphicFrame") {
      return undefined;
    }
    return descend(shape, ["a:graphic", "a:graphicData", "a:tbl"]);
  }

  private static runProps(runNode: XmlNode, paraIndex: number, runIndex: number): ParsedRun {
    const rPr = firstChild(childrenOf(runNode), "a:rPr");
    let sizeHundredths: number | null = null;
    let bold = false;
    let italic = false;
    let colorHex: string | null = null;
    let typeface: string | null = null;
    if (rPr) {
      const sz = getAttr(rPr, "sz");
      if (sz && Number.isFinite(Number(sz))) {
        sizeHundredths = Number(sz);
      }
      bold = getAttr(rPr, "b") === "1";
      italic = getAttr(rPr, "i") === "1";
      const fill = firstChild(childrenOf(rPr), "a:solidFill");
      if (fill) {
        const srgb = firstChild(childrenOf(fill), "a:srgbClr");
        const val = srgb ? getAttr(srgb, "val") : undefined;
        if (val) {
          colorHex = val.toUpperCase();
        }
      }
      const latin = firstChild(childrenOf(rPr), "a:latin");
      const face = latin ? getAttr(latin, "typeface") : undefined;
      if (face) {
        typeface = face;
      }
    }
    const tNode = firstChild(childrenOf(runNode), "a:t");
    const text = tNode ? gatherText(tNode) : "";
    return { text, sizeHundredths, bold, italic, colorHex, typeface, paraIndex, runIndex };
  }

  private static paragraphsOf(container: XmlNode | undefined): ParsedParagraph[] {
    if (!container) {
      return [];
    }
    const txBody =
      firstChild(childrenOf(container), "p:txBody") ??
      firstChild(childrenOf(container), "a:txBody");
    if (!txBody) {
      return [];
    }
    const paras = allChildren(childrenOf(txBody), "a:p");
    return paras.map((para, paraIndex) => {
      const runs = allChildren(childrenOf(para), "a:r").map((run, runIndex) =>
        PptxDocument.runProps(run, paraIndex, runIndex),
      );
      return { runs, text: runs.map((r) => r.text).join("") };
    });
  }

  private static cellFill(cellNode: XmlNode): string | null {
    const tcPr = firstChild(childrenOf(cellNode), "a:tcPr");
    if (!tcPr) {
      return null;
    }
    const fill = firstChild(childrenOf(tcPr), "a:solidFill");
    if (!fill) {
      return null;
    }
    const srgb = firstChild(childrenOf(fill), "a:srgbClr");
    const val = srgb ? getAttr(srgb, "val") : undefined;
    return val ? val.toUpperCase() : null;
  }

  private static parseTable(tbl: XmlNode): ParsedTable {
    const rows: ParsedRow[] = allChildren(childrenOf(tbl), "a:tr").map((row, rowIndex) => {
      const cells: ParsedCell[] = allChildren(childrenOf(row), "a:tc").map(
        (cell, cellIndex) => {
          const paragraphs = PptxDocument.paragraphsOf(cell);
          const runs: ParsedRun[] = [];
          paragraphs.forEach((p, paraIdx) => {
            p.runs.forEach((r, runIdx) => {
              runs.push({ ...r, paraIndex: paraIdx, runIndex: runIdx });
            });
          });
          return {
            rowIndex,
            cellIndex,
            fillHex: PptxDocument.cellFill(cell),
            text: paragraphs.map((p) => p.text).join(" ").trim(),
            runs,
          };
        },
      );
      return { rowIndex, cells, text: cells.map((c) => c.text).join(" ").trim() };
    });
    return { rows };
  }

  private static placeholderOf(shape: XmlNode): string | null {
    const ph = descend(shape, ["p:nvSpPr", "p:nvPr", "p:ph"]);
    if (!ph) {
      return null;
    }
    // A <p:ph> with no explicit type defaults to a body placeholder.
    return getAttr(ph, "type") ?? "body";
  }

  /** Read-only shape (chart/diagram/group): text exists but FixOps can't edit it. */
  private static readonlyShape(
    shapeIndex: number,
    kind: "chart" | "diagram" | "group",
    placeholder: string | null,
    bbox: BBoxEmu | null,
    lines: readonly string[],
  ): ParsedShape {
    const paragraphs: ParsedParagraph[] = lines.map((line, paraIndex) => ({
      runs: [
        {
          text: line,
          sizeHundredths: null,
          bold: false,
          italic: false,
          colorHex: null,
          typeface: null,
          paraIndex,
          runIndex: 0,
        },
      ],
      text: line,
    }));
    return {
      shapeIndex,
      kind,
      placeholder,
      bbox,
      text: lines.join("\n"),
      paragraphs,
      table: null,
      editable: false,
    };
  }

  /** Chart/diagram label text for a graphicFrame, looked up by its relId. */
  private static graphicFramePartText(
    frame: XmlNode,
    partText: Map<string, string[]>,
  ): { kind: "chart" | "diagram"; lines: string[] } | null {
    const gData = descend(frame, ["a:graphic", "a:graphicData"]);
    if (!gData) {
      return null;
    }
    const uri = getAttr(gData, "uri") ?? "";
    if (uri.includes("/chart")) {
      const chart = firstChild(childrenOf(gData), "c:chart");
      const rid = chart ? getAttr(chart, "r:id") : undefined;
      return { kind: "chart", lines: rid ? partText.get(rid) ?? [] : [] };
    }
    if (uri.includes("/diagram")) {
      const rel = firstChild(childrenOf(gData), "dgm:relIds");
      const rid = rel ? getAttr(rel, "r:dm") : undefined;
      return { kind: "diagram", lines: rid ? partText.get(rid) ?? [] : [] };
    }
    return null;
  }

  /** Recursively gather text from a group's nested shapes, tables, and charts. */
  private static collectGroupText(group: XmlNode, partText: Map<string, string[]>): string[] {
    const out: string[] = [];
    const walk = (node: XmlNode): void => {
      for (const child of childrenOf(node)) {
        const tag = nodeTag(child);
        if (tag === "p:sp" || tag === "p:cxnSp") {
          for (const para of PptxDocument.paragraphsOf(child)) {
            if (para.text.trim().length > 0) {
              out.push(para.text);
            }
          }
        } else if (tag === "p:graphicFrame") {
          const tbl = PptxDocument.tableOf(child);
          if (tbl) {
            for (const row of PptxDocument.parseTable(tbl).rows) {
              if (row.text.trim().length > 0) {
                out.push(row.text);
              }
            }
          } else {
            const part = PptxDocument.graphicFramePartText(child, partText);
            if (part) {
              out.push(...part.lines);
            }
          }
        } else if (tag === "p:grpSp") {
          walk(child);
        }
      }
    };
    walk(group);
    return out;
  }

  private parseSlide(slideIndex: number): ParsedSlide {
    const shapeNodes = this.shapeNodes(slideIndex);
    const partText = this.partTextBySlide.get(slideIndex) ?? new Map<string, string[]>();
    const shapes: ParsedShape[] = shapeNodes.map((node, shapeIndex) => {
      const tag = nodeTag(node);
      const bbox = PptxDocument.bboxOf(node);
      const placeholder = PptxDocument.placeholderOf(node);

      // Charts / SmartArt diagrams: a graphicFrame whose text lives in a separate
      // part. Surface it read-only so rules and the AI can see it.
      if (tag === "p:graphicFrame") {
        const tbl = PptxDocument.tableOf(node);
        if (!tbl) {
          const part = PptxDocument.graphicFramePartText(node, partText);
          if (part) {
            return PptxDocument.readonlyShape(shapeIndex, part.kind, placeholder, bbox, part.lines);
          }
        }
      }

      // Grouped shapes: never editable in place here, but their text matters.
      if (tag === "p:grpSp") {
        const lines = PptxDocument.collectGroupText(node, partText);
        if (lines.length > 0) {
          return PptxDocument.readonlyShape(shapeIndex, "group", placeholder, bbox, lines);
        }
      }

      const tbl = PptxDocument.tableOf(node);
      if (tbl) {
        const table = PptxDocument.parseTable(tbl);
        const text = table.rows.map((r) => r.text).join(" · ");
        return { shapeIndex, kind: "table", placeholder, bbox, text, paragraphs: [], table, editable: true };
      }
      const paragraphs = PptxDocument.paragraphsOf(node);
      if (paragraphs.length > 0) {
        const text = paragraphs.map((p) => p.text).join("\n");
        return { shapeIndex, kind: "text", placeholder, bbox, text, paragraphs, table: null, editable: true };
      }
      return { shapeIndex, kind: "other", placeholder, bbox, text: "", paragraphs: [], table: null, editable: true };
    });
    const text = shapes
      .map((s) => s.text)
      .filter((t) => t.length > 0)
      .join("\n");
    return { slideIndex, shapes, text };
  }

  // --- Editing --------------------------------------------------------------

  private resolveShapeNode(slideIndex: number, shapeIndex: number): XmlNode | undefined {
    return this.shapeNodes(slideIndex)[shapeIndex];
  }

  private resolveRunNode(addr: RunAddress): XmlNode | undefined {
    const shape = this.resolveShapeNode(addr.slideIndex, addr.shapeIndex);
    if (!shape) {
      return undefined;
    }
    let container: XmlNode | undefined = shape;
    if (addr.rowIndex !== undefined && addr.cellIndex !== undefined) {
      const tbl = PptxDocument.tableOf(shape);
      const row = tbl ? allChildren(childrenOf(tbl), "a:tr")[addr.rowIndex] : undefined;
      container = row ? allChildren(childrenOf(row), "a:tc")[addr.cellIndex] : undefined;
    }
    if (!container) {
      return undefined;
    }
    const txBody =
      firstChild(childrenOf(container), "p:txBody") ??
      firstChild(childrenOf(container), "a:txBody");
    const para = txBody ? allChildren(childrenOf(txBody), "a:p")[addr.paraIndex] : undefined;
    return para ? allChildren(childrenOf(para), "a:r")[addr.runIndex] : undefined;
  }

  private static ensureRPr(runNode: XmlNode): XmlNode {
    const existing = firstChild(childrenOf(runNode), "a:rPr");
    if (existing) {
      return existing;
    }
    const rPr = elementNode("a:rPr", { "lang": "en-US" });
    const tag = nodeTag(runNode);
    const children = Array.isArray(runNode[tag]) ? (runNode[tag] as XmlNode[]) : [];
    children.unshift(rPr);
    runNode[tag] = children;
    return rPr;
  }

  private static setSolidSrgb(parent: XmlNode, hex: string): void {
    const children = childrenOf(parent).filter((c) => nodeTag(c) !== "a:solidFill");
    const fill = elementNode("a:solidFill", undefined, [
      elementNode("a:srgbClr", { val: hex.toUpperCase() }),
    ]);
    // place fill before a:latin if present to keep a reasonable rPr order
    const latinIdx = children.findIndex((c) => nodeTag(c) === "a:latin");
    if (latinIdx >= 0) {
      children.splice(latinIdx, 0, fill);
    } else {
      children.push(fill);
    }
    setChildren(parent, children);
  }

  private applyOne(op: FixOp): void {
    switch (op.op) {
      case "setRunText": {
        const run = this.resolveRunNode(op.addr);
        if (!run) {
          return;
        }
        const tNode = firstChild(childrenOf(run), "a:t");
        if (!tNode) {
          return;
        }
        const current = gatherText(tNode);
        setChildren(tNode, [textNode(current.split(op.find).join(op.replace))]);
        return;
      }
      case "setRunSize": {
        const run = this.resolveRunNode(op.addr);
        if (run) {
          setAttr(PptxDocument.ensureRPr(run), "sz", String(op.value));
        }
        return;
      }
      case "setRunColor": {
        const run = this.resolveRunNode(op.addr);
        if (run) {
          PptxDocument.setSolidSrgb(PptxDocument.ensureRPr(run), op.hex);
        }
        return;
      }
      case "setRunFont": {
        const run = this.resolveRunNode(op.addr);
        if (run) {
          const rPr = PptxDocument.ensureRPr(run);
          const latin = firstChild(childrenOf(rPr), "a:latin");
          if (latin) {
            setAttr(latin, "typeface", op.typeface);
          } else {
            pushChild(rPr, elementNode("a:latin", { typeface: op.typeface }));
          }
        }
        return;
      }
      case "setCellFill": {
        const cell = this.resolveCellNode(op.addr.slideIndex, op.addr.shapeIndex, op.addr.rowIndex, op.addr.cellIndex);
        if (cell) {
          this.fillCell(cell, op.hex);
        }
        return;
      }
      case "setRowFill": {
        const shape = this.resolveShapeNode(op.addr.slideIndex, op.addr.shapeIndex);
        const tbl = shape ? PptxDocument.tableOf(shape) : undefined;
        const row = tbl ? allChildren(childrenOf(tbl), "a:tr")[op.addr.rowIndex] : undefined;
        if (row) {
          for (const cell of allChildren(childrenOf(row), "a:tc")) {
            this.fillCell(cell, op.hex);
          }
        }
        return;
      }
      case "setShapeParagraphs": {
        const shape = this.resolveShapeNode(op.addr.slideIndex, op.addr.shapeIndex);
        if (shape) {
          this.setShapeParagraphs(shape, op.paragraphs);
        }
        return;
      }
      case "clearShapeText": {
        const shape = this.resolveShapeNode(op.addr.slideIndex, op.addr.shapeIndex);
        if (shape) {
          this.clearText(shape);
        }
        return;
      }
      default:
        return;
    }
  }

  private resolveCellNode(
    slideIndex: number,
    shapeIndex: number,
    rowIndex: number,
    cellIndex: number,
  ): XmlNode | undefined {
    const shape = this.resolveShapeNode(slideIndex, shapeIndex);
    const tbl = shape ? PptxDocument.tableOf(shape) : undefined;
    const row = tbl ? allChildren(childrenOf(tbl), "a:tr")[rowIndex] : undefined;
    return row ? allChildren(childrenOf(row), "a:tc")[cellIndex] : undefined;
  }

  private fillCell(cellNode: XmlNode, hex: string): void {
    let tcPr = firstChild(childrenOf(cellNode), "a:tcPr");
    if (!tcPr) {
      tcPr = elementNode("a:tcPr");
      pushChild(cellNode, tcPr);
    }
    const kept = childrenOf(tcPr).filter((c) => !FILL_TAGS.has(nodeTag(c)));
    kept.push(
      elementNode("a:solidFill", undefined, [elementNode("a:srgbClr", { val: hex.toUpperCase() })]),
    );
    setChildren(tcPr, kept);
  }

  /**
   * Replace each paragraph's text with the provided strings (index-aligned),
   * preserving the first run's formatting and clearing extra runs. Used for
   * AI-generated text fixes of judgment issues.
   */
  private setShapeParagraphs(shape: XmlNode, paragraphs: readonly string[]): void {
    const txBody = firstChild(childrenOf(shape), "p:txBody");
    if (!txBody) {
      return;
    }
    const paraNodes = allChildren(childrenOf(txBody), "a:p");
    paragraphs.forEach((text, index) => {
      const para = paraNodes[index];
      if (!para) {
        return;
      }
      const runs = allChildren(childrenOf(para), "a:r");
      if (runs.length === 0) {
        return;
      }
      const first = runs[0];
      const tNode = first ? firstChild(childrenOf(first), "a:t") : undefined;
      if (tNode) {
        setChildren(tNode, [textNode(text)]);
      }
      for (let i = 1; i < runs.length; i += 1) {
        const run = runs[i];
        const t = run ? firstChild(childrenOf(run), "a:t") : undefined;
        if (t) {
          setChildren(t, [textNode("")]);
        }
      }
    });
  }

  private clearText(shape: XmlNode): void {
    const walk = (node: XmlNode): void => {
      for (const child of childrenOf(node)) {
        if (nodeTag(child) === "a:t") {
          setChildren(child, [textNode("")]);
        } else {
          walk(child);
        }
      }
    };
    walk(shape);
  }

  applyFixOps(ops: readonly FixOp[]): void {
    for (const op of ops) {
      this.applyOne(op);
    }
  }

  /** Append a translucent rectangle over a region so the user sees the flagged area. */
  addHighlight(slideIndex: number, bbox: BBoxEmu): void {
    const spTree = this.spTreeNode(slideIndex);
    if (!spTree) {
      return;
    }
    this.highlightCounter += 1;
    const id = String(this.highlightCounter);
    const shape = elementNode("p:sp", undefined, [
      elementNode("p:nvSpPr", undefined, [
        elementNode("p:cNvPr", { id, name: `acme-flag-${id}` }),
        elementNode("p:cNvSpPr"),
        elementNode("p:nvPr"),
      ]),
      elementNode("p:spPr", undefined, [
        elementNode("a:xfrm", undefined, [
          elementNode("a:off", { x: String(bbox.x), y: String(bbox.y) }),
          elementNode("a:ext", { cx: String(Math.max(bbox.cx, 1)), cy: String(Math.max(bbox.cy, 1)) }),
        ]),
        elementNode("a:prstGeom", { prst: "rect" }, [elementNode("a:avLst")]),
        elementNode("a:solidFill", undefined, [
          elementNode("a:srgbClr", { val: "FFD400" }, [elementNode("a:alpha", { val: "30000" })]),
        ]),
        elementNode("a:ln", { w: "19050" }, [
          elementNode("a:solidFill", undefined, [elementNode("a:srgbClr", { val: "E80000" })]),
        ]),
      ]),
      elementNode("p:txBody", undefined, [
        elementNode("a:bodyPr"),
        elementNode("a:lstStyle"),
        elementNode("a:p"),
      ]),
    ]);
    pushChild(spTree, shape);
  }

  /** Append a caption textbox near the bottom of the slide listing findings. */
  addCaption(slideIndex: number, lines: readonly string[]): void {
    const spTree = this.spTreeNode(slideIndex);
    if (!spTree || lines.length === 0) {
      return;
    }
    this.highlightCounter += 1;
    const id = String(this.highlightCounter);
    const marginX = 152400; // 0.167"
    const width = Math.max(this.slideSize.cx - marginX * 2, 1);
    const height = 120000 + lines.length * 175000;
    const y = Math.max(this.slideSize.cy - height - 60000, 0);

    const paras: XmlNode[] = lines.map((line, idx) =>
      elementNode("a:p", undefined, [
        elementNode("a:r", undefined, [
          elementNode("a:rPr", { lang: "en-US", sz: "1000", b: idx === 0 ? "1" : "0", dirty: "0" }, [
            elementNode("a:solidFill", undefined, [elementNode("a:srgbClr", { val: "9B0000" })]),
            elementNode("a:latin", { typeface: "Calibri" }),
          ]),
          elementNode("a:t", undefined, [textNode(line)]),
        ]),
      ]),
    );

    const shape = elementNode("p:sp", undefined, [
      elementNode("p:nvSpPr", undefined, [
        elementNode("p:cNvPr", { id, name: `acme-note-${id}` }),
        elementNode("p:cNvSpPr", { txBox: "1" }),
        elementNode("p:nvPr"),
      ]),
      elementNode("p:spPr", undefined, [
        elementNode("a:xfrm", undefined, [
          elementNode("a:off", { x: String(marginX), y: String(y) }),
          elementNode("a:ext", { cx: String(width), cy: String(height) }),
        ]),
        elementNode("a:prstGeom", { prst: "rect" }, [elementNode("a:avLst")]),
        elementNode("a:solidFill", undefined, [
          elementNode("a:srgbClr", { val: "FFFFDB" }, [elementNode("a:alpha", { val: "92000" })]),
        ]),
        elementNode("a:ln", { w: "12700" }, [
          elementNode("a:solidFill", undefined, [elementNode("a:srgbClr", { val: "E80000" })]),
        ]),
      ]),
      elementNode("p:txBody", undefined, [
        elementNode("a:bodyPr", { wrap: "square", lIns: "45720", tIns: "27432", rIns: "45720", bIns: "27432" }, [
          elementNode("a:normAutofit"),
        ]),
        elementNode("a:lstStyle"),
        ...paras,
      ]),
    ]);
    pushChild(spTree, shape);
  }

  // --- Serialization --------------------------------------------------------

  async toBuffer(): Promise<Buffer> {
    this.slideEntryNames.forEach((name, slideIndex) => {
      const tree = this.slideTrees[slideIndex];
      if (tree) {
        const xml = this.builder.build(tree);
        const withDecl = xml.startsWith("<?xml")
          ? xml
          : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n${xml}`;
        this.zip.file(name, withDecl);
      }
    });
    return this.zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
}

// Re-export so callers can reach the record guard without a separate import.
export { isRecord };
