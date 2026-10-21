{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "snyk-monitor.name" -}}
{{- default .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Provides a value used as a hint by the snyk-monitor to determine
if the monitor should watch all namespaces in the cluster or just a single namespace.
If the monitor is scoped to a namespace, it is the same one as the deployment.
*/}}
{{- define "snyk-monitor.scope" -}}
{{- if contains .Values.scope "Cluster" -}}
{{- printf "" -}}
{{- else -}}
{{- printf "%s" .Release.Namespace -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "snyk-monitor.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
The tag of the snyk-monitor image. image.releaseTag takes precedence over image.tag, so that
tools which overwrite image.tag at render time (for example ArgoCD, which sets it to a manifest
revision) can still deploy a specific release.
*/}}
{{- define "snyk-monitor.imageTag" -}}
{{- default .Values.image.tag .Values.image.releaseTag -}}
{{- end -}}
