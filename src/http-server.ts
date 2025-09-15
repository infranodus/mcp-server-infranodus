#!/usr/bin/env node
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import { config, validateConfig } from "./config/index.js";
import { makeInfraNodusRequest } from "./api/client.js";

const app = express();
const httpServer = createServer(app);
const sseClients = new Map<string, express.Response>();
const eventEmitter = new EventEmitter();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
		mcp: {
			connected: mcpProcess !== null,
		},
		sse: {
			activeConnections: sseClients.size,
		},
	});
});

// SSE endpoint for real-time updates
app.get("/sse/stream/:streamId", (req, res) => {
	const streamId = req.params.streamId;

	// Set SSE headers
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering

	// Store client connection
	sseClients.set(streamId, res);

	// Send initial connection message
	res.write(`event: connected\ndata: {"streamId":"${streamId}","timestamp":"${new Date().toISOString()}"}\n\n`);

	// Handle client disconnect
	req.on("close", () => {
		sseClients.delete(streamId);
		console.log(`SSE client disconnected: ${streamId}`);
	});

	// Keep connection alive
	const keepAlive = setInterval(() => {
		res.write(":ping\n\n");
	}, 30000);

	req.on("close", () => {
		clearInterval(keepAlive);
	});
});

// REST endpoint to trigger analysis with SSE updates
app.post("/api/analyze", async (req, res) => {
	const { text, streamId, options = {} } = req.body;

	if (!text) {
		return res.status(400).json({ error: "Text is required" });
	}

	const stream = streamId || `analysis-${Date.now()}`;

	// Send SSE updates if client is connected
	const sendSSE = (event: string, data: any) => {
		const client = sseClients.get(stream);
		if (client) {
			client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		}
	};

	try {
		// Start analysis
		sendSSE("start", { message: "Starting analysis", progress: 0 });

		// Build query parameters
		const queryParams = new URLSearchParams({
			doNotSave: "true",
			addStats: "true",
			optimize: options.optimize || "gap",
			includeStatements: "false",
			includeGraphSummary: options.includeGraphSummary || "false",
			extendedGraphSummary: "false",
			includeGraph: options.includeGraph || "false",
			aiTopics: "true",
		});

		sendSSE("progress", { message: "Building knowledge graph", progress: 30 });

		const endpoint = `/graphAndAdvice?${queryParams.toString()}`;
		const requestBody = {
			text,
			aiTopics: "true",
			requestMode: options.requestMode || "question",
			modelToUse: options.modelToUse || "gpt-4o",
		};

		sendSSE("progress", { message: "Sending to InfraNodus", progress: 50 });

		const response = await makeInfraNodusRequest(endpoint, requestBody);

		sendSSE("progress", { message: "Processing results", progress: 80 });

		if (response.error) {
			sendSSE("error", { error: response.error });
			return res.status(500).json({ error: response.error });
		}

		sendSSE("complete", { message: "Analysis complete", progress: 100 });

		res.json({
			streamId: stream,
			result: response,
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		sendSSE("error", { error: errorMsg });
		res.status(500).json({ error: errorMsg });
	}
});

// WebSocket-like endpoint using SSE for bidirectional-like communication
app.post("/api/command", async (req, res) => {
	const { command, params, streamId } = req.body;

	if (!command) {
		return res.status(400).json({ error: "Command is required" });
	}

	const stream = streamId || `command-${Date.now()}`;

	// Execute MCP command through stdio
	try {
		const result = await executeMCPCommand(command, params, stream);
		res.json({
			streamId: stream,
			result,
		});
	} catch (error) {
		res.status(500).json({
			error: error instanceof Error ? error.message : "Command execution failed",
		});
	}
});

// List available tools
app.get("/api/tools", (req, res) => {
	res.json({
		tools: [
			"generateKnowledgeGraph",
			"createKnowledgeGraph",
			"analyzeExistingGraph",
			"generateContentGaps",
			"generateTopicalClusters",
			"generateResearchQuestions",
			"generateResearchQuestionsFromGraph",
			"generateResponsesFromGraph",
			"generateTextOverview",
		],
	});
});

// Test SSE endpoint
app.get("/test/sse", (req, res) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	let counter = 0;
	const interval = setInterval(() => {
		counter++;
		res.write(`event: test\ndata: {"counter":${counter},"timestamp":"${new Date().toISOString()}"}\n\n`);

		if (counter >= 10) {
			clearInterval(interval);
			res.write(`event: complete\ndata: {"message":"Test complete"}\n\n`);
			res.end();
		}
	}, 1000);

	req.on("close", () => {
		clearInterval(interval);
	});
});

// MCP process management
let mcpProcess: any = null;

async function executeMCPCommand(command: string, params: any, streamId: string) {
	return new Promise((resolve, reject) => {
		// This would integrate with the MCP server through stdio
		// For now, returning a mock response
		setTimeout(() => {
			resolve({
				command,
				params,
				response: "Command executed successfully",
			});
		}, 100);
	});
}

// Start HTTP server
const PORT = process.env.HTTP_PORT || 3000;
const HOST = process.env.HTTP_HOST || "0.0.0.0";

httpServer.listen(PORT, HOST as any, () => {
	console.log(`🚀 HTTP/SSE Server running at http://${HOST}:${PORT}`);
	console.log(`📡 SSE endpoint: http://${HOST}:${PORT}/sse/stream/:streamId`);
	console.log(`❤️  Health check: http://${HOST}:${PORT}/health`);
	console.log(`🧪 Test SSE: http://${HOST}:${PORT}/test/sse`);
});

// Graceful shutdown
process.on("SIGINT", () => {
	console.log("\nShutting down gracefully...");

	// Close all SSE connections
	sseClients.forEach((client) => {
		client.write(`event: shutdown\ndata: {"message":"Server shutting down"}\n\n`);
		client.end();
	});

	httpServer.close(() => {
		console.log("HTTP server closed");
		process.exit(0);
	});
});

export { app, httpServer };