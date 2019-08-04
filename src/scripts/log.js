'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

// ----- global
let newLog;
const onOff = document.querySelector('#onOff');

chrome.runtime.getBackgroundPage(bg => {

  newLog = bg.getLog();
  onOff.checked = newLog.active;
  renderLog(); // log content will be shown if there are any, regardless of onOff
  hideSpinner();
});

function hideSpinner() {

  const spinner = document.querySelector('#spinner');
  spinner.classList.remove('on');
  setTimeout(() => { spinner.style.display = 'none'; }, 600);
}


onOff.addEventListener('change', (e) => {

  const isON = onOff.checked;
  //console.log("user changed logging to " + isON);
  const logging = {
    size: 500,
    active: isON
  };
  isON && renderLog(); // redisplay log when clicking ON

  chrome.storage.local.get(null, result => {
    !result.sync ? chrome.storage.local.set({logging}) : chrome.storage.sync.set({logging});
  });
  // better not clearing the log, user might temporary want to diable, use clear button to clear
});

document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));

function process () {

  switch (this.dataset.i18n) {

    case 'back': location.href = '/options.html'; break;
    case 'refresh': renderLog(); break;
    case 'clear':
      newLog.clear();
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

  newLog.elements.forEach(item => {

    const pattern = item.matchedPattern ?
      (item.matchedPattern === 'all' ? 'Proxy for all URLs' : item.matchedPattern.pattern) : 'No matches';

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

  // using hide class app.css#4575 to show/hide
  //document.querySelector('#spinner').classList.add('hide'); // unless there is an error, the spinner never really shows
  //document.querySelector('#logRow').classList.remove('hide');
}

function formatInt(d) {
  // International format based on user locale
  // you can delete the other function if you like this
  // you can adjust the content via the object properties
  return new Intl.DateTimeFormat(navigator.language,
                  {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(d));
}
