import React, { ElementType, ReactNode } from "react";

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TRAILING_PUNCTUATION_RE = /[.,;:!?)]$/;

const buildHref = (value: string) => {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const splitTrailingPunctuation = (value: string) => {
  let core = value;
  let trailing = "";

  while (core && TRAILING_PUNCTUATION_RE.test(core)) {
    trailing = core.slice(-1) + trailing;
    core = core.slice(0, -1);
  }

  return { core, trailing };
};

type CommentTextProps<T extends ElementType> = {
  as?: T;
  text?: string | null;
  className?: string;
  linkClassName?: string;
};

const CommentText = <T extends ElementType = "p">({
  as,
  text,
  className,
  linkClassName = "text-gray-700 underline underline-offset-2 hover:text-gray-900 break-all",
}: CommentTextProps<T>) => {
  const value = typeof text === "string" ? text : "";
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const Component = (as || "p") as ElementType;
  const content: ReactNode[] = [];
  const matcher = new RegExp(URL_RE.source, "gi");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(value)) !== null) {
    if (match.index > lastIndex) {
      content.push(value.slice(lastIndex, match.index));
    }

    const { core, trailing } = splitTrailingPunctuation(match[0]);

    if (core) {
      content.push(
        <a
          key={`${match.index}-${core}`}
          href={buildHref(core)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={linkClassName}
        >
          {core}
        </a>
      );
    }

    if (trailing) {
      content.push(trailing);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    content.push(value.slice(lastIndex));
  }

  return <Component className={className}>{content}</Component>;
};

export default CommentText;
