'use strict';

function validateInput() {
  Utils.trimAllInputs();
  return markInputErrors();
}

// Return false if any item in the selector is empty or doesn't have only nums when
// |numbersOnly| is true
function markInputErrors() {
  
  const patInput = document.querySelector('#pattern');
  patInput.classList.remove('is-invalid-input'); // reset
  let pat = patInput.value;
  
  if (!pat) {
    patInput.classList.add('is-invalid-input');
    return false;
  }
  
  const type = parseInt(document.querySelector('#type').value);
  switch (true) {

    case type === PATTERN_TYPE_WILDCARD && pat.indexOf('/') >== 0:
      alert("No slash in wildcard patterns. You cannot match URL paths because of Firefox restrictions.");
      patInput.classList.add('is-invalid-input');
      return false;

    case type === PATTERN_TYPE_REGEXP:
      try { new RegExp(pat); }
      catch (e) {
        console.error(e);
        patInput.classList.add('is-invalid-input');
        return false;
      }
      break;

    default:
      try { new RegExp(Utils.wildcardStringToRegExpString(pat)); }
      catch (e) {
        console.error(e);
        patInput.classList.add('is-invalid-input');
        return false;
      }
  }

  return true;
}
