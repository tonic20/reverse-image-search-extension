import { browser } from 'wxt/browser';
import { i18n } from '#i18n';
import { ENGINES, DEFAULT_ENGINE_ORDER } from '../../lib/engines';
import { getSettings, setSettings } from '../../lib/settings';
import { browserOwnsDataConsent } from '../../lib/telemetry-actions';
import { MSG } from '../../lib/messages';
import { localizeDom } from '../../lib/dom-i18n';
import { FEEDBACK_URL, RatingLinks, rateTarget, shouldAsk } from '../../lib/rating';
import { getRating, onRate } from '../../lib/rating-actions';
import { STORE_REVIEW_URL } from '../../lib/store-review-url';

const ENGINE_NOTE_KEY = {
  google: 'engine_note_google',
  bing: 'engine_note_bing',
  yandex: 'engine_note_yandex',
  tineye: 'engine_note_tineye',
} as const;

async function renderEngines() {
  const settings = await getSettings();
  const list = document.getElementById('engines')!;
  list.innerHTML = '';

  for (const id of Object.keys(ENGINES)) {
    const e = ENGINES[id];
    const enabled = settings.engineOrder.includes(id);
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = enabled;
    cb.addEventListener('change', async () => {
      const order = new Set(settings.engineOrder);
      cb.checked ? order.add(id) : order.delete(id);
      const next = DEFAULT_ENGINE_ORDER.filter((x) => order.has(x));
      await setSettings({ engineOrder: next });
      renderEngines();
    });

    const icon = document.createElement('img');
    icon.className = 'engine-ico';
    icon.src = `/icons/engines/${id}.png`;
    icon.alt = '';
    icon.width = 16;
    icon.height = 16;
    // Hide gracefully if an engine has no bundled icon.
    icon.onerror = () => (icon.style.display = 'none');

    const label = document.createElement('span');
    const noteKey = ENGINE_NOTE_KEY[id as keyof typeof ENGINE_NOTE_KEY];
    const note = noteKey ? i18n.t(noteKey) : '';
    // Built with DOM APIs rather than innerHTML: AMO's linter flags the
    // interpolated form, and it would become a real injection point the moment
    // engine names stop being first-party constants.
    const strong = document.createElement('b');
    strong.textContent = e.name;
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = note;
    label.append(strong, ' ', sub);

    li.append(cb, icon, label);
    list.append(li);
  }

  const bg = document.getElementById('openInBackground') as HTMLInputElement;
  bg.checked = settings.openInBackground;
  bg.onchange = () => setSettings({ openInBackground: bg.checked });

  // Firefox 140+ owns this decision: it shows the toggle in the install flow
  // and the Add-ons Manager, and telemetry-actions reads it instead of the
  // stored setting. Offering a second switch here could only contradict it.
  const countRow = document.getElementById('countSearchesRow')!;
  if (await browserOwnsDataConsent()) {
    countRow.hidden = true;
  } else {
    countRow.hidden = false;
    const count = document.getElementById('countSearches') as HTMLInputElement;
    count.checked = settings.countSearches;
    count.onchange = () => setSettings({ countSearches: count.checked });
  }
}

function status(text: string) {
  const el = document.getElementById('status')!;
  el.textContent = text;
  el.hidden = false;
}

async function sendToActiveTab(type: string, retryLabel: string) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await browser.tabs.sendMessage(tab.id, { type });
    window.close();
  } catch {
    // The content script isn't present on this tab (e.g. a page open before
    // install, or a restricted page). Ask the user to reload.
    status(i18n.t('status_reload', [retryLabel]));
  }
}

const startCapture = () => sendToActiveTab(MSG.START_CAPTURE, i18n.t('popup_capture'));
const startFaceCapture = () => sendToActiveTab(MSG.START_FACE_CAPTURE, i18n.t('search_this_face'));

async function onPaste(e: ClipboardEvent) {
  const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
  const file = item?.getAsFile();
  if (!file) {
    status(i18n.t('status_no_clipboard_image'));
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  await browser.runtime.sendMessage({ type: MSG.SEARCH_IMAGE, dataUrl, action: 'upload_paste' });
  window.close();
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// An outlined star; CSS fills it up to the one pointed at.
const STAR_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/** Rate us (lib/rating.ts): decided once on open, so the popup never changes height mid-read. */
async function maybeShowRating() {
  const links: RatingLinks = { reviews: STORE_REVIEW_URL, feedback: FEEDBACK_URL };
  if (!shouldAsk(await getRating(), links)) return;

  const row = document.getElementById('rate')!;
  const stars = document.getElementById('stars')!;
  for (let n = 1; n <= 5; n++) {
    const a = document.createElement('a');
    a.href = rateTarget(n, links);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', i18n.t('rate_stars', [String(n)]));
    a.innerHTML = STAR_SVG;
    // Not the link's own navigation: onRate saves the stars before the new tab
    // takes focus and the popup closes.
    a.addEventListener('click', (e) => {
      e.preventDefault();
      row.hidden = true;
      void onRate(n, a.href);
    });
    stars.append(a);
  }
  row.hidden = false;
}

document.getElementById('capture')!.addEventListener('click', startCapture);
document.getElementById('face')!.addEventListener('click', startFaceCapture);
document.addEventListener('paste', onPaste);
// The hint names the context-menu parent, which Chrome titles with the manifest name: the
// localized extName, so the hint takes it as $1 and stays right in every language.
localizeDom(document, (key) =>
  key === 'popup_hint_html'
    ? i18n.t('popup_hint_html', [i18n.t('extName')])
    : i18n.t(key as Parameters<typeof i18n.t>[0]),
);
renderEngines();
void maybeShowRating();
