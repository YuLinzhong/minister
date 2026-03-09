// Parse Markdown text into Feishu document block structures.

interface TextElementStyle {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  inline_code?: boolean;
}

interface TextElement {
  text_run: {
    content: string;
    text_element_style?: TextElementStyle;
  };
}

// Lark SDK block_type constants
export const BlockType = {
  Text: 2,
  Heading1: 3,
  Heading2: 4,
  Heading3: 5,
  Bullet: 12,
  Ordered: 13,
  Code: 14,
  Quote: 15,
  Table: 31,
} as const;

type BlockTypeValue = (typeof BlockType)[keyof typeof BlockType];

// Block property name corresponding to each block_type
const BLOCK_PROP: Record<number, string> = {
  [BlockType.Text]: "text",
  [BlockType.Heading1]: "heading1",
  [BlockType.Heading2]: "heading2",
  [BlockType.Heading3]: "heading3",
  [BlockType.Bullet]: "bullet",
  [BlockType.Ordered]: "ordered",
  [BlockType.Code]: "code",
  [BlockType.Quote]: "quote",
};

// Parse inline formatting: **bold**, *italic*, `code`, ~~strike~~
function parseInlineFormatting(text: string): TextElement[] {
  const elements: TextElement[] = [];
  // Order matters: ** before * to avoid partial match
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const idx = match.index!;
    if (idx > lastIndex) {
      elements.push({ text_run: { content: text.slice(lastIndex, idx) } });
    }

    if (match[2]) {
      elements.push({ text_run: { content: match[2], text_element_style: { bold: true } } });
    } else if (match[3]) {
      elements.push({ text_run: { content: match[3], text_element_style: { italic: true } } });
    } else if (match[4]) {
      elements.push({ text_run: { content: match[4], text_element_style: { inline_code: true } } });
    } else if (match[5]) {
      elements.push({ text_run: { content: match[5], text_element_style: { strikethrough: true } } });
    }

    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push({ text_run: { content: text.slice(lastIndex) } });
  }

  return elements.length ? elements : [{ text_run: { content: text } }];
}

function buildBlock(blockType: BlockTypeValue, elements: TextElement[]): Record<string, unknown> {
  return { block_type: blockType, [BLOCK_PROP[blockType]]: { elements } };
}

/** Internal table data attached to a table marker block. */
export interface TableData {
  headers: string[];
  rows: string[][];
}

// Check if a line looks like a Markdown table row: | col | col |
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2;
}

// Check if a line is a table separator: | --- | --- |
function isTableSeparator(line: string): boolean {
  return /^\|[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|$/.test(line.trim());
}

// Parse a table row into cell contents
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Build text elements for a single table cell (used by doc_update to fill cells).
 */
export function buildCellTextBlock(text: string): Record<string, unknown> {
  return buildBlock(BlockType.Text, parseInlineFormatting(text));
}

// Marker constant for table blocks in the mixed block array
const TABLE_MARKER = "__table_data";

/**
 * Check if a block is a table marker produced by markdownToBlocks.
 */
export function isTableMarker(
  block: Record<string, unknown>,
): block is Record<string, unknown> & { [TABLE_MARKER]: TableData } {
  return TABLE_MARKER in block;
}

/**
 * Extract table data from a table marker block.
 */
export function getTableData(block: Record<string, unknown>): TableData {
  return block[TABLE_MARKER] as TableData;
}

/**
 * Convert Markdown text to an array of Feishu document blocks.
 * Table blocks are returned as markers with block_type=31 and a __table_data field.
 */
export function markdownToBlocks(content: string): Record<string, unknown>[] {
  const lines = content.split("\n");
  const blocks: Record<string, unknown>[] = [];

  let inCodeFence = false;
  let codeLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Code fence toggle
    if (line.trimStart().startsWith("```")) {
      if (!inCodeFence) {
        inCodeFence = true;
        codeLines = [];
      } else {
        // Close code fence — emit a code block
        const codeContent = codeLines.join("\n");
        blocks.push(buildBlock(BlockType.Code, [{ text_run: { content: codeContent } }]));
        inCodeFence = false;
      }
      i++;
      continue;
    }

    if (inCodeFence) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Skip blank lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Table detection: consume consecutive table rows
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      // Need at least a header row
      if (tableLines.length >= 1) {
        const headers = parseTableRow(tableLines[0]);
        const dataRows: string[][] = [];
        // Skip separator row (index 1 if present), collect data rows
        const startIdx = tableLines.length > 1 && isTableSeparator(tableLines[1]) ? 2 : 1;
        for (let j = startIdx; j < tableLines.length; j++) {
          dataRows.push(parseTableRow(tableLines[j]));
        }
        // Emit a table marker block
        blocks.push({
          block_type: BlockType.Table,
          [TABLE_MARKER]: { headers, rows: dataRows } as TableData,
        });
      }
      continue;
    }

    // Heading: # ... ######
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      const headingType = (BlockType.Text + level) as BlockTypeValue; // Heading1=3, Heading2=4, Heading3=5
      blocks.push(buildBlock(headingType, parseInlineFormatting(heading[2].trim())));
      i++;
      continue;
    }

    // Bullet list: - item or * item
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      blocks.push(buildBlock(BlockType.Bullet, parseInlineFormatting(bullet[1])));
      i++;
      continue;
    }

    // Ordered list: 1. item
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      blocks.push(buildBlock(BlockType.Ordered, parseInlineFormatting(ordered[1])));
      i++;
      continue;
    }

    // Blockquote: > text
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      blocks.push(buildBlock(BlockType.Quote, parseInlineFormatting(quote[1])));
      i++;
      continue;
    }

    // Horizontal rule — skip (no visual equivalent in doc blocks)
    if (/^[-*_]{3,}\s*$/.test(line)) {
      i++;
      continue;
    }

    // Default: text block
    blocks.push(buildBlock(BlockType.Text, parseInlineFormatting(line)));
    i++;
  }

  // Handle unclosed code fence
  if (inCodeFence && codeLines.length) {
    blocks.push(buildBlock(BlockType.Code, [{ text_run: { content: codeLines.join("\n") } }]));
  }

  return blocks;
}
