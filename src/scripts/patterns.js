'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

// ----- global
let proxy = {};
vex.defaultOptions.className = 'vex-theme-default';

const header = document.querySelector('.header');

// ----- check for Edit
let id = localStorage.getItem('id');
const sync = localStorage.getItem('sync') === 'true';
const storageArea = !sync ? chrome.storage.local : chrome.storage.sync;
if (id) { // This is an edit operation

  storageArea.get(id, result => {

    if (!Object.keys(result).length) {

      if (id === LASTRESORT) {                              // error prevention
        proxy = DEFAULT_PROXY_SETTING;
        processOptions();
        return;
      }
      console.error('Unable to edit saved proxy (could not get existing settings)')
      return;
    }

    proxy = result[id];    
    if (proxy.title) { header.textContent = chrome.i18n.getMessage('editPatternsFor', proxy.title); }
    processOptions();
    hideSpinner();
  })
}
/*
else {
  // Error, shouldn't ever get here
  hideSpinner();
  document.querySelector('#error').classList.remove('hide');
  document.querySelector('.main').classList.add('hide');
  console.error("2: Unable to read saved proxy proxy (could not get existing settings)");
}*/

// --- processing all buttons
document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));

function process() {

  const PATTERN_NEW = {
    title: '',
    active: true,
    pattern: "",
    type: PATTERN_TYPE_WILDCARD,
    protocols: PROTOCOL_ALL
  };


  switch (this.dataset.i18n) {

    case 'back':                                            // error
    case 'cancel':
      location.href = '/options.html';
      break;

    case 'importPatterns': importPatterns(); break;
    case 'exportPatterns': exportPatterns(); break;

    // Make a copy of PATTERN_NEW and pass it to the vex dialog.
    // Note that openDialog() returns immediately even though the dialog is modal
    // so adding of the pattern info to the patterns array must be done in openDialog(), not here.
    case 'newWhite': openDialog(PATTERN_NEW, true, proxy.whitePatterns); break;
    case 'newBlack': openDialog(PATTERN_NEW, true, proxy.blackPatterns); break;
    case 'save':
      storageArea.set({[id]: proxy}, () => location.href = '/options.html');
      break;

    case 'add':
      proxy.blackPatterns.push(PATTERN_LOCALHOSTURLS_BLACK, PATTERN_INTERNALIPS_BLACK, PATTERN_LOCALHOSTNAMES_BLACK);
      processOptions();
      document.getElementById(proxy.blackPatterns.length-1).scrollIntoView({behavior: 'smooth'});
      break;
  }
}

function processEdit() {
  
  const parent = this.parentNode.parentNode;
  const idx = parent.dataset.idx *1;
  const patternsArray = this.parentNode.dataset.bw === 'white' ? proxy.whitePatterns : proxy.blackPatterns;

  switch (this.dataset.i18n) {

    case 'imported|title':
      alert(chrome.i18n.getMessage('importedPattern') + ' \n\n' + patternsArray[idx].importedPattern);
      break;

    case 'edit|title':
      openDialog(patternsArray[idx]);
      break;

    case 'delete|title':
      patternsArray.splice(idx, 1);
      parent.style.opacity = 0;
      setTimeout(() => { parent.remove(); }, 600);          // remove row                
      break;
  }
}


function processOptions() {

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const tr = document.querySelector('tr.template');
  const tbody = document.querySelectorAll('tbody');         // there are 2
  tbody[0].textContent = '';                                // clearing the content
  tbody[1].textContent = '';                                // clearing the content

  proxy.whitePatterns.forEach((item, index) => docfrag.appendChild(makeRow(item, index, tr, 'white')));
  docfrag.hasChildNodes() && tbody[0].appendChild(docfrag);

  proxy.blackPatterns.forEach((item, index) => docfrag.appendChild(makeRow(item, index, tr, 'black')));
  docfrag.hasChildNodes() && tbody[1].appendChild(docfrag);

  // add Listeners();
  document.querySelectorAll('td a').forEach(item => item.addEventListener('click', processEdit));
}

function makeRow(patternObj, index, template, bw) {

  const tr = template.cloneNode(true);
  tr.classList.remove('template');
  tr.classList.add(patternObj.active ? 'success' : 'secondary');
  tr.dataset.idx = index;
  const td = tr.children;

  let protocol = patternObj.protocols || 0; // testing if it was set
  switch (patternObj.protocols) {

    case PROTOCOL_ALL: protocol = 'both'; break;
    case PROTOCOL_HTTP: protocol = 'HTTP'; break;
    case PROTOCOL_HTTPS: protocol = 'HTTPS'; break;
  }

  td[0].title = patternObj.title || '\u00A0'; // Unicode &nbsp;  // ellipsis is handled by CSS, data filled by CSS
  td[1].title = patternObj.pattern;  // ellipsis is handled by CSS
  td[2].textContent = patternObj.type == PATTERN_TYPE_WILDCARD ? 'Wildcard': 'Reg Exp';
  td[3].textContent = protocol;
  td[4].textContent = patternObj.active ? 'On' : 'Off';
  td[5].dataset.bw = bw; // black/white
  patternObj.importedPattern && td[6].children[2].classList.remove('hide');

  return tr;
}


