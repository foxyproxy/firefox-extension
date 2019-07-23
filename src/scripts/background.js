'use strict';

const pacURL = 'scripts/pac.js';
let proxyScriptLoaded = false, activeSettings,browserVersion;

// BEGIN: used in log.js
// Use |var| not |let| so it's accessible from log.js
let logg; // no need for var.. it doesn't affect log.js
function getLogg() {
  return logg;
}

// Use |var| not |let| so it's accessible from log.js
var ignoreWrite = false;
function ignoreNextWrite() {
  ignoreWrite = true;
}
// END: used in log.js


// onProxyError will be renamed to onError
// https://bugzilla.mozilla.org/show_bug.cgi?id=1388619
const API = 'onProxyError' in browser.proxy ? browser.proxy.onProxyError : browser.proxy.onerror;
API.addListener(e => console.error(`pac.js error: ${e.message}`));

browser.runtime.onMessage.addListener((messageObj, sender) => {
  if (messageObj === MESSAGE_TYPE_DELETING_ALL_SETTINGS) {
    ignoreWrite = true;
    return;
  }

  // Only handle our messages
  if (sender.url !== browser.extension.getURL(pacURL)) {
    console.log('IGNORING MESSAGE');
    return;
  }
  if (messageObj.type === MESSAGE_TYPE_CONSOLE) {
    // browser.runtime.sendMessage({type: MESSAGE_TYPE_CONSOLE, message: str});
    console.log('Message from PAC: ' + messageObj.message);
  }
  else if (messageObj.type == MESSAGE_TYPE_LOG) {
    //console.log('Got log message from PAC: ' + JSON.stringify(messageObj));
    // browser.runtime.sendMessage({type: MESSAGE_TYPE_LOG, url: url, matchedPattern: patternObj, proxySetting: proxySetting, error: true});
    if (logg) logg.add(messageObj);
    // badge only shows 4 characters, no need to process it
    const title = proxySetting.title || `${proxySetting.address}:${proxySetting.port}`;
    browser.browserAction.setTitle({title}); 
    browser.browserAction.setBadgeText({text: title});
    browser.browserAction.setBadgeBackgroundColor({color: messageObj.proxySetting.color});
  }
});

function provideCredentialsAsync(details) {
  // details.url is scheme + url without path and query info; e.g. https://www.google.com/
  // note ending slash. details.host is www.google.com
  if (!details.isProxy || !activeSettings) { return; }
  //console.log('provideCredentialsAsync(): ' + JSON.stringify(activeSettings));
  let ps;
  if (activeSettings.mode == PATTERNS || activeSettings.mode == RANDOM || activeSettings.mode == ROUND_ROBIN) {
    ps = Utils.findMatchingProxySetting(details.url, new URL(details.url).host, activeSettings.proxySettings); // return {proxySetting: proxySetting, patternObj: patternObj};
    /*if (ps) {
      console.log('provideCredentialsAsync(): returning ' + JSON.stringify(ps));
    }
    else
      console.log('provideCredentialsAsync(): returning null');*/
  }
  else {
    // User has selected a proxy for all URLs (not patterns, disabled, random, round-robin modes).
    // activeSettings.mode is set to the proxySettings id to use for all URLs. Use its credentials, if any.
    // It's the only object in the activeSettings.proxySettings array.
    ps = {proxySetting: activeSettings.proxySettings[0], matchedPattern: USE_PROXY_FOR_ALL_URLS};
  }
  
  console.log(ps ? 'provideCredentialsAsync(): returning ' + ps.proxySetting.username : 'provideCredentialsAsync(): returning null');

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
      browser.browserAction.setIcon({path: '/images/icon.svg'});
      browser.browserAction.setTitle({title: 'Patterns'});
      browser.browserAction.setBadgeText({text: ''});
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
        activeSettings = settings; // For provideCredentialsAsync()
        //console.log('sorted, active proxy settings:');
        //console.log(JSON.stringify(settings, null, 2));
        browser.runtime.sendMessage(settings, {toProxyScript: true});
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
      let tmp = settings.proxySettings.find(e => e.id === settings.mode);
      if (tmp) {
        //browser.browserAction.setIcon({imageData: getColoredImage(tmp.color)});
        const title = temp.title || `${temp.address}:${temp.port}`;
        browser.browserAction.setIcon({path: '/images/icon.svg'});
        browser.browserAction.setTitle({title});
        browser.browserAction.setBadgeText({text: title});
        browser.browserAction.setBadgeBackgroundColor({color: tmp.color});
        activeSettings = {mode: settings.mode, proxySettings: [tmp]}; // For provideCredentialsAsync()
        browser.runtime.sendMessage(activeSettings, {toProxyScript: true});
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
    activeSettings = null; // For provideCredentialsAsync()
    browser.browserAction.setIcon({path: 'images/icon-off.svg'});
    browser.browserAction.setTitle({title: 'Disabled'});
    browser.browserAction.setBadgeText({text: ''});
    browser.runtime.sendMessage(DISABLED_SETTINGS_OBJ, {toProxyScript: true}); // Is this needed? We're unregistered.
    if (isError) {
      console.log('DISABLING DUE TO ERROR!');
      //Utils.displayNotification('There was an unspecified error. FoxyProxy is now disabled.');
    }
    // Update the options.html UI if it's open
    browser.runtime.sendMessage(MESSAGE_TYPE_DISABLED);
    ignoreWrite = true; // prevent infinite loop; next line writes to storage and we're already in storate write callback
    console.log('******* disabled mode');
    setMode(DISABLED);
  });
}


