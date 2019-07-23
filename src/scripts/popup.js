'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

getAllSettings().then(popupSuccess, popupError).catch((e) => console.log('exception: ' + e));

function popupSuccess(settings) {

  renderOptions(settings);
/*
  if (!proxySettings.length) {
    // Display defaults
    console.log("No proxies found in storage.");
    $("#spinner").hide();
    $("#optionsRow").show();
  }
  else {
    console.log("Proxies found in storage.");
    renderOptions(settings);
  }
*/
}

function popupError(error) {

  console.log(`popupError(): ${error}`);
  // using hide-unimportant class app.css#4575 to show/hide
  // note: all elements are hidden, only need to unhide
  document.querySelector('#error').classList.remove('hide-unimportant');
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
      //a.appendChild(document.createTextNode(chrome.i18n.getMessage('modeDedicated', Utils.getNiceTitle(item))));
      li.appendChild(document.createTextNode(Utils.getNiceTitle(item)));

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

  // using hide-unimportant class app.css#4575 to show/hide
  document.querySelector('#optionsRow').classList.remove('hide-unimportant');
}

async function process() {

  let tabs;
  switch (this.dataset.i18n) {

    case 'myIP':
      browser.tabs.create({url: 'https://getfoxyproxy.org/geoip/'}); // no need to wait for it
      window.close();
      break;

    case 'log':
      const url = browser.runtime.getURL('log.html');
      tabs = await browser.tabs.query({url}); // find a log tab
      tabs[0] ? browser.tabs.update(tabs[0].id, {active: true}) : browser.tabs.create({url}); // active existing tab OR open new tab
      window.close();
      break;
      
    case 'options':
      tabs = await browser.tabs.query({url: browser.runtime.getURL('') + '*'});
      if (!tabs[0]) { 
        browser.runtime.openOptionsPage();
        window.close();
        break;
      }
      
      const tab = tabs.find(item => /(add-edit-proxy|options|patterns)\.html/.test(item.url));  // find a option tab
      tab ? browser.tabs.update(tab.id, {active: true}) : browser.tabs.update(tabs[0].id, {active: true, url: '/options.html'});
      window.close();
      break;

    default:
      //setMode(this.id).then(window.close);
      setMode(this.id); // keep it open for more action
      // reset the old one
      const old = document.querySelector('.on');      
      old &&  old.classList.remove('on');
      this.classList.add('on');
  }
}
