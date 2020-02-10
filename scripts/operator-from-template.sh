OPERATOR_NAME=snyk-kubernetes-operator
DOCKER_HUB_ACCOUNT=snyk
OPERATOR_NAMESPACE=snyk-monitor

mkdir build
cd build

# Copy the Operator template
if [[ $(uname -s) == "Darwin" ]];then
    cp -av ../operator-template/snyk-kubernetes-operator ./
else
    cp -avr ../operator-template/snyk-kubernetes-operator ./
fi

# Copy in the Helm chart
mkdir ${OPERATOR_NAME}/helm-charts
if [[ $(uname -s) == "Darwin" ]];then
    cp -av ../snyk-monitor ${OPERATOR_NAME}/helm-charts
else
    cp -avr ../snyk-monitor ${OPERATOR_NAME}/helm-charts
fi

# Replace image tag in the Helm chart
echo overriding tag placeholders with latest semantic version
if [[ $(uname -s) == "Darwin" ]];then
    sed -i "" "s/IMAGE_TAG_OVERRIDE_WHEN_PUBLISHING/${FULL_IMAGE_TAG}/g" ${OPERATOR_NAME}/helm-charts/snyk-monitor/values.yaml
else
    sed -i "s/IMAGE_TAG_OVERRIDE_WHEN_PUBLISHING/${FULL_IMAGE_TAG}/g" ${OPERATOR_NAME}/helm-charts/snyk-monitor/values.yaml
fi

cd ${OPERATOR_NAME}
../../operator-sdk build ${FULL_OPERATOR_IMAGE_NAME_AND_TAG}
cd ..


# Update template image name in operator.yaml
if [[ $(uname -s) == "Darwin" ]];then
    sed -i "" "s|REPLACE_IMAGE|${FULL_OPERATOR_IMAGE_NAME_AND_TAG}|g" $OPERATOR_NAME/deploy/operator.yaml
else
    sed -i "s|REPLACE_IMAGE|${FULL_OPERATOR_IMAGE_NAME_AND_TAG}|g" $OPERATOR_NAME/deploy/operator.yaml
fi

# Update the role_binding.yaml namespace
if [[ $(uname -s) == "Darwin" ]];then
    sed -i "" "s|IMAGE_TAG_OVERRIDE_WHEN_PUBLISHING|${FULL_IMAGE_TAG}|g" $OPERATOR_NAME/deploy/crds/charts.helm.k8s.io_v1alpha1_snykmonitor_cr.yaml
else
    sed -i "s|IMAGE_TAG_OVERRIDE_WHEN_PUBLISHING|${FULL_IMAGE_TAG}|g" $OPERATOR_NAME/deploy/crds/charts.helm.k8s.io_v1alpha1_snykmonitor_cr.yaml
fi
