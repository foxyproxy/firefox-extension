'use strict';

// ----- global
//const FF = typeof browser !== 'undefined'; // for later
let storageArea; // keeping track of sync
let bgDisable = false;
 
// shortcuts so we can do int comparisons, rather than string comparisons, in hotspots
const FIXED_MODE = 1, PATTERNS_MODE = 2, DISABLED_MODE = 3;

// Start in DISABLED_MODE mode because it's going to take time to load setings from storage
let activeSettings = {mode: DISABLED_MODE};

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

chrome.runtime.onInstalled.addListener((details) => {       // Installs Update Listener
  // reason: install | update | browser_update | shared_module_update
  switch (true) {

    case details.reason === 'install':
    case details.reason === 'update' && /^(3\.|4\.|5\.5|5\.6)/.test(details.previousVersion):
      chrome.tabs.create({url: '/about.html?welcome'});
      break;
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
  setActiveSettings(settings);
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
  storageArea.get(null, setActiveSettings);
}

function proxyRequest(requestInfo) {
  return findProxyMatch(requestInfo.url, activeSettings);  
}

function setActiveSettings(settings) {
  browser.proxy.onRequest.hasListener(proxyRequest) && browser.proxy.onRequest.removeListener(proxyRequest);
  
  const pref = settings;
  const prefKeys = Object.keys(pref).filter(item => !['mode', 'logging', 'sync'].includes(item)); // not for these

  // --- cache credentials in authData (only those with user/pass)
  prefKeys.forEach(id => pref[id].username && pref[id].password &&
    (authData[pref[id].address] = {username: pref[id].username, password: pref[id].password}) );


  const mode = settings.mode;
  activeSettings = {  // global
    mode,
    proxySettings: []
  };
  
  if (mode === 'disabled' || (FOXYPROXY_BASIC && mode === 'patterns')){
    setDisabled();
    return;
  }

  if (['patterns', 'random', 'roundrobin'].includes(mode)) { // we only support 'patterns' ATM

    // filter out the inactive proxy settings
    prefKeys.forEach(id => pref[id].active && activeSettings.proxySettings.push(pref[id]));
    activeSettings.proxySettings.sort((a, b) => a.index - b.index); // sort by index

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
    for (const idx in activeSettings.proxySettings) {
      activeSettings.proxySettings[idx].blackPatterns = processPatterns(activeSettings.proxySettings[idx].blackPatterns);
      activeSettings.proxySettings[idx].whitePatterns = processPatterns(activeSettings.proxySettings[idx].whitePatterns);
    }
    activeSettings.mode = PATTERNS_MODE;
    //console.log(activeSettings, "activeSettings in patterns mode");
    browser.proxy.onRequest.addListener(proxyRequest, {urls: ["<all_urls>"]});
  }
  else {
    // User has selected a proxy for all URLs (not patterns, disabled, random, round-robin modes).
    // mode is set to the proxySettings id to use for all URLs.
    if (settings[mode]) {
      activeSettings.proxySettings = [settings[mode]];
      activeSettings.mode = FIXED_MODE;
      //console.log(activeSettings, "activeSettings in fixed mode");      
      browser.proxy.onRequest.addListener(proxyRequest, {urls: ["<all_urls>"]});      
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
  browser.proxy.onRequest.hasListener(proxyRequest) && browser.proxy.onRequest.removeListener(proxyRequest);
  activeSettings.mode = DISABLED_MODE;
  chrome.runtime.sendMessage({mode: 'disabled'});           // Update the options.html UI if it's open
  chrome.browserAction.setIcon({path: 'images/icon-off.svg'});
  chrome.browserAction.setTitle({title: chrome.i18n.getMessage('disabled')});
  chrome.browserAction.setBadgeText({text: ''});
  console.log('******* disabled mode');
}



// ----------------- Proxy Authentication ------------------
// ----- session global
let authData = {};
