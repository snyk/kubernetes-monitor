#!/usr/bin/env python3

import yaml
import sys

# The purpose of this script is to act as if we ran the helm installation with `--namespace XXX`.
# Therefore the script does the following:
#   1. Set `metadata.namespace` key to each manifest (yaml)
#   2. Set all the uses of `.Release.Namespace` in our helm chart to the given namespace - 
#      currently used only in the `subjects` key in rolebinding.yaml and clusterrolebinding.yaml

for manifest in yaml.load_all(sys.stdin):
    if manifest:
        if 'metadata' in manifest and 'namespace' not in manifest['metadata']:
            manifest['metadata']['namespace'] = sys.argv[1]
        if 'subjects' in manifest:
            for subject in manifest['subjects']:
                subject['namespace'] = sys.argv[1]
        
        print('---')
        print(yaml.dump(manifest))
