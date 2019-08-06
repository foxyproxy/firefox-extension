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

vex.defaultOptions.className = 'vex-theme-default';
vex.dialog.buttons.YES.className = 'button';
let noRefresh = false;
let storageArea;

// ----------------- User Preference -----------------------
chrome.storage.local.get(null, result => {
  // if sync is NOT set or it is false, use this result
  syncOnOff.checked = result.sync;
  localStorage.setItem('sync', syncOnOff.checked);
  storageArea = result.sync ? chrome.storage.sync : chrome.storage.local;
  result.sync ? chrome.storage.sync.get(null, processOptions) : processOptions(result);
});
// ----------------- /User Preference ----------------------



// ----- add Listeners for menu
document.querySelectorAll('nav a').forEach(item => item.addEventListener('click', process));
function process() {

  switch (this.dataset.i18n) {

    case 'add': 
      localStorage.removeItem('id');                        // clear localStorage
      location.href = '/proxy.html'; 
      break;
    case 'export': Utils.exportFile(); break;
    case 'import': location.href = '/import.html'; break;
    case 'log': location.href = '/log.html'; break;
    case 'about': location.href = '/about.html'; break;

    case 'deleteAll':
      if (confirm(chrome.i18n.getMessage('confirmDelete'))) {
        showSpinner();
        chrome.storage.local.clear(() => chrome.storage.sync.clear(() => {
          hideSpinner();
          console.log('delete all completed');
        }));
      }
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
            }, () => Utils.notify(chrome.i18n.getMessage('done')));
          }
        }
      });
      break;
  }
}

// ----- add Listeners for initial elements
mode.addEventListener('change', selectMode); 
function selectMode() {
  
  // set color
  mode.style.color = mode.children[mode.selectedIndex].style.color; 
  
  // we already know the state of sync | this is set when manually changing the select
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
  [...mode.children].forEach(item => !['patterns', 'disabled'].includes(item.value) && item.remove());

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

    const item = pref[id];

    const div = temp.cloneNode(true);
    const node = [...div.children[0].children, ...div.children[1].children];
    div.classList.remove('template');
    id === LASTRESORT && div.children[1].classList.add('default');

    div.id = id;
    node[0].style.backgroundColor = item.color;
    node[1].textContent = item.title || `${item.address}:${item.port}`; // ellipsis is handled by CSS
    node[2].textContent = item.address; // ellipsis is handled by CSS
    item.username && item.password && node[3].classList.remove('hide');
    node[4].id = id + '-onoff';
    node[4].checked = item.active;
    node[5].setAttribute('for', node[4].id);

    FOXYPROXY_BASIC && (node[0].style.display = 'none');

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
  docfrag2.hasChildNodes() && mode.insertBefore(docfrag2, mode.lastElementChild);

  const opt = mode.querySelector(`option[value="${pref.mode}"]`);
  if (opt) {
    opt.selected = true;
    mode.style.color = opt.style.color;
  }

  // add Listeners
  document.querySelectorAll('button').forEach(item => item.addEventListener('click', processButton));

  document.querySelectorAll('input[name="onOff"]').forEach(item => item.addEventListener('change', function() {
    const id = this.parentNode.parentNode.id;
    console.log('toggle on/off', id, this.checked);
    storageArea.get(id, result => {
      result[id].active = this.checked;
      storageArea.set(result);
    });
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
      location.href = '/proxy.html';
      break;

    case 'patterns':
      localStorage.setItem('id', id);
      location.href = '/patterns.html';
      break;

    case 'delete|title':
      if (confirm(chrome.i18n.getMessage('confirmDelete'))) {
        parent.style.opacity = 0;
        setTimeout(() => { parent.remove(); }, 600);          // remove row 
        //storageArea.remove(id, () => console.log('delete single completed');
      }
      break;

    case 'up|title':
    case 'down|title':
      const target = this.dataset.i18n === 'up|title' ? parent.previousElementSibling : parent.nextElementSibling;
      const insert = this.dataset.i18n === 'up|title' ? target : target.nextElementSibling;
      parent.parentNode.insertBefore(parent, insert);
      target.classList.add('off');
      parent.classList.add('on');
      setTimeout(() => { target.classList.remove('off'); parent.classList.remove('on'); }, 600);
      storageArea.get(null, result => {
        const fromIndex = result[id].index;
        const toIndex = result[target.id].index; 
        result[id].index = toIndex;
        result[target.id].index = fromIndex;
        storageArea.set(result);
      }); 
      break;
  }
}
// ----------------- Helper functions ----------------------
const spinner = document.querySelector('#spinner');
function hideSpinner() {

  spinner.classList.remove('on');
  setTimeout(() => { spinner.style.display = 'none'; }, 600);
}

function showSpinner() {

  spinner.style.display = 'flax';
  spinner.classList.add('on');
}
// ----------------- /Helper functions ---------------------