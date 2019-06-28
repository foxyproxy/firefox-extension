document.addEventListener("DOMContentLoaded", function() {
	$(document).foundation();
	$(document).on("click", "#test", testPattern);
	$(document).on("click", "#help", () => browser.tabs.create({url: "/pattern-help.html", active: true}));

	let patternObj = Utils.urlParamsToJsonMap().patternObj;

	if (patternObj) {
		$("#pattern").val(patternObj.pattern);
		$("#protocols").val(patternObj.protocols);
		$("#type").val(patternObj.type);
		$("#url").val("");
	}
});

function testPattern() {
	let urlInput = $("#url"), url = urlInput.val(), parsedURL;
	urlInput.removeClass("is-invalid-input");

	try {
		parsedURL = new URL(url);
	}
	catch (e) {
		console.error(e);
		urlInput.addClass("is-invalid-input");
		return false;
	}     
	if (!validateInput()) return;
	let pattern = $("#pattern").val(), type = parseInt($("#type").val()), protocols = parseInt($("#protocols").val()),
		regExp, schemeNum;

	// Check protocol first
  if (parsedURL.protocol == "https:") schemeNum = PROTOCOL_HTTPS;
  else if (parsedURL.protocol == "http:") schemeNum = PROTOCOL_HTTP;

	if (protocols != PROTOCOL_ALL && protocols != schemeNum) {
		console.log("no protocol match: " + schemeNum);
		$("#match,#noMatch").hide();
		$("#noProtocolMatch").show();
		return;
	}

  if (type == PATTERN_TYPE_WILDCARD)
    regExp = Utils.safeRegExp(Utils.wildcardStringToRegExpString(pattern));
  else 
     regExp = Utils.safeRegExp(pattern); // TODO: need to notify user and not match this to zilch.

	if (regExp.test(parsedURL.host)) {
		console.log("match");
		$("#match").show();
		$("#noMatch,#noProtocolMatch").hide();
	}
	else {
		console.log("no match");
		$("#match,#noProtocolMatch").hide();
		$("#noMatch").show();
	}
}

