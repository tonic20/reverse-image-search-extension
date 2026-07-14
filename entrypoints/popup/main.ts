import { browser } from 'wxt/browser';
import { i18n } from '#i18n';
import { ENGINES, DEFAULT_ENGINE_ORDER } from '../../lib/engines';
import { getSettings, setSettings } from '../../lib/settings';
import { MSG } from '../../lib/messages';
import { localizeDom } from '../../lib/dom-i18n';

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
    const note = i18n.t(ENGINE_NOTE_KEY[id as keyof typeof ENGINE_NOTE_KEY]);
    label.innerHTML = `<b>${e.name}</b> <span class="sub">${note}</span>`;

    li.append(cb, icon, label);
    list.append(li);
  }

  const bg = document.getElementById('openInBackground') as HTMLInputElement;
  bg.checked = settings.openInBackground;
  bg.onchange = () => setSettings({ openInBackground: bg.checked });
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
  await browser.runtime.sendMessage({ type: MSG.SEARCH_IMAGE, dataUrl });
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

document.getElementById('capture')!.addEventListener('click', startCapture);
document.getElementById('face')!.addEventListener('click', startFaceCapture);
document.addEventListener('paste', onPaste);
localizeDom(document, (key) => i18n.t(key as Parameters<typeof i18n.t>[0]));
renderEngines();
