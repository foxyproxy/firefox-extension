'use strict';

// ----- global
//const FF = typeof browser !== 'undefined'; // for later
const pacURL = 'scripts/pac.js';
let storageArea; // keeping track of sync
let bgDisable = false;

// ----------------- logger --------------------------------
// log.js -> logg.clear() | logg.elements | logg.active
// bg.js -> new Logg(size, active) | loog.add() | logg.active
let newLog;
function getLog() { return newLog; }
class Logger {

  constructor(maxSize = 500, active = true) {
    this.maxSize = maxSize; // there is no UI to hange this, so it is fixed, there may not be an option in ew API for logging
    this.elements = [];
    this.active = active;
  }

  clear() {
    this.elements = [];
  }

  add(item) {
    this.elements.push(item);                             // addds to the end
    this.elements = this.elements.slice(-this.maxSize);   // slice to the ending maxsize entries
  }
}
// ----------------- /logger -------------------------------


// ----------------- Listeners ------------------
// https://bugzilla.mozilla.org/show_bug.cgi?id=1388619
// proxy.onProxyError has been deprecated and will be removed in Firefox 71. Use proxy.onError instead.
// FF60+ proxy.onError | FF55-59 proxy.onProxyError
browser.proxy['onError' || 'onProxyError'].addListener(e => console.error(`pac.js error: ${e.message}`));

// --- registering persistent listener
// auth can only be sent for HTTP requests so '<all_urls>' is not needed
// https://bugzilla.mozilla.org/show_bug.cgi?id=1359693 ...Resolution: --- ? WONTFIX
chrome.webRequest.onAuthRequired.addListener(sendAuth, {urls: ['*://*/*']}, ['blocking']);

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
  // used only for log from PAC
  message.type === 'log' && newLog && newLog.active && newLog.add(message);
  message.type !== 'log' && console.log(message);
});


// ----- start

// ----------------- User Preference -----------------------
chrome.storage.local.get(null, result => {
  // browserVersion is not used & runtime.getBrowserInfo() is not supported on Chrome
  // sync is NOT set or it is false, use this result ELSE get it from storage.sync
  storageArea = result.sync ? chrome.storage.sync : chrome.storage.local; // cache for subsequent use
  !result.sync ? process(result) : chrome.storage.sync.get(null, process);
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
        size: 500,
        active: true
      },
      [LASTRESORT]: {
        id: LASTRESORT,
        active: true,
        title: 'Default',
        notes: 'These are the settings that are used when no patterns match a URL.',
        color: '#0055E5',
        type: PROXY_TYPE_NONE, // const PROXY_TYPE_NONE = 5; // DIRECT
        whitePatterns: [PATTERN_ALL_WHITE],
        blackPatterns: []
      }
    };
    update = true;
  }

  // ----- migrate
  if(settings.hasOwnProperty('whiteBlack')) {               // check for pre v5.0 storage, it had a whiteBlack property

    delete settings.whiteBlack;
    settings[LASTRESORT] = DEFAULT_PROXY_SETTING;           // 5.0 didn't have a default proxy setting
    update = true;
  }

  // Fix import settings bug in 6.1 - 6.1.3 (and Basic 5.1 - 5.1.3) where by import of legacy foxyproxy.xml
  // imported this property as a string rather than boolean.
  prefKeys.filter(item => !['mode', 'logging', 'sync'].includes(item)).forEach(item => {

    if (settings[item].proxyDNS && typeof settings[item].proxyDNS === 'string') {
      settings[item].proxyDNS = settings[item].proxyDNS === 'true' ? true : false;
      update =  true;
    }

    [settings[item].blackPatterns, update] = checkPatterns(settings[item].blackPatterns);
    [settings[item].whitePatterns, update] = checkPatterns(settings[item].whitePatterns);
  });

  update && storageArea.set(settings);                      // update storage

  chrome.storage.onChanged.addListener(storageOnChanged);   // add Change Listener after above updates

  const size = settings.logging ? settings.logging.size : 500; // default 500
  const active = settings.logging ? settings.logging.active : true; // default true
  newLog = new Logger(size, active);
  sendToPAC(settings);
  console.log('background.js: loaded proxy settings from storage.');
}

