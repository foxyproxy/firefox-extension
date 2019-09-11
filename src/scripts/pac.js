'use strict';

// ----- global
let settings = {};

browser.runtime.onMessage.addListener(s => settings = s);

function logToUI(log) { browser.runtime.sendMessage(log); }


function FindProxyForURL(url, host) { // The URL being accessed. The path and query components of https:// URLs are stripped. 

  switch (settings.mode) {
    // not supported at the moment
    case 'random':
    case 'roundrobin':
      return [{type: 'direct'}];

    case 'patterns':
     
      const proxyMatch = findProxyMatch(url); // |url| contains port, if any, but |host| does not.

      if (proxyMatch) {
        return [prepareSetting(url, proxyMatch.proxy, proxyMatch.pattern)];
      }
      else {
       // logToUI({type: 'log', url, timestamp: Date.now()});
        return [{type: 'direct'}];                            // default
      }

    default:
      // Use proxy "xxxx" for all URLs        // const USE_PROXY_FOR_ALL_URLS = 2;
      return [prepareSetting(url, settings.proxySettings[0], 'all')]; // the first proxy
  }
}

function findProxyMatch(url) {
  // for loop is slightly faster than .forEach(), which calls a function and all the overhead with that
  // note: we've already thrown out inactive settings and inactive patterns.
  // we're not iterating over them

  const [scheme, hostPort] = url.split('://');
  const schemeSet = {                                       // converting to meaningful terms
    all : 1,
    http: 2,
    https: 4
  };
  
  for (const proxy of settings.proxySettings) {
    
    // Check black patterns first
    const blackMatch = proxy.blackPatterns.find(item => 
            (item.protocols === schemeSet.all || item.protocols === schemeSet[scheme]) &&
              new RegExp(item['regExp'], 'i').test(hostPort));
 
    //if (blackMatch) { return null; }                        // found a blacklist match, end here, use direct, no proxy
    if (blackMatch) { continue; }                             // if blacklist matched move to the next proxy

    const whiteMatch = proxy.whitePatterns.find(item =>
            (item.protocols === schemeSet.all || item.protocols === schemeSet[scheme]) &&
              new RegExp(item['regExp'], 'i').test(hostPort));
  
    if (whiteMatch) { return {proxy, pattern: whiteMatch}; } // found a whitelist match, end here
  }

  return null; // no black or white matches
}

function prepareSetting(url, proxy, matchedPattern) {

  const typeSet = {
    1: 'http',    // PROXY_TYPE_HTTP
    2: 'https',   // PROXY_TYPE_HTTPS
    3: 'socks',   // PROXY_TYPE_SOCKS5
    4: 'socks4',  // PROXY_TYPE_SOCKS4
    5: 'direct'   // PROXY_TYPE_NONE
  };

  const ret = {
    type: typeSet[proxy.type] || null, 
    host: proxy.address, 
    port: proxy.port
  };
  proxy.username && (ret.username = proxy.username);
  proxy.password && (ret.password = proxy.password);
  proxy.proxyDNS && (ret.proxyDNS = proxy.proxyDNS);

  // trim the log data to what is needed
  const log = {
    type: 'log',
    url,
    title: proxy.title,
    color: proxy.color,
    address: proxy.address,
    matchedPattern,
    timestamp: Date.now()
  };
  logToUI(log);
  return ret;
}