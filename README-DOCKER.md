# Quoridor Docker Setup

This setup provides a complete containerized environment for the Quoridor game application.

## Quick Start

### Prerequisites
- Docker
- Docker Compose

### Running the Application

1. **Start the application:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

3. **Stop the application:**
   ```bash
   docker-compose down
   ```

### Testing the Setup

Run the automated test script:
```bash
./docker-test.sh
```

This script will:
- Clean up any existing containers
- Build fresh images
- Start the services
- Validate that both frontend and backend are working
- Provide health check results

### Development Commands

**View logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Rebuild after code changes:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Reset everything (including database):**
```bash
docker-compose down -v
docker-compose up -d
```

## Architecture

- **Frontend**: React + Vite (Node 22.16.0)
- **Backend**: Express + Socket.io (Node 22.16.0)
- **Database**: SQLite with automatic migrations
- **Shared Types**: Mounted as read-only volume

## Troubleshooting

**Port conflicts:**
If ports 3000 or 3001 are in use, stop the conflicting services or modify the ports in `docker-compose.yml`.

**Database issues:**
The database is automatically created and migrated on startup. If you encounter issues, try:
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d    # Fresh start
```

**Build failures:**
Ensure you have sufficient disk space and try:
```bash
docker system prune -a
docker-compose build --no-cache
``` 