function validateInput() {
  Utils.trimAllInputs();
  return markInputErrors();
}

// Return false if any item in the selector is empty or doesn't have only nums when
// |numbersOnly| is true
function markInputErrors() {
  let ret = true;
  let patInput = $("#pattern"), pat = patInput.val();
  patInput.removeClass("is-invalid-input");
  if (!pat) {
    patInput.addClass("is-invalid-input");
    //ret = false;
    return;
  }
  let type = parseInt($("#type").val());
  if (type == PATTERN_TYPE_WILDCARD && pat.indexOf("/") >= 0) {
    alert("No slash in wildcard patterns. You cannot match URL paths because of Firefox restrictions.");
    patInput.addClass("is-invalid-input");
    ret = false;
  }
  if (type == PATTERN_TYPE_REGEXP) {
    try {
      new RegExp(pat);
    }
    catch (e) {
      console.error(e);
      patInput.addClass("is-invalid-input");
      ret = false;
    }
  }
  else {
    try {
      new RegExp(Utils.wildcardStringToRegExpString(pat));
    }
    catch (e) {
      console.error(e);
      patInput.addClass("is-invalid-input");
      ret = false;
    }
  }
  return ret;
}