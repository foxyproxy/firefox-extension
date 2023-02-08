'use strict';

// ----------------- Internationalization ------------------
Utils.i18n();

// ----- global
const accounts = document.querySelector('#accounts');
const mode = document.querySelector('#mode');
const syncOnOff = document.querySelector('#syncOnOff');
const popup = document.querySelector('.popup');
const popupMain = popup.children[0];

let storageArea, minIndex = Number.MAX_SAFE_INTEGER;

// ----------------- User Preference -----------------------
chrome.storage.local.get(null, result => {
  // if sync is NOT set or it is false, use this result
  syncOnOff.checked = result.sync;
  localStorage.setItem('sync', syncOnOff.checked);
  storageArea = result.sync ? chrome.storage.sync : chrome.storage.local;
  result.sync ? chrome.storage.sync.get(null, processOptions) : processOptions(result);
});
// ----------------- /User Preference ----------------------

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


// ----- add Listeners for menu
document.querySelectorAll('nav a').forEach(item => item.addEventListener('click', process));
function process() {

  switch (this.dataset.i18n) {

    case 'add':
      localStorage.removeItem('id'); // clear localStorage; this indicates an add not an edit
      localStorage.setItem('nextIndex', minIndex); // index to use for this proxy so that it's added to the beginning
      location.href = '/proxy.html';
      break;
    case 'export': Utils.exportFile(); break;
    case 'import': location.href = '/import.html'; break;
    case 'importProxyList': location.href = '/import-proxy-list.html'; break;
    case 'log': location.href = '/log.html'; break;
    case 'about': location.href = '/about.html'; break;

    case 'deleteAll':
      if (confirm(chrome.i18n.getMessage('confirmDelete'))) {
        showSpinner();
        chrome.storage.local.clear(() => chrome.storage.sync.clear(() => {
          hideSpinner();
          Utils.notify(chrome.i18n.getMessage('deleteAllmessage'));
          location.href = '/options.html';
        }));
      }
      break;

    case 'deleteBrowserData':
      const h4 = document.createElement('h4');
      const p = document.createElement('p');
      popupMain.children[0].textContent = chrome.i18n.getMessage('deleteBrowserData');
      let h = h4.cloneNode();
      h.textContent = chrome.i18n.getMessage('deleteNot');
      let p1 = p.cloneNode();
      p1.textContent = chrome.i18n.getMessage('deleteBrowserDataNotDescription');
      popupMain.children[1].appendChild(h);
      popupMain.children[1].appendChild(p1);

      h = h4.cloneNode();
      h.textContent = chrome.i18n.getMessage('delete');
      p1 = p.cloneNode();
      p1.textContent = chrome.i18n.getMessage('deleteBrowserDataDescription');
      popupMain.children[1].appendChild(h);
      popupMain.children[1].appendChild(p1);

      popupMain.children[2].children[0].addEventListener('click', closePopup);
      popupMain.children[2].children[1].addEventListener('click', () =>             // Not cancelled
        chrome.browsingData.remove({}, {
          //appcache: true,
          cache: true,
          cookies: true,
          downloads: false,
          //fileSystems: true,
          formData: false,
          history: false,
          indexedDB: true,
          localStorage: true,
          pluginData: true,
          //passwords: true,
          //webSQL: true,
          //serverBoundCertificates: true,
          serviceWorkers: true
        }, () => {
            Utils.notify(chrome.i18n.getMessage('done'));
            closePopup();
          }
        ));
      showPopup();
      break;
  }
}

// ----- add Listeners for initial elements
mode.addEventListener('change', selectMode);
function selectMode() {

  // set color
  mode.style.color = mode.children[mode.selectedIndex].style.color;

  console.log(mode, "selectMode");
  // we already know the state of sync | this is set when manually changing the select
  // it is undefined when mode is switched from toolbar popup or on startup
  this && storageArea.set({mode: mode.value});

  // --- change the state of success/secondary
  // change all success -> secondary
  document.querySelectorAll('.success').forEach(item => item.classList.replace('success', 'secondary'));

    switch (mode.value) {

    case 'patterns':
      document.querySelectorAll('input[name="onOff"]:checked').forEach(item => {
          const node = item.parentNode.parentNode;
          node.classList.replace('secondary', 'success'); // FF49, Ch 61
      });
      break;

    case 'disabled':                                        // do nothing
      break;

    default:
      const node = document.getElementById(mode.value);
      node && node.classList.replace('secondary', 'success');
  }
}

