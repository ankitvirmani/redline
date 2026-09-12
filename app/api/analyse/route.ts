/**
 * The analysis route. The only place a model is called.
 *
 * It exists because the OpenRouter key must never reach a reader's browser, which
 * means the model call happens on the server and nowhere else. The browser sends the
 * extracted text and gets back the analysis, and the key and the model id stay in
 * this process: neither is in the response, in a header, or in anything logged.
 *
 * Nothing about a reader's document is stored or logged here. The text arrives, it is
 * analysed, the answer goes back, and the request ends. The only thing kept is the
 * defect counter in `src/analysis/defects.ts`, which holds codes and lengths and
 * never text.
 */

import { z } from "zod";

import { analyse } from "@/src/analysis";
import { extract } from "@/src/extraction";
import { openRouterClient } from "@/src/model/openrouter";

export const runtime = "nodejs";

/**
 * What the browser sends: the text extraction gave it.
 *
 * The document is rebuilt here by running extraction over that text, rather than
 * trusting a character count and a completeness reading computed in the browser.
 * Ticket 03 adds PDFs, which are parsed in the browser, so it will need to send the
 * source kind along with the text and this will read it.
 */
const REQUEST = z.strictObject({ text: z.string() });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ outcome: "unreadable-request" }, { status: 400 });
  }

  const read = REQUEST.safeParse(body);
  if (!read.success) {
    return Response.json({ outcome: "unreadable-request" }, { status: 400 });
  }

  const extraction = await extract({ kind: "pasted-text", text: read.data.text });
  if (extraction.outcome === "rejected") {
    return Response.json(extraction);
  }

  const analysis = await analyse({
    document: extraction.document,
    model: openRouterClient(),
  });

  // A failed analysis is a state the screen has copy for, not an HTTP error: the
  // reader's request was fine and there is something true to tell them.
  return Response.json(analysis);
}
