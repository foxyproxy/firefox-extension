'use strict';

// ----------------- Pattern Check ------------------

const anyProtocol = '(.+\://)';

function checkPattern(pattern, type) {

  const pat = pattern.value;

  if (!pat) {
    pattern.classList.add('invalid');
    pattern.focus();
    showResult(chrome.i18n.getMessage('errorEmpty'), true);
    return;
  }

  // In most cases, patterns should not start with the protocol
  const protocolMatches = pat.match(anyProtocol);
  if (protocolMatches && protocolMatches.length > 1) {
    if (!confirm(chrome.i18n.getMessage('patternHasProtocol', [pat, protocolMatches[0]]))) {
      return;
    }
  }

  const patternTypeSet = {
    '1': 'wildcard',
    '2': 'regex'
  }

  let regex;

  switch (patternTypeSet[type.value]) {

    // RegEx
    case 'regex':
      try { regex = new RegExp(pat); }
      catch (e) {
        pattern.classList.add('invalid');
        showResult(e.message, true);
        return false;
      }
      break;

    // wildcard
    default:
      if (pat.includes('/')) {
        pattern.classList.add('invalid');
        showResult(chrome.i18n.getMessage('errorSlash'), true);
        return false;
      }

      try { regex = new RegExp(Utils.wildcardToRegExp(pat)); }
      catch (e) {
        pattern.classList.add('invalid');
        showResult(e.message, true);
        return false;
      }
  }

  // --- pattern is valid
  return regex;
}




function showResult(text, fail) {

  fail && result.classList.add('alert');
  result.textContent = text;
  result.classList.remove('hide');
}