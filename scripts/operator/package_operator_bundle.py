from tempfile import mkdtemp
from os import mkdir
from datetime import datetime
from shutil import copy
from sys import argv


def createOperatorFromTemplate(new_version: str, new_operator_tag: str, new_monitor_tag: str, old_version: str = None) -> str:
    new_operator_dir = mkdtemp()

    new_operator_version_dir = new_operator_dir + "/" + new_version
    mkdir(new_operator_version_dir)

    templated_csv_path = "snyk-operator/deploy/olm-catalog/snyk-operator/0.0.0/snyk-operator.v0.0.0.clusterserviceversion.yaml"
    new_csv_path = new_operator_version_dir + "/" + \
        "snyk-operator.v" + new_version + ".clusterserviceversion.yaml"
    copy(templated_csv_path, new_csv_path)

    templated_crd_path = "snyk-operator/deploy/olm-catalog/snyk-operator/0.0.0/snykmonitors.charts.helm.k8s.io.crd.yaml"
    new_crd_path = new_operator_version_dir + "/" + \
        "snykmonitors.charts.helm.k8s.io.crd.yaml"
    copy(templated_crd_path, new_crd_path)

    templated_manifest_path = "snyk-operator/deploy/olm-catalog/snyk-operator/snyk-operator.package.yaml"
    new_manifest_path = new_operator_dir + "/" + "snyk-operator.package.yaml"
    copy(templated_manifest_path, new_manifest_path)

    timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

    with open(new_csv_path) as f:
        updated_csv = f.read().replace(
            '0.0.0', new_version).replace(
                'TIMESTAMP_OVERRIDE', timestamp).replace(
                    'SNYK_OPERATOR_VERSION_OVERRIDE', new_version).replace(
                        'SNYK_OPERATOR_IMAGE_TAG_OVERRIDE', new_operator_tag).replace(
                            'SNYK_MONITOR_IMAGE_TAG_OVERRIDE', new_monitor_tag)
        if old_version != None:
            updated_csv = updated_csv + "  replaces: snyk-operator.v" + old_version
    with open(new_csv_path, "w") as f:
        f.write(updated_csv)

    with open(new_manifest_path) as f:
        updated_manifest = f.read().replace('0.0.0', new_version)
    with open(new_manifest_path, "w") as f:
        f.write(updated_manifest)

    return new_operator_dir


if __name__ == '__main__':
    new_version = argv[1]
    new_operator_tag = argv[2]
    new_monitor_tag = argv[3]
    old_version = argv[4] if len(argv) == 5 else None
    print(createOperatorFromTemplate(
        new_version, new_operator_tag, new_monitor_tag, old_version
    ))
