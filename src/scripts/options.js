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


// ----- add Listeners for proxy section
mode.addEventListener('change', () => setMode(mode.value));

syncOnOff.addEventListener('click', function() {
  const useSync = this.checked;console.log(useSync);
  setStorageSync(useSync).then(() => console.log('sync value changed to ' + useSync));
});




// ----- add Listeners for menu
document.querySelector('nav a[data-i18n="deleteAll"]').addEventListener('click', () => {
  confirm(chrome.i18n.getMessage('confirmDelete')) && deleteAllSettings().then(() => console.log('delete all completed'));
});

document.querySelector('nav a[data-i18n="export"]').addEventListener('click', Utils.exportFile);

document.querySelector('nav a[data-i18n="deleteBrowserData"]').addEventListener('click', () => {
// change to DOM
  vex.dialog.confirm({
    message: `${chrome.i18n.getMessage('delete_browser_data')}`,
    input: `
    <h5>${chrome.i18n.getMessage('deleteNot')}</h5>
    <p>${chrome.i18n.getMessage('deleteBrowserDataNotDescription')}</p>
    <h5>${chrome.i18n.getMessage('delete')}</h5>
    <p>${chrome.i18n.getMessage('deleteBrowserDataDescription')}</p>`,
    callback: function(data) {
      if (data) {
        // Not cancelled
        browser.browsingData.remove({}, {
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
        }).then(() => Utils.displayNotification(chrome.i18n.getMessage('done')));
      }
    }
  });
});


start();
function start() {

  getAllSettings().then((settings) => storageRetrievalSuccess(settings))
    .catch((e) => storageRetrievalError(e));

  usingSync().then((useSync) => syncOnOff.checked = useSync)
    .catch((e) => { console.error(`usingSync() error: ${e}`); reject(e); });
}

// Update the UI whenever stored settings change and we are open.
// one example is user deleting a proxy setting that is the current mode.
// another: user changes mode from popup.html
browser.storage.onChanged.addListener((oldAndNewSettings) => {
  console.log('proxies.js: settings changed on disk');
  if (noRefresh) { noRefresh = false; } // We made the change ourselves
  //else location.reload();
  else { start(); }
});



browser.runtime.onMessage.addListener((messageObj, sender) => {
  //console.log("browser.runtime.onMessage listener: ", messageObj);
  if (messageObj === MESSAGE_TYPE_DISABLED) { mode.value = DISABLED; }
});

function storageRetrievalSuccess(settings) {

  if (!settings.proxySettings || !settings.proxySettings.length) {

    // using hide-unimportant class app.css#4575 to show/hide
    // note: all elements are hidden, only need to unhide
    document.querySelector('#spinner').classList.add('hide-unimportant');
    document.querySelector('#error').classList.remove('hide-unimportant');
  }
  else {
    console.log('Proxies found in storage.');
    renderProxies(settings);
    document.querySelector('#spinner').classList.add('hide-unimportant');
    document.querySelector('#accountsRow').classList.remove('hide-unimportant');
  }
}

function storageRetrievalError(error) {

  console.log(`storageRetrievalError(): ${error}`);
  document.querySelector('#error').classList.remove('hide-unimportant');
}

function renderProxies(settings) {

  accounts.textContent = ''; // clearing the content
  [...mode.children].forEach(item => mode.children.length > 2 && item.remove());

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const docfrag2 = document.createDocumentFragment();
  const temp = document.querySelector('.template');

  settings.mode = settings.mode || 'patterns'; // defaults to patterns

  settings.proxySettings.forEach(item => {

    const div = temp.cloneNode(true);
    const node = [...div.children[0].children, ...div.children[1].children];
    div.classList.remove('template');
    item.id == LASTRESORT && div.children[1].classList.add('default');

    div.id = item.id;
    node[0].style.backgroundColor = item.color;
    node[1].textContent = Utils.getNiceTitle(item);
    node[2].textContent = Utils.ellipsis(item.address);
    node[3].id = item.id + '-onoff';
    node[3].checked = item.active;
    node[4].setAttribute('for', node[3].id);

    FOXYPROXY_BASIC && (node[0].style.display = 'none');

    // setting div colors
    switch (true) {

      case Utils.isUnsupportedType(item.type):
        div.classList.add('unsupported-color');
        break;

      case settings.mode === 'patterns':
      case settings.mode === 'random':
      case settings.mode === 'roundrobin':
        div.classList.add(item.active ? 'success' : 'secondary');

      case settings.mode === 'disabled':
        div.classList.add('secondary');

      default:
        div.classList.add(settings.mode == item.id ? 'success' : 'secondary');
    }


    docfrag.appendChild(div);

    // add to select
    const opt = new Option(node[1].textContent, item.id);
    opt.style.color = item.color;
    docfrag2.appendChild(opt);
  });


  docfrag.hasChildNodes() && accounts.appendChild(docfrag);
  docfrag2.hasChildNodes() && mode.insertBefore(docfrag2, mode.firstElementChild);

  const opt = mode.querySelector(`option[value="${settings.mode}"]`);
  if (opt) {
    opt.selected = true;
    mode.style.color = opt.style.color;
  }

  // add Listeners
  document.querySelectorAll('button').forEach(item => item.addEventListener('click', processButton));

  document.querySelectorAll('input[name="onOff"]').forEach(item => item.addEventListener('click', function() {
    const id = this.parentNode.parentNode.id;
    console.log('toggle on/off', id);
    noRefresh = true;
    toggleActiveProxySetting(id).then(() => console.log('toggle done'))
  }));
}

async function processButton() {

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
      location.href = '/add-edit-proxy.html?id=' + Utils.jsonObject2UriComponent(id);
      break;

    case 'patterns':
      location.href = '/patterns.html?id=' + Utils.jsonObject2UriComponent(id);
      break;

    case 'delete|title':
      console.log('delete one proxy setting: ' + id);
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
      setTimeout(() => { target.classList.remove('off'); parent.classList.remove('on'); }, 800);
      noRefresh = true;
 /*     swapProxySettingWithNeighbor(id, target.id).then((settings) => {
        console.log('swapProxySettingWithNeighbor() succeeded');
        renderProxies(settings);
      }).catch((e) => console.error('swapProxySettingWithNeighbor failed: ' + e));*/
      break;
  }
}