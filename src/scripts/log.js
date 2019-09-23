'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

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
  renderLog(); // log content will be shown if there are any, regardless of onOff
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
    case 'refresh': renderLog(); break;
    case 'clear':
      logger.clear();
      renderLog();
      break;
  }
}

function renderLog() {

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const tr = document.querySelector('tr.template');
  const tbody = tr.parentNode.nextElementSibling;
  tbody.textContent = ''; // clearing the content

  const forAll = chrome.i18n.getMessage('forAll');;

  logger.list.forEach(item => {

    const pattern = item.matchedPattern ?
      (item.matchedPattern === 'all' ? forAll : item.matchedPattern.pattern) : 'No matches';

    // Build a row for this log entry by cloning the tr containing 6 td
    const row = tr.cloneNode(true);
    row.className = item.matchedPattern ? 'success' : 'secondary'; // this will rest class .tamplate as well
    const td = row.children;

    const a = td[0].children[0];
    a.href = item.url;
    a.textContent = item.url;

    td[1].textContent = item.title || 'n/a';
    td[2].style.backgroundColor = item.color || 'blue';
    td[3].textContent = item.address || 'n/a';
    td[4].textContent = pattern;
    td[5].textContent = formatInt(item.timestamp);

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
