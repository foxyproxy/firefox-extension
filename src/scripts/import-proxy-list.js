'use strict';

// ----------------- Internationalization ------------------
Utils.i18n();

document.addEventListener('keyup', evt => {
  if (evt.keyCode === 27) {
    location.href = '/options.html';
  }
});

// ----------------- Spinner -------------------------------
const spinner = document.querySelector('.spinner');
function hideSpinner() {

  spinner.classList.remove('on');
  setTimeout(() => { spinner.style.display = 'none'; }, 600);
}

function showSpinner() {

  spinner.style.display = 'flex';
  spinner.classList.add('on');
}
// ----------------- /spinner ------------------------------
document.addEventListener('DOMContentLoaded', () => {
  hideSpinner();
});

// addEventListener for all buttons & handle together
document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));

let proxiesAdded = 0; // Global to this module in case user does multiple bulk imports before closing import-bulk.html

function process(e) {
  switch (this.id || this.dataset.i18n) {
    case 'back': location.href = '/options.html'; break;
    case 'import': imp0rt(); break;
  }
}

function imp0rt() {
  const {parsedList, skippedList} = parseList(document.getElementById('proxyList').value);
  if (parsedList.length > 0) {
    if (document.querySelector('#overwrite').checked) {
      if (confirm(chrome.i18n.getMessage('confirmOverwrite'))) {
        showSpinner();
        chrome.storage.local.clear(() => chrome.storage.sync.clear(() => {
          hideSpinner();
          storeProxies(parsedList);
        }));
      }
      else {
        return;
      }
    }
    else {
      storeProxies(parsedList);
    }
  }
  if (skippedList.length > 0) {
    alert(`${chrome.i18n.getMessage('importsSkipped', [skippedList.length + "", skippedList.toString()])}`);
  }
  if (parsedList.length > 0) {
    alert(`${chrome.i18n.getMessage('importSucceeded', [parsedList.length])}`);
  }
  location.href = '/options.html';
}

