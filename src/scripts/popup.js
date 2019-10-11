'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

// ----------------- User Preference -----------------------
let storageArea;
chrome.storage.local.get(null, result => {
  storageArea = result.sync ? chrome.storage.sync : chrome.storage.local;
  result.sync ? chrome.storage.sync.get(null, processOptions) : processOptions(result);
});
// ----------------- /User Preference ---------------------- 

function processOptions(pref) {

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const temp = document.querySelector('li.template');

  // add default lastresort if not there
  //pref[LASTRESORT] || (pref[LASTRESORT] = DEFAULT_PROXY_SETTING);

  const prefKeys = Object.keys(pref).filter(item => !NON_PROXY_KEYS.includes(item)); // not for these

  prefKeys.sort((a, b) => pref[a].index - pref[b].index);   // sort by index
  
  pref.mode = pref.mode || 'disabled';                      // defaults to disabled
  let foundPattern;
  prefKeys.forEach(id => {

    const item = pref[id];
    
    if (item.whitePatterns[0]) { foundPattern = true; }
    
    if (!Utils.isUnsupportedType(item.type)) {              // if supported

      const li = temp.cloneNode(true);
      li.classList.remove('template');
      li.id = id;
      li.style.color = item.color;
      li.children[0].textContent = item.title || `${item.address}:${item.port}`;
      li.children[1].textContent = '(' + chrome.i18n.getMessage('forAll') + ')';

      docfrag.appendChild(li);
    }
  });

  docfrag.hasChildNodes() && temp.parentNode.insertBefore(docfrag, temp.nextElementSibling);
  
  if (FOXYPROXY_BASIC || !foundPattern) {
    temp.parentNode.children[0].classList.add('hide');      // hide by pattern option
    pref.mode === 'patterns' && (pref.mode = 'disabled');
  } 
  
  const node = document.getElementById(pref.mode);          // querySelector error with selectors starting with number
  node.classList.add('on');
  
  // add Listeners
  document.querySelectorAll('li, button').forEach(item => item.addEventListener('click', process));
}

function process() {

  let tabs;
  switch (this.dataset.i18n) {

    case 'myIP':
      chrome.tabs.create({url: 'https://getfoxyproxy.org/geoip/'}); // no need to wait for it
      window.close();
      break;

    case 'log':
      const url = chrome.runtime.getURL('log.html');
      chrome.tabs.query({url}, tabs => { // find a log tab
        tabs[0] ? chrome.tabs.update(tabs[0].id, {active: true}) : chrome.tabs.create({url}); // active existing tab OR open new tab
        window.close();
      });
      break;
      
    case 'options':
      chrome.tabs.query({url: chrome.runtime.getURL('') + '*'}, tabs => {
        if (!tabs[0]) { 
          chrome.runtime.openOptionsPage();
          window.close();
          return;
        }
        const tab = tabs.find(item => /(proxy|options|patterns)\.html/.test(item.url));  // find a option tab
        tab ? chrome.tabs.update(tab.id, {active: true}) : chrome.tabs.update(tabs[0].id, {active: true, url: '/options.html'});
        window.close();
      });
      break;

    default:
      // reset the old one
      const old = document.querySelector('.on');      
      old &&  old.classList.remove('on');
      this.classList.add('on');
      

      storageArea.set({mode: this.id});                     // keep it open for more action
      // popup & options are the only place that can set mode
      // sending message to option && bg, if it is open
      chrome.runtime.sendMessage({mode: this.id});
  }
}
