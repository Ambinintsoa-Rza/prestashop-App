/**
 * Parse un CSV multi-entites :
 * Retourne [{ resource: "products", rows: [...] }, { resource: "customers", rows: [...] }]
 */
import Papa from "papaparse";

const isResourceName = (line) => {
  const cleaned = line.replace(/^["']|["']$/g, "").trim();
  return /^[a-z_]+$/.test(cleaned) && !cleaned.includes(",") && !cleaned.includes(";");
};

const cleanResourceName = (line) => line.replace(/^["']|["']$/g, "").trim();

export const parseMultiEntityCsv = (text, delimiter) => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const sections = [];
  let currentResource = null;
  let currentLines = [];

  for (const line of lines) {
    if (isResourceName(line)) {
      if (currentResource && currentLines.length > 1) {
        sections.push({
          resource: currentResource,
          rows: parseSectionRows(currentLines, delimiter),
        });
      }
      currentResource = cleanResourceName(line);
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentResource && currentLines.length > 1) {
    sections.push({
      resource: currentResource,
      rows: parseSectionRows(currentLines, delimiter),
    });
  }

  return sections;
};

const parseSectionRows = (lines, delimiter) => {
  const csvText = lines.join("\n");
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    encoding: "UTF-8",
  });
  return result.data;
};
