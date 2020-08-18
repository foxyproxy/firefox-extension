'use strict';

// ----------------- Internationalization ------------------
Utils.i18n();

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
document.querySelectorAll('input[type="file"]').forEach(item => item.addEventListener('change', process));

function process(e) {

  switch (this.id || this.dataset.i18n) {
    // click
    case 'back': close(); break;
    case 'export': Utils.exportFile(); break;

    case 'togglePW|title':
      const inp = this.previousElementSibling;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      break;

    // change
    case 'importFP':
      showSpinner();
      foxyProxyImport();
      break;

    case 'importJson':
      showSpinner();
      Utils.importFile(e.target.files[0], ['application/json'], 1024*1024*10, 'json', importJson); // 10mb
      hideSpinner(); // hide spinner in case importJson() was not called due to error
      break;
    case 'importXml':
      showSpinner();
      Utils.importFile(e.target.files[0], ['text/xml'], 1024*1024*10, 'xml', importXml);  // 10mb
      hideSpinner(); // hide spinner in case importXml() was not called due to error
      break;
  }
}

function importJson(result) {

  if (!result) {                                            // user cancelled
    hideSpinner();
    return;
  }

  // --- convert pre v7.0 export to db format
  if (result.hasOwnProperty('proxySettings')) {
    result = prepareForStorage(result);
  }

  save(result, end);
}

function save(result, callback) {

  // Remove 'browserVersion', 'foxyProxyVersion', 'foxyProxyEdition' if they exist
  // We don't need those imported.
  delete result.browserVersion;
  delete result.foxyProxyVersion;
  delete result.foxyProxyEdition;

  const  storageArea = result.sync ? chrome.storage.sync : chrome.storage.local;

  // clear the storages and set new
  chrome.storage.local.clear(() => chrome.storage.sync.clear(() => {

    if (result.sync) {
      chrome.storage.local.set({sync: true});               // save sync state
      delete result.sync;
    }

    storageArea.set(result, callback);                      // save to target
  }));
}


function end() {
  hideSpinner();
  Utils.notify(chrome.i18n.getMessage('importEnd'));
  location.href = '/options.html';
}


