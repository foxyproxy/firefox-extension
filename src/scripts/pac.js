// Consts copied from const.js because.. proxyAPI suckage
// Bit-wise flags so we can add/remove these independently. We may add more later so PROTOCOL_ALL is future-proof.
const PROTOCOL_ALL = 1; // in case other protocols besides http and https are supported later
const PROTOCOL_HTTP = 2;
const PROTOCOL_HTTPS = 4;

// Consts copied from const.js because.. proxyAPI suckage
const PATTERNS = "patterns";
const USE_PROXY_FOR_ALL_URLS = 2;
const RANDOM = "random";
const ROUND_ROBIN = "roundrobin";
const DISABLED = "disabled";

// Consts copied from const.js because.. proxyAPI suckage
const MESSAGE_TYPE_CONSOLE = 1;
const MESSAGE_TYPE_LOG = 2;

// Consts copied from addon because... proxyAPI suckage
// TODO: send to this script in an init() function
const PROXY_TYPE_HTTP = 1;
const PROXY_TYPE_HTTPS = 2;
const PROXY_TYPE_SOCKS5 = 3;
const PROXY_TYPE_SOCKS4 = 4;
const PROXY_TYPE_NONE = 5; // DIRECT
const PROXY_TYPE_PAC = 6;
const PROXY_TYPE_WPAD = 7;
const PROXY_TYPE_SYSTEM = 8;
const PROXY_TYPE_PASS = 9;

// This const is not in const.js and doesn't need to be. It's only used here.
const DIRECT = "direct";
let settings = {};

function console(str) {
  //chrome.runtime.sendMessage({type: MESSAGE_TYPE_CONSOLE, message: str});
}

function logToUI(o) {
  o.type = MESSAGE_TYPE_LOG;
  browser.runtime.sendMessage(o);
}

browser.runtime.onMessage.addListener((s) => {settings = s});

function buildReturnForProxySetting(url, ps, matchedPattern) {
  let type = proxyTypeForPAC(ps.type);//, err = false;

  // Error checking -- don't do this here! Do this after reading the data from storage
  /*if (!type) {
    console(`FindProxyForURL(): an attribute of the proxy is bad. Unrecognized proxy type ${ps.type}`); // Config error
    err = true;
  }
  if (!ps.address) {
    console(`FindProxyForURL(): an attribute of the proxy is bad. No address/host.`);
    err = true;
  }
  if (!ps.port) {
    console(`FindProxyForURL(): an attribute of the proxy is bad. No address/host.`);
    err = true;
  }
  if (ps.proxyDNS && (ps.type != PROXY_TYPE_SOCKS5 && ps.type != PROXY_TYPE_SOCKS4)) {
    console(`FindProxyForURL(): an attribute of the proxy is bad. proxyDNS is specified but proxy type is not a SOCKS type.`);
    err = true;
  }
  if (err) {
    logToUI({url: url, matchedPattern: matchedPattern, proxySetting: ps, timestamp: Date.now(), error: true});
    return {type: DIRECT}; // TODO: change to null after https://bugzilla.mozilla.org/show_bug.cgi?id=1319634 is fixed
  }*/

  let ret = {type: type, host: ps.address, port: ps.port};
  if (ps.username) ret.username = ps.username;
  if (ps.password) ret.password = ps.password;
  if (ps.proxyDNS) ret.proxyDNS = ps.proxyDNS;
  logToUI({url: url, matchedPattern: matchedPattern, proxySetting: ps, timestamp: Date.now()});
  return ret;
}

