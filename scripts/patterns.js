$(document).foundation();
vex.defaultOptions.className = 'vex-theme-default';
let editingProxy,
  whitePatternsPerPage = 10, blackPatternsPerPage = 10,
  patternRowTemplate = `
<div data-idx="%data-idx" class="row pattern-row %data-active">
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
      .replace(/%data-pattern/g, Utils.ellipsis(patternObj.pattern))
      .replace(/%data-name/g, patternObj.title ? Utils.ellipsis(patternObj.title) : "&nbsp;")
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

  // Get the index and white or black array of the clicked item
  function getIdxAndPatternsArray(that) {
    let idx = parseInt(that.closest("div[data-idx]").attr("data-idx")),
      patternsArray = that.closest("div[data-white-black-patterns").attr("data-white-black-patterns") == "white" ?
        editingProxy.whitePatterns : editingProxy.blackPatterns;
    return [idx, patternsArray];
  }

  $(document).on("click", "a[data-imported]", (e) => {
    let [idx, patternsArray] = getIdxAndPatternsArray($(e.target));
    //let that = $(e.target).closest("div[data-idx]");
    alert("This pattern was imported from an older version of FoxyProxy and changed during import. Here is the original, unchanged pattern: \n\n" + patternsArray[idx].importedPattern);
    return false;
  });

  $(document).on("click", "#newWhite", () => {
    editingProxy.whitePatterns.push(PATTERN_NEW);
    document.getElementById(editingProxy.whitePatterns.length-1).scrollIntoView({
      behavior: "smooth"
    });
    openDialog(editingProxy.whitePatterns.length-1);
  });

  $(document).on("click", "#newBlack", () => {
    editingProxy.blackPatterns.push(PATTERN_NEW);
    document.getElementById(editingProxy.whitePatterns.length-1).scrollIntoView({
      behavior: "smooth"
    });
    openDialog(editingProxy.blackPatterns.length-1);
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

  $(document).on("click", "a[data-edit]", (e) => {
    let [idx, patternsArray] = getIdxAndPatternsArray($(e.target));
    let pat = patternsArray[idx];
    openDialog(pat);
    return false;
  });

  $(document).on("click", "#cancel", () => {
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

function openDialog(pat) {
  vex.dialog.buttons.YES.className = "button";
  vex.dialog.buttons.NO.className = "button alert";
  vex.dialog.open({
    message: 'Pattern Details',
    input: `
    <style>
      .vex-custom-field-wrapper {
        margin-bottom: 1rem;
      }
    </style>
    <div class="vex-custom-field-wrapper">
        <label for="name">Name
        <div class="vex-custom-input-wrapper">
            <input name="title" type="edit" style="width: 100%" value="${pat.title ? pat.title : ""}"/>
        </div></label>
    </div>
    <div class="vex-custom-field-wrapper">
        <label for="pattern">Pattern
        <input name="pattern" type="edit" style="width: 100%" value="${pat.pattern}"/></label>
    </div>

    <div class="vex-custom-field-wrapper">
        <div class="vex-custom-input-wrapper">
          <label>Type</label><p><label style="display: inline">Wildcard <input name="type" type="radio" value="${PATTERN_TYPE_WILDCARD}"
            ${pat.type == PATTERN_TYPE_WILDCARD ? `checked` : `` }/></label>
          <label style="display: inline">Regular Expression <input name="type" type="radio" value="${PATTERN_TYPE_REGEXP}"
            ${pat.type == PATTERN_TYPE_REGEXP ? `checked` : `` }/></label></p>
        </div>
    </div>
    <div class="vex-custom-field-wrapper">
        <div class="vex-custom-input-wrapper">
          <label>Protocols</label>
          <select name="protocols">
            <option value="${PROTOCOL_ALL}">both</option>
            <option value="${PROTOCOL_HTTP}">http</option>
            <option value="${PROTOCOL_HTTPS}">https</option>
          </ul>
        </select>
    </div>
    <div class="vex-custom-field-wrapper">
      <div class="vex-custom-input-wrapper">
      <label>On/Off</label> <input id="active" name="active" class="switch-input" type="checkbox" ${pat.active ? `checked` : `` }>
      <label class="switch-paddle" for="active">
        <span class="show-for-sr">On/Off</span>
        <span class="switch-active bold" aria-hidden="true" style="color: white">On</span>
        <span class="switch-inactive bold fp-orange" aria-hidden="true">Off</span>
      </label>
      </div>
    </div>
    `,

    callback: function(data) {
      if (data) {
        // Not cancelled
        // data has .title, .pattern, .type, .protocols, and .onOff (values on or off)
        pat.title = data.title && data.title.trim();
        pat.pattern = data.pattern && data.pattern.trim();
        pat.type = parseInt(data.type);
        pat.protocols = parseInt(data.protocols);
        pat.active = data.active == "on";
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