function parseList(rawList) {
  const parsedList = [], skippedList = [], colors = ['#663300', '#284B63', '#C99656', '#7B758C', '#171E1D'];
  if (!rawList) {
    return {parsedList, skippedList};
  }
  rawList.split('\n').forEach((item) => {
    if (!item) {
      return; // continue to next
    }
    let p, patternIncludesAll = true, patternExcludesIntranet = true;
    // Is this line simple or complete format?
    let protocol = item.match(/.+:\/\//); // null for strings like 127.0.0.1:3128 (simple format)
    if (protocol) {
      // This line is uses 'complete' format
      let url;
      try {
        // In Firefox 78.0.2, the built-in javascript URL class will not parse URLs with custom schemes/protocols
        // like socks://127.0.0.1. However, Chrome 84.0.4147.89 and Node 14.5.0 both do. In order to be compatible
        // with Firefox, let's replace the scheme/protocol with 'http'. We could also instead write our own parsing
        // logic with a regular expression, but that does not seems necessary.
        if (protocol[0] !== 'http://' && protocol[0] !== 'https://') {
          item = 'http://' + item.substring(protocol[0].length);
          url = new URL(item);
          protocol = protocol[0].substring(0, protocol[0].length-2); //strip ending //
        }
        else {
          url = new URL(item);
          protocol = url.protocol;
        }
      }
      catch (e) {
        console.log(e);
        // URL couldn't be parsed
        skippedList.push(item);
        return; // continue to next
      }
      const type = protocol === 'proxy:' || protocol === 'http:' ? PROXY_TYPE_HTTP :
        protocol === 'ssl:' || protocol === 'https:' ? PROXY_TYPE_HTTPS :
        protocol === 'socks:' || protocol === 'socks5:' ? PROXY_TYPE_SOCKS5 :
        protocol === 'socks4:' ? PROXY_TYPE_SOCKS4 : -1;
        if (type === -1) {
          console.log("unknown protocol");
          skippedList.push(item);
          return; // continue to next
        }

        // If color not specified in the URL, then rotate among the ones in the colors array.
        const color = url.searchParams.get('color') ?
          ('#' + url.searchParams.get('color')) : colors[parsedList.length % colors.length];

        const title = url.searchParams.get('title');
        const countryCode = url.searchParams.get('countryCode') || url.searchParams.get('cc');
        const country = url.searchParams.get('country') || countryCode;

        // If paramName url param is not specified or it's specified and not 'false', then paramValue should equal true.
        // We assume true in case the param is absent, which may be counterintuitive, but this fcn is used for params that
        // we want to assume true when absent.
        function parseBooleanParam(url, paramName, aliasParamName) {
          const paramValue = url.searchParams.get(paramName) || (aliasParamName && url.searchParams.get(aliasParamName));
          return paramValue ? !(paramValue.toLowerCase() === 'false') : true;
        }
        const proxyDNS = parseBooleanParam(url, 'proxyDns');
        const active = parseBooleanParam(url, 'enabled', 'active');

        patternIncludesAll = parseBooleanParam(url, 'patternIncludesAll');
        patternExcludesIntranet = parseBooleanParam(url, 'patternExcludesIntranet');

        // the URL class sets port === '' if not specified on the URL or it's an invalid port e.g. contains alpha chars
        let port = url.port;
        if (port === '') {
          // Default ports are 3128 for HTTP proxy, 443 for tls/ssl/https proxy, 1080 for socks4/5
          port = type === PROXY_TYPE_HTTP ? 3128 : type === PROXY_TYPE_HTTPS ? 443 : 1080;
        }

        console.log(url);
        // the URL class sets username and password === '' if not specified on the URL
        p = {type, username: url.username, password: url.password, address: url.hostname, port, color, title, proxyDNS, active, countryCode, country};
    }
    else {
      // simple
      const splitItem = item.split(':');
      // Split always returns an array no matter what
      p = {address: splitItem[0], port: splitItem[1], username: splitItem[2], password: splitItem[3], color: colors[parsedList.length % colors.length]};
    }

    const proxy = makeProxy(p, patternIncludesAll, patternExcludesIntranet);
    if (proxy) {
      parsedList.push(proxy);
    }
    else {
      skippedList.push(item);
    }

  }); //forEach

  return {parsedList, skippedList};
}

function makeProxy({type = PROXY_TYPE_HTTP, username, password, address, port, color, title, proxyDNS, active = true, countryCode, country},
  patternIncludesAll, patternExcludesIntranet) {

  port = port*1; // convert to digit
  if (!port || port < 1) { // is port NaN or less than 1
    console.log("port is NaN or less than 1");
    return null;
  }

  // strip bad chars from all input except username, password, type, proxyDNS, and active
  // (those last 3 are forced to boolean types before we are called)
  // If we do strip bad chars from usernams or password, auth could fail.
  address = Utils.stripBadChars(address);
  color = Utils.stripBadChars(color);
  title = Utils.stripBadChars(title);
  countryCode = Utils.stripBadChars(countryCode);
  country = Utils.stripBadChars(country);

  if (!address) {
    console.log("no address");
    return null;
  }

  const proxy = {type, address, port, color, active};

  // Only set the properties needed. null and undefined props seem to be saved if set, so don't set them.
  function setPropertyIfHasValue(prop, value, proxy) {
    if (value || value === 0) {
      proxy[prop] = value;
    }
  }
  setPropertyIfHasValue('username', username, proxy);
  setPropertyIfHasValue('password', password, proxy);
  setPropertyIfHasValue('title', title, proxy);
  setPropertyIfHasValue('cc', countryCode, proxy);
  setPropertyIfHasValue('country', country, proxy);

  if (type === PROXY_TYPE_SOCKS5) {
    // Only set if socks5
    proxy.proxyDNS = proxyDNS;
  }

  if (FOXYPROXY_BASIC) {
    proxy.whitePatterns = proxy.blackPatterns = [];
  }
  else {
    proxy.whitePatterns = patternIncludesAll ? [PATTERN_ALL_WHITE] : [];
    proxy.blackPatterns = patternExcludesIntranet ? [...blacklistSet] : [];
  }
  return proxy;
}

function storeProxies(parsedList) {
  const sync = localStorage.getItem('sync') === 'true';
  const storageArea = !sync ? chrome.storage.local : chrome.storage.sync;

  for (const idx in parsedList) {
    const proxy = parsedList[idx];
    console.log(proxy);
    // Get the nextIndex given to us by options.js and add by the number of proxies we've added.
    // This ensures this proxy setting is last in list of all proxy settings.

    proxy.index = (localStorage.getItem('nextIndex')) + (++proxiesAdded);
    storageArea.set({[Utils.getUniqueId()]: proxy}, () => {
      console.log(`stored proxy`);
    });
  }
}
