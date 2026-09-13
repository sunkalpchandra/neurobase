import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { userProfiles } from "@/db/schema";

export const PROFILE_COOKIE = "nb_profile";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Anonymous personalisation profile, identified by an httpOnly cookie. Reading never
 * creates anything; writing creates the row and the cookie on first use. An
 * authentication provider can later map its user onto user_profiles.external_id.
 */
export async function getProfileId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(PROFILE_COOKIE)?.value;
  if (!value || !UUID_PATTERN.test(value)) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.id, value))
    .limit(1);
  return row?.id ?? null;
}

/**
 * A Secure cookie is dropped by browsers over plain HTTP, which would silently break
 * local production runs (`npm run build && npm start`) and the end-to-end suite: every
 * write would create a fresh profile the next request could not find. Mark the cookie
 * Secure unless the request is a plain-HTTP one to a loopback host.
 */
async function shouldUseSecureCookie(): Promise<boolean> {
  const store = await headers();
  const proto = store.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  const host = store.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const loopback =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  return !loopback;
}

/** Only call from a Server Action or Route Handler: setting cookies requires a response. */
export async function getOrCreateProfileId(): Promise<string> {
  const existing = await getProfileId();
  if (existing) return existing;
  const db = getDb();
  const [created] = await db
    .insert(userProfiles)
    .values({ kind: "anonymous" })
    .returning({ id: userProfiles.id });
  if (!created) throw new Error("Failed to create profile");
  const store = await cookies();
  store.set(PROFILE_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldUseSecureCookie(),
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return created.id;
}
