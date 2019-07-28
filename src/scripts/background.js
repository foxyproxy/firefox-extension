'use strict';

const pacURL = 'scripts/pac.js';
let proxyScriptLoaded = false, activeSettings, browserVersion;

// global
let logg; // used in log.js
function getLogg() { return logg; }

let ignoreWrite = false; // used in log.js
function ignoreNextWrite() { ignoreWrite = true; }
// END: used in log.js


// onProxyError will be renamed to onError
// https://bugzilla.mozilla.org/show_bug.cgi?id=1388619
const API = 'onProxyError' in browser.proxy ? browser.proxy.onProxyError : browser.proxy.onerror;
API.addListener(e => console.error(`pac.js error: ${e.message}`));

chrome.runtime.onMessage.addListener((messageObj, sender) => {
  if (messageObj === MESSAGE_TYPE_DELETING_ALL_SETTINGS) {
    ignoreWrite = true;
    return;
  }

  // Only handle our messages
  if (sender.url !== chrome.runtime.getURL(pacURL)) {
    console.log('IGNORING MESSAGE');
    return;
  }
  if (messageObj.type === MESSAGE_TYPE_CONSOLE) {
    // chrome.runtime.sendMessage({type: MESSAGE_TYPE_CONSOLE, message: str});
    console.log('Message from PAC: ' + messageObj.message);
  }
  else if (messageObj.type == MESSAGE_TYPE_LOG) {
    //console.log('Got log message from PAC: ' + JSON.stringify(messageObj));
    // chrome.runtime.sendMessage({type: MESSAGE_TYPE_LOG, url: url, matchedPattern: patternObj, proxySetting: proxySetting, error: true});
    if (logg) { logg.add(messageObj);  }
    // badge only shows 4 characters, no need to process it
    const title = proxySetting.title || `${proxySetting.address}:${proxySetting.port}`;
    chrome.browserAction.setTitle({title}); 
    chrome.browserAction.setBadgeText({text: title});
    chrome.browserAction.setBadgeBackgroundColor({color: messageObj.proxySetting.color});
  }
});



