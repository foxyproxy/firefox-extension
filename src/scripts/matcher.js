'use strict';

const schemeSet = {
  all : 1,
  http: 2,
  https: 4
};
// Shortcuts so we dont perform i18n lookups for every non-match
const FOR_ALL = {originalPattern: chrome.i18n.getMessage('forAll')}
const NOMATCH_TEXT = chrome.i18n.getMessage('noMatch');
const NONE_TEXT = chrome.i18n.getMessage('none');
const NOMATCH_COLOR = '#D3D3D3';
const WHITE = chrome.i18n.getMessage('white');
const BLACK = chrome.i18n.getMessage('black');

function findProxyMatch(url, activeSettings) {
  // note: we've already thrown out inactive settings and inactive patterns in background.js.
  // we're not iterating over them
  
  if (activeSettings.mode === 'patterns') {
    // Unfortunately, since Firefox 57 and some releases afterwards, we were unable
    // to get anything of the URL except scheme, port, and host (because of Fx's PAC
    // implementation). Now we have access to rest of URL, like pre-57, but users
    // have written their patterns not anticipating that. Need to do more research
    // before using other parts of URL. For now, we ignore the other parts.
    const parsedUrl = new URL(url);
    const scheme = parsedUrl.protocol.substring(0, parsedUrl.protocol.length-1); // strip the colon
    const hostPort = parsedUrl.host; // This includes port if one is specified

    for (const proxy of activeSettings.proxySettings) {
      
      // Check black patterns first
      const blackMatch = proxy.blackPatterns.find(item => 
        (item.protocols === schemeSet.all || item.protocols === schemeSet[scheme]) &&
          item.pattern.test(hostPort));

      if (blackMatch) {
        sendToMatchedLog(url, proxy, Utils.getProxyTitle(proxy), blackMatch, BLACK);
        continue; // if blacklist matched, continue to the next proxy
      }

      const whiteMatch = proxy.whitePatterns.find(item =>
        (item.protocols === schemeSet.all || item.protocols === schemeSet[scheme]) &&
          item.pattern.test(hostPort));
      
      if (whiteMatch) {
  			// found a whitelist match, end here
        const title = Utils.getProxyTitle(proxy);
        Utils.updateIcon('images/icon.svg', proxy.color, title, false, title, false);
        sendToMatchedLog(url, proxy, title, whiteMatch, WHITE);
        return prepareSetting(proxy);
  		}
    }
    // no white matches in any settings
    sendToUnmatchedLog(url);
    Utils.updateIcon('images/gray.svg', null, NOMATCH_TEXT, false, NOMATCH_TEXT, false);
    return {type: 'direct'};
  }
  else if (activeSettings.mode === 'disabled') {
    // Generally we won't get to this block because our proxy handler is turned off in this mode.
    // We will get here at startup and also if there is a race condition between removing our listener
    // (when switching to disabled mode) and handaling requests.
    return {type: 'direct'};    
  }
  else {
    // Fixed mode -- use 1 proxy for all URLs
    const p = activeSettings.proxySettings[0];
    const title = Utils.getProxyTitle(p);
    Utils.updateIcon('images/icon.svg', p.color, title, false, title, false);
    sendToMatchedLog(url, p, title, FOR_ALL);
    return prepareSetting(p);
  }
}

const typeSet = {
  1: 'http',    // PROXY_TYPE_HTTP
  2: 'https',   // PROXY_TYPE_HTTPS
  3: 'socks',   // PROXY_TYPE_SOCKS5
  4: 'socks4',  // PROXY_TYPE_SOCKS4
  5: 'direct'   // PROXY_TYPE_NONE
};

function prepareSetting(proxy) {
  const ret = {
    type: typeSet[proxy.type] || typeSet[5], // If 'direct', all other properties of this object are ignored.
    host: proxy.address, 
    port: proxy.port
  };
  proxy.username && (ret.username = proxy.username);
  proxy.password && (ret.password = proxy.password);
  proxy.proxyDNS && (ret.proxyDNS = proxy.proxyDNS); // Only useful for SOCKS
  //if ((proxy.type === PROXY_TYPE_HTTP || proxy.type === PROXY_TYPE_HTTPS) && proxy.username && proxy.password) {
    // Using wireshark, I do not see this header being sent, contrary to
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/ProxyInfo
    //ret.proxyAuthorizationHeader = 'Basic ' + btoa(proxy.username + ":" + proxy.password);
  //}
  return ret;
}

function sendToMatchedLog(url, proxy, title, matchedPattern, whiteBlack) {
  // log only the data that is needed for display
  logger && logger.active && logger.addMatched({
    url,
    title,
    color: proxy.color,
    address: proxy.address,
    // Log should display whatever user typed, not our processed version of the pattern
    matchedPattern: matchedPattern.originalPattern,
    whiteBlack,
    timestamp: Date.now()
  });
}

function sendToUnmatchedLog(url) {
  logger && logger.active && logger.addUnmatched({url, timestamp: Date.now()});
}
