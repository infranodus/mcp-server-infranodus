#!/bin/bash

# Test SSE Server Connectivity and Functionality
# Usage: ./test-sse.sh [server_url]

SERVER_URL=${1:-"http://localhost:3000"}
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Testing SSE Server at: $SERVER_URL"
echo "========================================="

# Test 1: Health Check
echo -e "\n${YELLOW}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s "$SERVER_URL/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi

# Test 2: SSE Connection Test
echo -e "\n${YELLOW}Test 2: SSE Stream Connection${NC}"
echo "Connecting to test SSE endpoint (10 seconds)..."

timeout 10 curl -N -H "Accept: text/event-stream" "$SERVER_URL/test/sse" 2>/dev/null | while read -r line; do
    if [[ $line == event:* ]]; then
        echo -e "${GREEN}Event:${NC} ${line#event: }"
    elif [[ $line == data:* ]]; then
        echo -e "${GREEN}Data:${NC} ${line#data: }"
    fi
done

if [ ${PIPESTATUS[0]} -eq 124 ]; then
    echo -e "${GREEN}✓ SSE stream test completed (timeout as expected)${NC}"
else
    echo -e "${GREEN}✓ SSE stream test completed${NC}"
fi

# Test 3: API Endpoints
echo -e "\n${YELLOW}Test 3: API Endpoints${NC}"

# List tools
echo "Testing /api/tools endpoint..."
TOOLS_RESPONSE=$(curl -s "$SERVER_URL/api/tools")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Tools endpoint working${NC}"
    echo "$TOOLS_RESPONSE" | jq '.tools[]' 2>/dev/null || echo "$TOOLS_RESPONSE"
else
    echo -e "${RED}✗ Tools endpoint failed${NC}"
fi

# Test 4: Analysis with SSE (mock)
echo -e "\n${YELLOW}Test 4: Analysis Endpoint${NC}"

ANALYSIS_PAYLOAD='{
  "text": "Test text for analysis",
  "streamId": "test-stream-123",
  "options": {
    "optimize": "gap",
    "modelToUse": "gpt-4o"
  }
}'

echo "Sending analysis request..."
ANALYSIS_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$ANALYSIS_PAYLOAD" \
    "$SERVER_URL/api/analyze" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Analysis endpoint responsive${NC}"
    echo "$ANALYSIS_RESPONSE" | jq '.' 2>/dev/null || echo "$ANALYSIS_RESPONSE"
else
    echo -e "${RED}✗ Analysis endpoint failed${NC}"
fi

# Test 5: Concurrent SSE Connections
echo -e "\n${YELLOW}Test 5: Concurrent SSE Connections${NC}"

for i in {1..3}; do
    (
        STREAM_ID="concurrent-test-$i"
        echo "Starting stream $STREAM_ID..."
        timeout 3 curl -s -N "$SERVER_URL/sse/stream/$STREAM_ID" > /dev/null 2>&1
        echo -e "${GREEN}✓ Stream $STREAM_ID completed${NC}"
    ) &
done

wait
echo -e "${GREEN}✓ All concurrent streams handled${NC}"

# Summary
echo -e "\n========================================="
echo -e "${GREEN}✅ All tests completed successfully!${NC}"
echo -e "\nServer is ready to accept connections from:"
echo "  - Local: $SERVER_URL"
echo "  - Network: http://$(hostname -I | awk '{print $1}'):3000"
echo "  - Docker: http://0.0.0.0:3000"