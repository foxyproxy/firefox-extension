'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

// ----- global
const accounts = document.querySelector('#accounts');
const mode = document.querySelector('#mode');
const syncOnOff = document.querySelector('input[name="syncOnOff"]');
const spinner = document.querySelector('#spinner');

vex.defaultOptions.className = 'vex-theme-default';
vex.dialog.buttons.YES.className = 'button';
let noRefresh = false;


// ----- add Listeners for menu
document.querySelectorAll('nav a').forEach(item => item.addEventListener('click', process));
function process() {

  switch (this.dataset.i18n) {

    case 'add': location.href = '/proxy.html'; break;
    case 'export': Utils.exportFile(); break;
    case 'import': location.href = '/import.html'; break;
    case 'log': location.href = '/log.html'; break;
    case 'about': location.href = '/about.html'; break;

    case 'deleteAll':
      confirm(chrome.i18n.getMessage('confirmDelete')) && deleteAllSettings().then(() => console.log('delete all completed'));
      break;

    case 'deleteBrowserData':
      vex.dialog.confirm({
        message: `${chrome.i18n.getMessage('deleteBrowserData')}`,
        input: `
        <h3>${chrome.i18n.getMessage('deleteNot')}</h3>
        <p>${chrome.i18n.getMessage('deleteBrowserDataNotDescription')}</p>
        <h3>${chrome.i18n.getMessage('delete')}</h3>
        <p>${chrome.i18n.getMessage('deleteBrowserDataDescription')}</p>`,
        callback: function(data) {
          if (data) {
            // Not cancelled
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
            }, () => Utils.displayNotification(chrome.i18n.getMessage('done')));
          }
        }
      });
      break;
  }
}

// ----- add Listeners for initial elements
mode.addEventListener('change', selectMode); 
function selectMode() {
  
 console.log('selectMode', this);
  // set color
  mode.style.color = mode.children[mode.selectedIndex].style.color; 
  
  // we laready know the state of sync | this is set when manually changing the select
  this && (!syncOnOff.checked ? chrome.storage.local.set({mode: mode.value}) : chrome.storage.sync.set({mode: mode.value}));
  // change the state of success/secondary 
  const last = document.querySelector('.success');
  if (last) {
    last.classList.remove('success') ;
    last.classList.add('secondary');
  }
  const next = document.querySelector('#' + mode.value);
  if (next) {
    next.classList.remove('secondary') ;
    next.classList.add('success'); 
  }
}




syncOnOff.addEventListener('change', function() {
  const useSync = this.checked;
  // always stored locally
  //chrome.storage.local.set({'sync': useSync}, () => console.log('sync value changed to ' + useSync));
  if (useSync && confirm(chrome.i18n.getMessage('confirmTransferToSync'))) {
    showSpinner();
    chrome.storage.local.get(null, result => {              // get source
      result.sync = useSync;                                // save sync state
      chrome.storage.sync.get(null, res => {                // get target
        res.mode = result.mode;
        res.logging = result.logging;
        res.proxySettings = [...new Set([...res.proxySettings, ...result.proxySettings])]; // ES6 new Set() to create unique array
        chrome.storage.sync.set(res, () => processOptions(res)); // save to target
      });
    });
  }
  else if (!useSync && confirm(chrome.i18n.getMessage('confirmTransferToLocal'))) {
    showSpinner();
    chrome.storage.sync.get(null, result => {               // get source
      chrome.storage.local.get(null, res => {               // get target
        res.sync = useSync;                                 // save sync state
        res.mode = result.mode;
        res.logging = result.logging;
        res.proxySettings = [...new Set([...res.proxySettings, ...result.proxySettings])]; // ES6 new Set() to create unique array
        chrome.storage.local.set(res, () => processOptions(res)); // save to target
      });
    });
  }
});


chrome.runtime.onMessage.addListener((message, sender) => { // from popup or bg
  console.log(message);
  if(!message.mode) { return; }
  mode.value = message.mode;
  selectMode();
});

// ----- get storage and populate
init();
function init() {

  // ----------------- User Preference -----------------------
  chrome.storage.local.get(null, result => {
    // sync is NOT set or it is false, use this result
    if (!result.sync) {
      syncOnOff.checked = false;
      //processOptions(prepareForSettings(result));
      processOptions(result);
      return;
    }
    // sync is set
    syncOnOff.checked = true;
    chrome.storage.sync.get(null, result => {
     // processOptions(prepareForSettings(result));
      processOptions(result);
    });
  });
  // ----------------- /User Preference ----------------------
}

