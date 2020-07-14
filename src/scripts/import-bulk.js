'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

document.addEventListener('keyup', evt => {
  if (evt.keyCode === 27) {
    close();
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
      if (confirm(chrome.i18n.getMessage('confirmDelete'))) {
        showSpinner();
        chrome.storage.local.clear(() => chrome.storage.sync.clear(() => {
          hideSpinner();
          storeProxies(parsedList);
        }));
      }
    }
    else {
      storeProxies(parsedList);
    }
  }
  if (skippedList.length > 0) {
    alert(`Skipped ${skippedList.length} lines because they could not be parsed:\n\n${skippedList}`);
  }
  if (parsedList.length > 0) {
    alert(`Read and stored ${parsedList.length} proxies.`);
  }
}

function parseList(rawList) {
  const parsedList = [], skippedList = [], colors = [DEFAULT_COLOR, '#00ff00', '#0000ff'];
  if (!rawList) {
    return {parsedList, skippedList};
  }
  rawList.split('\n').forEach((item) => {
    if (!item) {
      return; // continue to next
    }
    let p;
    // Is this line simple or complete format?
    if (item.includes('://')) {
      // complete format
      let url;
      try {
        url = new URL(item);
      }
      catch (e) {
        console.log(e);
        // URL couldn't be parseds
        skippedList.push(item);
        return; // continue to next
      }
      const type = url.protocol === 'proxy:' || url.protocol === 'http:' ? PROXY_TYPE_HTTP :
        url.protocol === 'ssl:' || url.protocol === 'https:' ? PROXY_TYPE_HTTPS :
        url.protocol === 'socks:' || url.protocol === 'socks5:' ? PROXY_TYPE_SOCKS5 :
        url.protocol === 'socks4:' ? PROXY_TYPE_SOCKS4 : -1;
        if (type === -1) {
          skippedList.push(item);
          return; // continue to next
        }

        // If color not specified in the URL, then rotate among the ones in the colors array.
        const color = url.searchParams.get('color') ?
          ('#' + url.searchParams.get('color')) : colors[parsedList.length % colors.length];

        const title = url.searchParams.get('title');

        function parseBooleanParam(paramName) {
          let paramValue = url.searchParams.get(paramName);
          // If paramName url param is not specified or it's specified and not 'false', then paramValue should equal true
          // (we assume true in case the param is absent, which may be counterintuitive, but this fcn is used for params that
          // we want to assume true in 99% of cases).
          // |paramValue === null| accounts for the case where paramValue is 0.
          return paramValue === null || !(paramValue.toLowerCase() === 'false');
        }
        const proxyDNS = parseBooleanParam('proxydns');
        const active = parseBooleanParam('active');

        // the URL class sets port === '' if not specified on the URL or it's an invalid port e.g. contains alpha chars
        let port = url.port;
        if (port === '') {
          // Default ports are 3128 for HTTP proxy, 443 for tls/ssl/https proxy, 1080 for socks4/5
          port = type === PROXY_TYPE_HTTP ? 3128 : type === PROXY_TYPE_HTTPS ? 443 : 1080;
        }

        // the URL class sets username and password === '' if not specified on the URL
        p = {type, username: url.username, password: url.password, address: url.hostname, port, color, title, proxyDNS, active};
    }
    else {
      // simple
      const hostPort = item.split(':');
      // Split always returns an array no matter what
      p = {address: hostPort[0], port: hostPort[1], color: colors[parsedList.length % colors.length]};
    }

    const proxy = makeProxy(p, true, true);
    if (proxy) {
      parsedList.push(proxy);
    }
    else {
      skippedList.push(item);
    }

  }); //forEach

  return {parsedList, skippedList};
}

function makeProxy({type = PROXY_TYPE_HTTP, username, password, address, port, color, title, proxyDNS, active = true}, patternsAllWhite, patternsIntranetBlack) {
  port = port*1; // convert to digit
  if (!port || port < 1) { // is port NaN or less than 1
    return null;
  }

  // strip bad chars from all input except username, password, type, proxyDNS, and active
  // (those last 3 are forced to boolean types before we are called)
  // If we do strip bad chars from usernams or password, auth could fail.
  address = Utils.stripBadChars(address);
  color = Utils.stripBadChars(color);
  title = Utils.stripBadChars(title);

  if (!address) {
    return null;
  }

  const proxy = {type, address, port, color, active};

  // Only set the properties needed. null and undefined props seem to be saved if set, so don't set them.
  if (username) {
    p.username = username;
  }
  if (password) {
    p.password = password;
  }
  if (title) {
    p.title = title;
  }

  if (type === PROXY_TYPE_SOCKS5) {
    // Only set if socks5
    proxy.proxyDNS = proxyDNS;
  }

  if (FOXYPROXY_BASIC) {
    proxy.whitePatterns = proxy.blackPatterns = [];
  }
  else {
    proxy.whitePatterns = patternsAllWhite ? [PATTERN_ALL_WHITE] : [];
    proxy.blackPatterns = patternsIntranetBlack ? [...blacklistSet] : [];
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
