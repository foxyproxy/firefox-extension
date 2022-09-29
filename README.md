
# September 2022
This repository is not used anymore. Please refer to the new repository at https://github.com/foxyproxy/browser-extension for version 8.0 and above

# FoxyProxy for Firefox

The FoxyProxy extension has been around for almost 15 years as of 2019. It has been rewritten several times and is still maintained by the original developer, Eric H. Jung, with large contributions by others (e.g. erosman, Jesper Hansen, Georg Koppen, and others). As of 2019/2020, ericjung and erosman are primary developers.

Originally for Firefox, a Chrome edition was released years ago as well. It does not share the same codebase (yet), so this project is strictly for the Firefox edition. We hope they will share the same codebase sometime in 2020.

Pre-Firefox 57 (Quantum) versions are not maintained here. They are stored in a private git repo which I will release to github when time permits.

## Editions

FoxyProxy for Firefox comes in three editions. Two of these editions are in this repository.

### [Standard](https://addons.mozilla.org/firefox/addon/foxyproxy-standard/)

This edition switches requests between proxy servers based on domain/URL patterns or manually selecting a proxy server to use for all requests. This is the default build target for this project.

### [Basic](https://addons.mozilla.org/firefox/addon/foxyproxy-basic/)

This edition sends all requests through a proxy servers manually selected by the user. There is no domain/URL pattern switching like with Standard and Plus. This build target can be selected by TODO.

### Plus

No longer maintained since Firefox 57 dropped support for critical APIs. The source code is not in this repo. It had the same features as standard but also enabled switching by internal (LAN) IP address. For example, if your laptop connected to a work/school network and a home network, you could have different switching rules based on your location (providing the internal IP addresses were different, and they almost always are). Many people used this to automatically disable FoxyProxy while at home but enable it while at work or school.

## Translations!

FoxyProxy is internationalized! Translate [messages.json](https://github.com/foxyproxy/firefox-extension/blob/master/src/_locales/en/messages.json) then make a pull request or email the file to me. Pre-Firefox 57 (Quantum) editions had 33 or 35 languages!

## Building

FoxyProxy **Standard** edition is built by default. To build FoxyProxy **Basic** edition:

* change `FOXYPROXY_BASIC` from `false` to `true` in [utils.js](https://github.com/foxyproxy/firefox-extension/blob/master/src/scripts/utils.js)
* change browser_specific_settings.id in [manifest.json](https://github.com/foxyproxy/firefox-extension/blob/master/src/manifest.json) from `foxyproxy@eric.h.jung` to `foxyproxy-basic@eric.h.jung`

### Building With Grunt

[Install grunt](https://stackoverflow.com/questions/15703598/how-to-install-grunt-and-how-to-build-script-with-it), which requires npm and node.

Run grunt in top-level directory. The add-on is packaged into target.zip

### Building Without Grunt

Zip the [src](https://github.com/foxyproxy/firefox-extension/tree/master/src) directory.

## Running a development instance

0. Clone this repository: `git clone https://github.com/foxyproxy/firefox-extension.git`
1. In Firefox, navigate to `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Choose `manifest.json` in the cloned repository on your local system.

Note some items are cached by Firefox. Please refer to other online documentation for complete development and debugging of add-ons.

## Authors

* **Eric H. Jung** - [FoxyProxy](https://getfoxyproxy.org/team/)
* **[erosman](https://github.com/erosman)**
* **[FeralMeow](https://github.com/wsxy162)** - Chinese (Simplified) translation
* **[samuikaze](https://github.com/samuikaze)** - Chinese (Traditional) translation
* **[Hugo-C](https://github.com/Hugo-C)** - French translation
* **Vadim** - Russian translation
* **Your Name Here** if you contribute a language translation or other work


## License

This project is licensed under the GPL 2.0 License. Commercial re-licensing may be available on request.

## Feature Requests / RoadMap
