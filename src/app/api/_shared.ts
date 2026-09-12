import { ValidationError } from "@/lib/errors";

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Expected a JSON body");
  }
}
