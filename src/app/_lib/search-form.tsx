import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";

export interface SearchFormProps {
  defaultValue?: string;
  /** Carried through as a hidden field so category tabs survive a new query. */
  category?: string;
  size?: "md" | "lg";
  label?: string;
  className?: string;
}

/** GET form to /search. Server-rendered; no JavaScript required to submit. */
export function SearchForm({
  defaultValue = "",
  category,
  size = "md",
  label = "Search the database",
  className,
}: SearchFormProps) {
  const id = size === "lg" ? "home-search" : "page-search";
  return (
    <form
      role="search"
      method="get"
      action={routes.search()}
      className={cn("flex w-full gap-2", className)}
    >
      {category && category !== "all" ? (
        <input type="hidden" name="category" value={category} />
      ) : null}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="e.g. implanted BCIs for speech restoration"
        autoComplete="off"
        className={cn(inputClass, "min-w-0 flex-1", size === "lg" && "h-10 text-base")}
      />
      <Button
        type="submit"
        variant="primary"
        size={size === "lg" ? "md" : "sm"}
        className={cn(size === "lg" && "h-10")}
      >
        Search
      </Button>
    </form>
  );
}

export const EXAMPLE_QUERIES = [
  "implanted BCIs for speech restoration",
  "noninvasive devices for stroke rehabilitation",
  "retinal prostheses tested in humans",
  "companies working on peripheral nerve stimulation",
  "active clinical trials involving neural decoding",
] as const;
