FROM node:22.16.0-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci && npm cache clean --force

# Copy shared types to the same level as backend src
COPY shared/ ./shared/

COPY backend/ .

RUN mkdir -p /app/data

RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && node dist/src/server.js"] 