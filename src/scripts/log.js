'use strict';

let logg;
const onOff = document.querySelector('#onOff'); // cache for later

browser.runtime.getBackgroundPage().then((page) => {
  logg = page.getLogg();
  //console.log("logg active is " + logg.active);
  if (logg.active) {
    onOff.checked = true;
    renderLog();
  }
  else {
    onOff.checked = false;
    // using hide-unimportant class app.css#4575 to show/hide
    document.querySelector('#spinnerRow').classList.add('hide-unimportant');
    document.querySelector('#logRow').classList.remove('hide-unimportant');
  }
});

onOff.addEventListener('click', (e) => {
  const isON = onOff.checked;
  //console.log("user changed logging to " + isON);
  browser.runtime.getBackgroundPage().then((page) => {
    page.ignoreNextWrite(); // Don't propagate changes the PAC script
    setLogging(500, isON).then(() => {
      if (!isON) {
        logg.active = false;
        logg.clear(); // maybe it is better not clearing the log, user might temporary want to diable, use clear to manually clear
        renderLog();
      }
      else { logg.active = true; }
      getAllSettings().then((s) => console.log(s));
    });
  });
});


document.querySelectorAll('input[type="button"]').forEach(item => item.addEventListener('click', process));

function process () {

  switch (this.id) {

    case 'okBtn1':
    case 'okBtn2':
      location.href = '/proxies.html'
      break;

    case 'clearBtn1':
    case 'clearBtn2':
      logg.clear();
      renderLog();
      break;

    case 'refreshBtn1':
    case 'refreshBtn2':
      renderLog();
      break;

  }
}

function renderLog() {

  // ----- templates & containers
  const docfrag = document.createDocumentFragment();
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  const a = document.createElement('a');
  a.setAttribute('target', '_blank');
  // create 6 td inside tr
  for (let i = 1; i <= 6; i++) { tr.appendChild(td.cloneNode()); }


  for (let i = 0, len = logg.length; i < len; i++) {

    let item = logg.item(i), pattern;
    if (item.matchedPattern) {
      pattern = item.matchedPattern === USE_PROXY_FOR_ALL_URLS ? 'Use proxy for all URLs' :
        item.matchedPattern.pattern;
    }
    else { pattern = 'No matches'; }

    // Build a row for this log entry by cloning the tr containing 6 td
    const row = tr.cloneNode(true);
    row.className = item.matchedPattern ? 'success' : 'secondary';

    const cell1 = row.children[0];
    const a1 = a.cloneNode();
    a1.href = item.url;
    a1.textContent = item.url;
    cell1.appendChild(a1);

    const cell2 = row.children[1];
    cell2.textContent = item.proxySetting ? item.proxySetting.title : 'No matches';

    const cell3 = row.children[2];
    cell3.className = 'fp-color-blob-log'; // this style is blank app.css#4675
    cell3.style.backgroundColor = item.proxySetting ? item.proxySetting.color : 'blue';
    cell3.style.border = '2px solid #fff'; // looks better separated, but not important

    const cell4 = row.children[3];
    cell4.textContent = item.proxySetting ? item.proxySetting.address : 'No matches';

    const cell5 = row.children[4];
    cell5.textContent = pattern

    const cell6 = row.children[5];
    cell6.textContent = formatInt(item.timestamp);

    docfrag.appendChild(row);
  }

  const parent = document.querySelector('#logTable tbody'); // reduce the number of needed ids e.g. #rows
  parent.textContent = ''; // clearing the content
  parent.appendChild(docfrag);

  // using hide-unimportant class app.css#4575 to show/hide
  document.querySelector('#spinnerRow').classList.add('hide-unimportant');
  document.querySelector('#logRow').classList.remove('hide-unimportant');
}

function formatInt(d) {
  // International format based on user locale
  // you can delete the other function if you like this
  // you can adjust the content via the object properties
  return new Intl.DateTimeFormat(navigator.language,
                  {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(d));
}



/*
months.long.1=January
months.long.2=February
months.long.3=March
months.long.4=April
months.long.5=May
months.long.6=June
months.long.7=July
months.long.8=August
months.long.9=September
months.long.10=October
months.long.11=November
months.long.12=December
days.long.1=Sunday
days.long.2=Monday
days.long.3=Tuesday
days.long.4=Wednesday
days.long.5=Thursday
days.long.6=Friday
days.long.7=Saturday
timeformat=HH:nn:ss:zzz mmm dd, yyyy
*/

// TODO: i18n
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Thanks for the inspiration, Tor2k (http://www.codeproject.com/jscript/dateformat.asp)
function format(d) {

  d = new Date(d);
  if (!d.valueOf()) { return ' '; }

  var self = this;
  return "HH:nn:ss:zzz".replace(/yyyy|mmmm|mmm|mm|dddd|ddd|dd|hh|HH|nn|ss|zzz|a\/p/gi,
    function($1) {
      switch ($1) {
        case 'yyyy': return d.getFullYear();
        case 'mmmm': return months[d.getMonth()];
        case 'mmm':  return months[d.getMonth()].substr(0, 3);
        case 'mm':   return zf((d.getMonth() + 1), 2);
        case 'dddd': return days[d.getDay()];
        case 'ddd':  return days[d.getDay()].substr(0, 3);
        case 'dd':   return zf(d.getDate(), 2);
        case 'hh':   return zf(((h = d.getHours() % 12) ? h : 12), 2);
        case 'HH':   return zf(d.getHours(), 2);
        case 'nn':   return zf(d.getMinutes(), 2);
        case 'ss':   return zf(d.getSeconds(), 2);
        case 'zzz':  return zf(d.getMilliseconds(), 3);
        case 'a/p':  return d.getHours() < 12 ? 'AM' : 'PM';
      }
    }
  );
  // My own zero-fill fcn, not Tor 2k's. Assumes (n==2 || n == 3) && c<=n.
  function zf(c, n) { c=""+c; return c.length == 1 ? (n==2?'0'+c:'00'+c) : (c.length == 2 ? (n==2?c:'0'+c) : c); }
}
