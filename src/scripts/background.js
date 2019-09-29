'use strict';

// ----- global
//const FF = typeof browser !== 'undefined'; // for later
const pacURL = 'scripts/pac.js';
let storageArea; // keeping track of sync
let bgDisable = false;

// ----------------- logger --------------------------------
let logger;
function getLog() { return logger; }
class Logger {

  constructor(size = 100, active = false) {
    this.size = size;
    this.list = [];
    this.active = active;
  }

  clear() {
    this.list = [];
  }

  add(item) {
    this.list.push(item);                             // addds to the end
    this.list = this.list.slice(-this.size);          // slice to the ending size entries
  }

  updateStorage() {
    this.list = this.list.slice(-this.size);          // slice to the ending size entries
    storageArea.set({logging: {size: this.size, active: this.active} });
  }
}
// ----------------- /logger -------------------------------


// ----------------- Listeners ------------------
// https://bugzilla.mozilla.org/show_bug.cgi?id=1388619
// proxy.onProxyError has been deprecated and will be removed in Firefox 71. Use proxy.onError instead.
// FF60+ proxy.onError | FF55-59 proxy.onProxyError
browser.proxy['onError' || 'onProxyError'].addListener(e => console.error(`pac.js error: ${e.message}`));

// --- registering persistent listener
// Do not change '<all_urls>' to ['*://*/*'] since it seems to break http basic auth:
// https://github.com/foxyproxy/firefox-extension/issues/30
chrome.webRequest.onAuthRequired.addListener(sendAuth, {urls: ['<all_urls']}, ['blocking']);

