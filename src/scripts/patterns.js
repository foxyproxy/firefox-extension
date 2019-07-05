$(document).foundation();
vex.defaultOptions.className = 'vex-theme-default';
let editingProxy,
  patternRowTemplate =
  `<div data-idx="%data-idx" class="row pattern-row %data-active">
    <div class="small-3 columns">%data-name</div>
    <div class="small-3 columns">%data-pattern</div>
    <div class="small-2 columns">%data-type</div>
    <div class="small-1 columns">%data-protocols</div>
    <div class="small-1 columns">%data-onoff</div>
    <div class="small-2 columns">
    <a data-delete class="float-right"><i class="fa fa-1point8x fa-trash"></i></a>
    <a data-edit class="float-right"><i class="fa fa-1point8x fa-pencil"></i></a>
    <a data-imported class="%data-imported float-right"><i class="fa fa-1point8x fa-upload fp-orange"></i></a></div>
  </div>`;

// Keep this first. In case of error in DOMContentLoaded listener code, we need this to execute first
// So user can return from whence he came.
$(document).on("click", "#errorOkButton", () => {
  location.href = "/proxies.html";
});

function renderPatterns() {
  let blackPatternHtmlStr = [];
  for (let i=0; i<editingProxy.blackPatterns.length; i++) {
    blackPatternHtmlStr.push(buildRow(editingProxy.blackPatterns[i], i));
  }
  let whitePatternHtmlStr = [];
  for (let i=0; i<editingProxy.whitePatterns.length; i++) {
    whitePatternHtmlStr.push(buildRow(editingProxy.whitePatterns[i], i));
  }

  let blackScroller = new Clusterize({
    rows: blackPatternHtmlStr,
    scrollId: 'blackPatternScrollArea',
    contentId: 'blackPatternContentArea'}),
  whiteScroller = new Clusterize({
    rows: whitePatternHtmlStr,
    scrollId: 'whitePatternScrollArea',
    contentId: 'whitePatternContentArea'});

  installListeners();

  function buildRow(patternObj, idx) {
    let protocol;
    if (patternObj.protocols & PROTOCOL_ALL) protocol = "both";
    else if (patternObj.protocols & PROTOCOL_HTTPS) protocol = "https";
    else if (patternObj.protocols & PROTOCOL_HTTP) protocol = "http";

    let t = patternRowTemplate
      .replace(/%data-pattern/g, Utils.ellipsis(patternObj.pattern))
      .replace(/%data-name/g, patternObj.title ? Utils.ellipsis(patternObj.title) : "&nbsp;")
      .replace(/%data-type/g, patternObj.type == PATTERN_TYPE_WILDCARD ? "wildcard": "reg exp")
      .replace(/%data-protocols/g, protocol)
      .replace(/%data-idx/g, idx)
      .replace("%data-imported", patternObj.importedPattern ? "" : "hide-unimportant")

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

  // Get the index and white or black array of the clicked item
  function getIdxAndPatternsArray(that) {
    let idx = parseInt(that.closest("div[data-idx]").attr("data-idx")),
      patternsArray = that.closest("#whitePatternContentArea").length ?
        editingProxy.whitePatterns : editingProxy.blackPatterns;
    return [idx, patternsArray];
  }

  $(document).on("click", "a[data-imported]", (e) => {
    let [idx, patternsArray] = getIdxAndPatternsArray($(e.target));
    //let that = $(e.target).closest("div[data-idx]");
    alert("This pattern was imported from an older version of FoxyProxy and changed during import. Here is the original, unchanged pattern: \n\n" + patternsArray[idx].importedPattern);
    return false;
  });

  $(document).on("click", "a[data-edit]", (e) => {
    let [idx, patternsArray] = getIdxAndPatternsArray($(e.target));
    let pat = patternsArray[idx];
    openDialog(pat);
    return false;
  });

  $(document).on("click", "#newWhite", () => {
    // Make a copy of PATTERN_NEW and pass it to the vex dialog.
    // Note that openDialog() returns immediately even though the dialog is modal
    // so adding of the pattern info to the patterns array must be done in openDialog(), not here.
    openDialog(JSON.parse(JSON.stringify(PATTERN_NEW)), true, editingProxy.whitePatterns);
  return false;
  });

  $(document).on("click", "#newBlack", () => {
    // Make a copy of PATTERN_NEW and pass it to the vex dialog.
    // Note that openDialog() returns immediately even though the dialog is modal
    // so adding of the pattern info to the patterns array must be done in openDialog(), not here.
    openDialog(JSON.parse(JSON.stringify(PATTERN_NEW)), true, editingProxy.blackPatterns);
  return false;
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
    location.href = "/proxies.html";
  });

  $(document).on("click", "#addLocal", function() {
    editingProxy.blackPatterns.push(PATTERN_LOCALHOSTURLS_BLACK);
    editingProxy.blackPatterns.push(PATTERN_INTERNALIPS_BLACK);
    editingProxy.blackPatterns.push(PATTERN_LOCALHOSTNAMES_BLACK);
    renderPatterns();
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

function openDialog(pat, isNew, patternArray) {
  vex.dialog.buttons.YES.className = "button";
  vex.dialog.buttons.NO.className = "button alert";
  vex.dialog.open({
    message: 'Pattern Details',
    input: `
    <style>
      .vex-custom-field-wrapper {
        margin-bottom: .5rem;
      }
    </style>
    <div class="callout alert">
      Because of <a target="_blank" href="https://bugzilla.mozilla.org/show_bug.cgi?id=1337001">Firefox limitations</a>, only domains, subdomains, and ports are recognized in patterns. Do not use paths or query parameters in patterns. Example: <strong>*.foxyproxy.com:30053</strong> is OK but not <strong>*.foxyproxy.com:30053/help/*</strong>
    </div>
    <div class="vex-custom-field-wrapper">
        <label for="name">Pattern Name (optional)
        <div class="vex-custom-input-wrapper">
            <input name="title" type="edit" style="width: 100%" value="${pat.title ? pat.title : ""}"/>
        </div></label>
    </div>
    <div class="vex-custom-field-wrapper">
        <label for="pattern">Pattern &mdash; <a href="/pattern-help.html" target="_blank">Help</a>
        <input name="pattern" type="edit" style="width: 100%" value="${pat.pattern}"/></label>
    </div>

    <div class="vex-custom-field-wrapper">
        <div class="vex-custom-input-wrapper">
          <label>Is this a wildcard or regular expression?</label><p><label style="display: inline">Wildcard <input name="type" type="radio" value="${PATTERN_TYPE_WILDCARD}"
            ${pat.type == PATTERN_TYPE_WILDCARD ? `checked` : `` }/></label>
          <label style="display: inline">Regular Expression <input name="type" type="radio" value="${PATTERN_TYPE_REGEXP}"
            ${pat.type == PATTERN_TYPE_REGEXP ? `checked` : `` }/></label></p>
        </div>
    </div>
    <div class="vex-custom-field-wrapper">
        <div class="vex-custom-input-wrapper">
          <label>Use Pattern For Which Protocols?</label>
          <select name="protocols">
            <option value="${PROTOCOL_ALL}">https and http</option>
            <option value="${PROTOCOL_HTTP}">http</option>
            <option value="${PROTOCOL_HTTPS}">https</option>
          </ul>
        </select>
    </div>
    <div class="vex-custom-field-wrapper">
      <div class="vex-custom-input-wrapper">
      <label>Enable/Disable the Pattern</label> <input id="active" name="active" class="switch-input" type="checkbox" ${pat.active ? `checked` : `` }>
      <label class="switch-paddle" for="active">
        <span class="show-for-sr">On/Off</span>
        <span class="switch-active bold" aria-hidden="true" style="color: white">On</span>
        <span class="switch-inactive bold fp-orange" aria-hidden="true">Off</span>
      </label>
      </div>
    </div>`,

    callback: function(data) {
      if (data) {
        // Not cancelled
        // data has .title, .pattern, .type, .protocols, and .onOff (values on or off)
        pat.title = data.title && data.title.trim();
        pat.pattern = data.pattern && data.pattern.trim();
        pat.type = parseInt(data.type);
        pat.protocols = parseInt(data.protocols);
        pat.active = data.active == "on";
        if (isNew) {
          patternArray.push(pat);
        }
        renderPatterns();
      }
    },

    beforeClose: function() {
      // |this| is vex instance
      if (!this.value) {
        // Cancel button was clicked
        return true;
      }
      let pat = this.value.pattern && this.value.pattern.trim();
      if (!pat) {
        alert("Please enter a pattern");
        return false;
      }
      else return true;
    }
  })
}
