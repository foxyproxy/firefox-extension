$(document).foundation();
Utils.localizeHtmlPage();
let noRefresh = false;

function start() {
  getAllSettings().then((settings) => {
    storageRetrievalSuccess(settings);
    installListeners();
  }).catch((e) => storageRetrievalError(e));

  usingSync().then((useSync) => {
    $("#syncOnOff").prop("checked", useSync);
  }).catch((e) => {console.error(`usingSync() error: ${e}`);reject(e)});
}

start();
browser.runtime.onMessage.addListener((messageObj, sender) => {
  //console.log("browser.runtime.onMessage listener: ");
  //console.log(messageObj);

  if (messageObj == MESSAGE_TYPE_DISABLED) $("#mode").val(DISABLED);
});

function storageRetrievalSuccess(settings) {
  //deleteAllSettings();
  console.log("storageRetrievalSuccess()");
  //console.log(settings);
  if (!settings.proxySettings || !settings.proxySettings.length) {
    // Display defaults
    console.log("No proxies found in storage.");
    $("#accounts").html(''); // clear anything that's there
    $("#spinnerRow,#mainRow").hide();
    $("#noProxiesRow").show();
  }
  else {
    console.log("Proxies found in storage.");
    renderProxies(settings);
    $("#spinnerRow").hide();
    $("#accountsRow").show();
  }
}

function storageRetrievalError(error) {
  console.log(`storageRetrievalError(): ${error}`);
  $("#noProxiesRow").show();
}

function renderProxies(settings) {
  let rows = [], proxySettings = settings.proxySettings, modeOptions = [];
  for (var i=0; i<proxySettings.length; i++) {
    let proxySetting = settings.proxySettings[i];
    //console.log("proxySetting: ");
    //console.log(proxySetting);
    let t = $("#proxyRowTemplate").html(),
      previousProxySettingId = i > 0 ? proxySettings[i-1].id : -1,
      nextProxySettingId = i < proxySettings.length-1 && proxySettings[i+1].id != LASTRESORT ? proxySettings[i+1].id : -1,
      option = Utils.getOption(proxySetting);
    if (option) modeOptions.push(option);

    if (Utils.isUnsupportedType(proxySetting.type)) {
      t = t.replace('%color', 'unsupported-color');
    }
    else if (settings.mode == PATTERNS || settings.mode == RANDOM || settings.mode == ROUND_ROBIN)
      t = t.replace('%color', proxySetting.active ? 'success' : 'secondary');
    else if (settings.mode == DISABLED)
      t = t.replace('%color', 'secondary');
    else
      t = t.replace('%color', settings.mode == proxySetting.id ? 'success' : 'secondary');

    if (proxySetting.active) t = t.replace(/%onoffchecked/g, "checked");

    t = t.replace(/%data-id/g, proxySetting.id)
      .replace(/%data-next-proxy-id/g, nextProxySettingId)
      .replace(/%data-previous-proxy-id/g, previousProxySettingId)
      .replace("%hide-if-top", previousProxySettingId == -1 ? "hide-unimportant" : "")
      .replace("%show-if-top", previousProxySettingId == -1 ? "": "hide-unimportant")
      .replace("%hide-if-bottom", nextProxySettingId == -1 ? "hide-unimportant" : "")
      .replace("%show-if-bottom", nextProxySettingId == -1 ? "": "hide-unimportant")
      .replace("%color-blob", proxySetting.color);

    if (proxySetting.type == PROXY_TYPE_NONE)
      t = t.replace("%hide-if-no-server", "hide-unimportant");
    else
      t = t.replace("%data-server", Utils.ellipsis(proxySetting.address));

    // Only display title if it's different than address and it exists
    if (!proxySetting.title || proxySetting.title == proxySetting.address)
      t = t.replace("%hide-if-no-title", "hide-unimportant")
    else t = t.replace("%data-title", Utils.getNiceTitle(proxySetting))

    if (proxySetting.id == LASTRESORT)
      t = t.replace(/%hide-if-default-proxy/g, "hide-if-default-proxy");

    if (Utils.isUnsupportedType(proxySetting.type))
      t = t.replace(/%hide-if-unsupported/g, "hide-if-unsupported");

    if (FOXYPROXY_BASIC) t = t.replace(/%hide-if-foxyproxy-basic/g, "hide-unimportant");

    rows.push(t);
  }
  $("#accounts").html(""); // clear anything that's there
  $("#accounts").html(rows.join(""));

  // For some reason, we cannot successfully insert into a <select> that has 'patterns' and 'disabled'
  // hard-coded in the HTML.
  // So instead we add them dynamically with the rest of the options.
  $("#mode").html(""); // clear anything that's there
  if (!FOXYPROXY_BASIC) $("#patterns").clone().appendTo("#mode");
  $("#mode").append(modeOptions.join(''));
  $("#disabled").clone().appendTo("#mode");


  // Select the proper option
  if (settings.mode == PATTERNS) {
    $("#mode").css("color", $("#patterns").attr("color"));
    $("#mode").val(PATTERNS);
  }
  else if (settings.mode == DISABLED) {
    $("#mode").css("color", $("#disabled").attr("color"));
    $("#mode").val(DISABLED);
  }
  else {
    $("#mode").val(settings.mode);
    // Get color
    let color = $("option[value='" + settings.mode + "']").attr("color");
    $("#mode").css("color", color);
  }
}

