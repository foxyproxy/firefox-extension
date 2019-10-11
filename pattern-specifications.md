# pseudo-code for proxy selection

## Suppose we have 6 proxy definitions + Default:

### Proxy foo1
  a. http proxy on 123.123.123.123:8080
	b. username/password auth
  b. whitelist pattern "*.google.com"
	c. blacklist pattern "foo.google.com"

### Proxy foo2
  a. socks proxy on 999.999.99.999:1080
	b. username/password auth
	c. whitelist pattern "*.facebook.com"

### Proxy foo3
  a. PAC at https://192.168.1.1/proxy.pac
	b. no username/password auth
	c. whitelist pattern "*.internalstuffs.zzz"   (intranet address)

### Proxy foo4
  a. PAC at https://192.168.1.2/proxy.pac
  b no username/password auth
  c. whitelist pattern "*.internalstuffs.yyy"   (intranet address)

### Proxy foo5
  a. System settings
  b. no username/password auth (no applicable for system settings anyway)
  c. whitelist pattern "*.bar.com"

### Proxy foo6
  a. WPAD (auto-detect, not supported by Firefox proxyAPI right now)
	b. no username/password auth (no applicable for system settings anyway)
  c. whitelist pattern "*.bar.com"

### Default
  a. Set to DIRECT (no proxy)
	b. no username/password auth
	c. no patterns -- not supported by FoxyProxy

## User sets mode to "patterns"


### Suppose URL about to be loaded by browser is https://www.google.com/

http proxy on 123.123.123.123:8080 is used to load the URL

```const proxySettings = {
  proxyType: "manual",
  http: "http://123.123.123.123:8080",
  httpProxyAll: true,
	autoLogin: true
};
proxy.settings.set(proxySettings)```

### Suppose URL about to be loaded by browser is https://foo.google.com/

This matches the blacklist pattern in proxy `foo1`. Blacklist patterns take precedence
over whitelist patterns. So `foo1` is not used to load this URL. The other proxy patterns
are checked. None match, so `Default` is used.

```const proxySettings = {
  proxyType: "none",
	autoLogin: true,
	httpProxyAll: true // I don't know if this is necessary but cannot hurt
};
proxy.settings.set(proxySettings)```

### Suppose URL about to be loaded by browser is https://www.facebook.com/index.html

socks proxy on 999.999.99.999:1080 is used to load the URL

### Suppose URL about to be loaded by browser is https://internalstuffs.zzz/payroll/my-paycheck.pdf

https://192.168.1.1/proxy.pac is used to load the URL. FoxyProxy doesn't know what this PAC
is doing. Maybe it has its own URL pattern matching, maybe not. Does not matter.

```const proxySettings = {
  autoConfigUrl: pacUrl that user specified
	autoLogin: true,
	httpProxyAll: true // I don't know if this is necessary but cannot hurt
};
proxy.settings.set(proxySettings)```

