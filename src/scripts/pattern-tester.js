'use strict';

// ----------------- Internationalization ------------------
Utils.i18n();

// --- global
const url = document.querySelector('#url');
const pattern = document.querySelector('#pattern');
const type = document.querySelector('#type');
const protocols = document.querySelector('#protocols');
const result = document.querySelector('#result');


document.querySelector('button[data-i18n="test"]').addEventListener('click', testPattern);


// ----- check for Edit
const pat = localStorage.getItem('pattern');
if (pat) {

  pattern.value = pat;
  type.value = localStorage.getItem('type');
  protocols.value = localStorage.getItem('protocols');

  localStorage.removeItem('pattern');
  localStorage.removeItem('type');
  localStorage.removeItem('protocols');
}


function testPattern() {

  // --- reset
  url.classList.remove('invalid');
  pattern.classList.remove('invalid');
  result.classList.add('hide');
  result.classList.remove('alert');

  // --- trim text values
  [url, pattern].forEach(item => item.value = item.value.trim());
  
  // --- URL check
  let parsedURL;
  try { parsedURL = new URL(url.value); }
  catch (e) {
    url.classList.add('invalid');
    showResult(e.message, true);
    return;
  }

  // --- protocol check
  const protocolSet = {                                     // converting to meaningful terms
    '1': ['http:', 'https:'],
    '2': ['http:'],
    '4': ['https:']
  };

  if (!protocolSet[protocols.value].includes(parsedURL.protocol)) {
    showResult(chrome.i18n.getMessage('errorProtocol'), true);
    return;
  }


  // --- pattern check  
  const regex = checkPattern(pattern, type);
  if (!regex) { return; }
  
  // --- pattern on URL check (pattern is valid)
  regex.test(parsedURL.host) ? showResult(chrome.i18n.getMessage('patternMatch')) : 
                                showResult(chrome.i18n.getMessage('patternNotMatch'), true);

}