// getColoredImage is only used in background.js and it is commented oout so not used at all
// getColoredImage also is the only part that uses JQuery in background.js
// only utils.js uses JQuery ... removed from utils.js as well
/*
function getColoredImage(color) {
  // Modified from https://stackoverflow.com/a/30140386/3646737

  // Update color
  $('#stop2863,#stop2865,#stop2955,#stop2957,#stop2863,#stop2865,#stop2955,#stop2957,#stop2863,#stop2865,#stop2955,#stop2957').
    css('stop-color', color);

  // Update color
  $('#path2907,#path2935,#path2939').css('fill', color);

  // Get the image, prepend header
  let image64 = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(document.getElementById('fox')));

  // Set it as the source of the img element
  $('#img').attr('src', image64);
  let ctx = document.getElementById('canvas').getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, 48, 48);
}
*/
/**
 * After https://bugzilla.mozilla.org/show_bug.cgi?id=1359693 is fixed, onAuthRequired() not needed.
 */
browser.webRequest.onAuthRequired.addListener(provideCredentialsAsync,
  {urls: ['<all_urls>']},
  ['blocking']);

// Update the PAC script whenever stored settings change
browser.storage.onChanged.addListener((oldAndNewSettings) => {
  if (ignoreWrite) {
    // Ignore this change to storage
    ignoreWrite = false;
    return;
  }

  // Re-read them because oldAndNewSettings just gives us the deltas, not complete settings
  getAllSettings().then((settings) => {
      console.log('background.js: Re-read settings');
      sendSettingsToProxyScript(settings)})
    .catch(e => console.error(`getAllSettings() Error: ${e}`));
});

// Watch for new installs and updates to our addon
browser.runtime.onInstalled.addListener((details) => {
  // console.log('browser.runtime.onInstalled.addListener(): ' + JSON.stringify(details));
  
  // simplified logic
  // reason: install | update | browser_update | shared_module_update
  switch (true) {
  
    case details.reason === 'install':
    case details.reason === 'update' && /^(3\.|4\.|5\.5|5\.6)/.test(details.previousVersion):
      browser.tabs.create({url: '/about.html?welcome'});
      break;

    case details.reason === 'update' && details.previousVersion === '5.0':
      updateSettingsFrom50().then(() => console.log('finished updateSettingsFrom50()'));
      break;
  }  
/*  
  if (details.reason === 'install') {
    browser.tabs.create({url: '/first-install.html'});
  }
  else if (details.reason === 'update') {
    if (details.previousVersion === '5.0') {
      // The initial WebExtension version, which was disabled after a couple of days, was called 5.0
      // for both Standard and Basic. Update settings format.
      updateSettingsFrom50().then(() => console.log('finished updateSettingsFrom50()'));
    }
    else if (details.previousVersion.startsWith('3.') || // FP Basic was 3.x
        details.previousVersion.startsWith('4.') || // FP Standard was 4.x.
        details.previousVersion.startsWith('5.5') || // To distinguish from the 5.0 above
        details.previousVersion.startsWith('5.6')) { // I don't think there was a 5.6 but for a couple of users
      browser.tabs.create({url: '/first-install.html'});
    }
    //else browser.tabs.create({url: '/first-install.html'});
  }
*/  
});

// Get the current settings, then...
getAllSettings().then((settings) => {
  //console.log(settings);
  logg = new Logg(settings.logging.maxSize, settings.logging.active);
  browser.runtime.getBrowserInfo().then((info) => {
    browserVersion = parseFloat(info.version);
    console.log(`background.js: loaded proxy settings from disk. browserVersion is ${browserVersion}`);
    sendSettingsToProxyScript(settings);
  })
  .catch(e => console.error(`background.js: Error retrieving sendSettingsToProxyScript() or getBrowserInfo(): ${e}`))})
.catch(e => console.error(`background.js: Error retrieving stored settings: ${e}`));
