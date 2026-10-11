import { mount } from './controller';
import { loadSettings, parseSettings } from './settings';
void (async () => {
  let controller = mount(await loadSettings());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) controller.update(parseSettings(changes.settings.newValue));
  });
  window.addEventListener('pagehide', () => controller.dispose());
  window.addEventListener('pageshow', event => {
    if (event.persisted) void loadSettings().then(settings => { controller = mount(settings); });
  });
})();
