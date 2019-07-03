/**
 *
REMEMBER, EACH KEY ONLY HAS 1 MB MAX STORAGE!!
THAT IS WHY WE CANNOT STORE STRUCTURE LIKE THIS:
{
  "mode":"patterns",
  "proxySettings": [{...}, {...}, {...}]
}

PROXYSETTINGS KEY WOULD FILL 1 MB VERY QUICKLY

Instead we have the below format, and we convert to/from it
so the rest of the addon uses the above structure but the below is how
storage looks:

{
  "mode": 16,
  "lastresort": {
    "active": true,
    "title": "Default",
    "notes": "These are the settings that are used when no patterns match a URL.",
    "color": "#0055E5",
    "type": 5,
    "whitePatterns": [
      {
        "title": "all URLs",
        "active": true,
        "pattern": "*",
        "type": 1,
        "protocols": 1
      }
    ],
    "blackPatterns": [],
    "index": 9007199254740991
  },
  "ye3ikc1508098264080": {
    "title": "test",
    "type": 3,
    "color": "#66cc66",
    "address": "123.123.123.123",
    "port": 9999,
    "username": "eric",
    "password": "jung",
    "active": true,
    "whitePatterns": [
      {
        "title": "all URLs",
        "active": true,
        "pattern": "*",
        "type": 1,
        "protocols": 1
      }
    ],
    "blackPatterns": [
      {
        "title": "localhost URLs",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\\.\\d+\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "protocols": 1
      },
      {
        "title": "internal IP addresses",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:192\\.168\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6789]|2[0-9]|3[01])\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "protocols": 1
      },
      {
        "title": "localhost hostnames",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?[\\w-]+(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "protocols": 1
      }
    ],
    "index": 0
  }
}

*/
const PROXY_SETTINGS = "proxySettings";
const MODE = "mode";
const LOGGING = "logging";
const SYNC = "sync";

function _initializeStorage() {
  return new Promise((resolve, reject) => {
    // SYNC Always stored locally
    browser.storage.local.get([SYNC]).then((tmp) => {
      if (!(SYNC in tmp) || typeof(tmp[SYNC]) != "boolean") tmp[SYNC] = true; // true by default
      useSync = tmp[SYNC]; // unwrap from the object we're passed in |tmp|
      //console.log("storage init(): useSync is " + JSON.stringify(useSync));
      storage = useSync ? browser.storage.sync : browser.storage.local;
      resolve(storage);
    });
  });
}

// Set if we should use local or remote storage.
// This value is *always* stored locally and can therefore never be sync'd.
function setStorageSync(useSync) {
  return browser.storage.local.set({[SYNC]: useSync});
}

// True/false if we're using remote (sycn) storage.
function usingSync() {
  return new Promise((resolve, reject) => {
    return _initializeStorage().then((storage) => {
      resolve(storage === browser.storage.sync);
    }).catch(e => {console.error(`_initializeStorage() error: ${e}`);reject(e)});
  });
}

// Returns native object
function _getAllSettingsNative() {
  return _initializeStorage().then((storage) => {
    return storage.get();
  }).catch(e => {console.error(`_initializeStorage() error: ${e}`);reject(e)});
}

function setLogging(sz, a) {
  return _initializeStorage().then((storage) => {
    return storage.set({[LOGGING]: {size: sz, active: a}});
  }).catch(e => {console.error(`_initializeStorage() error: ${e}`);reject(e)});
}

// Returns as an 0-indexed array
function getAllSettings() {
  return new Promise((resolve, reject) => {
    _getAllSettingsNative().then((o) => {resolve(storageObjectToAddonStruct(o))})
    .catch((e) => {console.error(`getAllSettings() error: ${e}`);reject(e)});
  });
}

