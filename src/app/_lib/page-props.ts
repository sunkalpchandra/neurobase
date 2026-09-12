import type { RawParams } from "@/lib/validation";

/** Next.js App Router page props: params and searchParams are promises. */
export interface PageProps<Params extends Record<string, string> = Record<string, never>> {
  params: Promise<Params>;
  searchParams: Promise<RawParams>;
}

/** Keeps only string / string[] values so pages can pass params straight to the validators. */
export function rawParams(input: RawParams): RawParams {
  const output: RawParams = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" || Array.isArray(value)) output[key] = value;
  }
  return output;
}
