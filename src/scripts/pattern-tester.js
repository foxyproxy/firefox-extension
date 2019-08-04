'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

// --- global
const result = document.querySelector('#result');

  
const pattern = document.querySelector('#pattern');
const protocols = document.querySelector('#protocols');
const type = document.querySelector('#type');
const urlInput = document.querySelector('#url');

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
  urlInput.classList.remove('invalid');
  result.classList.remove('success', 'alert');
  
  let parsedURL;

  try { parsedURL = new URL(urlInput.value); }
  catch (e) {
    console.error(e);
    urlInput.classList.add('invalid');
    return false;
  }

  if (!validateInput()) { return; }

  // There are 3 possible states that we report:
  // 1. protocols do not match OR
  // 2. pattern does not match OR
  // 3. pattern matches
  // In each case, we show/hide the appropriate HTML blocks. We have to do
  // this each time testPattern() is called because this funciton many be
  // called multiple times without the HTML resetting -- yet the user may have
  // changed the inputs. So we just hide everything in the beginning and show
  // the appropriate block each execution of testPattern().

  

  const patternTest = pattern.value;
  const typeTest = parseInt(type.value);
  const protocolsTest = parseInt(protocols.value);
  let schemeNum;
  console.log(patternTest, typeTest, protocolsTest);

  // Check protocol first
  if (parsedURL.protocol === 'https:') { schemeNum = PROTOCOL_HTTPS; }
  else if (parsedURL.protocol === 'http:') { schemeNum = PROTOCOL_HTTP; }


  if (protocolsTest !== PROTOCOL_ALL && protocolsTest !== schemeNum) {
    result.classList.add('alert');
    result.textContent = 'Protocols do not match.';
    result.classList.remove('hide');
    return;
  }

  const regExp = typeTest === PATTERN_TYPE_WILDCARD ?
    Utils.safeRegExp(Utils.wildcardToRegExp(patternTest)) :
    Utils.safeRegExp(pattern); // TODO: need to notify user and not match this to zilch.

  if (regExp.test(parsedURL.host)) {
    result.classList.add('success');
    result.textContent = 'Pattern matches URL!';
  }
  else {
    result.classList.add('alert');
    result.textContent = 'Pattern does not match URL.';
  }

  result.classList.remove('hide');
}



function validateInput() {
  Utils.trimAllInputs();
  return markInputErrors();
}

// Return false if any item in the selector is empty or doesn't have only nums when
// |numbersOnly| is true
function markInputErrors() {

  const patInput = document.querySelector('#pattern');
  patInput.classList.remove('invalid'); // reset
  const pat = patInput.value;

  if (!pat) {
    patInput.classList.add('invalid');
    return false;
  }

  const type = parseInt(document.querySelector('#type').value);
  switch (true) {

    case type === PATTERN_TYPE_WILDCARD && pat.includes('/'):
      alert(chrome.i18n.getMessage('errorSlash'));
      patInput.classList.add('invalid');
      return false;

    case type === PATTERN_TYPE_REGEXP:
      try { new RegExp(pat); }
      catch (e) {
        console.error(e);
        patInput.classList.add('invalid');
        return false;
      }
      break;

    default:
      try { new RegExp(Utils.wildcardToRegExp(pat)); }
      catch (e) {
        console.error(e);
        patInput.classList.add('invalid');
        return false;
      }
  }

  return true;
}