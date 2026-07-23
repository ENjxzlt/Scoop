FROM node:20-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

COPY server ./server
COPY public ./public

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

RUN mkdir -p /app/data && chown -R node:node /app

VOLUME ["/app/data"]
EXPOSE 3000

USER node

CMD ["node", "server/index.js"]
