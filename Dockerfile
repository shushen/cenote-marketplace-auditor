FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci && \
    npm cache clean --force && \
    rm -rf ~/.npm

COPY . .

RUN npm run build:server && npm run build:client

CMD ["npm", "start"]
