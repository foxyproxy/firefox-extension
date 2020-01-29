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
  const parsedList = [];
  if (rawList) {
    try {
      rawList.split('\n').forEach((item) => {
        if (!item) {
          return; // continue to next
        }
        // Is this line simple or complete format?
        if (item.includes('://')) {
          // complete
          try {
            const url = new URL(item);
            console.log("url is");
            console.log(url);
            const type = url.protocol === 'proxy:' || url.protocol === 'http:' ? PROXY_TYPE_HTTP :
              url.protocol === 'ssl:' || url.protocol === 'https:' ? PROXY_TYPE_HTTPS :
              url.protocol === 'socks:' || url.protocol === 'socks5:' ? PROXY_TYPE_SOCKS5 :
              url.protocol === 'socks4:' ? PROXY_TYPE_SOCKS4 : -1;
              if (type === -1) {
                throw item;
              }
              const color = '#' + (url.searchParams.get('color') || '0000ff');
              const title = url.searchParams.get('title');
              let proxyDNS = url.searchParams.get('proxyDns');
              
              // If proxyDNS url param is not specified or it's specified and true, then proxyDns === true
              if (proxyDNS === null || proxyDNS.toLowerCase() === 'true') {
                proxyDNS = true;
              }
              let parsedItem = makeProxy(type, url.username, url.password, url.hostname, url.port, color, title, proxyDNS,
                true, true);
              storageArea.set({[Utils.getUniqueId()]: parsedItem}, () => {
                alert('imported one');
              });                
          }
          catch (e) {
            console.log(e);
            // URL couldn't be parsed.
            // Throw just the item that we barfed on
            throw item;
          }
        }
        else {
          // simple
          const hostPort = item.split(':');
          // Split always returns an array no matter what
          if (hostPort[0] && hostPort[1]) {
            const proxy = makeProxy(PROXY_TYPE_HTTP, )
            parsedList.push()
          }          
        }
      });
    }
    catch (e) {
      console.log(e);
      alert(`Error parsing this line: ${e}`);
    }
  }
}

function makeProxy(type, username, password, address, port, color, title, proxyDNS, patternAllWhite, patternsIntranetBlack) {
  const proxy = {type, username, password, address, port, color, title, active: true};
  if (proxy.type === PROXY_TYPE_SOCKS5) {
    // Only set if socks5
    proxy.proxyDNS = proxyDNS;
  }
  
  if (FOXYPROXY_BASIC) {
    proxy.whitePatterns = proxy.blackPatterns = [];
  }
  else {
    proxy.whitePatterns = patternAllWhite ? [PATTERN_ALL_WHITE] : [];
    proxy.blackPatterns = patternsIntranetBlack ? blacklistSet : [];
  }

  // Get the nextIndex given to us by options.js and add by the number of proxies we've added.
  // This ensures this proxy setting is last in list of all proxy settings.
  proxy.index = (localStorage.getItem('nextIndex')) + (++proxiesAdded);
  console.log("parsed proxy: ");
  console.log(proxy);
  return proxy;
}
