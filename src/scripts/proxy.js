'use strict';

// ----------------- Internationalization ------------------
Utils.i18n();

document.addEventListener('keyup', evt => {
  if (evt.keyCode === 27) {
    close();
  }
});
  
// ----- global
let proxy = {}, proxiesAdded = 0;
const color = new jscolor('colorChooser', {uppercase: false, hash: true});
color.fromString(DEFAULT_COLOR);                             // starting from default color

const header = document.querySelector('.header');           // dynamic header
setHeader();

// ----- check for Edit
let id = localStorage.getItem('id');
const sync = localStorage.getItem('sync') === 'true';
const storageArea = !sync ? chrome.storage.local : chrome.storage.sync;
if (id) {                                                   // This is an edit operation

  storageArea.get(id, result => {

    if (!Object.keys(result).length) {
/*
      if (id === LASTRESORT) {                              // error prevention
        proxy = DEFAULT_PROXY_SETTING;
        processOptions();
        return;
      }*/
      console.error('Unable to edit saved proxy (could not get existing settings)')
      return;
    }
    proxy = result[id];
    processOptions();
  });
}


// --- show & hide element using CSS
const nav = [...document.querySelectorAll('input[name="nav"]')];
//nav[0].checked = true;

const proxyType = document.querySelector('#proxyType');
proxyType.addEventListener('change', function() { nav[this.value -1].checked = true; });

const proxyTitle = document.querySelector('#proxyTitle');
proxyTitle.focus();

const proxyAddress =  document.querySelector('#proxyAddress');
const proxyPort = document.querySelector('#proxyPort');
const proxyUsername = document.querySelector('#proxyUsername');
const proxyPassword = document.querySelector('#proxyPassword');
const proxyActive = document.querySelector('#proxyActive');
const proxyDNS = document.querySelector('#proxyDNS');
const pacURL = document.querySelector('#pacURL');

// --- remove nodes completely for FP Basic
FOXYPROXY_BASIC && document.querySelectorAll('.notForBasic').forEach(item => item.remove());

// --- remove pattern shortcuts if this is an edit operation
id && document.querySelectorAll('.notForEdit').forEach(item => item.remove());

// --- add Listeners
document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));
function process() {

  switch (this.dataset.i18n) {

    case 'cancel':
      close();
      break;

    case 'saveAdd':
      if (!validateInput()) { return; }
      storageArea.set(makeProxy(), resetOptions);
      break;

    case 'saveEditPattern':
      if (!validateInput()) { return; }
      storageArea.set(makeProxy(), () => {
        localStorage.setItem('id', id);                     // in case new proxy was added
        proxyPassword.value = '';                           // prevent Firefox's save password prompt
        location.href = '/patterns.html';
      });
      break;

    case 'save':
      if (!validateInput()) { return; }
      storageArea.set(makeProxy(), () => {
        proxyPassword.value = '';                           // prevent Firefox's save password promp 
        location.href = '/options.html' 
      });
      break;

    case 'togglePW|title':
      const inp = this.nextElementSibling;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      break;
  }
}

function setHeader(proxy) {

  if (proxy) {
    document.title = 'FoxyProxy ' + chrome.i18n.getMessage('editProxy', '');
    header.textContent = chrome.i18n.getMessage('editProxy', proxy.title || `${proxy.address}:${proxy.port}`);
    return;
  }
  document.title = 'FoxyProxy ' + chrome.i18n.getMessage('addProxy');
  header.textContent = chrome.i18n.getMessage('addProxy');
}


function processOptions() {

    setHeader(proxy);

    // select
    proxyType.value = proxy.type;
    nav[proxyType.value -1].checked = true;

    // checkbox
    proxyActive.checked = proxy.active;
    proxyDNS.checked = proxy.proxyDNS || false;

    // color
    color.fromString(proxy.color || DEFAULT_COLOR);

    // input
    proxyTitle.value = proxy.title || '';
    proxyAddress.value = proxy.address || '';
    proxyPort.value = proxy.port || '';
    proxyUsername.value = proxy.username || '';
    proxyPassword.value = proxy.password || '';
    pacURL.value = proxy.pacURL || '';
}

function makeProxy() {

  proxy.type = proxyType.value *1;
  proxy.color = document.querySelector('#colorChooser').value;
  proxy.title = proxyTitle.value;
  proxy.active = proxyActive.checked;
  
  if (proxy.type !== PROXY_TYPE_NONE) {

    proxy.address = proxyAddress.value;
    proxy.port = proxyPort.value *1;
    proxy.proxyDNS = proxy.type === PROXY_TYPE_SOCKS5 && proxyDNS.checked;
    // already trimmed in validateInput()
    proxy.username = proxyUsername.value;                   // if it had u/p and then deletd it, it must be reflected
    proxy.password = proxyPassword.value;
  }
  if (FOXYPROXY_BASIC) {
    proxy.whitePatterns = proxy.blackPatterns = [];
  }
  else {
    proxy.whitePatterns = proxy.whitePatterns || (document.querySelector('#whiteAll').checked ? [PATTERN_ALL_WHITE] : []);
    proxy.blackPatterns = proxy.blackPatterns || (document.querySelector('#blackAll').checked ? blacklistSet : []);
  }
  proxy.pacURL = proxy.pacURL || pacURL.value;  // imported foxyproxy.xml

  if (!id) {  // global
    // This is an add operation since id does not exist. If this is an edit op, then id is already set.
    // Get the nextIndex given to us by options.js and subtract by the number of proxies we've added
    // while this window has been open. This ensures this proxy setting is first in list of all proxy settings.
    proxy.index = (localStorage.getItem('nextIndex')) - (++proxiesAdded);
    id = Utils.getUniqueId();
  }
  // else proxy.index is already set for edit operations
  return {[id]: proxy};
}

function validateInput() {

  document.querySelectorAll('input[type="text"]').forEach(item => item.value = item.value.trim());  
  
  if (proxyType.value *1 === PROXY_TYPE_NONE) { return true; }

  // let's handle here, #proxyPort will be checked later separately
  // escape all inputs
  [proxyTitle, proxyAddress].forEach(item => item.value = Utils.stripBadChars(item.value));  

  // checking proxyAddress
  proxyAddress.classList.remove('invalid'); // reset
  if (!proxyAddress.value) {
    proxyAddress.classList.add('invalid');
    return false;
  }

  // checking proxyPort
  proxyPort.classList.remove('invalid'); // reset
  if (!proxyPort.value *1) { // check to see if it is a digit and not 0
    proxyPort.classList.add('invalid');
    return false;
  }

  return true;
}


function resetOptions() {
  
  localStorage.removeItem('id');
  id = null;

  // to help entering sets quickly, some fields are kept
  [proxyTitle, proxyAddress].forEach(item => item.value = '');
  color.fromString(DEFAULT_COLOR);

  setHeader();  
  proxyTitle.focus();
}

function close() {
  proxyPassword.value = ''; /* prevent Firefox's save password prompt */
  location.href = '/options.html';
}
