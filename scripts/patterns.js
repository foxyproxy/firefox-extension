$(document).foundation();
let editingProxy,
	whitePatternsPerPage = 10, blackPatternsPerPage = 10,

	// I'd prefer to keep these templates in HTML but cloning them, substituting the text, and inserting
	// into DOM. Placing them here avoids the clone or innerHTML to copy what's in the DOM, a performance benefit
	// when rendering the page.
  patternRowTemplate = `
<div data-idx="%data-idx" class="row pattern-row %data-active">
	<div class="small-3 columns"><a id="%data-idx" data-type="text" data-title="Enter Name" name="name" data-full-name="%data-full-name">%data-name</a></div>
	<div class="small-3 columns"><a data-type="text" data-title="Enter Pattern" data-full-pattern="%data-full-pattern" name="pattern">%data-pattern</a></div>
	<div class="small-2 columns"><a data-type="select" data-title="Select Pattern Type" name="type">%data-type</a></div>
	<div class="small-1 columns"><a data-type="select" data-title="Use pattern with which protocols?" name="protocols">%data-protocols</a></div>
	<div class="small-1 columns"><a data-type="select" data-title="Turn pattern on/off" name="active" active="%data-onoff">%data-onoff</a></div>
	<div class="small-2 columns"><a data-delete class="float-right"><i class="fa fa-1point8x fa-trash"></i></a> <a data-imported class="%data-imported float-right"><i class="fa fa-1point8x fa-upload fp-orange"></i></a></div>
</div>`;


// Keep this first. In case of error in DOMContentLoaded listener code, we need this to execute first
$(document).on("click", "#errorOkButton", () => {
	console.log("cancel");
	location.href = "/proxies.html";
});

function renderPatterns(focusLastPageWhite=false, focusLastPageBlack=false) {
	$("#whitePatternsPerPage").val(whitePatternsPerPage + "");
	$("#blackPatternsPerPage").val(blackPatternsPerPage + "");
	if (editingProxy.whitePatterns.length < 2) $("#whitePatternsPerPageContainer").hide();
	else $("#whitePatternsPerPageContainer").show();
	if (editingProxy.blackPatterns.length < 2) $("#blackPatternsPerPageContainer").hide();
	else $("#blackPatternsPerPageContainer").show();

	render(editingProxy.whitePatterns, "div[data-white-black-patterns=white]", "#noWhitePatterns", "#whitePager", whitePatternsPerPage, focusLastPageWhite);
	render(editingProxy.blackPatterns,"div[data-white-black-patterns=black]", "#noBlackPatterns", "#blackPager", blackPatternsPerPage, focusLastPageBlack);
	
	function render(arr, contentSelector, noneMsg, pagerSelector, itemsPerPage, focusLastPage) {
		if (!arr || arr.length == 0) {
			$(noneMsg).show();
			$(pagerSelector).html("");
			installListeners();
			return;
		}
		if (arr.length <= itemsPerPage) {
			// no pagination
			let arrStr = [];
			for (let i=0; i<arr.length; i++) {
				arrStr.push(buildRow(arr[i], i));
			}
			$(contentSelector).html(arrStr.join(""));
			$(pagerSelector).html("");
			installListeners();
			return;
		}

		let total = Math.ceil(arr.length / itemsPerPage);
		// http://botmonster.com/jquery-bootpag/
	  $(pagerSelector).bootpag({
      total: total,
			maxVisible: 10,
			page: 1, // Doesn't appear to do anything
			href: pagerSelector,
			firstLastUse: true,
	  }).on("page", function(event, pageNum) {
			let arrStr = [],
				start = (pageNum-1)*itemsPerPage,
				end = pageNum*itemsPerPage-1 > arr.length-1 ? arr.length-1 : pageNum*itemsPerPage-1;
			for (let i=start; i<=end; i++) {
				arrStr.push(buildRow(arr[i], i));
			}
			$(contentSelector).html(arrStr.join(""));
			installListeners();
	  });
		$(pagerSelector).trigger("page", focusLastPage ? total : 1); // Load appropriate page. TODO: save position for future opening of /patterns.html
		$(pagerSelector).bootpag({"page": focusLastPage ? total : 1}); // Set active page num
		return true;
	}

	function buildRow(patternObj, idx) {
		let protocol;
		if (patternObj.protocols & PROTOCOL_ALL) protocol = "both";
		else if (patternObj.protocols & PROTOCOL_HTTPS) protocol = "https";
		else if (patternObj.protocols & PROTOCOL_HTTP) protocol = "http";
		
		let t = patternRowTemplate
			.replace(/%data-pattern/g, patternObj.pattern)
			.replace(/%data-full-pattern/g, patternObj.pattern)
			.replace(/%data-name/g, patternObj.title)
			.replace(/%data-full-name/g, patternObj.title?patternObj.title:"")
			.replace(/%data-type/g, patternObj.type == PATTERN_TYPE_WILDCARD ? "wildcard": "reg exp")
			.replace(/%data-protocols/g, protocol)
			.replace(/%data-idx/g, idx)
			.replace("%data-imported", patternObj.importedPattern ? "" : "hide-unimportant")

		console.log(patternObj);
		if (patternObj.active) {
			t = t.replace(/%data-onoff/g, "on").replace("%data-active", "success");
		}
		else
			t = t.replace(/%data-onoff/g, "off").replace("%data-active", "secondary");

		return t;
	}
}

