'use strict';

// ----------------- Constants -----------------------------
const FOXYPROXY_BASIC = false;

// Bit-wise flags so we can add/remove these independently. We may add more later so PROTOCOL_ALL is future-proof.
const PROTOCOL_ALL = 1; // in case other protocols besides http and https are supported later
const PROTOCOL_HTTP = 2;
const PROTOCOL_HTTPS = 4;


// import | pac
const PROXY_TYPE_HTTP = 1;
const PROXY_TYPE_HTTPS = 2;
const PROXY_TYPE_SOCKS5 = 3;
const PROXY_TYPE_SOCKS4 = 4;
const PROXY_TYPE_NONE = 5; // DIRECT
const PROXY_TYPE_PAC = 6;
const PROXY_TYPE_WPAD = 7;
const PROXY_TYPE_SYSTEM = 8;
const PROXY_TYPE_PASS = 9;


const PATTERN_TYPE_WILDCARD = 1;
const PATTERN_TYPE_REGEXP = 2;



// bg | import | proxy | utils
const PATTERN_ALL_WHITE = {
  title: 'all URLs',
  active: true,
  pattern: '*',
  type: 1,                    // PATTERN_TYPE_WILDCARD,
  protocols: 1                // PROTOCOL_ALL
};

// patterns | proxy
// the local-internal blacklist, always used as a set
const blacklistSet = [
  {
    title: "local hostnames (usually no dots in the name). Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
    pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\\.\\d+\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
  },
  {
    title: "local subnets (IANA reserved address space). Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
    pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?(?:192\\.168\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6789]|2[0-9]|3[01])\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
  },
  {
    title: "localhost - matches the local host optionally prefixed by a user:password authentication string and optionally suffixed by a port number. The entire local subnet (127.0.0.0/8) matches. Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
    pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?[\\w-]+(?::\\d+)?(?:/.*)?$"
  }
].map (item => {
  item.active = true;
  item.type = 2;              // PATTERN_TYPE_REGEXP,
  item.protocols = 1;         // PROTOCOL_ALL  
  return item;
});


/*
const LASTRESORT = 'k20d21508277536715';
const DEFAULT_PROXY_SETTING = {
  //id: Number.MAX_SAFE_INTEGER, // Not here so we dont save it to disk as an object property but instead as a key
  index: Number.MAX_SAFE_INTEGER,
  id: LASTRESORT,
  active: true,
  title: 'Default',
  notes: 'These are the settings that are used when no patterns match a URL.',
  color: '#0055E5',
  type: PROXY_TYPE_NONE,
  whitePatterns: [PATTERN_ALL_WHITE],
  blackPatterns: []
}
*/


// ----------------- Utils ---------------------------------
class Utils {

  static notify(message, title = 'FoxyProxy') {
    // the id is not used anywhere and can be omitted, it is only useful if you want to manually close the notification early
    chrome.notifications.create('foxyproxy', {
      type: 'basic',
      iconUrl: '/images/icon.svg',
      title,
      message
    });
  }

  // options | popup
  static isUnsupportedType(type) {
    //return type === PROXY_TYPE_PAC || type === PROXY_TYPE_WPAD || type === PROXY_TYPE_SYSTEM || type === PROXY_TYPE_PASS;
    return [PROXY_TYPE_PAC, PROXY_TYPE_WPAD, PROXY_TYPE_SYSTEM, PROXY_TYPE_PASS].includes(type);
  }

