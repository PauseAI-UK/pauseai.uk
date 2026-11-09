import type { Metadata } from "next";
import Image from "next/image";
import { isValidElement, type ReactNode } from "react";
import { people, personSlug, type Person } from "./people";
import { site } from "./site";

// What the blog (./blog/) and the campaigns' weekly briefings (./briefings/)
// share: a post's fields, and its byline, images, metadata and feed.

/**
 * Byline for pieces published in the organisation's own name rather than a
 * volunteer's. Rendered without a people/ link, with the Pause symbol where a
 * photo would go, and as an Organization rather than a Person in the article's
 * structured data.
 */
export const ORGANISATION_AUTHOR = "PauseAI UK";
export const ORGANISATION_AVATAR = "/images/logos/Pause-Symbol.svg";

// Deliberately minimal: each post is plain JSX in a file of its own, no
// markdown pipeline or CMS.
export type BlogPost = {
  slug: string;
  title: string;
  /** ISO date, e.g. "2026-08-11" */
  date: string;
  /**
   * Either a `name` in lib/content/people.ts (the byline links to their story),
   * or ORGANISATION_AUTHOR for pieces published in PauseAI UK's own name.
   */
  author: string;
  /** Plain-text summary for the index card and meta description. */
  tldr: string;
  /** Rich version of the summary for the post page's TL;DR callout. */
  tldrContent?: ReactNode;
  content: ReactNode;
  /**
   * Image for the blog index card and the social preview. Optional: without it
   * the first image in `content` is used, and a post with neither renders as a
   * text-only card.
   */
  cover?: PostImage;
};

/**
 * A list of posts with pages of their own: the blog, or the campaigns'
 * briefings (lib/content/briefings/). Its posts' pages are at
 * `${path}/${slug}`, and link back with `backLink`; its Atom feed is at
 * `${path}/feed.xml` (lib/content/posts-feed.ts).
 */
export type PostSection = {
  path: string;
  backLink: string;
  /** The heading over the older posts on the index. */
  moreHeading: string;
  /** The feed's name in a feed reader. */
  feedTitle: string;
};

export function postAuthor(post: BlogPost): { person: Person; slug: string } | null {
  const person = people.find((p) => p.name === post.author);
  if (!person) return null;
  return { person, slug: personSlug(person) };
}

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Throws on a post whose author is neither the organisation nor a person in
 * people.ts. Mirrors checkPeople: without it a misspelt author name would
 * silently fall through to the organisation byline.
 */
export function checkPostAuthors(list: BlogPost[]): void {
  for (const post of list) {
    if (post.author !== ORGANISATION_AUTHOR && !people.some((p) => p.name === post.author)) {
      throw new Error(
        `Post "${post.slug}" has author "${post.author}", which is neither "${ORGANISATION_AUTHOR}" nor a name in lib/content/people.ts.`,
      );
    }
  }
}

export type PostImage = { src: string; width?: number; height?: number; alt?: string };

/**
 * The first image in a post's content, used as the social preview card and
 * the article's structured-data image. Walks the JSX tree so a post doesn't
 * have to declare it separately; null when the post has no images, in which
 * case the page falls back to the site-wide Open Graph image.
 */
export function firstPostImage(post: BlogPost): PostImage | null {
  return findFirstImage(post.content);
}

/** The image that represents a post: its cover if set, otherwise the first image in its content. */
export function postImage(post: BlogPost): PostImage | null {
  return post.cover ?? firstPostImage(post);
}

function findFirstImage(node: ReactNode): PostImage | null {
  if (node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstImage(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown>;
  if (node.type === Image || node.type === "img") {
    const alt = typeof props.alt === "string" ? props.alt : undefined;
    // Static imports (`import photo from "./photo.jpg"`) carry their own dimensions.
    const src = props.src;
    if (src && typeof src === "object" && "src" in src && typeof src.src === "string") {
      const data = src as { src: string; width?: number; height?: number };
      return { src: data.src, width: data.width, height: data.height, alt };
    }
    if (typeof src !== "string") return null;
    return { src, width: toNumber(props.width), height: toNumber(props.height), alt };
  }
  return findFirstImage(props.children as ReactNode);
}

function toNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** A section's posts, newest first. */
export function newestFirst<Post extends BlogPost>(list: Post[]): Post[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

/** Where a section's Atom feed is served. */
export function feedPath(section: PostSection): string {
  return `${section.path}/feed.xml`;
}

/** A section's Atom feed, as metadata's `alternates`, so a feed reader finds it from the section's pages. */
export function feedLink(section: PostSection) {
  return {
    types: { "application/atom+xml": [{ url: feedPath(section), title: section.feedTitle }] },
  } satisfies Metadata["alternates"];
}

/** A post's page metadata. */
export function postMetadata(post: BlogPost, section: PostSection): Metadata {
  // A post's cover, or failing that its first image, is its social preview; posts with neither use the site-wide card.
  const image = postImage(post);
  return {
    title: post.title,
    description: post.tldr,
    openGraph: {
      title: post.title,
      description: post.tldr,
      images: [
        image
          ? { url: image.src, width: image.width, height: image.height, alt: image.alt }
          : { url: "/images/open-graph/open-graph-1200-630.jpg", width: 1200, height: 630 },
      ],
      url: `https://pauseai.uk${section.path}/${post.slug}/`,
      type: "article",
    },
    twitter: {
      images: [image ? image.src : "/images/open-graph/open-graph-1600-840.jpg"],
    },
    alternates: { canonical: `${section.path}/${post.slug}`, ...feedLink(section) },
  };
}

/** Schema.org Article data for a post, for search engines. */
export function postJsonLd(post: BlogPost, section: PostSection) {
  const author = postAuthor(post);
  const image = postImage(post);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.tldr,
    datePublished: post.date,
    url: `${site.url}${section.path}/${post.slug}`,
    mainEntityOfPage: `${site.url}${section.path}/${post.slug}`,
    image: `${site.url}${image?.src ?? "/images/open-graph/open-graph-1200-630.jpg"}`,
    author: author
      ? { "@type": "Person", name: post.author, url: `${site.url}/people/${author.slug}` }
      : { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "PauseAI UK",
      logo: { "@type": "ImageObject", url: `${site.url}/favicon/web-app-manifest-512x512.png` },
    },
  };
}