chrome.runtime.onInstalled.addListener((details) => {       // Installs Update Listener
  // reason: install | update | browser_update | shared_module_update
  switch (true) {

    case details.reason === 'install':
    case details.reason === 'update' && /^(3\.|4\.|5\.5|5\.6)/.test(details.previousVersion):
      chrome.tabs.create({url: '/about.html?welcome'});
      break;
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  // used only for log from PAC, will be removed in the next API update
  if (message.type === 1) {
    logger && logger.active && logger.add(message);
    browser.browserAction.setTitle({title:message.title});
    browser.browserAction.setBadgeText({text: message.title});
    browser.browserAction.setBadgeBackgroundColor({color: message.color});    
  }
  else if (message.type === 2) {
    console.log(message.message, "from PAC");
  }
});


// ----------------- User Preference -----------------------
chrome.storage.local.get(null, result => {
  // browserVersion is not used & runtime.getBrowserInfo() is not supported on Chrome
  // sync is NOT set or it is false, use this result ELSE get it from storage.sync
  // check both storage on start-up
  if (!Object.keys(result)[0]) {                            // local is empty, check sync

    chrome.storage.sync.get(null, syncResult => {
      if (!Object.keys(syncResult)[0]) {                    // sync is also empty
        storageArea = chrome.storage.local;                 // set storage as local
        process(result);
      }
      else {
        chrome.storage.local.set({sync: true});             // save sync as true
        storageArea = chrome.storage.sync;                  // set storage as sync
        process(syncResult);
      }
    });
  }
  else {
    storageArea = result.sync ? chrome.storage.sync : chrome.storage.local; // cache for subsequent use
    !result.sync ? process(result) : chrome.storage.sync.get(null, process);
  }
});
// ----------------- /User Preference ----------------------

function process(settings) {

  let update;
  let prefKeys = Object.keys(settings);

  if (!settings || !prefKeys[0]) {                          // create default settings if there are no settings
    // default
    settings = {
      mode: 'disabled',
      logging: {
        size: 100,
        active: false
      }
    };
    update = true;
  }

  // ----------------- migrate -----------------------------
  // The initial WebExtension version, which was disabled after a couple of days, was called 5.0
  if(settings.hasOwnProperty('whiteBlack')) {               // check for v5.0 storage, it had a whiteBlack property

    delete settings.whiteBlack;
    ///settings[LASTRESORT] = DEFAULT_PROXY_SETTING;           // 5.0 didn't have a default proxy setting
    update = true;
  }

  // Fix import settings bug in 6.1 - 6.1.3 (and Basic 5.1 - 5.1.3) where by import of legacy foxyproxy.xml
  // imported this property as a string rather than boolean.
  if (prefKeys.find(item => settings[item].proxyDNS && typeof settings[item].proxyDNS === 'string')) {
    prefKeys.forEach(item => {

      if (settings[item].proxyDNS && typeof settings[item].proxyDNS === 'string') {
        settings[item].proxyDNS = settings[item].proxyDNS === 'true' ? true : false;
      }
    });
    update = true;
  }
  // ----------------- /migrate ----------------------------

  // update storage then add Change Listener
  update ? storageArea.set(settings, () => chrome.storage.onChanged.addListener(storageOnChanged)) :
                                            chrome.storage.onChanged.addListener(storageOnChanged);

  logger = settings.logging ? new Logger(settings.logging.size, settings.logging.active) : new Logger();
  sendToPAC(settings);
  console.log('background.js: loaded proxy settings from storage.');
}

// Update the PAC script whenever stored settings change
function storageOnChanged(changes, area) {
//    console.log(changes);
  // update storageArea on sync on/off change from options
  if (changes.hasOwnProperty('sync') && changes.sync.newValue !== changes.sync.oldValue) {
    storageArea = changes.sync.newValue ? chrome.storage.sync : chrome.storage.local;
  }

  // update logger from log
  if (Object.keys(changes).length === 1 && changes.logging) { return; }


  // mode change from bg
  if(changes.mode && changes.mode.newValue === 'disabled' && bgDisable) {
    bgDisable = false;
    return;
  }

  // default: changes from popup | options
  storageArea.get(null, sendToPAC);
}


function sendToPAC(settings) {

  const pref = settings;
  const prefKeys = Object.keys(pref).filter(item => !['mode', 'logging', 'sync'].includes(item)); // not for these

  // --- cache credentials in authData (only those with user/pass)
  prefKeys.forEach(id => pref[id].username && pref[id].password &&
    (authData[pref[id].address] = {username: pref[id].username, password: pref[id].password}) );


  const mode = settings.mode;

  if (mode === 'disabled' || (FOXYPROXY_BASIC && mode === 'patterns')){
    setDisabled();
  }

  else if (['patterns', 'random', 'roundrobin'].includes(mode)) { // we only support 'patterns' ATM

    const active = {
      mode,
      proxySettings: []
    }

    // filter out the inactive proxy settings
    prefKeys.forEach(id => pref[id].active && active.proxySettings.push(pref[id]));
    active.proxySettings.sort((a, b) => a.index - b.index); // sort by index

    function processPatterns(patterns) {
      return patterns.reduce((accumulator, pat) => {
        if (pat.active) {
          if (pat.type === PATTERN_TYPE_WILDCARD) {
            // Convert wildcards to regular expressions.
            // Validate. If invalid, notify user.
            // Store the original pattern so if this pattern matches anything,
            // we can display whatever the user entered ("original") in the log
            pat.originalPattern = pat.pattern;
            pat.pattern = Utils.safeRegExp(Utils.wildcardToRegExp(pat.pattern));
            accumulator.push(pat);
          }
          else if (pat.type == PATTERN_TYPE_REGEXP) {
            // Validate regexp. If invalid, notify user
            // Store the original pattern so if this pattern matches anything,
            // we can display whatever the user entered ("original") in the log
            pat.originalPattern = pat.pattern;
            pat.pattern = Utils.safeRegExp(pat.pattern);
            accumulator.push(pat);
          }
          else {
            console.error(`Ignoring unknown type in pattern object ${pat}`);
          }
        }
        return accumulator;
      }, []);
    }
    // Filter out the inactive patterns before we send to pac. that way, each findProxyMatch() call
    // is a little faster (doesn't even know about inative patterns). Also convert all patterns to reg exps.
    for (const idx in active.proxySettings) {
      active.proxySettings[idx].blackPatterns = processPatterns(active.proxySettings[idx].blackPatterns);
      active.proxySettings[idx].whitePatterns = processPatterns(active.proxySettings[idx].whitePatterns);
    }

    browser.proxy.register(pacURL).then(() => {

      chrome.browserAction.setIcon({path: '/images/icon.svg'});
      chrome.browserAction.setTitle({title: chrome.i18n.getMessage('patterns')});
      chrome.browserAction.setBadgeText({text: ''});
      chrome.runtime.sendMessage(active, {toProxyScript: true});
    });
  }
  else {
    // User has selected a proxy for all URLs (not patterns, disabled, random, round-robin modes).
    // mode is set to the proxySettings id to use for all URLs.
    // Find it and pass to the PAC as the only proxySetting.
    if (settings[mode]) {

      const tmp = settings[mode];
      browser.proxy.register(pacURL).then(() => {

        const title = tmp.title || `${tmp.address}:${tmp.port}`;
        chrome.browserAction.setIcon({path: '/images/icon.svg'});
        chrome.browserAction.setTitle({title});
        chrome.browserAction.setBadgeText({text: title});
        chrome.browserAction.setBadgeBackgroundColor({color: tmp.color});
        chrome.runtime.sendMessage({mode, proxySettings: [settings[mode]]}, {toProxyScript: true});
      });
    }
    else {
      bgDisable = true;
      storageArea.set({mode: 'disabled'});                  // only in case of error, otherwise mode is already set
      setDisabled();
      console.error(`Error: mode is set to ${mode} but no active proxySetting is found with that id. Disabling Due To Error`);
    }
  }
}


function setDisabled(isError) {

  chrome.runtime.sendMessage({mode: 'disabled'});           // Update the options.html UI if it's open

  browser.proxy.unregister().then(() => {

    chrome.browserAction.setIcon({path: 'images/icon-off.svg'});
    chrome.browserAction.setTitle({title: chrome.i18n.getMessage('disabled')});
    chrome.browserAction.setBadgeText({text: ''});
    console.log('******* disabled mode');
  });
}



// ----------------- Proxy Authentication ------------------
// ----- session global
let authData = {};

function sendAuth(request) {

  // Do nothing if this not proxy auth request:
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onAuthRequired
  //   "Take no action: the listener can do nothing, just observing the request. If this happens, it will
  //   have no effect on the handling of the request, and the browser will probably just ask the user to log in."
  if (!request.isProxy) return;

  // --- authData credentials not yet populated from storage
  // --- cancel request; user may come back to the tab & reload it later.
  if(!Object.keys(authData)[0]) { return {cancel: true}; }

  // --- first authentication
  // According to https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onAuthRequired :
  //  "request.challenger.host is the requested host instead of the proxy requesting the authentication"
  //  But in my tests (Fx 69.0.1 MacOS), it is indeed the proxy requesting the authentication
  // TODO: test in future Fx releases to see if that changes.
  // console.log(request.challenger.host, "challenger host");
  if (authData[request.challenger.host]) {
    return {authCredentials: authData[request.challenger.host]};
  }
  // --- no user/pass set for the challenger.host, leave the authentication to the browser
}

