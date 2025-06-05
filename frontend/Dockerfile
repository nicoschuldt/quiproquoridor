
FROM node:22.16.0-alpine

WORKDIR /app

# Copy package files first for better caching
COPY frontend/package*.json ./
RUN npm ci && npm cache clean --force

# Copy shared types BEFORE starting the dev server
COPY shared/ ../shared/

# Copy frontend source
COPY frontend/ .

# Expose port
EXPOSE 3000

# Start the development server with host binding for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]