function FindProxyForURL(url, host) {
  let ret;
  if (settings.mode == DISABLED) ret = {type: DIRECT}; // TODO: change to null after https://bugzilla.mozilla.org/show_bug.cgi?id=1319634 is fixed
  else if (settings.mode == PATTERNS) {
    //console("FindProxyForURL(): 2");
    let psAndMatch = findMatchingProxySetting(url); // |url| contains port, if any, but |host| does not.
    if (psAndMatch) {
      //console("FindProxyForURL(): 3");
      ret = buildReturnForProxySetting(url, psAndMatch.proxySetting, psAndMatch.matchedPattern);
    }
    else {
      //console("FindProxyForURL(): 6");
      // No matches. Return null so other addons have a chance: https://bugzilla.mozilla.org/show_bug.cgi?id=1319634#c4
      logToUI({url: url, matchedPattern: null, proxySetting: null, timestamp: Date.now()});
      ret = {type: DIRECT}; // TODO: change to null after https://bugzilla.mozilla.org/show_bug.cgi?id=1319634 is fixed
    }
  }
  else if (settings.mode == RANDOM) {
  }
  else if (settings.mode == ROUND_ROBIN) {
  }
  else {
    // Use proxy "xxxx" for all URLs
    //console("FindProxyForURL(): 11");
    ret = buildReturnForProxySetting(url, settings.proxySettings[0], USE_PROXY_FOR_ALL_URLS); // The only proxySetting sent to us;
  }
  //console("FindProxyForURL(): returning " + JSON.stringify([ret]));
  return [ret];
}

function proxyTypeForPAC(proxyTypeInt) {
  switch (proxyTypeInt) {
    case PROXY_TYPE_HTTP: return "http";
    case PROXY_TYPE_HTTPS: return "https";
    case PROXY_TYPE_SOCKS5: return "socks";
    case PROXY_TYPE_SOCKS4: return "socks4";
    case PROXY_TYPE_NONE: return DIRECT;
    default: return null;
  }
}

// Copied from utils.js because.. proxyAPI suckage. Only change is the use of Utils.checkPatterns().
function findMatchingProxySetting(url) {
  //console("findMatchingProxySetting(): checking " + url);
  // We could use new URL(url) for parsing, but this is faster, giving us exactly what we need and nothing more.
  // And no regular expressions.
  let colonIdx = url.indexOf("://"), scheme = url.substring(0, colonIdx), schemeNum; // undefined if not http or https
  if (scheme == "https") schemeNum = PROTOCOL_HTTPS;
  else if (scheme == "http") schemeNum = PROTOCOL_HTTP;
  let hostWithOptionalPort = url.substring(colonIdx + 3);

  // for loop is slightly faster than .forEach(), which calls a function and all the overhead with that
  // note: we've already thrown out inactive settings and inactive patterns.
  // we're not iterating over them
  //console("settings: " + JSON.stringify(settings, null, 2));
  for (let i=0; i<settings.proxySettings.length; i++) {
    let proxySetting = settings.proxySettings[i];
    // console("proxy setting is " + JSON.stringify(proxySetting));
    // Check black patterns first
    let result = checkPatterns(proxySetting.blackPatterns, schemeNum, hostWithOptionalPort);
    if (result.match) {
      //console("findMatchingProxySetting(): black match found: " + JSON.stringify(result.matchedPattern));
      continue; // A black pattern matched. Skip this proxySetting
    }

    result = checkPatterns(proxySetting.whitePatterns, schemeNum, hostWithOptionalPort);
    if (result.match) {
      //console("findMatchingProxySetting(): white match found: " + JSON.stringify(result.matchedPattern));
      return {proxySetting: proxySetting, matchedPattern: result.matchedPattern};
    }
  }
  //console("findMatchingProxySetting(): no match found.");
  return null; // No white matches
}

// Copied from utils.js because.. proxyAPI suckage.
function checkPatterns(patterns, schemeNum, hostWithOptionalPort) {
  let unmatchedPatterns = [];
  for (let j=0; j<patterns.length; j++) {
    let patternObj = patterns[j];
    //console("checkPatterns(): checking pattern " + patternObj.regExp.toString());
    //console("checkPatterns(): protocol of pattern is: " + patternObj.protocols);
    if (patternObj.protocols != PROTOCOL_ALL && patternObj.protocols != schemeNum) {
      //console("checkPatterns(): protocol mismatch; skipping.");
      unmatchedPatterns.push(patternObj);
      continue;
    }
    if (patternObj.regExp.test(hostWithOptionalPort)) {
      //console("checkPatterns(): match found.");
      return {match: true, matchedPattern: patternObj, unmatchedPatterns: unmatchedPatterns};
    }
    else {
      //console("checkPatterns(): pattern did not match");
      unmatchedPatterns.push(patternObj);
    }
  }
  return {match: false, unmatchedPatterns: unmatchedPatterns};
}
