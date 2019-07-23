'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

// ----- global
let oldProxySetting;
const idParam = Utils.urlParamsToJsonMap().id,
  color = new jscolor("colorChooser", {uppercase: false, hash: true});

const header = document.querySelector('h3 span'); // dynamic header
const proxyPassword = document.querySelector('#proxyPassword');

// --- show & hide element using CSS
const nav = [...document.querySelectorAll('input[name="nav"]')];
nav[0].checked = true;
const proxyType = document.querySelector('#proxyType');
proxyType.addEventListener('change', function() {
  nav[this.value -1].checked = true;
});

// --- remove nodes completely for FP Basic
FOXYPROXY_BASIC && document.querySelectorAll('.notForBasic').forEach(item => item.remove());

// --- add Listeners
document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));
function process() {

  switch (this.dataset.i18n) {

    case 'cancel':
      // prevent Firefox's save password prompt
      proxyPassword.value = '';
      location.href = '/options.html';
      break;

    case 'saveAdd':
      if (!validateInput()) { return; }
      saveProxySetting().then(() => resetForm())
      .catch((e) => console.error('Error saving proxy: ' + e));
      break;

    case 'saveEditPattern':
      if (!validateInput()) { return; }
      saveProxySetting().then((id) => location.href = '/patterns.html?id=' + Utils.jsonObject2UriComponent(id))
      .catch((e) => console.error('Error saving proxy: ' + e));
      break;

    case 'save':
      if (!validateInput()) { return; }
      saveProxySetting().then(() => location.href = '/options.html')
      .catch((e) => console.error('Error saving proxy: ' + e));
      break;

    case 'togglePW|title':
      const inp = this.nextElementSibling;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      break;
  }
}


if (idParam) {
  // This is an edit operation. Read the data to be edited.
  getProxySettingById(idParam).then((proxyToEdit) => { console.log(proxyToEdit);
    
    oldProxySetting = proxyToEdit;
    
    // Populate the form
    document.title = 'FoxyProxy ' + chrome.i18n.getMessage('editProxy', '');
    header.textContent = chrome.i18n.getMessage('editProxy', Utils.getNiceTitle(proxyToEdit));
    
    // input
    document.querySelector('#proxyTitle').value = proxyToEdit.title || '';
    document.querySelector('#proxyAddress').value = proxyToEdit.address || '';
    document.querySelector('#proxyPort').value = proxyToEdit.port || '';
    document.querySelector('#proxyUsername').value = proxyToEdit.username || '';
    proxyPassword.value = proxyToEdit.password || ''; 
    document.querySelector('#pacURL').value = proxyToEdit.pacURL || '';   
    
    // select
    proxyType.value = proxyToEdit.type;
    
    // checkbox
    document.querySelector('#proxyDNS').checked = proxyToEdit.proxyDNS || false;
    
    // color
    document.querySelector('#color').value = proxyToEdit.color || DEFAULT_COLOR;
    color.fromString(proxyToEdit.color || DEFAULT_COLOR);
  })
  .catch((e) => console.error('Unable to edit saved proxy proxy (could not get existing settings): ' + e));
}
else { resetForm(); }


function resetForm() {
  
  document.title = 'FoxyProxy ' + chrome.i18n.getMessage('addProxy');
  header.textContent = chrome.i18n.getMessage('addProxy');
  
  proxyType.value = PROXY_TYPE_HTTP;

  document.querySelectorAll('input[type="text"]').forEach(item => item.value = '');
  document.querySelectorAll('input[type="checkbox"]').forEach(item => item.checked = true);
  
  document.querySelector('#color').value = DEFAULT_COLOR;
  color.fromString(DEFAULT_COLOR);  
  
  document.querySelector('#proxyTitle').focus();
}

 
function saveProxySetting() {

  let proxySetting = {};

  const proxyTitle = document.querySelector('#proxyTitle').value;
  if (proxyTitle) { proxySetting.title = proxyTitle; }

  proxySetting.type = proxyType.value *1;
  
  proxySetting.color = document.querySelector('#colorChooser').value;
  
  if (proxySetting.type !== PROXY_TYPE_NONE) {
    
    proxySetting.address = document.querySelector('#proxyAddress').value;
    proxySetting.port = document.querySelector('#proxyPort').value *1;
    if (proxySetting.type === PROXY_TYPE_SOCKS5 && document.querySelector('#proxyDNS').checked) { proxySetting.proxyDNS = true; }
    const username = document.querySelector('#proxyUsername').value; // already trimmed in validateInput()
    const password = proxyPassword.value;
    if (username) { proxySetting.username = username; } // don't store ''
    if (password) { proxySetting.password = password; } // don't store ''
  }

    // prevent Firefox's save password prompt
    proxyPassword.value = '';

  if (oldProxySetting) {
    // Edit operation
    proxySetting.active = oldProxySetting.active;
    proxySetting.whitePatterns = oldProxySetting.whitePatterns;
    proxySetting.blackPatterns = oldProxySetting.blackPatterns;
    if (oldProxySetting.pacURL) { proxySetting.pacURL = oldProxySetting.pacURL; } // imported foxyproxy.xml
    return editProxySetting(oldProxySetting.id, oldProxySetting.index, proxySetting);
  }
  else {
    // Add operation
    proxySetting.active = true;  // new entries are instantly active. TODO: add checkbox on GUI instead of assuming
    // Do not use this proxy for internal IP addresses.
    proxySetting.whitePatterns = document.querySelector('#onOffWhiteAll').checked ? [PATTERN_ALL_WHITE] : [];

    proxySetting.blackPatterns = document.querySelector('#onOffBlackAll').checked ? 
      [PATTERN_LOCALHOSTURLS_BLACK, PATTERN_INTERNALIPS_BLACK, PATTERN_LOCALHOSTNAMES_BLACK] : [];


    return addProxySetting(proxySetting);
  }
}

function validateInput() {

  Utils.trimAllInputs();
  Utils.escapeAllInputs('#proxyTitle, #proxyAddress, #proxyPort');

  if (proxyType.value *1 === PROXY_TYPE_NONE) { return true; }
  
  let item = document.querySelector('#proxyAddress');
  item.classList.remove('is-invalid-input'); // reset
  if (!item.value) {
    item.classList.add('is-invalid-input');
    return false;
  }
  
  item = document.querySelector('#proxyPort');
  item.classList.remove('is-invalid-input'); // reset
  if (!item.value *1) {
    item.classList.add('is-invalid-input');
    return false;
  }
  
  return true;
}
