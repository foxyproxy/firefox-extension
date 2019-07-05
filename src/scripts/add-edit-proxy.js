let idParam = Utils.urlParamsToJsonMap().id, oldProxySetting,
  color = new jscolor("colorChooser", {uppercase: false, hash: true});

document.addEventListener("DOMContentLoaded", function() {
  if (idParam) {
    // This is an edit operation. Read the data to be edited.
    getProxySettingById(idParam).then((proxyToEdit) => {
      oldProxySetting = proxyToEdit;
      // Populate the form
      $("#windowTitle").text("Edit Proxy " + Utils.getNiceTitle(proxyToEdit));
      $("#newProxyTitle").val(proxyToEdit.title ? proxyToEdit.title : "");
      $("#newProxyType").val(proxyToEdit.type);

      color.fromString(proxyToEdit.color ? proxyToEdit.color : DEFAULT_COLOR);
      $("#newProxyAddress").val(proxyToEdit.address ? proxyToEdit.address : "");
      $("#newProxyPort").val(proxyToEdit.port ? proxyToEdit.port : "");
      $("#newProxyUsername").val(proxyToEdit.username ? proxyToEdit.username : "");
      $("#newProxyPassword").val(proxyToEdit.password ? proxyToEdit.password : "");
      $("#proxyDNS").prop("checked", proxyToEdit.proxyDNS ? proxyToEdit.proxyDNS : false);
      $("#pacURL").val(proxyToEdit.pacURL ? proxyToEdit.pacURL : "");
      $(".hideIfEditing").hide();
      showHideStuff();
      $("#spinnerRow").hide();
      $("#addEditRow").show();
    })
    .catch((e) => {
      console.error("Unable to edit saved proxy proxy (could not get existing settings): " + e);
    });
  }
  else {
    resetForm();
    showHideStuff();
  }
});

$("#newProxyCancel,#newProxyCancel2").on("click", () => {
  // Set the password field type to text (not password) so that Firefox doesn't prompt
  // the user to save the password. Since we've already hidden this content with spinner,
  // user won't see the password anyway
  var pwInput = $("#newProxyPassword");
  $("#newProxyPassword").attr("type", "text");
  location.href = "/proxies.html";
});

$("#toggleNewProxyPasswordType").on("click", () => {
    var pwInput = $("#newProxyPassword");
    $("#newProxyPassword").attr("type", $("#newProxyPassword").attr("type") == "password" ? "text" : "password")
});

$("#newProxySave").on("click", () => {
  if (!validateInput()) return;
  saveProxySettingFromGUI().then(() => location.href = "/proxies.html")
  .catch((e) => {console.error("Error saving proxy: " + e)});
});

$("#newProxySaveAddAnother").on("click", () => {
  if (!validateInput()) return;
  saveProxySettingFromGUI().then(() => {
    resetForm();
  })
  .catch((e) => {console.error("Error saving proxy: " + e)});
});

$("#newProxySaveThenPatterns").on("click", () => {
  if (!validateInput()) return;
  saveProxySettingFromGUI().then((id) => {
    id = Utils.jsonObject2UriComponent(id);
    location.href = `/patterns.html?id=${id}`;
  })
  .catch((e) => {console.error("Error saving proxy: " + e)});
});

$(document).on("change", "#newProxyType", showHideStuff);

function showHideStuff() {

  // Show everything, then hide as necessary
  $(".supported,.hideIfNoProxy,.hideIfNotSOCKS5").show();
  $(".unsupported,.show-if-pac-or-wpad").hide();

  let proxyType = parseInt($("#newProxyType").val());

  if (proxyType == PROXY_TYPE_PAC || proxyType == PROXY_TYPE_WPAD || proxyType == PROXY_TYPE_SYSTEM) {
    $(".supported,.hideIfNoProxy").hide();
    $(".unsupported").show();
  }
  if (proxyType == PROXY_TYPE_PAC || proxyType == PROXY_TYPE_WPAD)
    $(".show-if-pac-or-wpad").show();

  if (proxyType == PROXY_TYPE_NONE) {
    $(".hideIfNoProxy").hide();
  }
  if (proxyType != PROXY_TYPE_SOCKS5)
    $(".hideIfNotSOCKS5").hide();

  if (oldProxySetting) {
    // Editing
    $(".hideIfEditing").hide();
  }
  if (FOXYPROXY_BASIC) $(".hideIfFoxyProxyBasic").hide();
}

