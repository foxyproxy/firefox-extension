# FoxyProxy for Firefox

The FoxyProxy extension has been around for almost 15 years as of 2019. It has been rewritten several times, but it is still maintained by the original developer, Eric H. Jung.

Originally for Firefox, a Chrome edition was released years ago as well. It does not share the same codebase (yet), so this project is strictly for the Firefox edition.

Pre-Firefox 57 (Quantum) versions are not maintained here. They are stored in a private git repo which I will release to github when time permits.

## Editions

FoxyProxy for Firefox comes in three flavors. Two of these flavors are in this repository.

### [Standard](https://addons.mozilla.org/firefox/addon/foxyproxy-standard/)

This edition switches requests between proxy servers based on domain/URL patterns or manually selecting a proxy server to use for all requests. This is the default build target for this project.

### [Basic](https://addons.mozilla.org/firefox/addon/foxyproxy-basic/)

This edition sends all requests through a proxy servers manually selected by the user. There is no domain/URL pattern switching like with Standard and Plus. This build target can be selected by TODO.

### Plus

No longer maintained since Firefox 57 dropped support for critical APIs. The source code is not in this repo. It had the same features as standard but also enabled switching by internal (LAN) IP address. For example, if your laptop connected to a work/school network and a home network, you could have different switching rules based on your location (providing the internal IP addresses were different, and they almost always are). Many people used this to automatically disable FoxyProxy while at home but enable it while at work or school.

## Translations!

FoxyProxy is partially internationalized and should be completed in July/August 2019. I look forward to your translation! Pre-Firefox 57 (Quantum) editions had 33 or 35 languages!

## Running a development instance

TODO

## Authors

* **Eric H. Jung** - [FoxyProxy](https://getfoxyproxy.org/team/)
* **Your Name Here** if you contribute a language translation


## License

This project is licensed under the GPL 2.0 License

