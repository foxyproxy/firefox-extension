$(document).foundation();

document.addEventListener("DOMContentLoaded", function() {
  browser.management.getSelf().then((extInfo) => {
    $("#version").text(extInfo.version);
    /* This requires the management permission, so don't do it.
    let edition;
    if (extInfo.id == "foxyproxy@eric.h.jung") edition = "FoxyProxy Standard";
    else if (extInfo.id == "foxyproxy-basic@eric.h.jung") edition = "FoxyProxy Basic";
    else edition = extInfo.id;*/
    if (FOXYPROXY_BASIC) $("#edition").text("FoxyProxy Basic");
    else $("#edition").text("FoxyProxy Standard");
  });
});

$(document).on("click", "#okBtn", function() {
  location.href = "/proxies.html";
});