function importXml(doc) {

  let lastResortFound = false;
  // base format
  const pref = {
    mode: 'disabled',
    logging: {
      size: 100,
      active: false
    }
  };

  const FP = doc.querySelector('foxyproxy');
  if (!FP) {
    // Don't use Utils.notify() because at least on macOS,
    // the message is too long and cut off
    alert('There is an error with the XML file (missing <foxyproxy ....>)');
    hideSpinner();
    return;
  }

  const mode = FP.getAttribute('mode');
  mode && (pref.mode = mode);

  const badModes = [];

  const proxies = doc.getElementsByTagName('proxy');
  let patternsEdited = false;

  const LASTRESORT = 'k20d21508277536715';
  const DEFAULT_PROXY_SETTING = {
    index: Number.MAX_SAFE_INTEGER,
    id: LASTRESORT,
    active: true,
    title: 'Default',
    notes: 'These are the settings that are used when no patterns match a URL.',
    color: '#0055E5',
    type: PROXY_TYPE_NONE,
    whitePatterns: [PATTERN_ALL_WHITE],
    blackPatterns: []
  };

  doc.querySelectorAll('proxy').forEach((item, index) => {

    const proxy = {};
    // type a.k.a. mode
    const oldType = item.getAttribute('mode');
    // Deactivate from patterns mode any unsupported types/modes
    const allowedType = ['manual', 'direct'].includes(oldType);
    proxy.active = allowedType ? item.getAttribute('enabled') === 'true' : false;
    // switch is faster than a series of if/else
    switch (oldType) {

      case 'system':
        badModes.push(item);
        proxy.type = PROXY_TYPE_SYSTEM;
        break;

      case 'auto':
        badModes.push(item);
        if (item.getAttribute('autoconfMode') === 'pac') { // PAC
          proxy.type = PROXY_TYPE_PAC;
          proxy.pacURL = item.querySelector('autoconf').getAttribute('url');
        }
        else {                                              // WPAD
          proxy.type = PROXY_TYPE_WPAD;
          proxy.pacURL = 'http://wpad/wpad.dat';
        }
        break;

      case 'direct':
        proxy.type = PROXY_TYPE_NONE;
        break;

      case 'manual':
        const manualconf = item.querySelector('manualconf');
        proxy.address = manualconf.getAttribute('host');
        proxy.port = parseInt(manualconf.getAttribute('port'));
        proxy.username = manualconf.getAttribute('username');
        proxy.password = manualconf.getAttribute('password');
        // There appears to be a bug in 4.6.5 and possibly earlier versions: socksversion is always 5, never 4
        if (manualconf.getAttribute('isSocks') === 'true') {
          proxy.type = PROXY_TYPE_SOCKS5;
          if (item.getAttribute('proxyDNS') === 'true') { proxy.proxyDNS = true; }
        }
        else if (manualconf.getAttribute('isHttps') === 'true') { proxy.type = PROXY_TYPE_HTTPS; }
        else { proxy.type = PROXY_TYPE_HTTP; }
        break;
    }

    proxy.title = item.getAttribute('name');
    proxy.color = item.getAttribute('color');

    let newId;
    const oldId = item.getAttribute('id');
    if (item.getAttribute('lastresort') === 'true') {
      lastResortFound = true;
      newId = LASTRESORT;                                   // this is a string
      proxy.index = Number.MAX_SAFE_INTEGER;
      if (!allowedType) { proxy.type = PROXY_TYPE_NONE; }
    }
    else {
      proxy.index = index;
      newId = 'import-' + oldId;
    }

    if (pref.mode === oldId) {
      // If the old top-level mode points to a proxy setting with an unsupported mode (e.g. WPAD),
      // we have to change the new top-level mode otherwise nothing will work w/o user intervention
      pref.mode = !allowedType ? PROXY_TYPE_NONE : newId;   // Update mode to the new id ("import-" prefix)
    }
    proxy.whitePatterns = [];
    proxy.blackPatterns = [];

    item.querySelectorAll('match').forEach(mtch => {

      const newPattern = {};
      /*
        "whitePatterns": [
          {
            "title": "all URLs",
            "active": true,
            "pattern": "*",
            "type": 1,
            "protocols": 1
          }
        ]

      */
      newPattern.title = mtch.getAttribute('name');
      newPattern.active = mtch.getAttribute('enabled') === 'true';
      newPattern.importedPattern = newPattern.pattern = mtch.getAttribute('pattern');
      newPattern.type = mtch.getAttribute('isRegEx') === 'true' ? PATTERN_TYPE_REGEXP : PATTERN_TYPE_WILDCARD;
      // Do some simple parsing but only for wildcards. Anything else is going to fail.
      if (newPattern.type === PATTERN_TYPE_WILDCARD) {

        switch (true) {

          case newPattern.pattern.startsWith('http://'):
            newPattern.protocols = PROTOCOL_HTTP;
            newPattern.pattern = newPattern.pattern.substring(7);
            break;

          case newPattern.pattern.startsWith('https://'):
            newPattern.protocols = PROTOCOL_HTTPS;
            newPattern.pattern = newPattern.pattern.substring(8);
            break;

          case newPattern.pattern.startsWith('*://'):
            newPattern.protocols = PROTOCOL_ALL;
            newPattern.pattern = newPattern.pattern.substring(4);
            break;

          default:
            newPattern.protocols = PROTOCOL_ALL;
        }

        // Clip everything after slashes; it can't be used anymore: https://bugzilla.mozilla.org/show_bug.cgi?id=1337001
        const idx = newPattern.pattern.indexOf('/');
        if (idx > -1) {
          newPattern.pattern = newPattern.pattern.substring(0, idx);
          patternsEdited = true;
        }
      }
      else { // e.g. ^https?://(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\.\d+\.\d+\.\d+)(?::\d+)?(?:/.*)?$

        switch (true) {

          case newPattern.pattern.indexOf('^http://') === 1:
            newPattern.protocols = PROTOCOL_HTTP;
            newPattern.pattern = '^' + newPattern.pattern.substring(8);
            break;

          case newPattern.pattern.indexOf('^https://') === 1:
            newPattern.protocols = PROTOCOL_HTTPS;
            newPattern.pattern = '^' + newPattern.pattern.substring(9);
            break;

          case newPattern.pattern.indexOf('^https?://') === 1:
            newPattern.protocols = PROTOCOL_ALL;
            newPattern.pattern = '^' + newPattern.pattern.substring(10);
            break;

          default:
            newPattern.protocols = PROTOCOL_ALL;
        }
      }

      mtch.getAttribute('isBlackList') === 'true' ? proxy.blackPatterns.push(newPattern) : proxy.whitePatterns.push(newPattern);
    });

    pref[newId] = proxy;
  });

  if (!lastResortFound) { pref[LASTRESORT] = DEFAULT_PROXY_SETTING; }

  save(pref, () => endXML(patternsEdited));
}

