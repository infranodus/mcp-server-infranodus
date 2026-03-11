#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as dotenv from 'dotenv';
import createServer from '../dist/index.js';

// Main function for CLI execution
async function main() {
    // Load environment variables
    dotenv.config();

    const config = {
        apiKey: process.env.INFRANODUS_API_KEY || "",
        apiBase: process.env.INFRANODUS_API_BASE || "https://infranodus.com/api/v1",
    };

    // Validate config
    if (!config.apiKey) {
        console.error(
            "WARNING: Set INFRANODUS_API_KEY in environment variables to ensure you don't hit the rate limit"
        );
    }

    // Create server with config
    const server = createServer({ config });

    // Create STDIO transport
    const transport = new StdioServerTransport();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
        await server.close();
        process.exit(0);
    });

    process.on("SIGTERM", async () => {
        await server.close();
        process.exit(0);
    });

    try {
        await server.connect(transport);
        // Server is running - no console output to avoid protocol interference
    } catch (error) {
        console.error("ERROR: MCP server failed to connect", error);
        process.exit(1);
    }
}

// Run the main function
main().catch((error) => {
    console.error("ERROR: Fatal error of MCP server", error);
    process.exit(1);
});