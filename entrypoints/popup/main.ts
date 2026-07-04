import { ENGINES, DEFAULT_ENGINE_ORDER } from '../../lib/engines';
import { getSettings, setSettings } from '../../lib/settings';

async function render() {
  const settings = await getSettings();
  const list = document.getElementById('engines')!;
  list.innerHTML = '';

  // Show all known engines; checkbox = enabled/in engineOrder.
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
      // Preserve a stable order based on the default ordering.
      const next = DEFAULT_ENGINE_ORDER.filter((x) => order.has(x));
      await setSettings({ engineOrder: next });
      render();
    });

    const label = document.createElement('span');
    label.innerHTML = `<b>${e.name}</b> <span class="sub">${e.note ?? ''}</span>`;

    li.append(cb, label);
    list.append(li);
  }

  const bg = document.getElementById('openInBackground') as HTMLInputElement;
  bg.checked = settings.openInBackground;
  bg.onchange = () => setSettings({ openInBackground: bg.checked });
}

render();
