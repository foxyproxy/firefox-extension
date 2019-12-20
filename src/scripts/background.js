'use strict';

// ----- global
//const FF = typeof browser !== 'undefined'; // for later
let storageArea; // keeping track of sync
let bgDisable = false;

// Start in disabled mode because it's going to take time to load setings from storage
let activeSettings = {mode: 'disabled'};

// ----------------- logger --------------------------------
let logger;
function getLog() { return logger; }
class Logger {

  constructor(size = 100, active = false) {
    this.size = size;
    this.matchedList = [];
    this.unmatchedList = [];
    this.active = active;
  }

  clear() {
    this.matchedList = [];
    this.unmatchedList = [];
  }
  
  addMatched(item) {
    this.matchedList.push(item);
    this.matchedList = this.matchedList.slice(-this.size); // slice to the ending size entries
  }

  addUnmatched(item) {
    this.unmatchedList.push(item);
    this.unmatchedList = this.unmatchedList.slice(-this.size); // slice to the ending size entries    
  }

  updateStorage() {
    this.matchedList = this.matchedList.slice(-this.size);          // slice to the ending size entries
    this.unmatchedList = this.unmatchedList.slice(-this.size);      // slice to the ending size entries
    storageArea.set({logging: {size: this.size, active: this.active} });
  }
}
// ----------------- /logger -------------------------------

// --- registering persistent listener
// https://bugzilla.mozilla.org/show_bug.cgi?id=1359693 ...Resolution: --- ? WONTFIX
chrome.webRequest.onAuthRequired.addListener(sendAuth, {urls: ['*://*/*']}, ['blocking']);
chrome.webRequest.onCompleted.addListener(clearPending, {urls: ['*://*/*']});
chrome.webRequest.onErrorOccurred.addListener(clearPending, {urls: ['*://*/*']});

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
  
  // update storage then add Change Listener
  if (update) {
    storageArea.set(settings, () => chrome.storage.onChanged.addListener(storageOnChanged));
  }
  else {
    chrome.storage.onChanged.addListener(storageOnChanged);
  }

  logger = settings.logging ? new Logger(settings.logging.size, settings.logging.active) : new Logger();
  setActiveSettings(settings);
  console.log('background.js: loaded proxy settings from storage.');
}

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
  const proxy_matched = findProxyMatch(requestInfo.url, activeSettings);
  // better to filter out: requestInfo.type == "speculative"
  //  They don't seem to fire in "onCompleted" or "onErrorOccurred"
  //  and will fill "proxy_for_requestID" without deletion.
  if (requestInfo.type != "speculative") {
    proxy_for_requestID[requestInfo.requestId] = proxy_matched;
  }
  return proxy_matched;
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

    function processPatternObjects(patternObjects) {
      return patternObjects.reduce((accumulator, patternObject) => {
        patternObject = Utils.processPatternObject(patternObject);
        patternObject && accumulator.push(patternObject);
        return accumulator;
      }, []);
    }
    
    // Filter out the inactive patterns. that way, each comparison
    // is a little faster (doesn't even know about inactive patterns). Also convert all patterns to reg exps.
    for (const idx in activeSettings.proxySettings) {
      activeSettings.proxySettings[idx].blackPatterns = processPatternObjects(activeSettings.proxySettings[idx].blackPatterns);
      activeSettings.proxySettings[idx].whitePatterns = processPatternObjects(activeSettings.proxySettings[idx].whitePatterns);
    }
    browser.proxy.onRequest.addListener(proxyRequest, {urls: ["<all_urls>"]});
    Utils.updateIcon('images/icon.svg', null, 'patterns', 'patterns');
    console.log(activeSettings, "activeSettings in patterns mode");
  }
  else {
    // User has selected a proxy for all URLs (not patterns, disabled, random, round-robin modes).
    // mode is set to the proxySettings id to use for all URLs.
    if (settings[mode]) {
      activeSettings.proxySettings = [settings[mode]];
      browser.proxy.onRequest.addListener(proxyRequest, {urls: ["<all_urls>"]});
      Utils.updateIcon('images/icon.svg', settings[mode].color, 'forAll', true, Utils.getProxyTitle(settings[mode]), false);
      console.log(activeSettings, "activeSettings in fixed mode");      
    }
    else {
      // This happens if user deletes the current proxy and mode is "use this proxy for all URLs"
      // Don't remove this block.
      bgDisable = true;
      storageArea.set({mode: 'disabled'});                  // only in case of error, otherwise mode is already set
      setDisabled();
      console.error(`Error: mode is set to ${mode} but no active proxySetting is found with that id. Disabling Due To Error`);
    }
  }
}


