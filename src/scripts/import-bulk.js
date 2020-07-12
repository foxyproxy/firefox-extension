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
hideSpinner();

// addEventListener for all buttons & handle together
document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));

let proxiesAdded = 0; // Global to this module in case user does multiple bulk imports before closing import-bulk.html    

const sync = localStorage.getItem('sync') === 'true';
const storageArea = !sync ? chrome.storage.local : chrome.storage.sync;

function process(e) {
  switch (this.id || this.dataset.i18n) {
    case 'back': location.href = '/options.html'; break;
    case 'import': importList(); break;
  }
}

function importList() {
  const rawList = document.getElementById('proxyList').value;
  if (!rawList) {
    return;
  }
  const parsedList = [], skippedList = [], colors = [DEFAULT_COLOR, '#00ff00', '#0000ff'];
  try {
    rawList.split('\n').forEach((item) => {
      if (!item) {
        return; // continue to next
      }
      // Is this line simple or complete format?
      if (item.includes('://')) {
        // complete format
        try {
          const url = new URL(item);
          console.log("url is", url);
          const type = url.protocol === 'proxy:' || url.protocol === 'http:' ? PROXY_TYPE_HTTP :
            url.protocol === 'ssl:' || url.protocol === 'https:' ? PROXY_TYPE_HTTPS :
            url.protocol === 'socks:' || url.protocol === 'socks5:' ? PROXY_TYPE_SOCKS5 :
            url.protocol === 'socks4:' ? PROXY_TYPE_SOCKS4 : -1;
            if (type === -1) {
              throw item;
            }

            // If color not specified in the URL, then rotate among the ones in the colors array.
            const color = url.searchParams.get('color') ?
              ('#' + url.searchParams.get('color')) : colors[parsedList.length % colors.length];

            const title = url.searchParams.get('title');            
            
            function parseBooleanParam(paramName) {
              let paramValue = url.searchParams.get(paramName);
              debugger;
              // If paramName url param is not specified or it's specified and not 'false', then paramValue should equal true
              // (we assume true in case the param is absent, which may be counterintuitive, but this fcn is used for params that
              // we want to assume true in 99% of cases).
              // |paramValue === null| accounts for the case where paramValue is 0.
              return paramValue === null || !paramValue.toLowerCase() === 'false';
            }
            const proxyDNS = parseBooleanParam('proxydns');
            const active = parseBooleanParam('active');

            storeProxy({
              type, username: url.username, password: url.password,
              hostname: url.hostname, port: url.port, color, title, proxyDNS, active: true},
              true, true, parsedList, skippedList);
        }
        catch (e) {
          console.log(e);
          // URL couldn't be parsed.
          // Throw just the item that we barfed on
          skippedList.push(item);
        }
      }
      else {
        // simple
        const hostPort = item.split(':');
        // Split always returns an array no matter what
        // escape all inputs
        [hostPort[0], hostPort[1]].forEach(item => item = Utils.stripBadChars(item));
        if (hostPort[0] && hostPort[1]) {
          storeProxy({
            type: PROXY_TYPE_HTTP, hostname: hostPort[0], port: hostPort[1],
            color: colors[parsedList.length % colors.length], // rotate color
            title: hostPort[0], active: true},
            true, true, parsedList, skippedList);
        }
        else {
          skippedList.push(hostPort);
        }
      }
    }); //forEach
  }
  catch (e) {
    console.log(e);
    alert(`Error ${e}`);
  }
}

function storeProxy({type, username, password, hostname, port, color, title, proxyDNS, active = true}, patternsAllWhite, patternsIntranetBlack, parsedList, skippedList) {
  console.log("storeProxy1", proxy);

  if (!port.value *1) { // is port a digit and not 0?
    skippedList.push(proxy);
    return false;
  }

  // strip bad chars from all input except username and password.
  // If we do that, auth could fail so dont change username/password.
  proxy = Object.fromEntries(Object.entries(proxy).map(([k, v]) => [k,
    k === 'username' || k === 'password' || k === 'type' || k === 'proxyDNS' ? v : Utils.stripBadChars(v)]));      
    
  console.log("storeProxy2", proxy);

  if (proxy.type !== PROXY_TYPE_SOCKS5) {
    // Only set if socks5
    proxy.proxyDNS = undefined;
  }
  
  if (FOXYPROXY_BASIC) {
    proxy.whitePatterns = proxy.blackPatterns = [];
  }
  else {
    proxy.whitePatterns = patternsAllWhite ? [PATTERN_ALL_WHITE] : [];
    proxy.blackPatterns = patternsIntranetBlack ? blacklistSet : []; // TODO: blacklistSet is not defined
  }

  // Get the nextIndex given to us by options.js and add by the number of proxies we've added.
  // This ensures this proxy setting is last in list of all proxy settings.
  proxy.index = (localStorage.getItem('nextIndex')) + (++proxiesAdded);
  storageArea.set({[Utils.getUniqueId()]: proxy}, () => {
    console.log(`imported ${proxy}`);
    parsedList.push(proxySetting);
  });
}