function getProxySettingById(id) {
  return _initializeStorage().then((storage) => {
    return new Promise((resolve, reject) => {
      //console.log("getProxySettingById(): id is " + id);
      storage.get(id).then((ps) => {
        if (id == LASTRESORT && Object.keys(ps).length == 0) {
          // There are edge cases when the default proxy setting hasn't been written to disk but exists in memory
          // e.g. if users clicks 'delete all' and then tries to edit the default proxy setting before doing
          // anything else that would result in all settings being writtn to disk
          resolve(DEFAULT_PROXY_SETTING);
        }
        ps[id].id = id;
        resolve(ps[id]);
      })
      .catch((e) => {console.error(`getProxySettingById() error: ${e}`);reject(e)});
    }).catch((e) => {console.error(`new Promise() error: ${e}`);reject(e)});
  }).catch(e => {console.error(`_initializeStorage() error: ${e}`);reject(e)});
}

function deleteAllSettings() {

  return new Promise((resolve, reject) => {
    _getAllSettingsNative().then((settings) => {
      // Remove all except default/lastresort. User may have customized it so save it back.
      let newSettings = {mode: DISABLED}, lastResortFound = false;
      for (let i in settings) {
        if (i == LASTRESORT) {
          lastResortFound = true
          // "Reset" the default proxy setting by copying its whitePatterns, blackPatterns, active state, etc
          newSettings[LASTRESORT] = JSON.parse(JSON.stringify(DEFAULT_PROXY_SETTING));
          // Copy over the user-customizable things about the default proxy (color, title, etc)
          newSettings[LASTRESORT].color = settings[i].color;
          newSettings[LASTRESORT].title = settings[i].title;
          delete newSettings[LASTRESORT].id; // Don't need to write this to disk for this object
        }
      }
      if (!lastResortFound) newSettings[LASTRESORT] = JSON.parse(JSON.stringify(DEFAULT_PROXY_SETTING), (key, value) => key == "id" ? undefined : value);

      browser.runtime.sendMessage(MESSAGE_TYPE_DELETING_ALL_SETTINGS).then(() =>
        storage.clear()).then(() => writeAllSettings(newSettings, false).then(() =>
          resolve()));
    })
    .catch((e) => {console.error(`getAllSettings() error: ${e}`);reject(e)});
  });
}

function deleteProxyById(id) {
  // Prevent deletion of default proxy setting
  if (id == LASTRESORT) return new Promise((resolve, reject) => {resolve()});

  console.log(`Deleting proxy setting with id ${id}`);
  return new Promise((resolve, reject) => {
    _initializeStorage().then((storage) => {
      // First delete
      storage.remove(id).then(() => {
        // Now re-index the remaining
        _getAllSettingsNative().then((settings) => {
          if (settings.mode == id) settings.mode = DISABLED;
          settings = storageObjectToAddonStruct(settings); // Forces a re-index of |index| attributes
          writeAllSettings(settings).then(() => resolve(settings))
            .catch((e) => {console.error(`deleteProxyById() error: ${e}`);reject(e)});
        }).catch((e) => {console.error(`_getAllSettingsNative() error: ${e}`);reject(e)});
      }).catch((e) => {console.error(`storage.remove() error: ${e}`);reject(e)});
    }).catch((e) => {console.error(`_initializeStorage() error: ${e}`);reject(e)});
  }).catch((e) => {console.error(`new Promise() error: ${e}`);reject(e)});
}

// Pre-condition: _initializeStorage() has been called.
function writeAllSettings(settings, convert = true) {
  // 2018-05-03 Eri Jung: I've confirmed that _initializeStorage() is called before this function is called.
  // If you use this again, make sure that precondition is still true.
  if (settings.length === 0) return deleteAllSettings();
  if (storage == browser.storage.local)
    settings[SYNC] = false; // restore this value that was possibly deleted
  return storage.set(convert ? addonStructToStorageObject(settings) : settings);
}