function openDialog(pat, isNew, patternArray) {

  vex.dialog.buttons.YES.className = 'button';
  //vex.dialog.buttons.YES.text = 'Save';
  vex.dialog.buttons.NO.className = 'button alert';
  vex.dialog.open({
    message: 'Pattern Details',
    input: `
    <style>
      .vex-custom-field-wrapper {
        margin-bottom: .5rem;
      }
    </style>
    <div class="prime alert" style="margin-top: 1em;">
      Because of <a target="_blank" href="https://bugzilla.mozilla.org/show_bug.cgi?id=1337001">Firefox limitations</a>, only domains, subdomains, and ports are recognized in patterns. Do not use paths or query parameters in patterns. Example: <strong>*.foxyproxy.com:30053</strong> is OK but not <strong>*.foxyproxy.com:30053/help/*</strong><!-- */ -->
    </div>
    <div class="vex-custom-field-wrapper">
        <label for="name" class="bold">Pattern Name (optional)</label>
        <div class="vex-custom-input-wrapper">
            <input name="title" type="edit" style="width: 100%" value="${pat.title ? pat.title : ""}"/>
        </div>
    </div>
    <div class="vex-custom-field-wrapper">
        <label for="pattern" class="bold">Pattern &mdash; <a href="/pattern-help.html" target="_blank">Pattern Help</a> |
          <a id="tester">Pattern Tester</a></label>
        <input name="pattern" type="edit" style="width: 100%" value="${pat.pattern}"/>
    </div>

    <div class="vex-custom-field-wrapper">
        <div class="vex-custom-input-wrapper">
          <label class="bold">Is the pattern a wildcard or regular expression?</label>
          <label style="display: inline">Wildcard <input name="type" type="radio" value="${PATTERN_TYPE_WILDCARD}"
            ${pat.type == PATTERN_TYPE_WILDCARD ? `checked` : `` }/></label>
          <label style="display: inline">Regular Expression <input name="type" type="radio" value="${PATTERN_TYPE_REGEXP}"
            ${pat.type == PATTERN_TYPE_REGEXP ? `checked` : `` }/></label>
        </div>
    </div>
    <div class="vex-custom-field-wrapper">
        <div class="vex-custom-input-wrapper">
          <label class="bold">Use Pattern For Which Protocols?</label>
          <select name="protocols">
            <option value="${PROTOCOL_ALL}">https and http</option>
            <option value="${PROTOCOL_HTTP}">http</option>
            <option value="${PROTOCOL_HTTPS}">https</option>
          </ul>
        </select>
    </div>
    <div class="vex-custom-field-wrapper">
      <div class="vex-custom-input-wrapper">
      <label class="bold">Enable/Disable the Pattern</label> <input id="active" name="active" class="switch-input" type="checkbox" ${pat.active ? `checked` : `` }>
      <label class="switch-paddle" for="active">
        <span class="show-for-sr">On/Off</span>
        <span class="switch-active bold" aria-hidden="true" style="color: white">On</span>
        <span class="switch-inactive bold fp-orange" aria-hidden="true">Off</span>
      </label>
      </div>
    </div>`,

    callback: function(data) {
      if (data) {
        // Not cancelled
        // data has .title, .pattern, .type, .protocols, and .onOff (values on or off)
        pat.title = data.title.trim();
        pat.pattern = data.pattern.trim();
        pat.type = parseInt(data.type);
        pat.protocols = parseInt(data.protocols);
        pat.active = data.active === 'on';
        if (isNew) { patternArray.push(pat); }
        processOptions();
      }
    },

    beforeClose: function() {
      // |this| is vex instance
      if (!this.value) { return true; }                     // Cancel button was clicked

      const pat = this.value.pattern.trim();
      if (!pat) {
        alert(chrome.i18n.getMessage('errorPattern'));
        return false;
      }
      return true;
    }
  });

  document.querySelector('#tester').addEventListener('click', () => {

      localStorage.setItem('pattern', pat.pattern);
      localStorage.setItem('type', pat.type);
      localStorage.setItem('protocols', pat.protocols);
      chrome.tabs.create({url: '/pattern-tester.html'});
  });
}

function exportPatterns() {

  const tmpObject = {whitePatterns: proxy.whitePatterns, blackPatterns: proxy.blackPatterns};
  const blob = new Blob([JSON.stringify(tmpObject, null, 2)], {type : 'text/plain'});
  const filename = 'foxyproxy-patterns.json';
  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename,
    saveAs: true
  }, () => console.log('Export/download finished'));        // wait for it to complete before returning
}

function importPatterns() {

// vex.dialog used in options.js & pattern.js

  vex.dialog.buttons.YES.className = 'button';
  vex.dialog.buttons.NO.className = 'button alert';
  vex.dialog.alert({
    message: 'Import Patterns',
    input: `
    <style>
      .vex-custom-field-wrapper {
        margin-bottom: .5rem;
      }
    </style>
    <div class="prime alert">
      <input id="importFileSelected" type="file" accept=".json">
    </div>`
  });

  document.querySelector('#importFileSelected').addEventListener('change', (e) =>
    importFileSelected(e.target.files[0], ['application/json'], 1024*1024*5)); // 5mb
}

function importFileSelected(file, mimeTypeArr, maxSizeBytes) {

  Utils.importFile(file, mimeTypeArr, maxSizeBytes, 'json', (allPatterns) => {
    proxy.whitePatterns = allPatterns.whitePatterns;
    proxy.blackPatterns = allPatterns.blackPatterns;
    vex.closeTop();
    processOptions();
    Utils.notify(chrome.i18n.getMessage('importBW', proxy.whitePatterns.length, proxy.blackPatterns.length));
  });
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