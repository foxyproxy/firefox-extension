'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

//getAllSettings().then(popupSuccess, popupError).catch((e) => console.log('exception: ' + e));

// ----------------- User Preference -----------------------
chrome.storage.local.get(null, result => {
  if (!result.sync) { // sync is NOT set or it is false, use this result
    renderOptions(prepareForSettings(result)); 
    return;
  }
  chrome.storage.sync.get(null, result => { // sync is set
    renderOptions(prepareForSettings(result));;       
  });
});
// ----------------- /User Preference ---------------------- 

function popupSuccess(settings) {

  renderOptions(settings);
}

function popupError(error) {

  console.log(`popupError(): ${error}`);
  // using hide class app.css#4575 to show/hide
  // note: all elements are hidden, only need to unhide
  document.querySelector('#error').classList.remove('hide');
}

function renderOptions(settings) {

  //console.log('renderOptions() and settings is ' + JSON.stringify(settings));

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const temp = document.querySelector('li.template');
  
  settings.proxySettings.forEach(item => {

    if (!Utils.isUnsupportedType(item.type)) { // if supported

      const li = temp.cloneNode(true);
      li.classList.remove('template');
      li.id = item.id;
      li.style.color = item.color;
      li.id = item.id;
      li.appendChild(document.createTextNode(item.title || `${item.address}:${item.port}`));

      docfrag.appendChild(li);
    }
  });

  docfrag.hasChildNodes() && temp.parentNode.insertBefore(docfrag, temp.nextElementSibling);

  // <span id="patternsSelected"></span>
  // no need to replace node, using CSS on the same node
  // HTML is set to the exact PATTERNS/DISABLED (patterns/disabled) so no need to re-evalute
  // default set to 'patterns'
  const node = document.getElementById(settings.mode || 'patterns'); // querySelector error with selectors starting with number
  node.classList.add('on');

  if (FOXYPROXY_BASIC) { 
    document.querySelectorAll('h6, #patterns').forEach(item => item.style.display = 'none');
  }

  // add Listeners
  document.querySelectorAll('li, button').forEach(item => item.addEventListener('click', process));

  // using hide class app.css#4575 to show/hide
  document.querySelector('#optionsRow').classList.remove('hide');
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
      //setMode(this.id).then(window.close);
      setMode(this.id); // keep it open for more action
      // reset the old one
      const old = document.querySelector('.on');      
      old &&  old.classList.remove('on');
      this.classList.add('on');
      
      // popup & options are the only place that can set mode
      // sneding message to option, if it is open
      chrome.runtime.sendMessage({mode: this.id});
  }
}
