'use strict';

const idParam = Utils.urlParamsToJsonMap().id,
  color = new jscolor("colorChooser", {uppercase: false, hash: true});
let oldProxySetting;

if (idParam) {
  // This is an edit operation. Read the data to be edited.
  getProxySettingById(idParam).then((proxyToEdit) => {
    oldProxySetting = proxyToEdit;
    // Populate the form
    document.querySelector('#windowTitle').textContent = 'Edit Proxy ' + Utils.getNiceTitle(proxyToEdit);
    document.querySelector('#newProxyTitle').value = proxyToEdit.title || '';
    document.querySelector('#newProxyType').value = proxyToEdit.type;

    color.fromString(proxyToEdit.color || DEFAULT_COLOR);
    document.querySelector('#newProxyAddress').value = proxyToEdit.address || '';
    document.querySelector('#newProxyPort').value = proxyToEdit.port || '';
    document.querySelector('#newProxyUsername').value = proxyToEdit.username || '';
    document.querySelector('#newProxyPassword').value = proxyToEdit.password || '';
    document.querySelector('#proxyDNS').checked = proxyToEdit.proxyDNS || false;
    document.querySelector('#pacURL').value = proxyToEdit.pacURL || '';
    document.querySelectorAll('.hideIfEditing').forEach(item => item.style.display = 'none');
    showHideStuff();
    document.querySelector('#spinnerRow').style.display = 'none';
    document.querySelector('#addEditRow').style.display = 'block';
  })
  .catch((e) => console.error('Unable to edit saved proxy proxy (could not get existing settings): ' + e));
}
else {
  resetForm();
  showHideStuff();
}

document.querySelectorAll('#newProxyCancel, #newProxyCancel2').forEach(item =>
  item.addEventListener('click', () => {
  // Set the password field type to text (not password) so that Firefox doesn't prompt
  // the user to save the password. Since we've already hidden this content with spinner,
  // user won't see the password anyway
  document.querySelector('#newProxyPassword').setAttribute('type', 'text');
  location.href = '/proxies.html';
}));

document.querySelector('#toggleNewProxyPasswordType').addEventListener('click', () => {
    const pwInput = document.querySelector('#newProxyPassword');
    pwInput.setAttribute('type', pwInput.getAttribute('type') === 'password' ? 'text' : 'password');
});

document.querySelector('#newProxySave').addEventListener('click', () => {
  if (!validateInput()) { return; }
  saveProxySettingFromGUI().then(() => location.href = '/proxies.html')
  .catch((e) => console.error('Error saving proxy: ' + e));
});

document.querySelector('#newProxySaveAddAnother').addEventListener('click', () => {
  if (!validateInput()) { return; }
  saveProxySettingFromGUI().then(() => resetForm())
  .catch((e) => console.error('Error saving proxy: ' + e));
});

document.querySelector('#newProxySaveThenPatterns').addEventListener('click', () => {
  if (!validateInput()) { return; }
  saveProxySettingFromGUI().then((id) => {
    id = Utils.jsonObject2UriComponent(id);
    location.href = `/patterns.html?id=${id}`;
  })
  .catch((e) => console.error('Error saving proxy: ' + e));
});

document.querySelector('#newProxyType').addEventListener('change', showHideStuff);

function showHideStuff() {
  // Show everything, then hide as necessary
  document.querySelectorAll('.supported,.hideIfNoProxy,.hideIfNotSOCKS').forEach(item => item.style.display = '');
  document.querySelectorAll('.unsupported,.show-if-pac-or-wpad').forEach(item => item.style.display = 'none');

  const proxyType = parseInt(document.querySelector('#newProxyType').value);

  if (proxyType === PROXY_TYPE_PAC || proxyType === PROXY_TYPE_WPAD || proxyType === PROXY_TYPE_SYSTEM) {
    document.querySelectorAll('.supported,.hideIfNoProxy').forEach(item => item.style.display = 'none');
    document.querySelectorAll('.unsupported').forEach(item => item.style.display = 'block');
  }
  if (proxyType === PROXY_TYPE_PAC || proxyType === PROXY_TYPE_WPAD) {
    document.querySelectorAll('.show-if-pac-or-wpad').forEach(item => item.style.display = 'block');
  }
  if (proxyType === PROXY_TYPE_NONE) {
    document.querySelectorAll('.hideIfNoProxy').forEach(item => item.style.display = 'none');
  }
  if (proxyType !== PROXY_TYPE_SOCKS5) {
    document.querySelectorAll('.hideIfNotSOCKS5').forEach(item => item.style.display = 'none');
  }
  if (oldProxySetting) {
    // Editing
    document.querySelectorAll('.hideIfEditing').forEach(item => item.style.display = 'none');
  }
  if (FOXYPROXY_BASIC) {
    document.querySelectorAll('.hideIfFoxyProxyBasic').forEach(item => item.style.display = 'none');
  }
}