function endXML(patternsEdited) {

  hideSpinner();
  if (patternsEdited) {
    // Don't use Utils.notify() because at least on macOS,
    // the message is too long and cut off
    alert(chrome.i18n.getMessage('patternsChanged'));
    location.href = '/options.html';
  }
  else {
    // Don't use Utils.notify() because at least on macOS,
    // the message is too long and cut off
    alert(chrome.i18n.getMessage('importEndSlash'));
    location.href = '/options.html';
  }
}


function prepareForStorage(settings) {

  if (!settings.hasOwnProperty('proxySettings') || !settings.proxySettings[0]) {
    alert('Imported file doesn not have any proxies.');
    return null;
  }

  // base format
  const ret = {
    mode: 'disabled',
    logging: {
      size: 100,
      active: false
    }
  };

  settings.mode && (ret.mode = settings.mode);
  settings.logging && (ret.logging = settings.logging);

  let idx = 0;
  settings.proxySettings.forEach(item => {

    const id = item.id;
    item.index = idx++;
    delete item.id;                                         // Don't need id
    ret[id] = item;
  });

  return ret;
}


// ----------------- FoxyProxy Import ----------------------
function foxyProxyImport() {

  // ---  check user/pass
  const username = document.querySelector('#username').value.trim();
  const password = document.querySelector('#password').value.trim();
  if (!username || !password) {
    hideSpinner();
    alert(chrome.i18n.getMessage('errorUserPass'));
    return;
  }

  // --- generate the form post data
  const usernamePassword = { 'username': username, 'password': password };
  const formBody = [];
  for (const property in usernamePassword) {
  const encodedKey = encodeURIComponent(property);
  const encodedValue = encodeURIComponent(usernamePassword[property]);
  formBody.push(encodedKey + "=" + encodedValue);
  }

  // --- fetch data
  fetch('https://getfoxyproxy.org/webservices/get-accounts.php',
  {	method: 'POST',
  body: formBody.join("&"),
  headers: {
  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
  }
  })
  .then(response => response.json())
  .then(response => {
    if (!Array.isArray(response) || !response[0] || !response[0].hostname) {
      hideSpinner();
      Utils.notify(chrome.i18n.getMessage('errorFetch'));
      return;
    }

    const sync = localStorage.getItem('sync') === 'true';
    const storageArea = !sync ? chrome.storage.local : chrome.storage.sync;
    storageArea.get(null, result => {

      response.forEach(item => {
      const hostname = item.hostname.substring(0, item.hostname.indexOf('.getfoxyproxy.org'));

       if (hostname && item.ipaddress && item.port && item.port[0] && item.country_code && item.country) {

          // --- creating proxy
          result[Math.random().toString(36).substring(7) + new Date().getTime()] = {
            index: -1,
            active: item.active,
            title: hostname,
            color: '#ff9900',
            type: 1,                                          // HTTP
            address: item.ipaddress,
            port: item.port[0],
            username: item.username,
            password: item.password,
            cc: item.country_code,
            country: item.country,
            whitePatterns: [],
            blackPatterns: []
          };
        }
      });

      storageArea.set(result, end);                         // save to target
    });
  })
  .catch(error => {
    hideSpinner();
    Utils.notify(chrome.i18n.getMessage('errorFetch'));
  });

}
// ----------------- /FoxyProxy Import ---------------------

function close() {
  document.querySelector('#password').value = ''; /* prevent Firefox's save password prompt */
  location.href = '/options.html';
}
