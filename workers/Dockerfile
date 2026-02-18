FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

CMD ["node", "worker.js"]
