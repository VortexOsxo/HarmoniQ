FROM postgres:17 AS builder

ENV POSTGRES_USER=harmoniq
ENV POSTGRES_PASSWORD=harmoniq
ENV POSTGRES_DB=harmoniq

COPY harmoniq.sql /docker-entrypoint-initdb.d/harmoniq.sql

RUN set -eux; \
    docker-entrypoint.sh postgres & \
    SERVER_PID=$!; \
    timeout 7200 bash -c 'until pg_isready -h localhost -U user; do sleep 5; done'; \
    gosu postgres pg_ctl -D "$PGDATA" -m fast stop; \
    wait $SERVER_PID || true; \
    rm -f /docker-entrypoint-initdb.d/harmoniq.sql

FROM postgres:17

ENV POSTGRES_USER=harmoniq
ENV POSTGRES_PASSWORD=harmoniq
ENV POSTGRES_DB=harmoniq

COPY --from=builder --chown=postgres:postgres /var/lib/postgresql/data /var/lib/postgresql/data

EXPOSE 5432
