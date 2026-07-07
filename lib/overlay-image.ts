/**
 * Find a searchable image URL in a stack of elements (topmost first, as
 * returned by document.elementsFromPoint).
 *
 * Sites like Instagram/Pinterest lay a transparent element over each photo, so
 * a right-click lands on that overlay and Chrome reports a `page` context with
 * no info.srcUrl. Walking the element stack under the cursor finds the covered
 * <img> (or CSS background-image) so the search can proceed.
 *
 * Resolution order:
 *   1. the first <img> in the stack → currentSrc || src
 *   2. else the first element with a CSS background-image url(...)
 *   3. else null
 */
export function pickImageUrl(elements: Element[]): string | null {
  for (const el of elements) {
    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      const src = img.currentSrc || img.src;
      if (src) return src;
    }
  }
  for (const el of elements) {
    const url = backgroundImageUrl(el);
    if (url) return url;
  }
  return null;
}

/** First url(...) in an element's computed background-image, else null. */
export function backgroundImageUrl(el: Element): string | null {
  // Prefer the inline style first: jsdom/happy-dom test environments don't
  // always reflect an inline style into getComputedStyle(), but real
  // browsers do (and Instagram's background-image comes from a stylesheet,
  // which getComputedStyle always resolves).
  const bg = (el as HTMLElement).style?.backgroundImage || getComputedStyle(el).backgroundImage;
  if (!bg || bg === 'none') return null;
  const match = /url\((['"]?)(.*?)\1\)/.exec(bg);
  return match ? match[2] : null;
}
