import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The page asks Supabase who is signed in and for the row at this address. Both are
// replaced here, so the page renders exactly as it would on the server with no network
// call: a signed-in reader, and whatever the store is told to answer.
vi.mock("@/src/supabase/server", () => ({
  accountState: async () => ({ kind: "signed-in", reader: { id: "reader-1", email: null } }),
}));
vi.mock("@/src/library/store", () => ({ keptDocument: vi.fn() }));
vi.mock("@/src/red-lines/store", () => ({
  redLinesOf: async () => ({ outcome: "listed", redLines: [] }),
}));

import * as page from "@/app/library/[id]/page";
import { keptDocument } from "@/src/library/store";

const params = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });

/** The title in the browser tab, however the page declares it. */
async function tabTitle(): Promise<unknown> {
  const declared = page as {
    metadata?: { title?: unknown };
    generateMetadata?: (props: { params: typeof params }) => Promise<{ title?: unknown }>;
  };
  if (declared.generateMetadata !== undefined) {
    return (await declared.generateMetadata({ params })).title;
  }
  return declared.metadata?.title;
}

async function heading(): Promise<string> {
  const html = renderToStaticMarkup(await page.default({ params }));
  return /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? "";
}

describe("an address in the library that holds no document of the reader's", () => {
  beforeEach(() => {
    vi.mocked(keptDocument).mockResolvedValue({ outcome: "not-found" });
  });

  it("does not head the page as a document the reader kept", async () => {
    expect(await heading()).not.toMatch(/document you kept/i);
  });

  it("does not name the tab as a document the reader kept", async () => {
    expect(await tabTitle()).not.toMatch(/document you kept/i);
  });
});

describe("an address in the library that holds one of the reader's documents", () => {
  it("still names the tab as a document the reader kept", async () => {
    vi.mocked(keptDocument).mockResolvedValue({
      outcome: "reopened",
      reading: { outcome: "unreadable" },
    } as never);
    expect(await tabTitle()).toBe("A document you kept: Redline");
  });
});