// Update the PAC script whenever stored settings change
function storageOnChanged(changes, area) {
    //console.log(changes);
  // update storageArea on sync on/off change from options
  if (changes.hasOwnProperty('sync') && changes.sync.newValue !== changes.sync.oldValue) {
    storageArea = changes.sync.newValue ? chrome.storage.sync : chrome.storage.local;
  }

  // update newLog on on/off change from log
  if (changes.logging) {
    newLog.active = changes.logging.newValue.active;
  }

  // mode change from bg
  if(changes.mode && changes.mode.newValue === 'disabled' && bgDisable) {
    bgDisable = false;
    return;
  }

  // default: changes from popup | options
  storageArea.get(null, sendToPAC);

}



function sendToPAC(settings) {
console.log('sendToPAC called');

  const pref = settings;
  const prefKeys = Object.keys(pref).filter(item => !['mode', 'logging', 'sync'].includes(item)); // not for these

  // --- cache credentials in authData (only those with user/pass)
  prefKeys.forEach(id => pref[id].username && pref[id].password &&
    (authData[pref[id].address] = {username: pref[id].username, password: pref[id].password}) );
  // console.log(authData);

  // settings will always have proxySettings with default
  // Remove inactive proxySetting objects and patterns
//  settings = Utils.prepareForSettings(settings);
//  settings.proxySettings = settings.proxySettings.filter(x => x.active);

  const mode = settings.mode;

  if (mode === 'disabled' || (FOXYPROXY_BASIC && mode === 'patterns')){
    setDisabled();
  }

  else if (['patterns', 'random', 'roundrobin'].includes(mode)) { // we only support 'patterns' now

    const active = {
      mode,
      proxySettings: []
    }

    // filter out the inactive & prepare RegEx
    prefKeys.forEach(id => {
  
      if (pref[id].active) {
    
        [pref[id].blackPatterns] = checkPatterns(pref[id].blackPatterns); // retrurns [a, b]
        [pref[id].whitePatterns] = checkPatterns(pref[id].whitePatterns);
        active.proxySettings.push(pref[id]);
      }
    });

    active.proxySettings.sort((a, b) => a.index - b.index); // sort by index


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
    if (settings[mode]) {  // register only if temp was found

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

// Returns an array of patterns or []
function checkPatterns(patterns = []) {

  let update = false;
  const ret = patterns.map(item => {

    const re = item['regExp']; // cache
    // Build regexp from patterns
    if (item.type === PATTERN_TYPE_WILDCARD) {
      item.regExp = checkRE(Utils.wildcardToRegExp(item.pattern));
    }
    else if (item.type == PATTERN_TYPE_REGEXP) {
      item.regExp = checkRE(item.pattern);
    }
    if (re !== item.regExp) { update = true; }

    return item;
  });

  return [ret, update];

}

function checkRE(str) {

  try {
    new RegExp(str);
    return str;
  }
  catch(e) {
    console.error('Regular Expression Error', str, e.message);
    return 'a^';
  }
}


// ----------------- Proxy Authentication ------------------
// ----- session global
let authData = {};
let authPending = {};

async function sendAuth(request) {

  // --- already sent once and pending
  if (authPending[request.requestId]) { return {cancel: true}; }

  // --- authData credentials not yet populated from storage
  if(!Object.keys(authData)[0]) { return {cancel: true}; }

  // --- first authentication
  if (authData[request.challenger.host]) {
    authPending[request.requestId] = 1;                       // prevent bad authentication loop
    return {authCredentials: authData[request.challenger.host]};
  }
  // --- no user/pass set for the challenger.host, leave the authentication to the browser
}

function clearPending(request) {

  if(!authPending[request.requestId]) { return; }

  if (request.error) {
    const host = request.proxyInfo && request.proxyInfo.host ? request.proxyInfo.host : request.ip;
    Utils.notify(chrome.i18n.getMessage('authError', host));
    console.error(request.error);
    return;
  }

  delete authPending[request.requestId];                    // no error
}
