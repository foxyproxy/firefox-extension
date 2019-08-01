'use strict';

// ----- global
//const FF = typeof browser !== 'undefined'; // for later
const pacURL = 'scripts/pac.js';
let proxyScriptLoaded = false, activeSettings;
let storageArea; // keeping track of sync

// --- used in log.js
let logg;
function getLogg() { return logg; }



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


// used only for log from PAC
chrome.runtime.onMessage.addListener((message, sender) => {
//const MESSAGE_TYPE_LOG = 2;
  if (message.type === 'log') {

    //console.log('Got log message from PAC: ' + JSON.stringify(message));
    // chrome.runtime.sendMessage({type: 'log', url: url, matchedPattern: patternObj, proxySetting: proxySetting, error: true});
    logg && logg.add(message);
/*
    // ne need to alter browserAction on log message

    // badge only shows 4 characters, no need to process it
    const title = message.proxySetting.title || `${proxySetting.address}:${message.proxySetting.port}`;
    chrome.browserAction.setTitle({title});
    chrome.browserAction.setBadgeText({text: title});
    chrome.browserAction.setBadgeBackgroundColor({color: message.proxySetting.color});
*/
  }
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
        type: PROXY_TYPE_NONE,
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
      migrate = true;
    }

    const bw = settings[item].blackPatterns + settings[item].whitePatterns;
    settings[item].blackPatterns = checkPatterns(settings[item].blackPatterns);
    settings[item].whitePatterns = checkPatterns(settings[item].whitePatterns);

    if (bw !== settings[item].blackPatterns + settings[item].whitePatterns) {
      update = true;
    }
  });

  update && storageArea.set(settings);                      // update storage

  chrome.storage.onChanged.addListener(storageOnChanged);   // add Change Listener after above updates

  const size = settings.logging ? settings.logging.size : 500; // default 500
  const active = settings.logging ? settings.logging.active : true; // default true
  logg = new Logg(size, active);
  sendSettingsToProxyScript(settings);
  console.log('background.js: loaded proxy settings from storage.');
}

// Update the PAC script whenever stored settings change
function storageOnChanged(changes, area) {
    console.log(changes);
  // update storageArea on sync on/off change from options
  if (changes.hasOwnProperty('sync') && changes.sync.newValue !== changes.sync.oldValue) {
    storageArea = changes.sync.newValue ? chrome.storage.sync : chrome.storage.local;
  }

  // update logg on on/off change from log
  if (changes.logging && changes.logging.newValue.active !== changes.logging.oldValue.active) {
    logg.active = changes.logging.newValue.active;
  }

  // mode change from bg
  if(changes.mode && changes.mode.newValue === 'disabled' && !proxyScriptLoaded) {
    return;
  }

  // mode change from popup | options
  if(changes.mode && changes.mode.newValue !== changes.mode.oldValue) {
    storageArea.get(null, sendSettingsToProxyScript);
    return;
  }

  // default
  if (changes.mode && changes.mode.newValue !== 'disabled') {
    storageArea.get(null, sendSettingsToProxyScript);
    return;
  }
}


// ------------------- change to DB format
function sendSettingsToProxyScript(settings) {
console.log('sendSettingsToProxyScript called');
  // settings will always have proxySettings with default
  settings = Utils.prepareForSettings(settings);

  if (settings.mode === 'disabled' || (FOXYPROXY_BASIC && settings.mode === 'patterns')){
    setDisabled();
  }

  else if (['patterns', 'random', 'roundrobin'].includes(settings.mode)) { // Right now we only support 'patterns'

    registerProxyScript().then(() => {

      proxyScriptLoaded = true;
      chrome.browserAction.setIcon({path: '/images/icon.svg'});
      chrome.browserAction.setTitle({title: chrome.i18n.getMessage('patterns')});
      chrome.browserAction.setBadgeText({text: ''});
      // Remove inactive proxySetting objects and patterns
      activeSettings = settings.proxySettings.filter(x => x.active); // For sendAuth()
      chrome.runtime.sendMessage(activeSettings, {toProxyScript: true});
    });
  }
  else {
    // User has selected a proxy for all URLs (not patterns, disabled, random, round-robin modes).
    // settings.mode is set to the proxySettings id to use for all URLs.
    // Find it and pass to the PAC as the only proxySetting.
    const tmp = settings.proxySettings.find(e => e.id === settings.mode);
    if (!tmp) {
      setDisabled(true);
      console.error(`Error: settings.mode is set to ${settings.mode} but no proxySetting is found with that id`);
    }
    else {                                                  // register only if temp was found
      registerProxyScript().then(() => {

        proxyScriptLoaded = true;
        const title = tmp.title || `${tmp.address}:${tmp.port}`;
        chrome.browserAction.setIcon({path: '/images/icon.svg'});
        chrome.browserAction.setTitle({title});
        chrome.browserAction.setBadgeText({text: title});
        chrome.browserAction.setBadgeBackgroundColor({color: tmp.color});
        activeSettings = {mode: settings.mode, proxySettings: [tmp]}; // For sendAuth()
        chrome.runtime.sendMessage(activeSettings, {toProxyScript: true});
      });
    }
  }
}


function setDisabled(isError) {

  chrome.runtime.sendMessage({mode: 'disabled'});           // Update the options.html UI if it's open

  unregisterProxyScript().then(() => {

    proxyScriptLoaded = false;
    activeSettings = null;                                  // For sendAuth()
    chrome.browserAction.setIcon({path: 'images/icon-off.svg'});
    chrome.browserAction.setTitle({title: chrome.i18n.getMessage('disabled')});
    chrome.browserAction.setBadgeText({text: ''});

    if (isError) {
      storageArea.set({mode: 'disabled'}); // only in case of error, otherwise mode is already set
      console.log('Disabling Due To Error!');
      //Utils.notify('There was an unspecified error. FoxyProxy is now disabled.');
    }
    console.log('******* disabled mode');
  });
}

