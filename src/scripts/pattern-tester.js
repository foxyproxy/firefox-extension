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

document.querySelector('button[data-i18n="test"]').addEventListener('click', testPattern);
document.querySelector('button[data-i18n="help"]').addEventListener('click', () => browser.tabs.create({url: '/pattern-help.html'}));

const patternObj = Utils.urlParamsToJsonMap().patternObj;
if (patternObj) {
  document.querySelector('#pattern').value = patternObj.pattern;
  document.querySelector('#protocols').value = patternObj.protocols;
  document.querySelector('#type').value = patternObj.type;
  document.querySelector('#url').value = '';
}


function testPattern() {

  const urlInput = document.querySelector('#url');
  // --- reset
  urlInput.classList.remove('is-invalid-input');
  result.classList.remove('success', 'alert');
  
  let parsedURL;

  try { parsedURL = new URL(urlInput.value); }
  catch (e) {
    console.error(e);
    urlInput.classList.add('is-invalid-input');
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

  

  const pattern = document.querySelector('#pattern').value;
  const type = parseInt(document.querySelector('#type').value);
  const protocols = parseInt(document.querySelector('#protocols').value);
  let schemeNum;
  console.log(pattern, type, protocols);

  // Check protocol first
  if (parsedURL.protocol === 'https:') { schemeNum = PROTOCOL_HTTPS; }
  else if (parsedURL.protocol === 'http:') { schemeNum = PROTOCOL_HTTP; }


  if (protocols !== PROTOCOL_ALL && protocols !== schemeNum) {
    result.classList.add('alert');
    result.textContent = 'Protocols do not match.';
    result.classList.remove('hide-unimportant');
    return;
  }

  const regExp = type === PATTERN_TYPE_WILDCARD ?
    Utils.safeRegExp(Utils.wildcardStringToRegExpString(pattern)) :
    Utils.safeRegExp(pattern); // TODO: need to notify user and not match this to zilch.

  if (regExp.test(parsedURL.host)) {
    result.classList.add('success');
    result.textContent = 'Pattern matches URL!';
  }
  else {
    result.classList.add('alert');
    result.textContent = 'Pattern does not match URL.';
  }

  result.classList.remove('hide-unimportant');
}
