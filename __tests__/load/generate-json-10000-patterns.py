# Use foxyproxy-template.json to ouptut foxyproxy-5000-proxies-test-settings.json
# which has 5000 proxies defined. foxyproxy-template.json should have a least 1
# non-default proxy defined. All data in new file is same as the 1 non-default
# proxy except for the proxy id, which must be unqiue

import json, copy

with open('foxyproxy-template.json') as json_file:
    data = json.load(json_file)
    template = data['proxySettings'][0]['whitePatterns'][0]
    for x in range(10000):
        new_pattern = copy.deepcopy(template)
        data['proxySettings'][0]['whitePatterns'].append(new_pattern)
with open("foxyproxy-10000-patterns-test-settings.json", "w") as write_file:
    json.dump(data, write_file)
