/**
 * Fill localized text into a static DOM tree. Elements with `data-i18n` get
 * their textContent set; `data-i18n-html` sets innerHTML (for strings with
 * inline markup like <b>). The translator is injected so this stays testable
 * without the extension i18n runtime.
 */
export function localizeDom(root: ParentNode, t: (key: string) => string): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml!);
  });
}