syncOnOff.addEventListener('change', () => {
  const useSync = syncOnOff.checked;
  // sync value always CHECKED locally
  // data is merged, replacing exisitng and adding new ones
  localStorage.setItem('sync', syncOnOff.checked);
  storageArea = syncOnOff.checked ? chrome.storage.sync : chrome.storage.local;
  if (useSync && confirm(chrome.i18n.getMessage('confirmTransferToSync'))) {
    showSpinner();
    chrome.storage.local.set({sync: true});                 // save sync state
    chrome.storage.local.get(null, result => {              // get source
      delete result.sync;
      chrome.storage.sync.set(result, hideSpinner);         // save to target
    }); // get source & save to target
  }
  else if (!useSync && confirm(chrome.i18n.getMessage('confirmTransferToLocal'))) {
    showSpinner();
    chrome.storage.sync.get(null, result => {               // get source
      result.sync = false;                                  // set sync = false
      chrome.storage.local.set(result, hideSpinner);        // save to target
    });
  }
});


chrome.runtime.onMessage.addListener((message, sender) => { // from popup or bg
//  console.log(message);
  if(!message.mode || message.mode === mode.value) { return; } // change if it is different
  mode.value = message.mode;
  selectMode();
});

function processOptions(pref) {
  // --- reset
  accounts.textContent = '';

  // remove all <option> elements except patterns and disabled
  [...mode.children].forEach(item => !['patterns', 'disabled'].includes(item.value) && item.remove());

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const docfrag2 = document.createDocumentFragment();
  const temp = document.querySelector('.template');

  // --- working directly with DB format

  // add default lastresort if not there
  //pref[LASTRESORT] || (pref[LASTRESORT] = DEFAULT_PROXY_SETTING);

  const prefKeys = Object.keys(pref).filter(item => !NON_PROXY_KEYS.includes(item)); // not for these

  prefKeys.sort((a, b) => pref[a].index - pref[b].index);   // sort by index
  if (prefKeys[0]) {
    minIndex = pref[prefKeys[0]].index; // the first index after sort (if any)
  }

  pref.mode = pref.mode || 'disabled';                      // defaults to disabled
  prefKeys.forEach(id => {
    const item = pref[id];

    const div = temp.cloneNode(true);
    const node = [...div.children[0].children, ...div.children[1].children];
    div.classList.remove('template');
    //id === LASTRESORT && div.children[1].classList.add('default');

    div.id = id;
    node[0].style.backgroundColor = item.color;
    node[1].textContent = Utils.getProxyTitle(item);
    node[2].textContent = item.address; // ellipsis is handled by CSS
    if (item.cc) {
      node[3].classList.remove('hide');
      node[3].textContent = getFlag(item.cc);
      node[3].title = item.country;
    }
    item.username && item.password && node[4].classList.add('on');
    node[5].id = id + '-onoff';
    node[5].checked = item.active;
    node[6].setAttribute('for', node[5].id);

    FOXYPROXY_BASIC && (node[8].style.display = 'none');

    // setting div colors
    switch (true) {

      case Utils.isUnsupportedType(item.type):
        div.classList.add('unsupported');
        break;

      case pref.mode === 'patterns':
      case pref.mode === 'random':
      case pref.mode === 'roundrobin':
        div.classList.add(item.active ? 'success' : 'secondary');
        break;

      case pref.mode === 'disabled':
        div.classList.add('secondary');
        break;

      default:
        div.classList.add(pref.mode == id ? 'success' : 'secondary');
    }

    docfrag.appendChild(div);

    // add to select
    const opt = new Option(node[1].textContent, id);
    opt.style.color = item.color;
    docfrag2.appendChild(opt);
  });

  docfrag.hasChildNodes() && accounts.appendChild(docfrag);
  docfrag2.hasChildNodes() && mode.appendChild(docfrag2, mode.lastElementChild);

  if (FOXYPROXY_BASIC) {
    mode.children[0].classList.add('hide');                 // hide by pattern option
    pref.mode === 'patterns' &&  (pref.mode = 'disabled');
  }

  const opt = mode.querySelector(`option[value="${pref.mode}"]`);
  if (opt) {
    opt.selected = true;
    mode.style.color = opt.style.color;
  }

  // add Listeners
  document.querySelectorAll('button').forEach(item => item.addEventListener('click', processButton));

  document.querySelectorAll('input[name="onOff"]').forEach(item => item.addEventListener('change', function() {
    const id = this.parentNode.parentNode.id;
    storageArea.get(id, result => {
      result[id].active = this.checked;
      storageArea.set(result);
    });
  }));

  doWeHaveProxiesDefined();
  hideSpinner();
}

