{{- define "guma.metricsEnv" -}}
{{- with .Values.metrics }}
- name: METRICS_ENABLED
  value: {{ .enabled | quote }}
{{- if .enabled }}
{{- with .endpoint }}
- name: METRICS_ENDPOINT
  value: {{ . | quote }}
{{- end }}
- name: METRICS_PROTOCOL
  value: {{ .protocol | quote }}
- name: METRICS_INSECURE
  value: {{ .insecure | quote }}
- name: METRICS_EXPORT_INTERVAL
  value: {{ .exportInterval | quote }}
{{- with .headersSecret }}
{{- if .name }}
- name: METRICS_HEADERS
  valueFrom:
    secretKeyRef:
      name: {{ .name | quote }}
      key: {{ .key | quote }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
