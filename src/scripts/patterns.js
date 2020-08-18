'use strict';

// ----------------- Internationalization ------------------
Utils.i18n();

document.addEventListener('keyup', evt => {
  if (evt.keyCode === 27) {
    history.back(); // We either came from /proxy.html or /options.html
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

// ----- global
let proxy = {};
const header = document.querySelector('.header');
const tbody = document.querySelectorAll('tbody');         // there are 2
const template = document.querySelector('tr.template');
const docfrag = document.createDocumentFragment();

const defaultPattern = {
  title: '',
  active: true,
  pattern: '',
  type: 1,                  // PATTERN_TYPE_WILDCARD,
  protocols: 1              // PROTOCOL_ALL
};


const protocolSet = {                                     // converting to meaningful terms
  1: 'All',
  2: 'HTTP',
  4: 'HTTPS'
};

const patternTypeSet = {
  1: 'wildcard',
  2: 'Reg Exp'
}

// ----- check for Edit
const id = localStorage.getItem('id');
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

  switch (this.dataset.i18n) {

    case 'back':                                            // error
    case 'cancel':
      location.href = '/options.html';
      break;

    case 'exportPatterns': exportPatterns(); break;

    case 'newWhite':
       addNew(tbody[0], 'whitePatterns');
      break;

    case 'newBlack':
      addNew(tbody[1], 'blackPatterns');
      break;

    case 'save':
      checkOptions();
      break;

    case 'add':
      if (typeof(this.dataset.black) !== 'undefined') {
        proxy.blackPatterns.push(...blacklistSet);
        processOptions();
      }
      else {
        proxy.whitePatterns.push(PATTERN_ALL_WHITE);
        processOptions();
      }
      break;
  }
}

function processOptions() {

  // clearing the content
  tbody[0].textContent = '';
  tbody[1].textContent = '';

  proxy.whitePatterns.forEach((item, index) => docfrag.appendChild(makeRow(item, index, 'whitePatterns')));
  docfrag.hasChildNodes() && tbody[0].appendChild(docfrag);

  proxy.blackPatterns.forEach((item, index) => docfrag.appendChild(makeRow(item, index, 'blackPatterns')));
  docfrag.hasChildNodes() && tbody[1].appendChild(docfrag);

}

function makeRow(pat, index, bw) {

  const tr = template.cloneNode(true);
  tr.classList.remove('template');
  tr.classList.add(pat.active ? 'success' : 'secondary');
  tr.dataset.idx = index;
  tr.dataset.bw = bw;                                       // black/white
  const td = tr.children;


  td[0].children[0].value = pat.title;
  td[1].children[0].value = pat.pattern;
  td[2].children[0].value = pat.type;
  td[3].children[0].value = pat.protocols;
  td[4].children[0].checked = pat.active;
  td[4].children[0].id = bw + index;
  td[4].children[1].setAttribute('for', td[4].children[0].id);

  pat.importedPattern && td[5].children[0].classList.remove('hide');

  // add Listeners();
  [...td[5].children].forEach(item => item.addEventListener('click', processEdit));

  return tr;
}

function addNew(parent, bw) {

  const tr = makeRow(defaultPattern, parent.children.length, bw);
  parent.appendChild(tr);
  tr.children[1].children[0].focus();
}

function processEdit() {

  const parent = this.parentNode.parentNode;
  const idx = parent.dataset.idx *1;
  const patternsArray = proxy[parent.dataset.bw];           // whitePatterns | blackPatterns

  switch (this.dataset.i18n) {

    case 'imported|title':
      alert(chrome.i18n.getMessage('importedPattern') + ' \n\n' + patternsArray[idx].importedPattern);
      break;

    case 'patternTester|title':
      const pat = patternsArray[idx];
      if (pat) {
        localStorage.setItem('pattern', pat.pattern);
        localStorage.setItem('type', pat.type);
        localStorage.setItem('protocols', pat.protocols);
      }
      chrome.tabs.create({url: '/pattern-tester.html'});
      break;

    case 'delete|title':
      parent.style.opacity = 0;
      setTimeout(() => { parent.remove(); }, 300);          // remove row
      break;
  }
}


function checkOptions() {

  const pxy = {
    whitePatterns: [],
    blackPatterns: []
  };
  
  // use for loop to be able to return early on error
  for (const item of document.querySelectorAll('tr[data-idx]')) {

    const td = item.children;

    // --- trim text values
    [td[0].children[0], td[1].children[0]].forEach(item => item.value = item.value.trim());

    // test pattern
    const regex = testPattern(td[1].children[0], td[2].children[0]);
    if (!regex) { return; }

    const bw = item.dataset.bw;
    pxy[bw].push({
      title: td[0].children[0].value,
      pattern: td[1].children[0].value,
      type: td[2].children[0].value *1,
      protocols: td[3].children[0].value *1,
      active: td[4].children[0].checked
    });
  }

  // all patterns passed
  proxy.whitePatterns = pxy.whitePatterns;
  proxy.blackPatterns = pxy.blackPatterns;
  storageArea.set({[id]: proxy}, () => location.href = '/options.html');
}


function testPattern(pattern, type) {

  // --- reset
  pattern.classList.remove('invalid');
  result.classList.add('hide');
  result.classList.remove('alert');

  // --- pattern check
  return checkPattern(pattern, type);
}



function exportPatterns() {

  const tmpObject = {whitePatterns: proxy.whitePatterns, blackPatterns: proxy.blackPatterns};
  const blob = new Blob([JSON.stringify(tmpObject, null, 2)], {type : 'text/plain'});
  const filename = 'foxyproxy' + (proxy.title ? '-' + proxy.title : '')  + '-patterns' + '_' + new Date().toISOString().substring(0, 10) + '.json';
  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename,
    saveAs: true,
    conflictAction: 'uniquify'
  }, () => console.log('Export/download finished'));        // wait for it to complete before returning
}


document.getElementById('file').addEventListener('change', processFileSelect);
function processFileSelect(e) {

  const file = e.target.files[0];

  Utils.importFile(file, ['application/json'], 1024*1024*5, 'json', imported => {
    proxy.whitePatterns = imported.whitePatterns;
    proxy.blackPatterns = imported.blackPatterns;
    processOptions();
    Utils.notify(chrome.i18n.getMessage('importBW', [proxy.whitePatterns.length, proxy.blackPatterns.length]));
  });
}
