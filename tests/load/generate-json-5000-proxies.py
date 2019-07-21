# Use foxyproxy-template.json to ouptut foxyproxy-5000-proxies-test-settings.json
# which has 5000 proxies defined. foxyproxy-template.json should have a least 1
# non-default proxy defined. All data in new file is same as the 1 non-default
# proxy except for the proxy id, which must be unqiue

import json, copy

with open('foxyproxy-template.json') as json_file:
    data = json.load(json_file)
    template = data['proxySettings'][0]
    for x in range(5000):
        new_settings = copy.deepcopy(template)
        # Must have unique id
        new_settings['id'] = template['id'] + str(x)
        data['proxySettings'].append(new_settings)
with open("foxyproxy-5000-proxies-test-settings.json", "w") as write_file:
    json.dump(data, write_file)
