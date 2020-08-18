'use strict';

// ----------------- Internationalization ------------------
Utils.i18n();

document.addEventListener('keyup', evt => {
  if (evt.keyCode === 27) {
    // We either came from /options.html or were opened as a new tab from popup.html (in that case, do nothing)
    history.back();
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
let logger;
const onOff = document.querySelector('#onOff');
const logSize = document.querySelector('#logSize');

chrome.runtime.getBackgroundPage(bg => {

  logger = bg.getLog();
  onOff.checked = logger.active;
  logSize.value = logger.size;
  renderMatchedLog(); // log content will be shown if there are any, regardless of onOff
  renderUnmatchedLog();  // log content will be shown if there are any, regardless of onOff
  hideSpinner();
});

onOff.addEventListener('change', (e) => {

  logger.active = onOff.checked;
  logger.updateStorage();
});

logSize.addEventListener('change', (e) => {

  logSize.value = logSize.value*1 || logger.size;           // defaults on bad number entry
  if (logger.size !== logSize.value) {                      // update on change
    logger.size = logSize.value;
    logger.updateStorage();
  }
});

document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));

function process () {

  switch (this.dataset.i18n) {

    case 'back': location.href = '/options.html'; break;
    case 'refresh':
      renderMatchedLog();
      renderUnmatchedLog();
      break;
    case 'clear':
      logger.clear();
      renderMatchedLog();
      renderUnmatchedLog();
      break;
  }
}

function renderMatchedLog() {

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const tr = document.querySelector('tr.matchedtemplate');
  const tbody = tr.parentNode.nextElementSibling;
  tbody.textContent = ''; // clearing the content

  const forAll = chrome.i18n.getMessage('forAll');
  const NA = chrome.i18n.getMessage('notApplicable');
  
  logger.matchedList.forEach(item => {

    const pattern = item.matchedPattern ?
      (item.matchedPattern === 'all' ? forAll : item.matchedPattern) : 'No matches';

    // Build a row for this log entry by cloning the tr containing 7 td
    const row = tr.cloneNode(true);
    row.className = item.matchedPattern ? 'success' : 'secondary'; // this will rest class .tamplate as well
    const td = row.children;

    const a = td[0].children[0];
    a.href = item.url;
    a.textContent = item.url;

    td[1].textContent = item.title || NA;
    td[2].style.backgroundColor = item.color || 'blue';
    td[3].textContent = item.address || NA;
    td[4].textContent = pattern;
    td[5].textContent = item.whiteBlack || NA;
    td[6].textContent = formatInt(item.timestamp);

    docfrag.appendChild(row);
  });

  tbody.appendChild(docfrag);
}

function renderUnmatchedLog() {

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const tr = document.querySelector('tr.unmatchedtemplate');
  const tbody = tr.parentNode.nextElementSibling;
  tbody.textContent = ''; // clearing the content
  
  logger.unmatchedList.forEach(item => {
    // Build a row for this log entry by cloning the tr containing 2 td
    const row = tr.cloneNode(true);
    const td = row.children;
    const a = td[0].children[0];
    
    a.href = item.url;
    a.textContent = item.url;
    td[1].textContent = formatInt(item.timestamp);

    docfrag.appendChild(row);
  });

  tbody.appendChild(docfrag);
}

function formatInt(d) {
  // International format based on user locale
  // you can delete the other function if you like this
  // you can adjust the content via the object properties
  return new Intl.DateTimeFormat(navigator.language,
                  {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(d));
}
