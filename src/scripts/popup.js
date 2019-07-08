getAllSettings().then(popupSuccess, popupError).catch((e) => console.log("exception: " + e));

function popupSuccess(settings) {
  /*if (!proxySettings.length) {
    // Display defaults
    console.log("No proxies found in storage.");
    $("#spinnerRow").hide();
    $("#optionsRow").show();
  }
  else {
    console.log("Proxies found in storage.");*/
    renderOptions(settings);
 // }
}

function popupError(error) {
  console.log(`popupError(): ${error}`);
  $("#spinnerRow").hide();
  $("#errorRow").show();
}

function renderOptions(settings) {
  console.log("renderOptions() and settings is " + JSON.stringify(settings));
  let rows = [], ids = [];
  settings.proxySettings.forEach((proxySetting) => {
    let option = Utils.getOption(proxySetting);
    if (option) {
      rows.push(option);
      ids.push(proxySetting.id);
    }
  });

  $("#menuInsertPoint").html(rows.join(''));
  let mode = settings.mode ? settings.mode : PATTERNS;
  if (mode == PATTERNS) {
    $("#patternsSelected").replaceWith('<i class="fa fa-check" style="color:green"></i>&nbsp;');
  }
  else if (mode == DISABLED) {
    $("#disabledSelected").replaceWith('<i class="fa fa-check" style="color:green"></i>&nbsp;');
  }
  else {
    $("#" + mode + "Selected").replaceWith('<i class="fa fa-check" style="color:green"></i>&nbsp;');
  }

  if (FOXYPROXY_BASIC) $("#patternsListItem").hide();
  installListeners(ids);

  $("#spinnerRow").hide();
  $("#optionsRow").show();
}

function installListeners(ids) {
  $(document).on("click", "#options", function(evt) {
    Utils.showInternalPage("proxies").then(() => window.close());
  });

  $(document).on("click", "#where", function(evt) {
    browser.tabs.create({url: "https://getfoxyproxy.org/geoip/", active: true}).then(() => window.close());
  });

  $(document).on("click", "#log", function(evt) {
    Utils.showInternalPage("log").then(() => window.close());
  });


  $("#patterns,#disabled,#" + ids.join(",#")).on("click",function(e) {
    setMode($(this).attr("id")).then(() => { window.close() });
  });

  function enableOrDisable(active, evt) {
    evt.preventDefault();
    $("#optionsRow").hide();
    $("#spinnerRow").show();
    enableDisableAllProxySettings(active).then((proxySettings) => {
      let windows = browser.extension.getViews({type: "tab"});
      for (let w of windows)
        w.location.reload();
      popupSuccess(proxySettings);
    }, popupError);
  }
}