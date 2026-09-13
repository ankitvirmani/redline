/**
 * Whether there is a reader signed in, said in one value.
 *
 * Three states, and the first of them is not an error. A build with no Supabase
 * project is the state the owner sees before they create one, so it is carried here
 * beside the other two rather than thrown: the library and the red lines say so in
 * their own copy, and nothing on the analysis path has to care.
 *
 * Pure, and it imports no client. The rail and the screens that show a reader's name
 * take this as a value, which is what keeps a Supabase client out of the browser
 * bundle for the surface that reads a document.
 */

import { z } from "zod";

import { SUPABASE_VARIABLES, type SupabaseVariable } from "@/src/supabase/configuration";

/** The signed-in reader, as far as any screen needs them. */
export type Reader = {
  readonly id: string;
  /**
   * The address they signed in with. Null where the project holds none, which a
   * magic-link project never does, but the field is nullable in Supabase and a
   * screen that assumed otherwise would render "undefined" at someone.
   */
  readonly email: string | null;
};

export type AccountState =
  | { readonly kind: "no-project"; readonly missing: readonly SupabaseVariable[] }
  | { readonly kind: "signed-out" }
  | { readonly kind: "signed-in"; readonly reader: Reader };

/**
 * The account reply as it crosses from the route to the browser.
 *
 * Checked rather than cast. The paste surface asks the route whether anyone is
 * signed in, and a reply it could not read must come back as "nobody" rather than
 * as a half-built reader, because the only thing that turns on this value is
 * whether Redline offers to keep someone's contract.
 */
const ACCOUNT_STATE = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("no-project"),
    missing: z.array(z.enum(SUPABASE_VARIABLES)).readonly(),
  }),
  z.object({ kind: z.literal("signed-out") }),
  z.object({
    kind: z.literal("signed-in"),
    reader: z.object({ id: z.string().min(1), email: z.string().nullable() }),
  }),
]);

/** The reply as an account state, or null when it was not one. */
export function readAccountState(reply: unknown): AccountState | null {
  const read = ACCOUNT_STATE.safeParse(reply);
  return read.success ? read.data : null;
}
