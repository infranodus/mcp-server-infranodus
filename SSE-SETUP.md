# SSE (Server-Sent Events) Setup Guide

## Overview

This MCP server now supports SSE for real-time streaming of long-running operations. SSE provides:
- One-way server-to-client communication
- Real-time progress updates
- Automatic reconnection
- Works over standard HTTP

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build
```

### 3. Start the HTTP/SSE Server
```bash
# Development
npm run dev:http

# Production
npm run start:http

# With Docker
docker-compose up
```

### 4. Test the Server
```bash
# Run automated tests
npm run test:sse

# Monitor server health
npm run monitor

# Open browser test client
open test-sse-client.html
```

## Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### SSE Stream
```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:3000/sse/stream/your-stream-id
```

### Test SSE Stream
```bash
curl -N http://localhost:3000/test/sse
```

### Analyze with SSE
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text here",
    "streamId": "analysis-123",
    "options": {
      "optimize": "gap",
      "modelToUse": "gpt-4o"
    }
  }'
```

## Deployment Options

### Local Development
```bash
npm run dev:http
```
Server runs on `http://localhost:3000`

### Docker (Recommended for Production)
```bash
# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f mcp-server

# Stop
docker-compose down
```

### Production with HTTPS

1. Update `docker-compose.yml` with your domain
2. Configure SSL certificates in `nginx.conf`
3. Deploy:
```bash
docker-compose -f docker-compose.yml up -d
```

### Cloud Deployment

#### AWS/EC2
```bash
# Install Docker
sudo yum install docker -y
sudo service docker start

# Clone and run
git clone <your-repo>
cd mcp-server-infranodus
docker-compose up -d
```

#### Heroku
```bash
heroku create your-app-name
heroku stack:set container
git push heroku main
```

#### DigitalOcean App Platform
1. Connect GitHub repo
2. Set environment variables
3. Deploy with Dockerfile

## Firewall Configuration

### Allow Port 3000
```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 3000/tcp

# firewalld (CentOS/RHEL)
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

### Nginx Reverse Proxy (Recommended)
Already configured in `nginx.conf` for:
- Load balancing
- SSL termination
- SSE optimization
- Health checks

## Monitoring

### Real-time Monitoring
```bash
./scripts/monitor.sh http://localhost:3000 5
```

### Docker Stats
```bash
docker stats infranodus-mcp-server
```

### Logs
```bash
# Docker logs
docker-compose logs -f mcp-server

# PM2 (if using)
pm2 logs mcp-server
```

## Testing External Access

### 1. Check Local Access
```bash
curl http://localhost:3000/health
```

### 2. Check Network Access
```bash
# Get your IP
ip addr show | grep inet

# Test from another machine
curl http://YOUR_SERVER_IP:3000/health
```

### 3. Test SSE Stream
Open `test-sse-client.html` in a browser and:
1. Click "Connect SSE"
2. Click "Test SSE Stream"
3. Enter text and click "Analyze Text"

### 4. Load Testing
```bash
# Install Apache Bench
apt-get install apache2-utils

# Test concurrent connections
ab -n 1000 -c 10 http://localhost:3000/health
```

## Security Considerations

1. **API Key**: Store in `.env` file, never commit
2. **CORS**: Configure allowed origins in `http-server.ts`
3. **Rate Limiting**: Add rate limiting for production
4. **HTTPS**: Use SSL certificates in production
5. **Firewall**: Only expose necessary ports

## Troubleshooting

### SSE Not Working
- Check firewall rules
- Verify Nginx buffering is disabled
- Test with `curl -N` flag

### Connection Drops
- Increase proxy timeouts in Nginx
- Check keep-alive settings
- Monitor server resources

### High Memory Usage
- Limit concurrent SSE connections
- Implement connection pooling
- Use Redis for session management

## Environment Variables

```bash
# .env file
INFRANODUS_API_KEY=your-api-key
INFRANODUS_API_URL=https://api.infranodus.com
HTTP_PORT=3000
HTTP_HOST=0.0.0.0
NODE_ENV=production
```

## Architecture

```
Client <--SSE--> HTTP Server <---> MCP Server <---> InfraNodus API
                     |
                     ├── Express.js (HTTP/SSE)
                     ├── Progress Notifications
                     └── Stream Management
```

The HTTP server wraps the MCP server and provides:
- RESTful API endpoints
- SSE streaming capabilities
- Health monitoring
- Progress tracking
- Connection management

## Next Steps

1. **Add Authentication**: Implement JWT or API key authentication
2. **Rate Limiting**: Add rate limiting with express-rate-limit
3. **Metrics**: Add Prometheus metrics endpoint
4. **Clustering**: Use PM2 or Node cluster for multiple workers
5. **Caching**: Implement Redis caching for responses