function sendAuth(details) {
  // details.url is scheme + url without path and query info; e.g. https://www.google.com/
  // note ending slash. details.host is www.google.com
  if (!details.isProxy || !activeSettings) { return; }
  //console.log('sendAuth(): ' + JSON.stringify(activeSettings));
  let ps;
  if (['patterns', 'random', 'roundrobin'].includes(activeSettings.mode)) {

    ps = findMatchingProxySetting(details.url, new URL(details.url).host, activeSettings.proxySettings); // return {proxySetting: proxySetting, patternObj: patternObj};











    /*if (ps) { console.log('sendAuth(): returning ' + JSON.stringify(ps)); }
    else { console.log('sendAuth(): returning null'); }*/
  }
  else {
    // User has selected a proxy for all URLs (not patterns, disabled, random, round-robin modes).
    // activeSettings.mode is set to the proxySettings id to use for all URLs. Use its credentials, if any.
    // It's the only object in the activeSettings.proxySettings array.
    ps = {proxySetting: activeSettings.proxySettings[0], matchedPattern: USE_PROXY_FOR_ALL_URLS};
  }

  console.log(ps ? 'sendAuth(): returning ' + ps.proxySetting.username : 'sendAuth(): returning null');

  return ps ? {authCredentials: {username: ps.proxySetting.username, password: ps.proxySetting.password}} : null;
}

// only use in bg
function findMatchingProxySetting(url, host, proxySettings) {
  
/*
  
// note
the auth requests are based on host
scheme does not matter
no need to check scheme

details.url is the target site .. not the proxy site asking for auth, it is not relevant

There is no need to pattern match agianst target URL

challenger.host (the proxy) has asked for Authentication
if there is u/p for challenger.host, then send it
otherwise... pass it through


details.challenger.host

onAuthRequired 
{
  "requestId": "1249",
  "url": "https://aus5.mozilla.org/.......xml",
  "method": "GET",
  "type": "xmlhttprequest",
  "timeStamp": 1536724391658,
  "frameId": 0,
  "parentFrameId": -1,
  "statusCode": 407,
  "statusLine": "HTTP/1.0 407 Proxy Authentication Required",
  "scheme": "basic",
  "realm": "Web-Proxy",
  "isProxy": true,
  "challenger": {
    "host": "104.238.---.---",
    "port": 4443
  },
  "proxyInfo": {
    "failoverTimeout": 5,
    "host": "104.238.---.---",
    "port": 4443,
    "proxyDNS": false,
    "type": "https",
    "username": ""
  },
  "ip": "104.238.132.173",
  "tabId": -1
}
*/
  
  
  
  
  
  let scheme = url.substring(0, url.indexOf('://')), schemeNum;
  if (scheme === 'https') { schemeNum = PROTOCOL_HTTPS; }
  else if (scheme === 'http') { schemeNum = PROTOCOL_HTTP; }
  
  
  //console.log('findMatchingProxySetting(): scheme is ' + scheme);

  //console.log(`Utils.findMatchingProxySetting(): host is ${host} and url is ${url}`);
  // for loop is slightly faster than .forEach(), which calls a function and all the overhead with that
  // note: we've already thrown out inactive proxySettings and inactive patterns.
  // we're not iterating over them
  for (const proxySetting of proxySettings) {
    // Check black patterns first
    //console.log('Utils.findMatchingProxySetting(): checking black patterns');
    let patternObj = Utils.checkPatterns(proxySetting.blackPatterns, schemeNum, host);
    if (patternObj) {
      console.log('Utils.findMatchingProxySetting(): black match found: ' + JSON.stringify(patternObj.pattern));
      continue; // A black pattern matched. Skip this proxySetting
    }

    //console.log('Utils.findMatchingProxySetting(): checking white patterns');
    patternObj = Utils.checkPatterns(proxySetting.whitePatterns, schemeNum, host);
    if (patternObj) {
      //console.log('Utils.findMatchingProxySetting(): white match found: ' + JSON.stringify(patternObj.pattern));
      return {proxySetting: proxySetting, matchedPattern: patternObj};
    }
  }
  console.log('Utils.findMatchingProxySetting(): no match found. Returning null.');
  return null; // No white matches
}


// --- Register/unregister proxy script
function registerProxyScript() {

  if (!proxyScriptLoaded) {
    console.log('registering proxy script');
    // Name changed in 56.0a1 https://bugzilla.mozilla.org/show_bug.cgi?id=1371879
    // We're only compatible with Firefox 57+ now so no need to check this.
    // proxy.register has been deprecated and will be removed in Firefox 71 (2019-12-10). Nightly (2019-09-02) 
    return browser.proxy.register(pacURL);
  }
  else { return new Promise((resolve) => resolve()); }
}
function unregisterProxyScript() {

  if (proxyScriptLoaded) {
    console.log('Unregistering proxy script');
    return browser.proxy.unregister();
  }
  else { return new Promise((resolve) => resolve()); }
}

// Returns an array of active patterns or []
function checkPatterns(patterns = []) {

  return patterns.map(item => {

    // Build regexp from patterns
    if (item.type === PATTERN_TYPE_WILDCARD) {
      item.regExp = checkRE(Utils.wildcardToRegExp(item.pattern));
    }
    else if (item.type == PATTERN_TYPE_REGEXP) {
      item.regExp = checkRE(item.pattern);
    }

    return item;
  });
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