function setDisabled(isError) {
  browser.proxy.onRequest.hasListener(proxyRequest) && browser.proxy.onRequest.removeListener(proxyRequest);
  chrome.runtime.sendMessage({mode: 'disabled'});           // Update the options.html UI if it's open
  Utils.updateIcon('images/icon-off.svg', null, 'disabled', true);
  console.log('******* disabled mode');
}


// ----------------- Proxy Authentication ------------------
// ----- session global
let authData = {};
let authPending = {};
let proxy_for_requestID = {};

async function sendAuth(request) {
  // Do nothing if this not proxy auth request:
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onAuthRequired
  //   "Take no action: the listener can do nothing, just observing the request. If this happens, it will
  //   have no effect on the handling of the request, and the browser will probably just ask the user to log in."
  if (!request.isProxy) return;
  
  // --- already sent once and pending
  if (authPending[request.requestId]) { return {cancel: true}; }

  // --- authData credentials not yet populated from storage
  if(!Object.keys(authData)[0]) { await getAuth(request); }

  // --- first authentication
  // According to https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onAuthRequired :
  //  "request.challenger.host is the requested host instead of the proxy requesting the authentication"
  //  But in my tests (Fx 69.0.1 MacOS), it is indeed the proxy requesting the authentication
  // TODO: test in future Fx releases to see if that changes.
  // console.log(request.challenger.host, "challenger host");
  if (authData[request.challenger.host]) {
    authPending[request.requestId] = 1;                       // prevent bad authentication loop
    return {authCredentials: authData[request.challenger.host]};
  }

  // Can confirm (Fx 68.2 ESR), but requested host is available in "request.url":
  //  Use result from function "proxyRequest" via "proxy_for_requestID" if
  //  available, otherwise repeat call to "proxyRequest":
  let proxy_matched = {};
  if (proxy_for_requestID[request.requestId]) {
    proxy_matched  = proxy_for_requestID[request.requestId];
  } else {
    proxy_matched = proxyRequest(request);
  };
  if (proxy_matched) {
    if (request.challenger.host == proxy_matched.host && request.challenger.port == proxy_matched.port) {
      authPending[request.requestId] = 1;                       // prevent bad authentication loop
      if (proxy_matched.username != "" || proxy_matched.password != "") {
        const response = {authCredentials: {username: proxy_matched.username, password: proxy_matched.password}};
        return response;
      }
    }
  }
  // --- no user/pass set for the challenger.host, leave the authentication to the browser
}

async function getAuth(request) {

  await new Promise(resolve => {
    chrome.storage.local.get(null, result => {
      const host = result.hostData[request.challenger.host];
      if (host && host.username) {                          // cache credentials in authData
        authData[host] = {username: host.username, password: host.password};
      }
      resolve();
    });
  });
}

function clearProxyrRequestID(request) {

  if (proxy_for_requestID[request.requestId]) {
    delete proxy_for_requestID[request.requestId];
  }
}

function clearPending(request) {

  if(!authPending[request.requestId]) { return; }

  if (request.error) {
    const host = request.proxyInfo && request.proxyInfo.host ? request.proxyInfo.host : request.ip;
    Utils.notify(chrome.i18n.getMessage('authError', host));
    console.error(request.error);
    return; // auth will be sent again
  }

  delete authPending[request.requestId];                    // no error
}