function resetForm() {
  color.fromString(DEFAULT_COLOR);
  $("#windowTitle").text("Add Proxy");
  $("#newProxyTitle").val("");
  $("#newProxyType").val(PROXY_TYPE_HTTP);
  $("#newProxyAddress").val("");
  $("#newProxyPort").val("");
  $("#newProxyUsername").val("");
  $("#newProxyPassword").val("");
  $("#onOffWhiteAll").prop("checked", true);
  $("#onOffBlackAll").prop("checked", true);
  $("#proxyDNS").prop("checked", true);
  $("#pacURL").val("");
  $("#newProxyTitle").trigger("focus");
  showHideStuff();
  $("#spinnerRow").hide();
  $("#addEditRow").show();
}

function saveProxySettingFromGUI() {
  $("#spinnerRow").show();
  $("#addEditRow").hide();

  let proxySetting = {};

  if ($("#newProxyTitle").val()) proxySetting.title = $("#newProxyTitle").val();
  proxySetting.type = parseInt($("#newProxyType").val());
  proxySetting.color = $("#colorChooser").val();
  if (proxySetting.type != PROXY_TYPE_NONE) {
    proxySetting.address = $("#newProxyAddress").val();
    proxySetting.port = parseInt($("#newProxyPort").val());
    if (proxySetting.type == PROXY_TYPE_SOCKS5 && $("#proxyDNS").prop("checked")) proxySetting.proxyDNS = true;
    let username = $("#newProxyUsername").val().trim(), password = $("#newProxyPassword").val().trim();
    if (username) proxySetting.username = username; // don't store ""
    if (password) proxySetting.password = password;// don't store ""
  }

  // Set the password field type to text (not password) so that Firefox doesn't prompt
  // the user to save the password. Since we've already hidden this content with spinner,
  // user won't see the password anyway
  var pwInput = $("#newProxyPassword");
  $("#newProxyPassword").attr("type", "text");

  if (oldProxySetting) {
    // Edit operation
    proxySetting.active = oldProxySetting.active;
    proxySetting.whitePatterns = oldProxySetting.whitePatterns;
    proxySetting.blackPatterns = oldProxySetting.blackPatterns;
    if (oldProxySetting.pacURL) proxySetting.pacURL = oldProxySetting.pacURL; // imported foxyproxy.xml
    return editProxySetting(oldProxySetting.id, oldProxySetting.index, proxySetting)
  }
  else {
    // Add operation
    proxySetting.active = true;  // new entries are instantly active. TODO: add checkbox on GUI instead of assuming
    // Do not use this proxy for internal IP addresses. TODO: add checkbox on GUI instead of assuming
    if ($("#onOffWhiteAll").prop("checked")) proxySetting.whitePatterns = [PATTERN_ALL_WHITE];
    else proxySetting.whitePatterns = [];

    if ($("#onOffBlackAll").prop("checked")) proxySetting.blackPatterns = [PATTERN_LOCALHOSTURLS_BLACK, PATTERN_INTERNALIPS_BLACK, PATTERN_LOCALHOSTNAMES_BLACK];
    else proxySetting.blackPatterns = [];

    return addProxySetting(proxySetting);
  }
}

function validateInput() {
  Utils.trimAllInputs();
  Utils.escapeAllInputs("#newProxyTitle,#newProxyAddress,#newProxyPort");
  let type = parseInt($("#newProxyType").val());
  if (type == PROXY_TYPE_NONE) return true;
  let r1 = markInputErrors("#newProxyAddress"), r2 = markInputErrors("#newProxyPort", true);
  return r1 && r2;
}

// Return false if any item in the selector is empty or doesn't have only nums when
// |numbersOnly| is true
function markInputErrors(selector, numbersOnly) {
  let ret = true;
  $(selector).each(function() {
    $(this).removeClass("is-invalid-input");
    let elemVal = $(this).val();
    if (elemVal) {
      if (numbersOnly) {
        if (!/^\d+$/.test(elemVal)) {
          $(this).addClass("is-invalid-input");
          ret = false;
        }
      }
    }
    else {
      $(this).addClass("is-invalid-input");
      ret = false
    }
  });
  return ret;
}