function sendAuth(details) {
  // details.url is scheme + url without path and query info; e.g. https://www.google.com/
  // note ending slash. details.host is www.google.com
  if (!details.isProxy || !activeSettings) { return; }
  //console.log('sendAuth(): ' + JSON.stringify(activeSettings));
  let ps;
  if (activeSettings.mode == PATTERNS || activeSettings.mode == RANDOM || activeSettings.mode == ROUND_ROBIN) {
    ps = Utils.findMatchingProxySetting(details.url, new URL(details.url).host, activeSettings.proxySettings); // return {proxySetting: proxySetting, patternObj: patternObj};
    /*if (ps) {
      console.log('sendAuth(): returning ' + JSON.stringify(ps));
    }
    else
      console.log('sendAuth(): returning null');*/
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

/**
 * Register the proxy script and send it the settings
 */
function registerProxyScript() {
  if (!proxyScriptLoaded) {
    console.log('registering proxy script');
    // Name changed in 56.0a1 https://bugzilla.mozilla.org/show_bug.cgi?id=1371879
    // We're only compatible with Firefox 57+ now so no need to check this.
    return browser.proxy.register(pacURL);
  }
  else return new Promise((resolve) => resolve());
}


function unregisterProxyScript() {
  if (proxyScriptLoaded) {
    console.log('Unregistering proxy script');
    // Did not exist prior to 56.0a1 https://bugzilla.mozilla.org/show_bug.cgi?id=1371879
    // We're only compatible with Firefox 57+ now so no need to check this.
    //if (browserVersion >= 56) {
    return browser.proxy.unregister();
  }
  else return new Promise((resolve) => resolve());
}

// Returns an array of active patterns. Returns a valid empty array if |p| is null or not an array.
// Never return nulls.
function filterAndValidatePatterns(patternObjArr) {
  let ret = [];
  if (patternObjArr && Array.isArray(patternObjArr)) {
    for (const patternObj in patternObjArr) {
      const pat = patternObjArr[patternObj];
      if (pat.active) {
        // Build regexp from patterns
        if (pat.type === PATTERN_TYPE_WILDCARD) { 
          pat.regExp = Utils.safeRegExp(Utils.wildcardStringToRegExpString(pat.pattern)); 
        }
        else if (pat.type == PATTERN_TYPE_REGEXP) { 
          pat.regExp = Utils.safeRegExp(pat.pattern); // TODO: need to notify user and not match this to zilch. Go to disabled mode.
        } 
        else {
          //console.error('filterAndValidatePatterns(): Skipping pattern due to error (1): ' + JSON.stringify(pat));
          continue;
        }
        //console.log('filterAndValidatePatterns(): keeping pattern: ' + JSON.stringify(pat.pattern));
        ret.push(pat);
      }
      //else {
        //console.error('filterAndValidatePatterns(): Skipping pattern because it's inactive ' + JSON.stringify(pat));
      //}
    }
  }
  return ret;
}

function sendSettingsToProxyScript(settings) {
  
  if (!settings || !settings.mode || settings.mode === DISABLED || (FOXYPROXY_BASIC && settings.mode === PATTERNS))
    setDisabled();
  else if (settings.mode === PATTERNS || settings.mode === RANDOM || settings.mode === ROUND_ROBIN) {
    registerProxyScript().then(() => {
      proxyScriptLoaded = true;
      // Right now we only support PATTERNS
      chrome.browserAction.setIcon({path: '/images/icon.svg'});
      chrome.browserAction.setTitle({title: chrome.i18n.getMessage('Patterns')});
      chrome.browserAction.setBadgeText({text: ''});
      // Remove inactive proxySetting objects and patterns. We also create empty arrays when necessary, never nulls.
      if (settings.proxySettings && Array.isArray(settings.proxySettings)) {
        settings.proxySettings = settings.proxySettings.filter(x => x.active);
        settings.proxySettings.forEach((ps) => {
          // Fix import settings bug in 6.1 - 6.1.3 (and Basic 5.1 - 5.1.3) where by import of legacy foxyproxy.xml
          // imported this property as a string rather than boolean.
          if (ps.proxyDNS === 'true') { ps.proxyDNS = true; }
          else if (ps.proxyDNS === 'false') { ps.proxyDNS = false; }
          ps.whitePatterns = filterAndValidatePatterns(ps.whitePatterns);
          ps.blackPatterns = filterAndValidatePatterns(ps.blackPatterns);
        });
        activeSettings = settings; // For sendAuth()
        //console.log('sorted, active proxy settings:');
        //console.log(JSON.stringify(settings, null, 2));
        chrome.runtime.sendMessage(settings, {toProxyScript: true});
      }
      else {
        setDisabled(true);
        console.error(`Error: settings.mode is set to ${settings.mode} but settings.proxySettings is empty or not an array`);
      }
    });
  }
  else {
    // User has selected a proxy for all URLs (not patterns, disabled, random, round-robin modes).
    // settings.mode is set to the proxySettings id to use for all URLs.
    // Find it and pass to the PAC as the only proxySetting.
    registerProxyScript().then(() => {
      proxyScriptLoaded = true;
      const tmp = settings.proxySettings.find(e => e.id === settings.mode);
      if (tmp) {
        //chrome.browserAction.setIcon({imageData: getColoredImage(tmp.color)});
        const title = tmp.title || `${temp.address}:${tmp.port}`;
        chrome.browserAction.setIcon({path: '/images/icon.svg'});
        chrome.browserAction.setTitle({title});
        chrome.browserAction.setBadgeText({text: title});
        chrome.browserAction.setBadgeBackgroundColor({color: tmp.color});
        activeSettings = {mode: settings.mode, proxySettings: [tmp]}; // For sendAuth()
        chrome.runtime.sendMessage(activeSettings, {toProxyScript: true});
      }
      else {
        setDisabled(true);
        console.error(`Error: settings.mode is set to ${settings.mode} but no proxySetting is found with that id`);
      }
    });
  }
}

const DISABLED_SETTINGS_OBJ = {mode: DISABLED, proxySettings: []};
function setDisabled(isError) {
  
  unregisterProxyScript().then(() => {
    proxyScriptLoaded = false;
    activeSettings = null; // For sendAuth()
    chrome.browserAction.setIcon({path: 'images/icon-off.svg'});
    chrome.browserAction.setTitle({title: chrome.i18n.getMessage('disabled')});
    chrome.browserAction.setBadgeText({text: ''});
    chrome.runtime.sendMessage(DISABLED_SETTINGS_OBJ, {toProxyScript: true}); // Is this needed? We're unregistered.
    if (isError) {
      console.log('DISABLING DUE TO ERROR!');
      //Utils.displayNotification('There was an unspecified error. FoxyProxy is now disabled.');
    }
    // Update the options.html UI if it's open
    //chrome.runtime.sendMessage(MESSAGE_TYPE_DISABLED);
    chrome.runtime.sendMessage({mode: 'disabled'});
    ignoreWrite = true; // prevent infinite loop; next line writes to storage and we're already in storate write callback
    console.log('******* disabled mode');
    //setMode(DISABLED);
    setMode('disabled');
  });
}




// After https://bugzilla.mozilla.org/show_bug.cgi?id=1359693 is fixed, onAuthRequired() not needed. ...Resolution: --- ? WONTFIX
// --- registering persistent listener
chrome.webRequest.onAuthRequired.addListener(sendAuth, {urls: ['*://*/*']}, ['blocking']);
// auth can only be sent for HTTP requests so '<all_urls>' not needed


// Update the PAC script whenever stored settings change
//chrome.storage.onChanged.addListener((oldAndNewSettings) => {
chrome.storage.onChanged.addListener((changes, area) => {   // Change Listener
console.log(changes);
  if (changes.mode && changes.mode
  if (ignoreWrite) {
    // Ignore this change to storage
    ignoreWrite = false;
    return;
  }

  // Re-read them because oldAndNewSettings just gives us the deltas, not complete settings
  
  init();
/*
  getAllSettings().then((settings) => {
      console.log('background.js: Re-read settings');
      sendSettingsToProxyScript(settings)})
    .catch(e => console.error(`getAllSettings() Error: ${e}`));
  */
});

// Watch for new installs and updates to our addon
chrome.runtime.onInstalled.addListener((details) => {
  // console.log('chrome.runtime.onInstalled.addListener(): ' + JSON.stringify(details));
  
  // simplified logic
  // reason: install | update | browser_update | shared_module_update
  switch (true) {
  
    case details.reason === 'install':
    case details.reason === 'update' && /^(3\.|4\.|5\.5|5\.6)/.test(details.previousVersion):
      chrome.tabs.create({url: '/about.html?welcome'});
      break;

    case details.reason === 'update' && details.previousVersion === '5.0':
      updateSettingsFrom50().then(() => console.log('finished updateSettingsFrom50()'));
      break;
  }    
});

// start
init();
function init() {
  
  chrome.storage.local.get(null, result => {
    // browserVersion is not used & runtime.getBrowserInfo() is not supported on Chrome
    // sync is NOT set or it is false, use this result ELSE get it from storage.sync
    !result.sync ? process(result) : chrome.storage.sync.get(null, process);
  });
}

function process(settings) {
 
  const size = settings.logging ? settings.logging.size : 500; // default 500
  const active = settings.logging ? settings.logging.active : true; // default true
  logg = new Logg(size, active);
  sendSettingsToProxyScript(prepareForSettings(settings));
  console.log(`background.js: loaded proxy settings from disk.`);
}
