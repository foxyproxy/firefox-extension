// bg | import | proxy | utils
const PATTERN_ALL_WHITE = {
  title: 'all URLs',
  active: true,
  pattern: '*',
  type: 1,                    // PATTERN_TYPE_WILDCARD,
  protocols: 1                // PROTOCOL_ALL
};

const DEFAULT_COLOR = '#66cc66'; // default proxy color

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


function stripBadChars(str) {
  return str ? str.replace(/[&<>"']+/g, '') : null;
}

function parseList(rawList) {
  if (!rawList) {
    return;
  }
  const parsedList = [], skippedList = [], colors = [DEFAULT_COLOR, '#00ff00', '#0000ff'];
  rawList.split('\n').forEach((item) => {
    if (!item) {
      return; // continue to next
    }
    let p;
    // Is this line simple or complete format?
    if (item.includes('://')) {
      // complete format
      let url;
      try {
        url = new URL(item);
      }
      catch (e) {
        console.log(e);
        // URL couldn't be parsed.
        // Throw just the item that we barfed on
        skippedList.push(item);
        return; // continue to next
      }
      console.log("url is", url.toString());
      const type = url.protocol === 'proxy:' || url.protocol === 'http:' ? PROXY_TYPE_HTTP :
        url.protocol === 'ssl:' || url.protocol === 'https:' ? PROXY_TYPE_HTTPS :
        url.protocol === 'socks:' || url.protocol === 'socks5:' ? PROXY_TYPE_SOCKS5 :
        url.protocol === 'socks4:' ? PROXY_TYPE_SOCKS4 : -1;
        if (type === -1) {
          skippedList.push(item);
          return; // continue to next
        }

        // If color not specified in the URL, then rotate among the ones in the colors array.
        const color = url.searchParams.get('color') ?
          ('#' + url.searchParams.get('color')) : colors[parsedList.length % colors.length];

        //console.log("color is " + color);
        const title = url.searchParams.get('title');

        function parseBooleanParam(paramName) {
          let paramValue = url.searchParams.get(paramName);
          // If paramName url param is not specified or it's specified and not 'false', then paramValue should equal true
          // (we assume true in case the param is absent, which may be counterintuitive, but this fcn is used for params that
          // we want to assume true in 99% of cases).
          // |paramValue === null| accounts for the case where paramValue is 0.
          return paramValue === null || !(paramValue.toLowerCase() === 'false');
        }
        const proxyDNS = parseBooleanParam('proxydns');
        const active = parseBooleanParam('active');

        // the URL class sets port === '' if not specified on the URL or it's an invalid port e.g. contains alpha chars
        let port = url.port;
        if (port === '') {
          // Default ports are 3128 for HTTP proxy, 443 for tls/ssl/https proxy, 1080 for socks4/5
          port = type === PROXY_TYPE_HTTP ? 3128 : type === PROXY_TYPE_HTTPS ? 443 : 1080;
        }

        // the URL class sets username and password === '' if not specified on the URL
        p = {type, username: url.username === '' ? undefined: url.username, password: url.password === '' ? undefined : url.password,
          address: url.hostname, port, color, title, proxyDNS, active};
        console.log(p);
    }
    else {
      // simple
      const hostPort = item.split(':');
      // Split always returns an array no matter what
      p = {address: hostPort[0], port: hostPort[1], color: colors[parsedList.length % colors.length]};
    }

    const proxy = makeProxy(p, true, true);
    if (proxy) {
      parsedList.push(proxy);
    }
    else {
      skippedList.push(item);
    }

  }); //forEach

  return {parsedList, skippedList};
}

const PROXY_TYPE_HTTP = 1;
const PROXY_TYPE_HTTPS = 2;
const PROXY_TYPE_SOCKS5 = 3;
const PROXY_TYPE_SOCKS4 = 4;
const PROXY_TYPE_NONE = 5; // DIRECT
const PROXY_TYPE_PAC = 6;
const PROXY_TYPE_WPAD = 7;
const PROXY_TYPE_SYSTEM = 8;
const PROXY_TYPE_PASS = 9;
const FOXYPROXY_BASIC = false;

function makeProxy({type = PROXY_TYPE_HTTP, username, password, address, port, color, title, proxyDNS, active = true}, patternsAllWhite, patternsIntranetBlack) {
  port = port*1; // convert to digit
  if (!port || port < 1) { // is port NaN or less than 1
    return null;
  }

  // strip bad chars from all input except username, password, type, proxyDNS, and active
  // (those last 3 are forced to boolean types before we are called)
  // If we do strip bad chars from usernams or password, auth could fail.
  address = stripBadChars(address);
  color = stripBadChars(color);
  title = stripBadChars(title);

  if (!address) {
    return null;
  }

  const proxy = {type, username, password, address, port, color, title, active};

  if (type === PROXY_TYPE_SOCKS5) {
    // Only set if socks5
    proxy.proxyDNS = proxyDNS;
  }

  if (FOXYPROXY_BASIC) {
    proxy.whitePatterns = proxy.blackPatterns = [];
  }
  else {
    proxy.whitePatterns = patternsAllWhite ? [PATTERN_ALL_WHITE] : [];
    proxy.blackPatterns = patternsIntranetBlack ? [...blacklistSet] : [];
  }

  return proxy;
}

describe("import-bulk-complete-format", () => {

  test("import-bulk-simple-1", () => {
    const input = '192.168.1.1:3128';
    const {parsedList, skippedList} = parseList(input);
    expect(skippedList.length).toEqual(0);
    expect(parsedList.length).toEqual(1);
    const o = {type: PROXY_TYPE_HTTP, address: '192.168.1.1', port: 3128, color: '#66cc66', active: true,
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    expect(parsedList).toContainEqual(expect.objectContaining(o));
  });

  test("import-bulk-simple-2", () => {
    const input = '192.168.1.1:3128\nfoo.bar.com:991\nyeah.com:0\n172.168.9.10:a\n127.<0.0.1:19\n<><>&:22';
    const {parsedList, skippedList} = parseList(input);
    expect(skippedList.length).toEqual(3);
    expect(parsedList.length).toEqual(3);
    const o = {type: PROXY_TYPE_HTTP, address: '192.168.1.1', port: 3128, color: '#66cc66', active: true,
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    const o2 = {type: PROXY_TYPE_HTTP, address: 'foo.bar.com', port: 991, color: '#00ff00', active: true,
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
      const o3 = {type: PROXY_TYPE_HTTP, address: '127.0.0.1', port: 19, color: '#0000ff', active: true,
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    expect(parsedList).toContainEqual(expect.objectContaining(o));
    expect(parsedList).toContainEqual(expect.objectContaining(o2));
    expect(parsedList).toContainEqual(expect.objectContaining(o3));
  });

  test("import-bulk-complex-1", () => {
    const input = 'http://username:password@192.168.1.1:3128?color=ff0000&title=eric%20proxy&active=true';
    const {parsedList, skippedList} = parseList(input);
    expect(skippedList.length).toEqual(0);
    expect(parsedList.length).toEqual(1);
    const o = {type: PROXY_TYPE_HTTP, username: 'username', password: 'password', address: '192.168.1.1', port: 3128, color: '#ff0000', active: true, title: 'eric proxy',
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    expect(parsedList).toContainEqual(expect.objectContaining(o));
  });


  test("import-bulk-complex-1", () => {
    const input = 'http://username:password@192.168.1.1:3128?color=ff0000&title=eric%20proxy&active=true';
    const {parsedList, skippedList} = parseList(input);
    expect(skippedList.length).toEqual(0);
    expect(parsedList.length).toEqual(1);
    const o = {type: PROXY_TYPE_HTTP, username: 'username', password: 'password', address: '192.168.1.1', port: 3128, color: '#ff0000', active: true, title: 'eric proxy',
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    expect(parsedList).toContainEqual(expect.objectContaining(o));
  });

  test("import-bulk-complex-2", () => {
    const input = 'ssl://foo.com';
    const {parsedList, skippedList} = parseList(input);
    expect(skippedList.length).toEqual(0);
    expect(parsedList.length).toEqual(1);
    const o = {type: PROXY_TYPE_HTTPS, address: 'foo.com',active: true, port: 443,
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    expect(parsedList).toContainEqual(expect.objectContaining(o));
  });

  test("import-bulk-complex-3", () => {
    const input = 'ssl://foo.com\nsocks://user:pass@himom.com:123?active=false&title=yeah';
    const {parsedList, skippedList} = parseList(input);
    expect(skippedList.length).toEqual(0);
    expect(parsedList.length).toEqual(2);
    const o = {type: PROXY_TYPE_HTTPS, address: 'foo.com',active: true, port: 443,
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    const o2 = {type: PROXY_TYPE_SOCKS5, address: 'himom.com',active: false, port: 123, username: 'user', password: 'pass',
      whitePatterns: [PATTERN_ALL_WHITE], blackPatterns: [...blacklistSet]};
    expect(parsedList).toContainEqual(expect.objectContaining(o));
    expect(parsedList).toContainEqual(expect.objectContaining(o2));
  });
})