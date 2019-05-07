import sys
import json

this = sys.modules[__name__]

with open('./k8smonitor/config.json', 'r') as f:
  config = json.load(f)

  for k, v in config.items():
    # TODO filter out weird keys?
    setattr(this, k, v)
