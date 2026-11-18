import type { ReactNode } from "react";
import { parseJobDescription } from "@/lib/jobDescription";
import type { JdSource, JdStatus } from "@/lib/types";

const LINK_PATTERN = /(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
const LABEL_PATTERN =
  /^(Project title|About the project|Essential|Desirable|Optional|Pay Level|Consolidated salary|Age limit|Salary|Stipend|Tenure|Duration|Note)\b\s*(?:--|–|:|-)?\s*/i;
const FACT_PATTERN =
  /^(Project title|About the project|Pay Level|Consolidated salary|Age limit|Salary|Stipend|Tenure|Duration)\b/i;

function renderLinks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    const raw = match[0];
    const value = raw.replace(/[),.;]+$/g, "");
    const trailing = raw.slice(value.length);
    const isWeb = /^https?:\/\//i.test(value);
    const href = isWeb ? value : `mailto:${value}`;

    parts.push(
      <a
        key={`${href}-${index}`}
        href={href}
        target={isWeb ? "_blank" : undefined}
        rel={isWeb ? "noreferrer noopener" : undefined}
        className="break-words font-medium text-indigo-300 underline decoration-indigo-400/40 underline-offset-2 transition hover:text-indigo-200"
      >
        {value}
      </a>,
    );
    if (trailing) parts.push(trailing);
    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

function renderText(text: string): ReactNode {
  const label = text.match(LABEL_PATTERN);
  if (label) {
    return (
      <>
        <span className="font-semibold text-slate-100">{label[1]}</span>{" "}
        {renderLinks(text.slice(label[0].length))}
      </>
    );
  }
  return renderLinks(text);
}

function headingStyle(text: string): {
  accent: string;
  badge?: { label: string; classes: string };
} {
  if (/essential/i.test(text)) {
    return {
      accent: "bg-emerald-400",
      badge: {
        label: "Must have",
        classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      },
    };
  }
  if (/desirable/i.test(text)) {
    return {
      accent: "bg-amber-400",
      badge: {
        label: "Good to have",
        classes: "border-amber-500/25 bg-amber-500/10 text-amber-300",
      },
    };
  }
  if (/pay|salary/i.test(text)) {
    return {
      accent: "bg-indigo-400",
      badge: {
        label: "Compensation",
        classes: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
      },
    };
  }
  if (/apply/i.test(text)) {
    return {
      accent: "bg-sky-400",
      badge: {
        label: "How to apply",
        classes: "border-sky-500/25 bg-sky-500/10 text-sky-300",
      },
    };
  }
  if (/job profile|about the project/i.test(text)) {
    return { accent: "bg-violet-400" };
  }
  return { accent: "bg-slate-500" };
}

function descriptionBadge(
  source: JdSource | null | undefined,
  status: JdStatus | null | undefined,
): { label: string; classes: string } {
  if (status === "failed") {
    return {
      label: "Extraction failed",
      classes: "border-rose-500/25 bg-rose-500/10 text-rose-300",
    };
  }
  if (status === "empty") {
    return {
      label: "No text found",
      classes: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    };
  }
  if (source === "ocr") {
    return {
      label: "OCR text",
      classes: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    };
  }
  if (source === "mixed") {
    return {
      label: "OCR + text",
      classes: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    };
  }
  return {
    label: "From advert PDF",
    classes: "border-white/10 bg-white/5 text-slate-400",
  };
}

export function JobDescription({
  text,
  source,
  status,
}: {
  text: string;
  source?: JdSource | null;
  status?: JdStatus | null;
}) {
  const parsed = parseJobDescription(text);
  const badge = descriptionBadge(source, status);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-indigo-500/10 via-white/[0.02] to-transparent px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M7 3h7l5 5v13H7z" />
              <path d="M14 3v5h5" />
              <path d="M10 13h6" />
              <path d="M10 17h4" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              Job description
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {parsed.institution ?? "Official advertisement"}
              {parsed.advertisementNo ? ` · ${parsed.advertisementNo}` : ""}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${badge.classes}`}
        >
          {badge.label}
        </span>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        {parsed.blocks.length === 0 ? (
          <p className="text-sm text-slate-400">No description captured.</p>
        ) : (
          parsed.blocks.map((block, index) => {
            if (block.kind === "heading") {
              const style = headingStyle(block.text);
              return (
                <div
                  key={`heading-${index}`}
                  className="flex flex-wrap items-center gap-2 pt-1 first:pt-0"
                >
                  <span className={`h-4 w-1 rounded-full ${style.accent}`} />
                  <h3 className="text-sm font-semibold text-slate-100">
                    {block.text}
                  </h3>
                  {style.badge ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.badge.classes}`}
                    >
                      {style.badge.label}
                    </span>
                  ) : null}
                </div>
              );
            }

            if (block.kind === "paragraph") {
              const fact = FACT_PATTERN.test(block.text);
              return (
                <p
                  key={`paragraph-${index}`}
                  className={
                    fact
                      ? "rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm leading-relaxed text-slate-300"
                      : "text-sm leading-relaxed text-slate-300"
                  }
                >
                  {renderText(block.text)}
                </p>
              );
            }

            return (
              <ul key={`list-${index}`} className="space-y-2">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`item-${index}-${itemIndex}`}
                    className="flex gap-2.5"
                  >
                    {item.marker ? (
                      <span className="mt-0.5 min-w-6 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                        {item.marker}
                      </span>
                    ) : (
                      <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/70 ring-2 ring-indigo-400/10" />
                    )}
                    <span className="min-w-0 text-sm leading-relaxed text-slate-300">
                      {renderText(item.text)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          })
        )}
      </div>
    </section>
  );
}
