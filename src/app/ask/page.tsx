import type { Metadata } from "next";
import Link from "next/link";
import { getAskService } from "@/ask";
import type { AskAnswer } from "@/ask";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { Section } from "@/app/_lib/section";
import { ENTITY_TYPE_LABELS } from "@/domain/enums";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import { routes, toRoute } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { inputClass } from "@/components/ui/input";
import { PageHeader } from "@/components/shell/page-header";
import { linkClass, microLabelClass, panelClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Ask" };
export const dynamic = "force-dynamic";

const EXAMPLES = [
  "Which companies are developing implanted speech neuroprostheses?",
  "What is the evidence that spinal cord stimulation restores movement after paralysis?",
  "Which deep brain stimulation trials are recruiting?",
  "What has the FDA cleared for vagus nerve stimulation?",
  "How is focused ultrasound being used for neuromodulation?",
];

/**
 * Renders an answer sentence with its [n] markers turned into links to the cited record.
 * Markers that do not match a citation are left as text rather than silently dropped.
 */
function Cited({ text, answer }: { text: string; answer: AskAnswer }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (!match) return <span key={index}>{part}</span>;
        const marker = Number(match[1]);
        const citation = answer.citations.find((entry) => entry.marker === marker);
        if (!citation) return <span key={index}>{part}</span>;
        return (
          <Link
            key={index}
            href={toRoute(citation.href)}
            title={citation.title}
            className="mx-0.5 rounded-xs border border-accent-line bg-accent-soft px-1 text-2xs font-medium text-accent no-underline align-baseline"
          >
            {marker}
          </Link>
        );
      })}
    </>
  );
}

export default async function AskPage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  const question = typeof params.q === "string" ? params.q.trim() : "";

  let answer: AskAnswer | null = null;
  let failed = false;
  if (question.length >= 3) {
    try {
      answer = await getAskService().answer({ question });
    } catch (error: unknown) {
      console.error(error);
      failed = true;
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Ask"
        description="Ask a question about neurotechnology and get an answer built only from the records in this database, with a citation on every claim. It will tell you when the records do not cover what you asked."
      />

      <form
        method="get"
        action={routes.ask()}
        className="flex flex-col gap-2 py-4 sm:flex-row"
        role="search"
      >
        <label htmlFor="ask-question" className="sr-only">
          Your question
        </label>
        <input
          id="ask-question"
          type="text"
          name="q"
          defaultValue={question}
          placeholder="e.g. Which companies are developing implanted speech neuroprostheses?"
          autoComplete="off"
          className={cn(inputClass, "h-10 min-w-0 flex-1 text-base")}
        />
        <Button type="submit" variant="primary" size="md" className="h-10 shrink-0">
          Ask
        </Button>
      </form>

      {!question ? (
        <div className="pb-6">
          <p className={microLabelClass}>Try one of these</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <Link href={toRoute(routes.ask(example))} className={linkClass}>
                  {example}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-prose text-sm text-ink-secondary">
            Answers are grounded in the {""}
            <Link href={toRoute(routes.search())} className={linkClass}>
              indexed records
            </Link>
            : clinical trials from ClinicalTrials.gov, research from OpenAlex, device clearances
            from openFDA and the organizations those records name. Nothing is answered from a
            model&rsquo;s own memory of the field.
          </p>
        </div>
      ) : failed ? (
        <ErrorState
          title="The answer could not be produced"
          description="Retrieval or the answer model failed. Try the question again, or search the records directly."
          action={
            <Link href={toRoute(routes.search({ q: question }))} className={linkClass}>
              Search instead
            </Link>
          }
        />
      ) : answer ? (
        <AnswerView answer={answer} />
      ) : (
        <EmptyState
          title="Ask a longer question"
          description="Questions need at least three characters."
        />
      )}
    </div>
  );
}

function AnswerView({ answer }: { answer: AskAnswer }) {
  return (
    <div className="flex flex-col">
      <div className={cn(panelClass, "px-4 py-4")}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant={answer.mode === "generated" ? "accent" : "neutral"}>
            {answer.mode === "generated" ? "Generated from records" : "Built from records"}
          </Badge>
          <span className="text-xs text-ink-muted">
            {pluralize(answer.interpretation.matchedRecords, "matching record")} ·{" "}
            {answer.citations.length} cited · {(answer.elapsedMs / 1000).toFixed(1)}s
          </span>
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-ink">
          <Cited text={answer.summary} answer={answer} />
        </p>
        {answer.sections.map((section) => (
          <div key={section.heading} className="mt-3">
            {answer.mode === "extractive" ? (
              <p className={microLabelClass}>{section.heading}</p>
            ) : null}
            <ul
              className={cn(
                "mt-1 flex flex-col gap-1.5 text-sm",
                answer.mode === "extractive" && "list-none",
              )}
            >
              {section.lines.map((line, index) => (
                <li key={index} className="max-w-prose leading-relaxed text-ink-secondary">
                  <Cited text={line} answer={answer} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-3 border-t border-line-soft pt-2 text-xs text-ink-muted">
          {answer.modeDescription}
        </p>
      </div>

      {answer.noEvidence ? (
        <EmptyState
          className="mt-4"
          title="No records matched"
          description="Try naming a technology, a condition or an organization. The database covers neurotechnology companies, devices, clinical trials, research and device clearances."
          action={
            <Link href={toRoute(routes.search({ q: answer.question }))} className={linkClass}>
              Search the records directly
            </Link>
          }
        />
      ) : (
        <Section
          id="citations"
          title="Records this answer used"
          aside={pluralize(answer.citations.length, "record")}
        >
          <ol className="flex flex-col gap-2">
            {answer.citations.map((citation) => (
              <li key={citation.marker} className={cn(panelClass, "flex gap-3 px-3 py-2")}>
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-xs border border-accent-line bg-accent-soft text-center text-2xs font-medium leading-5 text-accent">
                  {citation.marker}
                </span>
                <div className="min-w-0">
                  <p className={microLabelClass}>{ENTITY_TYPE_LABELS[citation.entityType]}</p>
                  <Link
                    href={toRoute(citation.href)}
                    className="text-sm font-medium hover:underline"
                  >
                    {citation.title}
                  </Link>
                  {citation.publishedOn ? (
                    <span className="ml-2 text-xs text-ink-muted">
                      {formatDate(citation.publishedOn)}
                    </span>
                  ) : null}
                  <p className="mt-0.5 line-clamp-2 max-w-prose text-xs text-ink-secondary">
                    {citation.passage}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section id="interpretation" title="How the records were found">
        <p className="max-w-prose text-sm text-ink-secondary">
          Searched for{" "}
          {answer.interpretation.terms.length ? (
            <>“{answer.interpretation.terms.join(" ")}”</>
          ) : (
            "the question as written"
          )}
          {answer.interpretation.filters.length ? (
            <>
              , with {answer.interpretation.filters.map((filter) => filter.label).join(" and ")}{" "}
              read from the wording
              {answer.interpretation.filters.every((filter) => filter.applied)
                ? " and applied as a filter"
                : " but not applied, because filtering on it left no records"}
            </>
          ) : null}
          . That matched {pluralize(answer.interpretation.matchedRecords, "record")}, of which the
          closest {answer.citations.length} were used.
        </p>
      </Section>
    </div>
  );
}
