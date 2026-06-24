// Minimal helpers for navigating/mutating fast-xml-parser `preserveOrder` trees.
// In preserveOrder mode each element is `{ "<tag>": XmlNode[], ":@": { "@_attr": val } }`
// and text is `{ "#text": value }`. All casts are confined to this boundary with
// runtime checks (per the project's strict-TS conventions).

export type XmlNode = Record<string, unknown>;

const ATTR_KEY = ":@";
const ATTR_PREFIX = "@_";
const TEXT_KEY = "#text";

export function isRecord(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asNodeArray(value: unknown): XmlNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

/** Tag name of an element node (the first key that is not the attribute group). */
export function nodeTag(node: XmlNode): string {
  for (const key of Object.keys(node)) {
    if (key !== ATTR_KEY) {
      return key;
    }
  }
  return "";
}

export function isTextNode(node: XmlNode): boolean {
  return TEXT_KEY in node;
}

/** The (mutable) children array of an element node. */
export function childrenOf(node: XmlNode): XmlNode[] {
  const tag = nodeTag(node);
  const value = node[tag];
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  return [];
}

/** Replace the children array of an element node in place. */
export function setChildren(node: XmlNode, children: XmlNode[]): void {
  const tag = nodeTag(node);
  node[tag] = children;
}

/** The live (mutable) children array of an element node, creating it if absent. */
export function liveChildrenArray(node: XmlNode): XmlNode[] {
  const tag = nodeTag(node);
  let value = node[tag];
  if (!Array.isArray(value)) {
    value = [];
    node[tag] = value;
  }
  return value as XmlNode[];
}

/** Append a child to an element node's live children array. */
export function pushChild(parent: XmlNode, child: XmlNode): void {
  liveChildrenArray(parent).push(child);
}

export function getAttr(node: XmlNode, name: string): string | undefined {
  const attrs = node[ATTR_KEY];
  if (isRecord(attrs)) {
    const value = attrs[ATTR_PREFIX + name];
    return value === undefined ? undefined : String(value);
  }
  return undefined;
}

export function setAttr(node: XmlNode, name: string, value: string): void {
  let attrs = node[ATTR_KEY];
  if (!isRecord(attrs)) {
    attrs = {};
    node[ATTR_KEY] = attrs;
  }
  (attrs as Record<string, unknown>)[ATTR_PREFIX + name] = value;
}

export function firstChild(children: XmlNode[], tag: string): XmlNode | undefined {
  return children.find((child) => nodeTag(child) === tag);
}

export function allChildren(children: XmlNode[], tag: string): XmlNode[] {
  return children.filter((child) => nodeTag(child) === tag);
}

/** Descend a fixed path of single tags, returning the deepest node or undefined. */
export function descend(node: XmlNode, path: readonly string[]): XmlNode | undefined {
  let current: XmlNode | undefined = node;
  for (const tag of path) {
    if (!current) {
      return undefined;
    }
    current = firstChild(childrenOf(current), tag);
  }
  return current;
}

/** Concatenate all descendant #text content under a node. */
export function gatherText(node: XmlNode): string {
  let out = "";
  const walk = (children: XmlNode[]): void => {
    for (const child of children) {
      if (isTextNode(child)) {
        out += String(child[TEXT_KEY]);
      } else {
        walk(childrenOf(child));
      }
    }
  };
  walk(childrenOf(node));
  return out;
}

/**
 * Collect human-readable label text from a chart or diagram XML subtree.
 * Gathers every `<a:t>` (rich text: titles, axis titles, data labels) and every
 * string `<c:v>` (category / series labels), skipping numeric caches so a
 * chart's raw data values don't flood the result. Formula refs (`<c:f>`) are
 * ignored since they carry no human-readable text.
 */
export function collectLabelText(root: XmlNode): string[] {
  const NUMERIC = new Set(["c:numRef", "c:numCache", "c:numLit"]);
  const out: string[] = [];
  const walk = (node: XmlNode, inNumeric: boolean): void => {
    for (const child of childrenOf(node)) {
      const tag = nodeTag(child);
      if (tag === "a:t") {
        const value = gatherText(child).trim();
        if (value) {
          out.push(value);
        }
        continue;
      }
      if (tag === "c:v") {
        if (!inNumeric) {
          const value = gatherText(child).trim();
          if (value) {
            out.push(value);
          }
        }
        continue;
      }
      walk(child, inNumeric || NUMERIC.has(tag));
    }
  };
  walk(root, false);
  return out;
}

/** Make a `{ "#text": value }` node. */
export function textNode(value: string): XmlNode {
  return { [TEXT_KEY]: value };
}

/** Build an element node with optional attributes and children. */
export function elementNode(
  tag: string,
  attrs?: Record<string, string>,
  children: XmlNode[] = [],
): XmlNode {
  const node: XmlNode = { [tag]: children };
  if (attrs && Object.keys(attrs).length > 0) {
    const group: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(attrs)) {
      group[ATTR_PREFIX + key] = value;
    }
    node[ATTR_KEY] = group;
  }
  return node;
}
