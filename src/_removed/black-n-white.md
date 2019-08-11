# Black & White Listing

The concept of Black & white listing to mainly to separate possibilities into 2 distinct categories.

* Whitelist: Do (i.e. pass via proxy in this case)
* Blacklist: Do Not (i.e. do not pass via proxy in this case)


## Use Cases

### 1. Pass only selected sites A, B, C via proxy
In this case only Whitelisting is required. The concept is to only proxy A, B, C and not proxy (direct) all others

1. Whitelist:  A, B, C
2. Blacklist: 

### 2. Pass ALL or MANY via proxy, with the exception of A, B, C
Please note that blacklisting only has a meaning if there is a catch-all or catch-many situation. In other words, it has a meaning when blacklist rules are a subset of the whitelist rules, i.e. all except these, or many except these.

1. Whitelist:  * (or *.com etc)
2. Blacklist: A, B, C

In this case, the logic derived by the user's assertion is to proxy everything except A, B, C. The aforementioned logic is fully encompassing all of the situations and thus there is no need to check any further rules.


### 3. Multiple Proxies and Rules
In this case users has set more specific rules and not a catch-all type rule like the previous case. It is worth noting that blacklist rules must relate to the corresponding whitelist rules or else it would be meaningless.

#### 1. Proxy 1 on .com
1. Whitelist:  *.com
2. Blacklist: a.com, b.com, c.com

#### 2. Proxy 2 on .net
1. Whitelist:  *.net
2. Blacklist: a.net, b.net, c.net

#### 3. Proxy 3 on .org
1. Whitelist:  *.org
2. Blacklist: a.org, b.org, c.org

#### 4. Proxy 3 on .org
1. Whitelist:  *
2. Blacklist: 

The procedural logic is as following, in the order of the proxies:
1. Check proxy 1 blacklist, if rule is met, honour the rule by not proxying, if not met, check whitelist
2. Check proxy 1 whitelist, if rule is met, honour the rule by proxying, if not met, check the next proxy

3. Check proxy 2 blacklist .......................... etc


## Test Cases

### Example for Use Case 1
site: example.com  
If site matches A, B, C, Do proxy, if not Do Not proxy

### Example for Use Case 2
site: example.com  
If site matches A, B, C, Do Not proxy, if not Do proxy

### Example for Use Case 3
site: example.com  
Checking blacklist on proxy 1: Site does not match a.com, b.com, c.com  
Checking whitelist on proxy 1: Site does match the rule, so Do Proxy


### Example for Use Case 3
site: example.tv  
Checking blacklist on proxy 1: Site does not match a.com, b.com, c.com  
Checking whitelist on proxy 1: Site does not match  

Checking blacklist on proxy 2: Site does not match a.net, b.net, c.net  
Checking whitelist on proxy 2: Site does not match  

Checking blacklist on proxy 3: Site does not match a.org, b.org, c.org  
Checking whitelist on proxy 3: Site does not match  

Checking blacklist on proxy 4: no rule   
Checking whitelist on proxy 4: Site does match the rule, so Do Proxy via proxy 4

