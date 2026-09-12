/**
 * The question route. The second and last place a model is called.
 *
 * It exists for the same reason `app/api/analyse/route.ts` does: the OpenRouter key must
 * never reach a reader's browser, so the model call happens on the server and nowhere
 * else. The browser sends the extracted text and the question and gets back an answer or
 * a refusal, and the key and the model id stay in this process.
 *
 * Nothing about a reader's document or their question is stored or logged here. Both
 * arrive, the question is answered, the answer goes back, and the request ends. The only
 * thing kept is the defect counter in `src/domain/defects.ts`, which holds codes and
 * lengths and never text.
 */

import { z } from "zod";

import { extract } from "@/src/extraction";
import { openRouterClient } from "@/src/model/openrouter";
import { answerQuestion } from "@/src/qa";

export const runtime = "nodejs";

/**
 * What the browser sends: the text extraction gave it, and what the reader typed.
 *
 * The document is rebuilt here by running extraction over that text, exactly as the
 * analysis route does, rather than trusting a character count computed in the browser.
 * Verification runs against what extraction stores, so the two routes have to store the
 * same characters.
 */
const REQUEST = z.strictObject({ text: z.string(), question: z.string() });

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

  const reading = await answerQuestion({
    document: extraction.document,
    question: read.data.question,
    model: openRouterClient(),
  });

  // A refusal is not an HTTP error and neither is a failure. The reader's request was
  // fine and there is something true to tell them in both cases, which the screen has
  // copy for.
  return Response.json(reading);
}