function processOptions(pref) {

  // --- reset
  accounts.textContent = '';
  [...mode.children].forEach(item => mode.children.length > 2 && item.remove());

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const docfrag2 = document.createDocumentFragment();
  const temp = document.querySelector('.template');

  // --- working directly with DB format
  
  // add default lastresort if not there
  pref[LASTRESORT] || (pref[LASTRESORT] = DEFAULT_PROXY_SETTING);

  const prefKeys = Object.keys(pref).filter(item => !['mode', 'logging', 'sync'].includes(item)); // not for these

  prefKeys.sort((a, b) => pref[a].index - pref[b].index);   // sort by index

  pref.mode = pref.mode || 'patterns';                      // defaults to patterns

  prefKeys.forEach(id => {

    // note item is the id
    const item = pref[id];
console.log(item);
    const div = temp.cloneNode(true);
    const node = [...div.children[0].children, ...div.children[1].children];
    div.classList.remove('template');
    item === LASTRESORT && div.children[1].classList.add('default');


    div.id = id;
    node[0].style.backgroundColor = item.color;
    node[1].textContent = item.title || `${item.address}:${item.port}`; // ellipsis is handled by CSS
    node[2].textContent = item.address; // ellipsis is handled by CSS
    node[3].id = id + '-onoff';
    node[3].checked = item.active;
    node[4].setAttribute('for', node[3].id);

    FOXYPROXY_BASIC && (node[0].style.display = 'none');

    // setting div colors
    switch (true) {

      case Utils.isUnsupportedType(item.type):
        div.classList.add('unsupported-color');
        break;

      case pref.mode === 'patterns':
      case pref.mode === 'random':
      case pref.mode === 'roundrobin':
        div.classList.add(item.active ? 'success' : 'secondary');

      case pref.mode === 'disabled':
        div.classList.add('secondary');

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
  docfrag2.hasChildNodes() && mode.insertBefore(docfrag2, mode.lastElementChild.previousElementSibling);

  const opt = mode.querySelector(`option[value="${pref.mode}"]`);
  if (opt) {
    opt.selected = true;
    mode.style.color = opt.style.color;
  }

  // add Listeners
  document.querySelectorAll('button').forEach(item => item.addEventListener('click', processButton));

  document.querySelectorAll('input[name="onOff"]').forEach(item => item.addEventListener('click', function() {
    const id = this.parentNode.parentNode.id;
    //console.log('toggle on/off', id);
    noRefresh = true;
    toggleActiveProxySetting(id).then(() => console.log('toggle done'));
  }));

  hideSpinner();
}

function processButton() {

  const parent = this.parentNode.parentNode;
  const id = parent.id;

  switch (this.dataset.i18n) {

    case 'help|title':
      vex.dialog.alert({
        message: chrome.i18n.getMessage('syncSettings') + '',
        input: chrome.i18n.getMessage('syncSettingsHelp') + ''
      });
      break;

    case 'edit':
      localStorage.setItem('id', id);
      localStorage.setItem('sync', syncOnOff.checked);
      location.href = '/proxy.html';
      break;

    case 'patterns':
      localStorage.setItem('id', id);
      localStorage.setItem('sync', syncOnOff.checked);
      location.href = '/patterns.html';
      break;

    case 'delete|title':
      //console.log('delete one proxy setting: ' + id);
      confirm(chrome.i18n.getMessage('confirmDelete')) &&
        deleteProxyById(id).then(() => console.log('delete single completed'));
      break;

    case 'up|title':
    case 'down|title':
      const target = this.dataset.i18n === 'up|title' ? parent.previousElementSibling : parent.nextElementSibling;
      const insert = this.dataset.i18n === 'up|title' ? target : target.nextElementSibling;
      parent.parentNode.insertBefore(parent, insert);
      target.classList.add('off');
      parent.classList.add('on');
      setTimeout(() => { target.classList.remove('off'); parent.classList.remove('on'); }, 600);
      noRefresh = true;
      swapProxySettingWithNeighbor(id, target.id).then((settings) => {
        //console.log('swapProxySettingWithNeighbor() succeeded');
        processOptions(settings);
      }).catch((e) => console.error('swapProxySettingWithNeighbor failed: ' + e));
      break;
  }
}

/*
// ----  update UI manaully

// Update the UI whenever stored settings change and we are open.
// one example is user deleting a proxy setting that is the current mode.
// another: user changes mode from popup.html
chrome.storage.onChanged.addListener((oldAndNewSettings) => {
  //console.log('proxies.js: settings changed on disk');
  if (noRefresh) { noRefresh = false; } // We made the change ourselves
  //else location.reload();
  //else { init(); }
});

function storageRetrievalSuccess(settings) {

  if (!settings.proxySettings || !settings.proxySettings.length) {

    // using hide class app.css#4575 to show/hide
    // note: all elements are hidden, only need to unhide
    hideSpinner();
    document.querySelector('#error').classList.remove('hide');
    return;
  }

  console.log('Proxies found in storage.');
  processOptions(settings);
  hideSpinner();
}




function storageRetrievalError(error) {

  console.log(`storageRetrievalError(): ${error}`);
  document.querySelector('#error').classList.remove('hide');
}

*/

// ----------------- Helper functions ----------------------
function hideSpinner() {

  spinner.classList.remove('on');
  setTimeout(() => { spinner.style.display = 'none'; }, 600);
}

function showSpinner() {

  spinner.style.display = 'flax';
  spinner.classList.add('on');
}
// ----------------- /Helper functions ---------------------