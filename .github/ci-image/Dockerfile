# CI's image for its jobs with a browser and a database (.github/workflows/ci.yml):
# Chromium's system packages, Git, and the Postgres 18 client, to match the
# server, for psql and pg_dump. And zstd: actions/cache compresses with it
# when it's there, as it is on the runner, and a cache made one way is
# another version to one made the other, so without it every cache the
# runner's jobs keep misses here. Chromium itself isn't here: the jobs keep it
# in the Actions cache by @playwright/test's version, so a bump of the package
# needs no new image. The version here is only the one whose list of system
# packages is installed; a later Chromium that needs another fails to launch,
# naming the library, and that's when to raise it.
#
# Its tag is the hash of this file (tests/checks/ci-image.test.ts), and
# .github/workflows/ci-image.yml builds and pushes it to GitHub's registry
# when this file changes. Not in Dependabot's list: a new base image would
# be a new tag, which its pull requests can't push.
#
# Ubuntu 24.04, the runners' own, as the jobs share node_modules with jobs
# that run on the runner itself, native modules too. Node is copied in from
# its official image, for npx here and for the jobs' actions; each job still
# sets up .nvmrc's.
FROM ubuntu:24.04

COPY --from=node:24-bookworm-slim /usr/local/ /usr/local/

ARG PLAYWRIGHT_VERSION=1.65.1
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git postgresql-common zstd \
  && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && npx -y "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium \
  && rm -rf /var/lib/apt/lists/* /root/.npm

# The jobs run as root, and the runner's checkout is another user's, which
# Git refuses to read unless it's told the checkout is safe.
RUN git config --system --add safe.directory '*'
