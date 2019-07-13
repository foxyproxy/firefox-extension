'use strict';

getAllSettings().then(popupSuccess, popupError).catch((e) => console.log('exception: ' + e));

function popupSuccess(settings) {
  
  /*if (!proxySettings.length) {
    // Display defaults
    console.log("No proxies found in storage.");
    $("#spinnerRow").hide();
    $("#optionsRow").show();
  }
  else {
    console.log("Proxies found in storage.");*/
    renderOptions(settings);
 // }
}

function popupError(error) {
  
  console.log(`popupError(): ${error}`);
  // using hide-unimportant CSS to show/hide
  document.querySelector('#spinnerRow').classList.add('hide-unimportant');
  document.querySelector('#errorRow').classList.remove('hide-unimportant');
}

function renderOptions(settings) {
  
  console.log('renderOptions() and settings is ' + JSON.stringify(settings));
  const rows = [], ids = [];
  settings.proxySettings.forEach((proxySetting) => {
    const option = Utils.getOption(proxySetting);
    if (option) {
      rows.push(option);
      ids.push(proxySetting.id);
    }
  });

  // using innerHTML & DOMPurify for now, to fix later
  document.querySelector('#menuInsertPoint').innerHTML = DOMPurify.sanitize(rows.join(""), {SAFE_FOR_JQUERY: true});
  


  const mode = settings.mode ? settings.mode : PATTERNS;
  // <span id="patternsSelected"></span>
  // no need to replace node, using CSS on the same node
  let target;
  switch (mode) {

    case 'PATTERNS': target = '#patternsSelected'; break;
    case 'DISABLED': target = '#disabledSelected'; break;
    default: target = '#' + mode + 'Selected';
  }

  const node = document.querySelector(target);
  node.className = 'fa fa-check';
  node.setAttribute('style', 'color: green; font-style: italic; margin-right: 0.5em;');

  FOXYPROXY_BASIC && document.querySelector('#patternsListItem').classList.add('hide-unimportant');
  installListeners(ids);

  // using hide-unimportant CSS to show/hide
  document.querySelector('#spinnerRow').classList.add('hide-unimportant');
  document.querySelector('#optionsRow').classList.remove('hide-unimportant');
}

function installListeners(ids) {
  
  document.querySelector('#options').addEventListener('click', (e) => {
    Utils.showInternalPage('proxies').then(window.close);
  });
  
  // no need for active: true, both FF & CH default to true
  document.querySelector('#where').addEventListener('click', (e) => {
    browser.tabs.create({url: 'https://getfoxyproxy.org/geoip/'}).then(window.close);
  });  

  document.querySelector('#log').addEventListener('click', (e) => {
    Utils.showInternalPage('log').then(window.close);
  });

  document.querySelectorAll('#patterns, #disabled, #' + ids.join(', #')).forEach(item => {
    item.addEventListener('click', function(e) { setMode(this.id).then(window.close); });
  });
}


/*
// This function was nested in above
// It doesn't seem to be used anywhere

function enableOrDisable(active, evt) {
  evt.preventDefault();
  $("#optionsRow").hide();
  $("#spinnerRow").show();
  enableDisableAllProxySettings(active).then((proxySettings) => {
    let windows = browser.extension.getViews({type: "tab"});
    for (let w of windows)
      w.location.reload();
    popupSuccess(proxySettings);
  }, popupError);
}
*/
