// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OutputData, BlockToolData } from "@editorjs/editorjs";

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function convertToHtml(data: OutputData): string {
  return data.blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
        case "paragraph":
          return `<p>${block.data.text}</p>`;
        case "list":
          const listItems = block.data.items
            .map((item: string) => `<li>${item}</li>`)
            .join("");
          return block.data.style === "ordered"
            ? `<ol>${listItems}</ol>`
            : `<ul>${listItems}</ul>`;
        case "checklist":
          return `<ul class="checklist">${block.data.items
            .map(
              (item: { text: string; checked: boolean }) =>
                `<li class="${item.checked ? "checked" : ""}">${item.text}</li>`
            )
            .join("")}</ul>`;
        case "quote":
          return `<blockquote>${block.data.text}${
            block.data.caption ? `<footer>${block.data.caption}</footer>` : ""
          }</blockquote>`;
        case "code":
          return `<pre><code>${block.data.code}</code></pre>`;
        case "image":
          return `<figure><img src="${block.data.file.url}" alt="${block.data.caption}" /><figcaption>${block.data.caption}</figcaption></figure>`;
        default:
          return "";
      }
    })
    .join("");
}

export function convertToText(data: OutputData): string {
  const lines = data.blocks.map((block) => {
    switch (block.type) {
      case "header":
        return normalizeWhitespace(stripHtml(block.data.text));
      case "paragraph":
        return normalizeWhitespace(stripHtml(block.data.text));
      case "list":
        return block.data.items
          .map((item: string, index: number) => {
            const cleaned = normalizeWhitespace(stripHtml(item));
            return block.data.style === "ordered"
              ? `${index + 1}. ${cleaned}`
              : `- ${cleaned}`;
          })
          .join("\n");
      case "checklist":
        return block.data.items
          .map((item: { text: string; checked: boolean }) => {
            const cleaned = normalizeWhitespace(stripHtml(item.text));
            return `${item.checked ? "[x]" : "[ ]"} ${cleaned}`;
          })
          .join("\n");
      case "quote":
        return normalizeWhitespace(stripHtml(block.data.text));
      case "code":
        return block.data.code;
      case "image":
        return block.data.caption
          ? normalizeWhitespace(stripHtml(block.data.caption))
          : "";
      default:
        return "";
    }
  });

  return lines.filter((line) => line.length > 0).join("\n\n");
}
