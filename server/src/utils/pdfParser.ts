import pdf from 'pdf-parse';

export interface ExtractedQuestion {
  title: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
}

/**
 * Parses a PDF buffer and returns a list of proposed questions.
 */
export async function parsePdfQuestions(pdfBuffer: Buffer): Promise<ExtractedQuestion[]> {
  try {
    const data = await pdf(pdfBuffer);
    const text = data.text;
    return splitQuestionsText(text);
  } catch (error) {
    console.error('Error parsing PDF in engine:', error);
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Splits raw PDF text into structured coding questions.
 */
export function splitQuestionsText(text: string): ExtractedQuestion[] {
  // Normalize line breaks
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Regex to detect "Question 1", "Question 1:", "Q1:", "Problem 1", or "1. Title" (uppercase) at the start of lines
  const delimiterRegex = /(?:^|\n)(?:Question\s+\d+|Q\d+|Problem\s+\d+)\s*[:.-]?\s*|(?:^|\n)\d+\.\s+[A-Z]/g;
  
  const matches: { index: number; text: string }[] = [];
  let match;
  
  // Find all matches of question headings
  const tempRegex = new RegExp(delimiterRegex);
  while ((match = tempRegex.exec(normalizedText)) !== null) {
    matches.push({ index: match.index, text: match[0] });
  }

  const chunks: string[] = [];
  if (matches.length <= 1) {
    // If no clear multi-question delimiters are found, split by double newlines or fall back to single question
    const doubleNewlineChunks = normalizedText.split(/\n\n+/);
    if (doubleNewlineChunks.length > 1) {
      doubleNewlineChunks.forEach(c => {
        if (c.trim().length > 30) chunks.push(c.trim());
      });
    } else {
      chunks.push(normalizedText.trim());
    }
  } else {
    // Extract the text chunks between consecutive delimiters
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : normalizedText.length;
      const chunk = normalizedText.slice(start, end).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
    }
  }

  // Parse each chunk into structural fields
  return chunks.map((chunk, index) => {
    // Clean up the prefix delimiter from the chunk (e.g., remove "Question 1:")
    let cleanChunk = chunk.replace(/^(?:Question\s+\d+|Q\d+|Problem\s+\d+|\d+\.)\s*[:.-]?\s*/i, '').trim();

    // Split the first line as a potential title
    const lines = cleanChunk.split('\n');
    let title = lines[0].trim();
    if (title.length > 100 || title.length === 0) {
      title = `Extracted Question ${index + 1}`;
    }

    // Heuristics for sections
    const sectionKeywords = {
      problemStatement: ['problem statement', 'description', 'problem description'],
      inputFormat: ['input format', 'input specification', 'input'],
      outputFormat: ['output format', 'output specification', 'output'],
      sampleInput: ['sample input', 'sample inputs', 'input example'],
      sampleOutput: ['sample output', 'sample outputs', 'output example']
    };

    // Find indices of keywords in cleanChunk
    const indices: { key: keyof typeof sectionKeywords; idx: number; keywordLength: number }[] = [];

    Object.entries(sectionKeywords).forEach(([key, list]) => {
      for (const keyword of list) {
        // Look for the keyword as a separate term/phrase, case-insensitive
        const regex = new RegExp(`(?:^|\\n)\\s*(${keyword})\\s*[:.-]?\\s*(?:\\n|$)`, 'i');
        const m = regex.exec(cleanChunk);
        if (m) {
          indices.push({
            key: key as keyof typeof sectionKeywords,
            idx: m.index,
            keywordLength: m[0].length
          });
          break; // Match first matching keyword in list
        }
      }
    });

    // Sort indices ascending
    indices.sort((a, b) => a.idx - b.idx);

    // Initialize fields
    let problemStatement = cleanChunk;
    let inputFormat = '';
    let outputFormat = '';
    let sampleInput = '';
    let sampleOutput = '';

    // If we detected sections, slice them
    if (indices.length > 0) {
      // Problem statement is from start of cleanChunk to the first section index
      problemStatement = cleanChunk.slice(0, indices[0].idx).trim();

      for (let i = 0; i < indices.length; i++) {
        const current = indices[i];
        const next = i + 1 < indices.length ? indices[i + 1] : null;
        
        const sectionContentStart = current.idx + current.keywordLength;
        const sectionContentEnd = next ? next.idx : cleanChunk.length;
        const content = cleanChunk.slice(sectionContentStart, sectionContentEnd).trim();

        if (current.key === 'problemStatement') {
          problemStatement = content;
        } else if (current.key === 'inputFormat') {
          inputFormat = content;
        } else if (current.key === 'outputFormat') {
          outputFormat = content;
        } else if (current.key === 'sampleInput') {
          sampleInput = content;
        } else if (current.key === 'sampleOutput') {
          sampleOutput = content;
        }
      }
    }

    // Clean up title if it's identical to first line of problem statement
    if (problemStatement.startsWith(title)) {
      problemStatement = problemStatement.replace(title, '').trim();
    }

    // Strip leading colons or dashes from fields
    const sanitize = (val: string) => val.replace(/^[:.-]\s*/, '').trim();

    return {
      title: sanitize(title).slice(0, 150) || `Question ${index + 1}`,
      problemStatement: sanitize(problemStatement),
      inputFormat: sanitize(inputFormat),
      outputFormat: sanitize(outputFormat),
      sampleInput: sanitize(sampleInput),
      sampleOutput: sanitize(sampleOutput)
    };
  });
}