function doWeHaveProxiesDefined() {
  if (!accounts.hasChildNodes()) {
    document.querySelector('#help').style.display = 'block';
    document.querySelector('#rightColumn').classList.add('secondary');
    document.querySelector('#mode').style.display = 'none';
  }
  else {
    document.querySelector('#help').style.display = 'none';
    document.querySelector('#rightColumn').classList.remove('warning');
    document.querySelector('#mode').style.display = 'flex';
  }
}

function getFlag(cc) {

  cc = /^[A-Z]{2}$/i.test(cc) && cc.toUpperCase();
  return cc && String.fromCodePoint(...[...cc].map(c => c.charCodeAt() + 127397));
}

function processButton() {

  const parent = this.parentNode.parentNode;
  const id = parent.id;

  switch (this.dataset.i18n) {

    case 'help|title':
      popupMain.children[0].textContent = chrome.i18n.getMessage('syncSettings');
      popupMain.children[1].textContent = chrome.i18n.getMessage('syncSettingsHelp');
      popupMain.children[2].children[0].style.visibility = 'hidden';
      popupMain.children[2].children[1].addEventListener('click', closePopup);
      showPopup();
      break;

    case 'edit':
      localStorage.setItem('id', id);
      location.href = '/proxy.html';
      break;

    case 'patterns':
      localStorage.setItem('id', id);
      location.href = '/patterns.html';
      break;

    case 'delete|title':
      if (confirm(chrome.i18n.getMessage('confirmDelete'))) {
        parent.style.opacity = 0;
        setTimeout(() => { parent.remove(); doWeHaveProxiesDefined();}, 600);          // remove row
        storageArea.remove(id);
      }
      break;

    case 'up|title':
    case 'down|title':
      const target = this.dataset.i18n === 'up|title' ? parent.previousElementSibling : parent.nextElementSibling;
      const insert = this.dataset.i18n === 'up|title' ? target : target.nextElementSibling;
      parent.parentNode.insertBefore(parent, insert);
      parent.classList.add('on');
      setTimeout(() => { parent.classList.remove('on'); }, 600);
      storageArea.get(null, result => {
        // re-index
        //[...accounts.children].forEach((item, index) => item.id !== LASTRESORT && (result[item.id].index = index));
        [...accounts.children].forEach((item, index) => result[item.id].index = index);
        minIndex = 0; // minimum index is always 0 now
        storageArea.set(result);
      });
      break;
  }
}

function showPopup() {

  popup.style.display = 'flex';
  window.getComputedStyle(popup).opacity;
  window.getComputedStyle(popup.children[0]).transform;
  popup.classList.add('on');
}

function closePopup() {

  popup.classList.remove('on');
  setTimeout(() => {
    popup.style.display = 'none';
    // reset
    popupMain.children[0].textContent = '';
    popupMain.children[1].textContent = '';
    popupMain.children[2].children[0].style.visibility = 'visible';
    popupMain.replaceChild(popupMain.children[2].cloneNode(true), popupMain.children[2]); // cloning to remove listeners
  }, 600);
}
