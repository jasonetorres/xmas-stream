FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
RUN mkdir -p /tmp/xmas-stream && chown -R node:node /app /tmp/xmas-stream
USER node
EXPOSE 8080
CMD ["node", "--experimental-sqlite", "--disable-warning=ExperimentalWarning", "server/index.js"]
