'use strict';

document.querySelector('#test').addEventListener('click', testPattern);
document.querySelector('#help').addEventListener('click', () => browser.tabs.create({url: '/pattern-help.html'}));

const patternObj = Utils.urlParamsToJsonMap().patternObj;
if (patternObj) {
  document.querySelector('#pattern').value = patternObj.pattern;
  document.querySelector('#protocols').value = patternObj.protocols;
  document.querySelector('#type.valu')e = patternObj.type;
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

  const pattern = document.querySelector('#pattern').value;
  const type = parseInt(document.querySelector('#type').value);
  const protocols = parseInt(document.querySelector('#protocols').value);
  let schemeNum;

  // Check protocol first
  if (parsedURL.protocol === 'https:') { schemeNum = PROTOCOL_HTTPS; }
  else if (parsedURL.protocol === 'http:') { schemeNum = PROTOCOL_HTTP; }

  if (protocols !== PROTOCOL_ALL && protocols !== schemeNum) {
    console.log('no protocol match: ' + schemeNum);
    
    // #match,#noMatch, #noProtocolMatch are already hidden via hide-unimportant
    document.querySelector('#noProtocolMatch').classList.remove('hide-unimportant');
    return;
  }

  const regExp = type === PATTERN_TYPE_WILDCARD ? Utils.safeRegExp(Utils.wildcardStringToRegExpString(pattern)) :
                            Utils.safeRegExp(pattern); // TODO: need to notify user and not match this to zilch.

  document.querySelector(regExp.test(parsedURL.host) ? '#match' : '#noMatch').classList.remove('hide-unimportant');
}