  // bg | pattern-tester | validate-pattern
  static wildcardToRegExp(pat) {

    let start = 0, end = pat.length, matchOptionalSubdomains = false;

    if (pat[0] === '.') { pat = '*' + pat; }

    if (pat.startsWith('**')) {
      // Strip asterisks from front and back
      while (pat[start] === '*' && start < end) start++;
      while (pat[end - 1] === '*' && start < end) end--;
      // If there's only an asterisk left, match everything
      if (end - start == 1 && pat[start] == '*') return new RegExp('');
    }
    else if (pat.startsWith('*.')) { matchOptionalSubdomains = true; }

    let regExpStr = pat.substring(start, end+1)
      // $& replaces with the string found, but with that string escaped
      .replace(/[$.+()^{}\]\[|]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    if (matchOptionalSubdomains) {
        // Non-capturing group that matches:
        // any group of non-whitespace characters following by an optional . repeated zero or more times
        regExpStr = '(?:\\S+\\.)*' + regExpStr.substring(4);
    }

    // Leading or ending double-asterisks mean exact starting and ending positions
    if (start === 0) { regExpStr = '^' + regExpStr; }
    if (end === pat.length) { regExpStr += '$'; }
    return regExpStr;
  }

  // import | pattern
  static importFile(file, mimeTypeArr, maxSizeBytes, jsonOrXml, callback) {

    if (!file) {
      alert('There was an error');
      return;
    }

    // Check MIME type // note chrome file.type for JSON is blank ... type: ""
    if (file.type && !mimeTypeArr.includes(file.type)) {
      alert('Unsupported file format');
      return;
    }

    if (file.size > maxSizeBytes) {
      alert('Filesize is too large');
      return;
    }

    const reader  = new FileReader();
    reader.onloadend = () => {
      if (reader.error) {
        alert('Error reading file.');
        return;
      }

      let settings;
      try {
        if (jsonOrXml === 'json') { settings = JSON.parse(reader.result); }
        else if (jsonOrXml === 'xml') {
          settings = new DOMParser().parseFromString(reader.result, 'text/xml');
          if (settings.documentElement.nodeName === 'parsererror') { throw new Error(); }
        }
      }
      catch(e) {
        console.log(e);
        alert("Error parsing file. Please remove sensitive data from the file, and then email it to support@getfoxyproxy.org so we can fix bugs in our parser.");
        return;
      }
      if (settings && confirm('This will overwite existing proxy settings. Are you sure?')) { callback(settings); }

    };
    reader.onerror = () => { alert('Error reading file'); };
    reader.readAsText(file);
  }

  // import | options
  static exportFile() {

    chrome.storage.local.get(null, result => {
      !result.sync ? Utils.saveAs(result) : chrome.storage.sync.get(null, result => { 
        result.sync = true;                                 // storing syn value
        Utils.saveAs(result);
      });
    });
  }
  // exportFile helper
  static saveAs(data) {

    const settings = data; //Utils.prepareForSettings(data);
    const blob = new Blob([JSON.stringify(settings, null, 2)], {type : 'text/plain;charset=utf-8'});
    const filename = chrome.i18n.getMessage('extensionName') + '_' + new Date().toISOString().substring(0, 10) + '.json';
    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename,
      saveAs: true,
      conflictAction: 'uniquify'
    });
  }

/*
  // utils only used for export, will be removed as DB format export is adapted
  static prepareForSettings(settings = {}) {

    //if (settings && !settings.mode) { }// 5.0 settings

    let lastResortFound = false;
    const prefKeys = Object.keys(settings);

    const def = {
      id: LASTRESORT,
      active: true,
      title: 'Default',
      notes: 'These are the settings that are used when no patterns match a URL.',
      color: '#0055E5',
      type: PROXY_TYPE_NONE,
      whitePatterns: [PATTERN_ALL_WHITE],
      blackPatterns: []
    };

    // base format
    const ret = {
      mode: 'disabled',
      proxySettings: [],
      logging: {
        size: 500,
        active: true
      }
    };

    if (!prefKeys.length) {                                     // settings is {}
      ret.proxySettings = [def];
      return ret;
    }

    prefKeys.forEach(key => {

      switch (key) {

        case 'mode':
        case 'logging':
          ret[key] = settings[key];
          break;

        case 'sync': break;                                 // do nothing

        default:
          const temp = settings[key];
          temp.id = key;                                    // Copy the id into the object
          temp.id === LASTRESORT && (lastResortFound = true);
          ret.proxySettings.push(temp);
      }
    });

    ret.proxySettings.sort((a, b) => a.index - b.index);
    ret.proxySettings.forEach(item => delete item.index);   // Re-calculated when/if this object is written to disk again (user may move proxySetting up/down)

    !lastResortFound && ret.proxySettings.push(def);        // add default lastresort

    return ret;
  }
*/  

}