function editProxySetting(id, index, proxySetting) {
  delete proxySetting.id; // We don't need to write this, in case it's in the object. it's the key.
  proxySetting.index = index;
  return new Promise((resolve, reject) => {
    _initializeStorage().then((storage) => {
      storage.set({[id]: proxySetting}).then(() => resolve(proxySetting))
        .catch((e) => {console.error(`editProxySetting() error: ${e}`);reject(e)});
    }).catch((e) => {console.error(`_initializeStorage() error: ${e}`);reject(e)});
  });
}

function addProxySetting(proxySetting) {
  proxySetting.index = -1;
  let id = Utils.getUniqueId();
  return new Promise((resolve, reject) => {
    _getAllSettingsNative().then((settings) => { // calls _initializeStorage()
      settings[id] = proxySetting;
      settings = storageObjectToAddonStruct(settings); // Forces a re-index of |index| attributes
      //console.log("writing...");
      //console.log(JSON.stringify(settings, null, 2));
      writeAllSettings(settings).then(() => resolve(id))
        .catch((e) => {console.error(`addProxySetting() error: ${e}`);reject(e)});
    }).catch((e) => {console.error(`_getAllSettingsNative() error: ${e}`);reject(e)});
  });
}

// Toggle active state.
// The success promise contains the proxySetting along with updated active state
function toggleActiveProxySetting(id) {

  // Prevent movement of default proxy setting
  if (id == LASTRESORT) return new Promise((resolve, reject) => {resolve()});

  return getProxySettingById(id).then((proxySetting) => { // calls _initializeStorage()
    proxySetting.active = !proxySetting.active;
    return editProxySetting(proxySetting.id, proxySetting.index, proxySetting);
  }).catch((e) => {console.error(`getProxySettingById() error: ${e}`);reject(e)});
}

function swapProxySettingWithNeighbor(id, neighborId) {

  // Prevent movement of default proxy setting
  if (id == LASTRESORT || neighborId == LASTRESORT) return new Promise((resolve, reject) => {resolve()});

  return new Promise((resolve, reject) => {
    _getAllSettingsNative().then((settings) => { // calls _initializeStorage()
      // Sanity check
      let first, second;
      for (let i in settings) {
        if (i != MODE) {
          let setting = settings[i];
          if (i == id) first = settings[i];
          else if (i == neighborId) second = settings[i];
        }
      }
      if (first && second) {
        console.log(`first is id: ${id} with index ${settings[id].index} and second is ${neighborId} and index ${settings[neighborId].index}`);
        let tmp = settings[id].index;
        settings[id].index = settings[neighborId].index;
        settings[neighborId].index = tmp;
        // We could do two calls to editProxySetting() but that means 2 separate writes, which
        // takes longer but also means two PAC regenerations, and an inaccurate PAC between the two writes
        writeAllSettings(settings, false).then(() => resolve(storageObjectToAddonStruct(settings)))
          .catch((e) => {console.error(`swapProxySettingWithNeighbor() failed: ${e}`);reject(e)});
      }
    }).catch((e) => {console.error(`_getAllSettingsNative() error: ${e}`);reject(e)});
  });
}

function enableDisableAllProxySettings(active) {
  return new Promise((resolve, reject) => {
    _getAllSettingsNative().then((settings) => { // calls _initializeStorage()
      for (let i in settings) {
        if (i != MODE && i != LASTRESORT) settings[i].active = active;
        // If the proxySetting is being disabled and its the current mode, change mode to disabled
        if (!active && settings[MODE] == settings[i].id) settings[MODE] = "disabled";
      }
      writeAllSettings(settings, false).then(() => resolve(storageObjectToAddonStruct(settings)))
        .catch((e) => {console.error(`enableDisableAllProxySettings() failed: ${e}`);reject(e)});
    }).catch((e) => {console.error(`_getAllSettingsNative() failed: ${e}`);reject(e)});
  });
}

function setMode(mode) {
  return _initializeStorage().then((storage) => {
    return storage.set({[MODE]: mode});
  }).catch(e => {console.error(`_initializeStorage() error: ${e}`);reject(e)});
}