function resetForm() {
  color.fromString(DEFAULT_COLOR);
  document.querySelector('#windowTitle').textContent = 'Add Proxy';
  document.querySelector('#newProxyTitle').value = '';
  document.querySelector('#newProxyType').value = PROXY_TYPE_HTTP;
  document.querySelector('#newProxyAddress').value = '';
  document.querySelector('#newProxyPort').value = '';
  document.querySelector('#newProxyUsername').value = '';
  document.querySelector('#newProxyPassword').value = '';
  document.querySelector('#onOffWhiteAll').checked = true;
  document.querySelector('#onOffBlackAll').checked = true;
  document.querySelector('#proxyDNS').checked = true;
  document.querySelector('#pacURL').value = '';
  document.querySelector('#newProxyTitle').focus();
  showHideStuff();
  document.querySelector('#spinnerRow').style.display = 'none';
  document.querySelector('#addEditRow').style.display = 'block';
}

function saveProxySettingFromGUI() {
  document.querySelector('#spinnerRow').style.display = 'none';
  document.querySelector('#addEditRow').style.display = 'block';

  let proxySetting = {};

  const newProxyTitle = document.querySelector('#newProxyTitle');
  if (newProxyTitle.value) { proxySetting.title = newProxyTitle.value; }

  proxySetting.type = parseInt(document.querySelector('#newProxyType').value);
  proxySetting.color = document.querySelector('#colorChooser').value;
  if (proxySetting.type !== PROXY_TYPE_NONE) {
    proxySetting.address = document.querySelector('#newProxyAddress').value;
    proxySetting.port = parseInt(document.querySelector('#newProxyPort').value);
    if (proxySetting.type === PROXY_TYPE_SOCKS5 && document.querySelector('#proxyDNS').checked) { proxySetting.proxyDNS = true; }
    const username = document.querySelector('#newProxyUsername').value.trim();
    const password = document.querySelector('#newProxyPassword').value.trim();
    if (username) { proxySetting.username = username; } // don't store ''
    if (password) { proxySetting.password = password; } // don't store ''
  }

  // Set the password field type to text (not password) so that Firefox doesn't prompt
  // the user to save the password. Since we've already hidden this content with spinner,
  // user won't see the password anyway
  document.querySelector('#newProxyPassword').setAttribute('type', 'text');

  if (oldProxySetting) {
    // Edit operation
    proxySetting.active = oldProxySetting.active;
    proxySetting.whitePatterns = oldProxySetting.whitePatterns;
    proxySetting.blackPatterns = oldProxySetting.blackPatterns;
    if (oldProxySetting.pacURL) proxySetting.pacURL = oldProxySetting.pacURL; // imported foxyproxy.xml
    return editProxySetting(oldProxySetting.id, oldProxySetting.index, proxySetting);
  }
  else {
    // Add operation
    proxySetting.active = true;  // new entries are instantly active. TODO: add checkbox on GUI instead of assuming
    // Do not use this proxy for internal IP addresses.
    if (document.querySelector('#onOffWhiteAll').checked) { proxySetting.whitePatterns = [PATTERN_ALL_WHITE]; }
    else { proxySetting.whitePatterns = []; }

    if (document.querySelector('#onOffBlackAll').checked) {
      proxySetting.blackPatterns = [PATTERN_LOCALHOSTURLS_BLACK, PATTERN_INTERNALIPS_BLACK, PATTERN_LOCALHOSTNAMES_BLACK];
    }
    else { proxySetting.blackPatterns = []; }

    return addProxySetting(proxySetting);
  }
}

function validateInput() {
  Utils.trimAllInputs();
  Utils.escapeAllInputs('#newProxyTitle,#newProxyAddress,#newProxyPort');
  const type = parseInt(document.querySelector('#newProxyType').value);
  if (type === PROXY_TYPE_NONE) { return true; }
  let r1 = markInputErrors("#newProxyAddress"), r2 = markInputErrors("#newProxyPort", true);
  return r1 && r2;
}

// Return false if any item in the selector is empty or doesn't have only nums when
// |numbersOnly| is true
function markInputErrors(selector, numbersOnly) {
  const item = document.querySelector(selector);
  item.classList.remove('is-invalid-input'); // reset
  const elemVal = item.value;
  if (!elemVal || (numbersOnly && !/^\d+$/.test(elemVal))) {
    item.classList.add('is-invalid-input');
    return false;
  }
  return true;
}
