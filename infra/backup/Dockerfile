FROM quay.io/minio/mc:latest AS minio_client

FROM postgres:16-alpine

RUN apk add --no-cache ca-certificates curl jq

COPY --from=minio_client /usr/bin/mc /usr/local/bin/mc

COPY backup.sh /usr/local/bin/backup
RUN chmod +x /usr/local/bin/backup

ENTRYPOINT ["/usr/local/bin/backup"]
