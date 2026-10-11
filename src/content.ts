import { mount } from './controller';
import { loadSettings, parseSettings } from './settings';
import { remoteChecker } from './remote-checker';
import { createNotices } from './popover';
void (async () => {
  const initial=await loadSettings();
  let notices=createNotices(initial);
  let controller = mount(initial,remoteChecker,notices.update);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {const settings=parseSettings(changes.settings.newValue);notices.configure(settings);controller.update(settings);}
    else if(area==='local' && (changes.provider || changes.providerRevision)) controller.invalidate();
  });
  window.addEventListener('pagehide', () => {controller.dispose();notices.dispose();});
  window.addEventListener('pageshow', event => {
    if (event.persisted) void loadSettings().then(settings => { notices=createNotices(settings);controller = mount(settings,remoteChecker,notices.update); });
  });
})();
