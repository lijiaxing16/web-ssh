FROM node:20-alpine

WORKDIR /opt/web-ssh

RUN apk add --no-cache curl tini

COPY package*.json ./
RUN npm ci --only=production

COPY backend ./backend
COPY public ./public
COPY .env.example .env

RUN mkdir -p /opt/web-ssh/tmp /opt/web-ssh/logs

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/app.js"]
