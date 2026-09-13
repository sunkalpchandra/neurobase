import { z } from "zod";
import { getEnv } from "@/lib/env";
import type { AnswerModel } from "./types";

/**
 * Optional answer models. NeuroBase answers without one — see extractive.ts — so a
 * missing key degrades the prose, never the grounding.
 */

const anthropicResponse = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

const openaiResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })),
});

const TIMEOUT_MS = 30_000;

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status}`);
    }
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new Error(`Unexpected response shape from ${url}`);
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

function anthropicModel(apiKey: string, model: string): AnswerModel {
  return {
    id: model,
    label: `Anthropic ${model}`,
    async complete({ system, prompt, maxTokens }) {
      const body = await postJson(
        "https://api.anthropic.com/v1/messages",
        { model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] },
        { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        anthropicResponse,
      );
      return body.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("")
        .trim();
    },
  };
}

function openAiModel(apiKey: string, model: string): AnswerModel {
  return {
    id: model,
    label: `OpenAI ${model}`,
    async complete({ system, prompt, maxTokens }) {
      const body = await postJson(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          max_completion_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        },
        { authorization: `Bearer ${apiKey}` },
        openaiResponse,
      );
      return (body.choices[0]?.message.content ?? "").trim();
    },
  };
}

/**
 * The configured model, or null. Anthropic is preferred when both are set because the
 * default model below is the one the prompt was written against.
 */
export function getAnswerModel(): AnswerModel | null {
  const env = getEnv();
  if (env.ANTHROPIC_API_KEY) {
    return anthropicModel(env.ANTHROPIC_API_KEY, env.ANSWER_MODEL ?? "claude-sonnet-5");
  }
  if (env.OPENAI_API_KEY) {
    return openAiModel(env.OPENAI_API_KEY, env.ANSWER_MODEL ?? "gpt-4o-mini");
  }
  return null;
}