document.addEventListener("DOMContentLoaded", () => {
	let parsedURL = Utils.urlParamsToJsonMap(), idParam = parsedURL.id;
	console.log("parsedURL is ");
	console.log(parsedURL);
	if (idParam) {
		// Read the data to be edited.
		getProxySettingById(idParam).then((ps) => {
			editingProxy = ps;
			init();
		})
		.catch((e) => {
			$("#spinnerRow").hide();
			$("#errorRow").show();
			console.error("1: Unable to read saved proxy (could not get existing settings): " + e);
		});
	}
	else {
		// Error, shouldn't ever get here
		$("#spinnerRow").hide();
		$("#errorRow").show();
		console.error("2: Unable to read saved proxy proxy (could not get existing settings)");
	}
});

function init() {
	// Populate the form
	let heading = editingProxy.title ? ("Add/Edit Patterns for " + editingProxy.title) : "Add/Edit Patterns";
	$("#windowTitle").text(heading);
	renderPatterns();
	$("#spinnerRow").hide();
	$("#patternsRow").show();
}

function installListeners() {
	$(document).off(); // Remove any existing handlers

	function getIdxAndPatternsArray(that) {
		let idx = parseInt(that.closest("div[data-idx]").attr("data-idx")),
			patternsArray = that.closest("div[data-white-black-patterns").attr("data-white-black-patterns") == "white" ?
				editingProxy.whitePatterns : editingProxy.blackPatterns;
		return [idx, patternsArray];
	}

	$("a[name='pattern']").editable({
		success: function(resp, newPattern) {
			// resp is always null since we don't do server-side updates
			let [idx, patternsArray] = getIdxAndPatternsArray($(this));
			patternsArray[idx].pattern = newPattern.trim();
		},
		display: function(value) {
			$(this).html(Utils.ellipsis(value))
		},
		emptytext: "click to add pattern",
		autotext: "never"
	});

	$("a[name='name']").editable({
		success: function(resp, newTitle) {
			// resp is always null since we don't do server-side updates
			let [idx, patternsArray] = getIdxAndPatternsArray($(this));
			patternsArray[idx].title = newTitle.trim();
		},
		display: function(value) {
			$(this).html(Utils.ellipsis(value))
		},
		emptytext: "click to add name",
		autotext: "never"
	});

	$("a[name='type']").editable({
		source: [
			{value: PATTERN_TYPE_WILDCARD, text: "Wildcard"},
			{value: PATTERN_TYPE_REGEXP, text: "Regular Expression"}
		],
		success: function(resp, newType) {
			// resp is always null since we don't do server-side updates
			let [idx, patternsArray] = getIdxAndPatternsArray($(this));
			patternsArray[idx].type = parseInt(newType);
		},
		display: function(value, sourceData) {
			if (value == null) return;
			if (parseInt(value) == PATTERN_TYPE_WILDCARD) $(this).text("wildcard");
			else $(this).text("reg exp");
		}
	});

	$("a[name='protocols']").editable({
		source: [
			{value: PROTOCOL_ALL, text: "All"},
			{value: PROTOCOL_HTTP, text: "HTTP Only"},
			{value: PROTOCOL_HTTPS, text: "HTTPS Only"}
		],
		success: function(resp, newProtocols) {
			// resp is always null since we don't do server-side updates
			let [idx, patternsArray] = getIdxAndPatternsArray($(this));
			patternsArray[idx].protocols = parseInt(newProtocols);
		},
		display: function(value, sourceData) {
			if (value == null) return;
			value = parseInt(value);
			if (value == PROTOCOL_ALL) $(this).text("all");
			else if (value == PROTOCOL_HTTP) $(this).text("http");
			else $(this).text("https");
		}
	});

	$("a[name='active']").editable({
		source: [
			{value: 1, text: "on"},
			{value: 2, text: "off"}
		],
		success: function(resp, newActive) {
			// resp is always null since we don't do server-side updates
			let [idx, patternsArray] = getIdxAndPatternsArray($(this));
			patternsArray[idx].active = newActive == parseInt(1);
		},
		display: function(value, sourceData) {
			if (value == null) return;
			value = parseInt(value);

			// Update background color
			let that = $(this), row = that.closest("div[data-idx]");
			if (value == 1) row.addClass("success").removeClass("secondary");
			else row.addClass("secondary").removeClass("success");

			if (value == 1) that.text("on");
			else that.text("off");
		}
	});

	$(document).on("click", "a[data-imported]", (e) => {
		let [idx, patternsArray] = getIdxAndPatternsArray($(e.target));
		//let that = $(e.target).closest("div[data-idx]");
		alert("This pattern was imported from an older version of FoxyProxy and changed during import. Here is the original, unchanged pattern: \n\n" + patternsArray[idx].importedPattern);
		return false;
	});

	$(document).on("click", "#newWhite", () => {
		editingProxy.whitePatterns.push(PATTERN_NEW);
		renderPatterns(true, false);
		document.getElementById(editingProxy.whitePatterns.length-1).scrollIntoView({ 
		  behavior: "smooth"
		});
	});

	$(document).on("click", "#newBlack", () => {
		editingProxy.blackPatterns.push(PATTERN_NEW);
		renderPatterns(false, true);
		document.getElementById(editingProxy.whitePatterns.length-1).scrollIntoView({ 
		  behavior: "smooth"
		});
	});

	$(document).on("click", "#save", () => {
		savePatterns().then(() => location.href = "/proxies.html")
		.catch((e) => {console.error("Error saving proxy: " + e)});
	});

	$(document).on("click", "a[data-delete]", (e) => {
		let [idx, patternsArray] = getIdxAndPatternsArray($(e.target));
		let that = $(e.target).closest("div[data-idx]");
		that.hide("fast", function(){
			patternsArray.splice(idx, 1);
			renderPatterns(); // TODO: refocus correct page number
		});
		return false;
	});

	$(document).on("click", "#cancel", () => {
		console.log("cancel");
		location.href = "/proxies.html";
	});

	$(document).on("click", "#changeWhitePatternsPerPage", () => {
		whitePatternsPerPage = parseInt($("#whitePatternsPerPage").val());
		console.log("whitePatternsPerPage: " + $("#whitePatternsPerPage").val());
		if (isNaN(whitePatternsPerPage) || whitePatternsPerPage < 1) whitePatternsPerPage = 10;
		renderPatterns();
	});

	$(document).on("click", "#changeBlackPatternsPerPage", () => {
		blackPatternsPerPage = parseInt($("#blackPatternsPerPage").val());
		if (isNaN(blackPatternsPerPage) || blackPatternsPerPage < 1) blackPatternsPerPage = 10;
		renderPatterns();
	});

	$(document).on("click", "#addLocal", function() {
		editingProxy.blackPatterns.push(PATTERN_LOCALHOSTURLS_BLACK);
		editingProxy.blackPatterns.push(PATTERN_INTERNALIPS_BLACK);
		editingProxy.blackPatterns.push(PATTERN_LOCALHOSTNAMES_BLACK);
		renderPatterns(false, true);
		document.getElementById(editingProxy.blackPatterns.length-1).scrollIntoView({ 
		  behavior: "smooth"
		});
	});
}

function savePatterns() {
	$("#patternsRow").hide();
	$("#spinnerRow").show();
	return editProxySetting(editingProxy.id, editingProxy.index, editingProxy);
}
