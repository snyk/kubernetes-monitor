FROM quay.io/operator-framework/helm-operator:v1.7.2

LABEL name="Snyk Operator" \
      maintainer="support@snyk.io" \
      vendor="Snyk Ltd" \
      summary="Snyk Operator for Snyk Controller" \
      description="Snyk Controller enables you to import and test your running workloads and identify vulnerabilities in their associated images and configurations that might make those workloads less secure."

ENV HOME=/opt/helm

COPY LICENSE /licenses/LICENSE
COPY watches.yaml ${HOME}/watches.yaml
COPY helm-charts/ ${HOME}/helm-charts/

WORKDIR ${HOME}
