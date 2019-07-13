'use strict';

document.querySelector('#test').addEventListener('click', testPattern);
document.querySelector('#help').addEventListener('click', () => browser.tabs.create({url: '/pattern-help.html'}));

const patternObj = Utils.urlParamsToJsonMap().patternObj;
if (patternObj) {
  document.querySelector('#pattern').value = patternObj.pattern;
  document.querySelector('#protocols').value = patternObj.protocols;
  document.querySelector('#type').value = patternObj.type;
  document.querySelector('#url').value = '';
}


function testPattern() {

  const urlInput = document.querySelector('#url');
  urlInput.classList.remove('is-invalid-input');  // reset
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

  document.querySelectorAll('#match,#noMatch,#noProtocolMatch').forEach(item =>
    item.classList.add('hide-unimportant'));

  const pattern = document.querySelector('#pattern').value;
  const type = parseInt(document.querySelector('#type').value);
  const protocols = parseInt(document.querySelector('#protocols').value);
  let schemeNum;

  // Check protocol first
  if (parsedURL.protocol === 'https:') { schemeNum = PROTOCOL_HTTPS; }
  else if (parsedURL.protocol === 'http:') { schemeNum = PROTOCOL_HTTP; }

  if (protocols !== PROTOCOL_ALL && protocols !== schemeNum) {
    document.querySelector('#noProtocolMatch').classList.remove('hide-unimportant');
    return;
  }

  const regExp = type === PATTERN_TYPE_WILDCARD ?
    Utils.safeRegExp(Utils.wildcardStringToRegExpString(pattern)) :
    Utils.safeRegExp(pattern); // TODO: need to notify user and not match this to zilch.

  if (regExp.test(parsedURL.host)) {
    document.querySelector('#match').classList.remove('hide-unimportant');
  }
  else {
    document.querySelector('#noMatch').classList.remove('hide-unimportant');
  }
}