/**
Example 5.0 format. Note the missing "mode" key. Also pattern objects have a useless "whiteBlack" key

{
  "2uohdn1508091810137": {
    "title": "proxy1",
    "type": 1,
    "address": "111.111.111.111",
    "port": 1,
    "username": "eric",
    "password": "jung",
    "active": true,
    "whitePatterns": [
      {
        "title": "all URLs",
        "active": true,
        "pattern": "*",
        "type": 1,
        "whiteBlack": 1,
        "protocols": 1
      }
    ],
    "blackPatterns": [
      {
        "title": "localhost URLs",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\\.\\d+\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "whiteBlack": 2,
        "protocols": 1
      },
      {
        "title": "internal IP addresses",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:192\\.168\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6789]|2[0-9]|3[01])\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "whiteBlack": 2,
        "protocols": 1
      },
      {
        "title": "localhost hostnames",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?[\\w-]+(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "whiteBlack": 2,
        "protocols": 1
      }
    ],
    "index": 1
  },
  "9k3abn1508091830699": {
    "title": "proxy2",
    "type": 3,
    "address": "222.222.222.2222",
    "port": 22,
    "index": 0,
    "active": true,
    "whitePatterns": [
      {
        "title": "all URLs",
        "active": true,
        "pattern": "*",
        "type": 1,
        "whiteBlack": 1,
        "protocols": 1
      }
    ],
    "blackPatterns": [
      {
        "title": "localhost URLs",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\\.\\d+\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "whiteBlack": 2,
        "protocols": 1
      },
      {
        "title": "internal IP addresses",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?(?:192\\.168\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6789]|2[0-9]|3[01])\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "whiteBlack": 2,
        "protocols": 1
      },
      {
        "title": "localhost hostnames",
        "active": true,
        "pattern": "^(?:[^:@/]+(?::[^@/]+)?@)?[\\w-]+(?::\\d+)?(?:/.*)?$",
        "type": 2,
        "whiteBlack": 2,
        "protocols": 1
      }
    ]
  }
}
*/
function updateSettingsFrom50() {
  console.log("updateSettingsFrom50()");
  return new Promise((resolve, reject) => {
    _getAllSettingsNative().then((settings) => {  // calls _initializeStorage()
      if (!settings || Object.keys(settings).length === 0) return deleteAllSettings(); // Creates the default proxy setting and sets to disabled
      settings = JSON.parse(JSON.stringify(settings), (key, value) => key == "whiteBlack" ? null : value);
      // 5.0 didn't have a default proxy setting
      settings[LASTRESORT] = JSON.parse(JSON.stringify(DEFAULT_PROXY_SETTING));
      console.log("updateSettingsFrom50(): writing new settings:" + JSON.stringify(settings, null, 2));
      return writeAllSettings(settings, false);
    }).catch((e) => {console.error(`_getAllSettingsNative() error: ${e}`);reject(e)});
  });
}

/**
 * Reverse of addonStructToStorageObject(). Convert the structure in storage to one for memory:
 *
 * Memory:
 *   {
 *     "mode":"xxx", // e.g. "patterns", "disabled", etc
 *     "proxySettings": [{...}, {...}, {...}] // array of proxySetting objects
 *   }
 *
 * Storage:
 *   {
 *     "mode": "patterns",
 *     "a476ccd8-87f7-488a-bf87-6c97a1fbeed4": {
 *       address: "192.168.0.1",
 *       port: 9999,
 *       type: 2,
 *       index: 1,
 *       username: "foo1",
 *       password: "bar1",
 *       title: "some proxy of mine",
 *       active: true,
 *       whitePatterns: [
 *         {name: "all", notes: "match all URLs", active: true, pattern: "*", type: 1, protocols: 1}
 *        ],
 *       blackPatterns: []
 *
 * See comments at top of file.
 */
