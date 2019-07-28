'use strict';

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
      try { new RegExp(Utils.wildcardStringToRegExpString(pat)); }
      catch (e) {
        console.error(e);
        patInput.classList.add('invalid');
        return false;
      }
  }

  return true;
}
