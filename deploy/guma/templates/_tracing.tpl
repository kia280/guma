{{- define "guma.tracingEnv" -}}
{{- with .Values.tracing }}
- name: TRACING_ENABLED
  value: {{ .enabled | quote }}
{{- if .enabled }}
{{- with .endpoint }}
- name: TRACING_ENDPOINT
  value: {{ . | quote }}
{{- end }}
- name: TRACING_PROTOCOL
  value: {{ .protocol | quote }}
- name: TRACING_INSECURE
  value: {{ .insecure | quote }}
- name: TRACING_SAMPLE_RATE
  value: {{ .sampleRate | quote }}
{{- with .headersSecret }}
{{- if .name }}
- name: TRACING_HEADERS
  valueFrom:
    secretKeyRef:
      name: {{ .name | quote }}
      key: {{ .key | quote }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