function storageObjectToAddonStruct(settings) {
  //console.log("storageObjectToAddonStruct() before conversion:" + JSON.stringify(settings, null, 2));
  if (settings && !settings.mode) {
    // 5.0 settings
  }
  let ret = {mode: DISABLED, "proxySettings": [], logging: {active: true, maxSize: 500}}, lastResortFound = false;
  if (!settings) {
     _insertLastResort(ret.proxySettings);
    console.log("in storageObjectToAddonStruct(): " + JSON.stringify(ret));
    return ret;
  }

  for (let idOrMode in settings) {
    if (idOrMode == MODE || idOrMode == LOGGING) ret[idOrMode] = settings[idOrMode];
    else if (idOrMode == SYNC) continue;
    else {
      let tmp = settings[idOrMode];
      tmp.id = idOrMode; // Copy the id into the object because we are not using it as a key in the array
      if (!lastResortFound && tmp.id == LASTRESORT) lastResortFound = true;
      ret.proxySettings.push(tmp);
    }
  }
  ret.proxySettings.sort(function(a, b) { return a.index - b.index; });

  for (let k in ret.proxySettings)
    delete ret.proxySettings[k].index; // Re-calculated when/if this object is written to disk again (user may move proxySetting up/down)

  if (!lastResortFound) _insertLastResort(ret.proxySettings);

  //console.log("storageObjectToAddonStruct() after conversion:" + JSON.stringify(ret, null, 2));
  return ret;

  function _insertLastResort(arr) {
    let def = JSON.parse(JSON.stringify(DEFAULT_PROXY_SETTING)); // Copy
    delete def.index; // Re-calculated when/if this object is written to disk again (user may move proxySetting up/down)
    arr.push(def); // Push onto the end
  }
}

/**
 * Reverse of storageObjectToAddonStruct(). Convert the structure in memory to one for storage:
 *
 * Memory:
 *   {
 *     "mode":"xxx", // e.g. "patterns", "disabled", etc
 *     "proxySettings": [{...}, {...}, {...}] // array of proxySetting objects
 *   }
 *
 * Storage:
 *   {
 *     "mode": "patterns",
 *     "a476ccd8-87f7-488a-bf87-6c97a1fbeed4": {
 *       address: "192.168.0.1",
 *       port: 9999,
 *       type: 2,
 *       index: 1,
 *       username: "foo1",
 *       password: "bar1",
 *       title: "some proxy of mine",
 *       active: true,
 *       whitePatterns: [
 *         {name: "all", notes: "match all URLs", active: true, pattern: "*", type: 1, protocols: 1}
 *        ],
 *       blackPatterns: []
 *
 * See comments at top of file.
 */
function addonStructToStorageObject(settings) {
  //console.log("addonStructToStorageObject() 1: " + JSON.stringify(settings, null, 2));
  let ret = {}, lastResortFound = false;
  if (!settings || !PROXY_SETTINGS in settings) return ret;
  ret[MODE] = settings[MODE];
  ret[LOGGING] = settings[LOGGING];
  // if (SYNC in settings) /* don't copy this into the return obj */
    // ret[SYNC] = settings[SYNC];

  let idx = 0;
  for (let i in settings.proxySettings) {
    if (i != MODE && i != LOGGING && i != SYNC) {
      let proxySetting = settings.proxySettings[i];
      let id = proxySetting.id;
      if (id == LASTRESORT) {
        lastResortFound = true;
        proxySetting.index = Number.MAX_SAFE_INTEGER;
      }
      else proxySetting.index = idx++;
      delete proxySetting.id; // Don't need to write this to disk for this object
      ret[id] = proxySetting;
    }
  }
  if (!lastResortFound) {
    // Fix data integrity
    // Copy but without id
    ret[LASTRESORT] = JSON.parse(JSON.stringify(DEFAULT_PROXY_SETTING), (key, value) => key == "id" ? undefined : value);
  }
  //console.log("addonStructToStorageObject() 2:" + JSON.stringify(settings, null, 2));
  return ret;
}