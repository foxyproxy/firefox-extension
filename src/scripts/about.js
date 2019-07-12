const manifest = browser.runtime.getManifest();

document.querySelector('#version').textContent = manifest.version;
document.querySelector('#edition').textContent = FOXYPROXY_BASIC ? 'FoxyProxy Basic' : 'FoxyProxy Standard';
document.querySelector('#okBtn').addEventListener('click', () => location.href = '/proxies.html');
