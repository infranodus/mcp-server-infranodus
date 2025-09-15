#!/bin/bash

# Monitor SSE Server Performance and Connections
# Usage: ./monitor.sh [server_url] [interval_seconds]

SERVER_URL=${1:-"http://localhost:3000"}
INTERVAL=${2:-5}

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear

echo -e "${BLUE}📊 SSE Server Monitor${NC}"
echo "================================="
echo "Server: $SERVER_URL"
echo "Refresh: Every ${INTERVAL}s"
echo "Press Ctrl+C to stop"
echo "================================="

while true; do
    # Get health status
    HEALTH=$(curl -s "$SERVER_URL/health" 2>/dev/null)

    if [ $? -eq 0 ]; then
        STATUS=$(echo "$HEALTH" | jq -r '.status' 2>/dev/null || echo "unknown")
        VERSION=$(echo "$HEALTH" | jq -r '.version' 2>/dev/null || echo "unknown")
        MCP_CONNECTED=$(echo "$HEALTH" | jq -r '.mcp.connected' 2>/dev/null || echo "false")
        SSE_CONNECTIONS=$(echo "$HEALTH" | jq -r '.sse.activeConnections' 2>/dev/null || echo "0")
        TIMESTAMP=$(echo "$HEALTH" | jq -r '.timestamp' 2>/dev/null || date -Iseconds)

        # Clear previous output
        echo -ne "\033[6A\033[K"

        # Display status
        if [ "$STATUS" = "healthy" ]; then
            echo -e "Status: ${GREEN}● $STATUS${NC}"
        else
            echo -e "Status: ${RED}● $STATUS${NC}"
        fi

        echo -e "Version: $VERSION"
        echo -e "MCP Connected: $([ "$MCP_CONNECTED" = "true" ] && echo -e "${GREEN}Yes${NC}" || echo -e "${RED}No${NC}")"
        echo -e "Active SSE: ${YELLOW}$SSE_CONNECTIONS${NC} connections"
        echo -e "Last Check: $(date '+%H:%M:%S')"

        # Performance metrics (if available)
        if command -v docker &> /dev/null && docker ps | grep -q infranodus-mcp-server; then
            echo -e "\n${BLUE}Container Stats:${NC}"
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" infranodus-mcp-server 2>/dev/null | tail -n +2
        fi
    else
        echo -e "${RED}⚠ Server unreachable${NC}"
    fi

    sleep $INTERVAL
done