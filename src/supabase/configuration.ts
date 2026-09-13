/**
 * Whether this build has a Supabase project to talk to, and which variable is
 * missing when it does not.
 *
 * Pure, and importing nothing. That is the point of the file: the "no project
 * configured" state is a designed state the owner will see before the project
 * exists, so deciding whether there is a project must not involve constructing a
 * client, and nothing on the analysis path should have to import a client library
 * to find out that it has no business calling one.
 *
 * The two variables are read as literal member expressions in
 * `configuredSupabase`, and nowhere else, because Next replaces
 * `process.env.NEXT_PUBLIC_...` in browser code at build time and only does so
 * where it can see the name written out. `readSupabaseConfiguration` takes the
 * values instead, so the rule this file states can be tested without touching the
 * environment.
 */

/** The two variables the whole account path rests on. Names only, never values. */
export const SUPABASE_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export type SupabaseVariable = (typeof SUPABASE_VARIABLES)[number];

/**
 * The project, or the reason there is none.
 *
 * `missing` names the variables that are unset, so the screen can say which one
 * rather than saying something is wrong. It is a list because both being unset is
 * the ordinary case in a build that has never had a project.
 */
export type SupabaseConfiguration =
  | { readonly kind: "configured"; readonly url: string; readonly anonKey: string }
  | { readonly kind: "no-project"; readonly missing: readonly SupabaseVariable[] };

/** What the two variables hold, as far as this file cares. */
export type SupabaseEnvironment = {
  readonly [K in SupabaseVariable]?: string | undefined;
};

/**
 * The rule: a variable that is unset, or set to nothing but whitespace, is not set.
 *
 * A whitespace anon key would build a client that fails on its first request with a
 * network error, which reads to a reader as Redline being broken rather than as this
 * build having no project yet.
 */
function set(value: string | undefined): string | null {
  if (value === undefined) return null;
  const written = value.trim();
  return written.length === 0 ? null : written;
}

/** Reads the configuration out of values, so a test can hand in its own. */
export function readSupabaseConfiguration(
  environment: SupabaseEnvironment,
): SupabaseConfiguration {
  const url = set(environment.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = set(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (url !== null && anonKey !== null) return { kind: "configured", url, anonKey };

  return {
    kind: "no-project",
    missing: SUPABASE_VARIABLES.filter((name) =>
      name === "NEXT_PUBLIC_SUPABASE_URL" ? url === null : anonKey === null,
    ),
  };
}

/**
 * The configuration this build is running with.
 *
 * The only place either variable is read. Written out by name so that Next can
 * replace both when it compiles the browser bundle.
 */
export function configuredSupabase(): SupabaseConfiguration {
  return readSupabaseConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
