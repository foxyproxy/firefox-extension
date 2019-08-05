'use strict';

// Consts copied from const.js
const PROXY_TYPE_HTTP = 1;
const PROXY_TYPE_HTTPS = 2;
const PROXY_TYPE_SOCKS5 = 3;
const PROXY_TYPE_SOCKS4 = 4;
const PROXY_TYPE_NONE = 5; // DIRECT
const PROXY_TYPE_PAC = 6;
const PROXY_TYPE_WPAD = 7;
const PROXY_TYPE_SYSTEM = 8;
const PROXY_TYPE_PASS = 9;

// ----- global
let settings = {};

browser.runtime.onMessage.addListener(s => settings = s);

function logToUI(log) { browser.runtime.sendMessage(log); }

function prepareSetting(url, ps, matchedPattern) {
  
  // proxyTypeForPAC(proxyTypeInt)
  let type = null;
  switch (ps.type) {
    case PROXY_TYPE_HTTP: type = 'http'; break;
    case PROXY_TYPE_HTTPS: type = 'https'; break;
    case PROXY_TYPE_SOCKS5: type = 'socks'; break;
    case PROXY_TYPE_SOCKS4: type = 'socks4'; break;
    case PROXY_TYPE_NONE: type = 'direct'; break;
  }

  const ret = {type, host: ps.address, port: ps.port};
  ps.username && (ret.username = ps.username);
  ps.password && (ret.password = ps.password);
  ps.proxyDNS && (ret.proxyDNS = ps.proxyDNS);
  
  // trim the log data to what is needed
  const log = {
    type: 'log',
    url,
    matchedPattern,
    timestamp: Date.now(),
    title: ps.title,
    color: ps.color,
    address: ps.address
  };
  logToUI(log);
  return ret;
}

function FindProxyForURL(url, host) {
                              
  switch (settings.mode) {
    // not supported at the moment
    case 'random':
    case 'roundrobin':
      return [{type: 'direct'}];

    case 'patterns':
      const proxyMatch = findProxyMatch(url); // |url| contains port, if any, but |host| does not.
      
      if (proxyMatch) {
        return [prepareSetting(url, proxyMatch.proxy, proxyMatch.matchedPattern)];
      }
      else {
        logToUI({type: 'log', url, timestamp: Date.now()});
        return [{type: 'direct'}];                            // default
      }

    default:browser.runtime.sendMessage('default');
      // Use proxy "xxxx" for all URLs        // const USE_PROXY_FOR_ALL_URLS = 2;
      return [prepareSetting(url, settings.proxySettings[0], 'all')]; // the first proxy
  }  
}


function findProxyMatch(url) {
  // for loop is slightly faster than .forEach(), which calls a function and all the overhead with that
  // note: we've already thrown out inactive settings and inactive patterns.
  // we're not iterating over them
  
  const [scheme, hostPathname] = url.split('://');
  
  for (const proxy of settings.proxySettings) {
    // Check black patterns first
    
    if (checkPatterns(scheme, hostPathname, proxy.blackPatterns)) { 
      browser.runtime.sendMessage({id:'black', result: checkPatterns(scheme, hostPathname, proxy.blackPatterns) });
      return null; } // blacklist match, no proxy, end here direct

    const result = checkPatterns(scheme, hostPathname, proxy.whitePatterns);
    if (result) {                                           // whilelist match, use this proxy
      browser.runtime.sendMessage({id:'white', result });
      return {proxy, matchedPattern: result.matchedPattern};
    }
  }
browser.runtime.sendMessage('null');
  return null; // no black or white matches
}

function checkPatterns(scheme, hostPathname, patterns) {
    
  const unmatchedPatterns = [];
  const schemeSet = {                                       // converting to meaningful terms
    all : 1,
    http: 2,
    https: 4
  };

  for (const item of patterns) {

    if ((item.protocols === schemeSet.all || item.protocols === schemeSet[scheme]) && 
              new RegExp(item['regExp'], 'i').test(hostPathname) {
      return {match: true, matchedPattern: item, unmatchedPatterns};                
    }
    else { unmatchedPatterns.push(item); }
  }
  return {match: false, unmatchedPatterns};
}