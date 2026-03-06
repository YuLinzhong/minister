// Build Feishu interactive message cards

interface CardOptions {
  title: string;
  content: string;
  status?: string;
  tools?: string[];
  headerColor?: string;
}

export function buildProgressCard(opts: CardOptions): string {
  const elements: unknown[] = [];

  // Main content
  if (opts.content) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: opts.content },
    });
  }

  // Tool execution chain
  if (opts.tools?.length) {
    elements.push({
      tag: "note",
      elements: [
        { tag: "plain_text", content: `Tools: ${opts.tools.join(" → ")}` },
      ],
    });
  }

  elements.push({ tag: "hr" });

  // Status footer
  elements.push({
    tag: "note",
    elements: [
      { tag: "plain_text", content: opts.status || "Processing..." },
    ],
  });

  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: opts.title },
      template: opts.headerColor || "blue",
    },
    elements,
  };

  return JSON.stringify(card);
}

export function buildThinkingCard(): string {
  return buildProgressCard({
    title: "Minister is thinking...",
    content: "Analyzing your request...",
    status: "Thinking...",
    headerColor: "blue",
  });
}

export function buildResultCard(content: string): string {
  return buildProgressCard({
    title: "Minister",
    content,
    status: "Done",
    headerColor: "green",
  });
}

export function buildErrorCard(error: string): string {
  return buildProgressCard({
    title: "Minister - Error",
    content: error,
    status: "Failed",
    headerColor: "red",
  });
}
