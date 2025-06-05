FROM node:22.16.0-alpine

RUN apk add --no-cache curl sqlite

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci && npm cache clean --force

# Copy shared types to the same level as backend src
COPY shared/ ./shared/

COPY backend/ .

RUN mkdir -p /app/data

# Set the database path to use the data directory
ENV DB_FILE_NAME=file:/app/data/quoridor.db

RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npm run db:migrate && sqlite3 /app/data/quoridor.db 'ALTER TABLE users ADD COLUMN ai_difficulty text;' || true && node dist/src/server.js"] 