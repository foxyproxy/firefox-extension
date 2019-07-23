'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

let logg;
const onOff = document.querySelector('#onOff'); // cache for later

browser.runtime.getBackgroundPage().then((page) => {
  logg = page.getLogg();
  //console.log("logg active is " + logg.active);
  onOff.checked = logg.active;
  renderLog(); // log content will be shown if there are any regardless of onOff
});

onOff.addEventListener('click', async (e) => {

  const isON = onOff.checked;
  //console.log("user changed logging to " + isON);
  const bg = await browser.runtime.getBackgroundPage();
  bg.ignoreNextWrite(); // Don't propagate changes the PAC script
  await setLogging(500, isON);
  logg.active = isON;
  isON && renderLog(); // redisplay log when clicking ON
  //logg.clear(); // maybe it is better not clearing the log, user might temporary want to diable, use clear button
  getAllSettings().then(console.log);
});

document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));

function process () {

  switch (this.dataset.i18n) {

    case 'back': location.href = '/options.html'; break;
    case 'refresh': renderLog(); break;
    case 'clear':
      logg.clear();
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

  for (let i = 0, len = logg.length; i < len; i++) {

    const item = logg.item(i);
    const pattern = item.matchedPattern ?
      (item.matchedPattern === USE_PROXY_FOR_ALL_URLS ? 'Use proxy for all URLs' : item.matchedPattern.pattern) : 'No matches';

    // Build a row for this log entry by cloning the tr containing 6 td
    const row = tr.cloneNode(true);
    row.className = item.matchedPattern ? 'success' : 'secondary'; // this will rest class .tamplate as well
    const td = row.children;
    
    // cell1
    const a = td[0].children[0];
    a.href = item.url;
    a.textContent = item.url;

    // cell2
    td[1].textContent = item.proxySetting ? item.proxySetting.title : 'No matches';

    // cell3
    //const cell3 = row.children[2];
    //cell3.className = 'fp-color-blob-log'; // this style is blank app.css#4675
    td[2].style.backgroundColor = item.proxySetting ? item.proxySetting.color : 'blue';

    // cell4
    td[3].textContent = item.proxySetting ? item.proxySetting.address : 'No matches';

    // cell5
    td[4].textContent = pattern;

    // cell6
    td[5].textContent = formatInt(item.timestamp);

    docfrag.appendChild(row);
  }

  tbody.appendChild(docfrag);

  // using hide-unimportant class app.css#4575 to show/hide
  //document.querySelector('#spinner').classList.add('hide-unimportant'); // unless there is an error, the spinner never really shows
  //document.querySelector('#logRow').classList.remove('hide-unimportant');
}

function formatInt(d) {
  // International format based on user locale
  // you can delete the other function if you like this
  // you can adjust the content via the object properties
  return new Intl.DateTimeFormat(navigator.language,
                  {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(d));
}
