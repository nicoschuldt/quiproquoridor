#!/bin/bash

echo "🧪 Testing Docker Compose setup..."

# Clean up any existing containers and volumes
echo "🧹 Cleaning up existing containers..."
docker-compose down -v

# Remove any existing images to ensure fresh build
echo "🗑️  Removing existing images..."
docker-compose down --rmi all 2>/dev/null || true

# Build the images
echo "🔨 Building Docker images..."
docker-compose build --no-cache

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker build successful!"

# Start the services
echo "🚀 Starting services..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services!"
    exit 1
fi

# Wait a bit for services to start
echo "⏳ Waiting for services to start..."
sleep 15

# Check if services are healthy
echo "🔍 Checking service health..."

# Check backend health
backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$backend_health" = "200" ]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed (HTTP $backend_health)"
    echo "Backend logs:"
    docker-compose logs backend
    docker-compose down
    exit 1
fi

# Check frontend accessibility
frontend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$frontend_health" = "200" ]; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend accessibility check failed (HTTP $frontend_health)"
    echo "Frontend logs:"
    docker-compose logs frontend
    docker-compose down
    exit 1
fi

echo "🎉 All tests passed! The Docker setup is working correctly."
echo "🌐 Frontend: http://localhost:3000"
echo "🔗 Backend: http://localhost:3001"
echo ""
echo "To stop the services, run: docker-compose down"
echo "To view logs, run: docker-compose logs -f" 