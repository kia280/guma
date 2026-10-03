{{- define "guma.ketoEnv" -}}
{{- with .Values.keto }}
- name: KETO_READ_ADDR
  value: {{ required "keto.readAddr is required" .readAddr | quote }}
- name: KETO_WRITE_ADDR
  value: {{ required "keto.writeAddr is required" .writeAddr | quote }}
- name: KETO_OUTBOX_SWEEP_INTERVAL
  value: {{ .outboxSweepInterval | quote }}
{{- end }}
{{- end }}
