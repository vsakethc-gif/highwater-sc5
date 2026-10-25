/**
 * dom.ts — a tiny helper for building page elements in TypeScript.
 *
 * Instead of writing HTML strings, we call h('p', { class: 'meta' }, 'Hello').
 * Text is always inserted as plain text (never as HTML), so anything typed by
 * a user or returned by an API can't inject code into the page (this blocks "XSS").
 */

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

/** Add children to an element. Strings become text nodes; empty values are skipped. */
export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}
