FROM node:20-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

COPY server ./server
COPY public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

RUN mkdir -p /app/data && chown -R node:node /app

VOLUME ["/app/data"]
EXPOSE 3000

# Container starts as root so the entrypoint can fix ownership of the
# bind-mounted data volume (e.g. a TrueNAS dataset owned by root) before
# dropping privileges to the unprivileged "node" user.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
