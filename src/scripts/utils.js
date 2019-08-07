'use strict';

// ----------------- Utils ------------------
class Utils {

  static notify(message, title = 'FoxyProxy') {
    // the id is not used anywhere and can be omitted, it is only useful if you want to manually close the notification early
    chrome.notifications.create('foxyproxy-notification', {
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

    // Check MIME type
    if (!mimeTypeArr.includes(file.type)) {
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
      !result.sync ? Utils.saveAs(result) : chrome.storage.sync.get(null, Utils.saveAs);
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

  // utils only used for export now
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
}