function installListeners() {
  $(document).off(); // Remove any existing handlers

  $(document).on("click", "#syncOnOff", () => {
    let useSync = $("#syncOnOff").prop("checked");
    setStorageSync(useSync).then(() => console.log("sync value updated to " + useSync));
  });

  $(document).on("click", "a[class*=patterns]", (evt) => {
    //console.log("clicked id ");
    let id = getNearestId(evt);
    //console.log(id);
    id = Utils.jsonObject2UriComponent(id);
    location.href = `/patterns.html?id=${id}`;
    return false;
  });


  $(document).on("click", "div[data-addedit-proxy],a[data-addedit-proxy]", (evt) => {
    //console.log("clicked id ");
    let id = getNearestId(evt);
    //console.log(id);
    id = Utils.jsonObject2UriComponent(id);
    location.href = `/add-edit-proxy.html?id=${id}`;
    return false;
  });

  $(document).on("click", "#deleteAll", (evt) => {
    if (confirm(chrome.i18n.getMessage("delete_confirmation")))
      deleteAllSettings().then(() => console.log("delete all completed"));
		return false;
  });

  $(document).on("click", "a[data-single-delete]", (evt) => {
    let id = getNearestId(evt), title="Delete Proxy";
    console.log("deleteoneproxysetting: " + id);
    if (confirm(chrome.i18n.getMessage("delete_confirmation")))
			deleteProxyById(id).then(() => console.log("delete single completed"));
    return false;
  });

  $(document).on("click", "input[name=onOff]", (evt) => {
    console.log("toggle on/off");
    let id = getNearestId(evt);
    toggleActiveProxySetting(id).then(() => console.log("toggleDone"));
    return false;
  });

  $(document).on("click", "a[data-moveup]", (evt) => {
    console.log("moveup");
    let id = getNearestId(evt), previousProxySettingId = $(evt.target).closest("a[data-previous-proxy-id]").attr("data-previous-proxy-id");
    console.log(`id: ${id}, previousProxySettingId: ${previousProxySettingId}`);

    $("#" + id).swap({
        target: previousProxySettingId, // Mandatory. The ID of the element we want to swap with
        opacity: "0.5", // If set will give the swapping elements a translucent effect while in motion
        speed: 100, // The time taken in milliseconds for the animation to occur
        callback: function() { // Optional. Callback function once the swap is complete
          noRefresh = true;
          swapProxySettingWithNeighbor(id, previousProxySettingId).then((settings) => {
            console.log("swapProxySettingWithNeighbor() succeeded");
            renderProxies(settings);
          }).catch((e) => {console.error("swapProxySettingWithNeighbor failed: " + e)});
        }
    });
    return false;
  });

  $(document).on("click", "a[data-movedown]", (evt) => {
    console.log("movedown");
    console.log(evt.target.nodeName);
    let id = getNearestId(evt), nextProxySettingId = $(evt.target).closest("a[data-next-proxy-id]").attr("data-next-proxy-id");
    console.log(`id: ${id}, nextProxySettingId: ${nextProxySettingId}`);

    $("#" + id).swap({
        target: nextProxySettingId, // Mandatory. The ID of the element we want to swap with
        opacity: "0.5", // If set will give the swapping elements a translucent effect while in motion
        speed: 100, // The time taken in milliseconds for the animation to occur
        callback: function() { // Optional. Callback function once the swap is complete
          noRefresh = true;
          swapProxySettingWithNeighbor(id, nextProxySettingId).then((settings) => {
            console.log("swapProxySettingWithNeighbor() succeeded");
            renderProxies(settings);
          }).catch((e) => {console.error("swapProxySettingWithNeighbor failed: " + e)});
        }
    });
    return false;
  });

  $(document).on("change", "#mode", () => {
    setMode($("#mode").val());
  });

  $(document).on("click", "#export", () => {
    Utils.exportFile();
  });

  $(document).on("click", "#nukeBrowsingData", () => {
    if (confirm("Do not delete: stored passwords, browsing and form history, download history, webSQL, and server-bound certificates.\r\n\r\nDelete: cache, cookies, indexedDB storage, DOM local storage, plugin data, service worker data.")) {
      browser.browsingData.remove(
          {}, {
          //"appcache": true,
          "cache": true,
          "cookies": true,
          "downloads": false,
          //"fileSystems": true,
          "formData": false,
          "history": false,
          "indexedDB": true,
          "localStorage": true,
          "pluginData": true,
          //"passwords": true,
          //"webSQL": true,
          //"serverBoundCertificates": true,
          "serviceWorkers": true
        }).then(() => {alert("Done!")});
    }
  });

  function getNearestId(evt) {
    return $(evt.target).closest("div[id]").attr("id");
  }
}

// Update the UI whenever stored settings change and we are open.
// one example is user deleting a proxy setting that is the current mode.
// another: user changes mode from popup.html
browser.storage.onChanged.addListener((oldAndNewSettings) => {
  console.log("proxies.js: settings changed on disk");
  if (noRefresh) noRefresh = false; // We made the change ourselves
  //else location.reload();
  else start();
});
