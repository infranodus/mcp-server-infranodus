// Prompts for common InfraNodus use cases
export const prompts = [
	{
		name: "analyze-text",
		definition: {
			title: "Analyze text as a knowledge graph",
			description:
				"Generate a knowledge graph from text to identify main topics, concepts, and gaps",
			arguments: [
				{
					name: "text",
					description: "The text to analyze",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const text = args.text as string;
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Please analyze the following text using InfraNodus to generate a knowledge graph. Show me the main topics, topical clusters, key concepts, relationships, and any structural gaps you identify:

${text}

Use the generate_knowledge_graph tool to get a detailed analysis.`,
						},
					},
				],
			};
		},
	},
	{
		name: "gap-analysis",
		definition: {
			title: "Find the gaps in a text",
			description:
				"Find the gaps in a text based on the knowledge graph analysis",
			arguments: [
				{
					name: "text",
					description: "The text to find the gaps in",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const text = args.text as string;
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Please analyze the following text using InfraNodus to find the gaps within it that could be bridged to improve the content and generate new ideas:

${text}

Use the generate_content_gaps tool to get a detailed analysis.`,
						},
					},
				],
			};
		},
	},
	{
		name: "topic-analysis",
		definition: {
			title: "Find the topics in a text",
			description:
				"Find the main topics and topical clusters in a text based on the knowledge graph analysis",
			arguments: [
				{
					name: "text",
					description: "The text to find the topics in",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const text = args.text as string;
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Please analyze the following text using InfraNodus to find the gaps within it that could be bridged to improve the content and generate new ideas:

${text}

Use the generate_topical_clusters tool to get a detailed analysis.`,
						},
					},
				],
			};
		},
	},
	{
		name: "compare-texts",
		definition: {
			title: "Compare two texts",
			description:
				"Find overlaps and differences between two texts using knowledge graphs",
			arguments: [
				{
					name: "text1",
					description:
						"The main text to find similarities and find the differences: what's in the first text that is not in the second one.",
					required: true,
				},
				{
					name: "text2",
					description:
						"The second text to compare for similarities and differences: the content in the first text that is not in the second.",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const text1 = args.text1 as string;
			const text2 = args.text2 as string;
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Please compare these two texts using InfraNodus:

Text 1:
${text1}

Text 2:
${text2}

First, use the overlap_between_texts tool to find common themes and concepts.
Then, use the difference_between_texts tool to identify what's present in the first text that is not in the second one.
Provide a summary of the main similarities and differences.`,
						},
					},
				],
			};
		},
	},
	{
		name: "research-ideas",
		definition: {
			title: "Generate research ideas",
			description:
				"Generate research questions and ideas from text or existing graph",
			arguments: [
				{
					name: "text",
					description: "The text to generate research ideas from",
					required: true,
				},
				{
					name: "graphName",
					description:
						"Optional: name of existing graph to use if no text is provided",
					required: false,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const text = args.text as string;
			const graphName = args.graphName;
			if (graphName) {
				return {
					messages: [
						{
							role: "user" as const,
							content: {
								type: "text" as const,
								text: `Please generate research ideas for the graph "${graphName}":

1. Use the generate_research_questions_from_graph tool to create research questions
2. Use the generate_responses_from_graph tool to generate potential responses

Provide a comprehensive research agenda based on the analysis.`,
							},
						},
					],
				};
			}

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Please help me generate research ideas based on this text: 
							"${text}"

Use the develop_text tool to generate research ideas based on the content gaps, conceptual bridges, and latent topics identified in the text.

Provide a structured research plan with key questions and areas to investigate.`,
						},
					},
				],
			};
		},
	},
	{
		name: "seo-topic-analysis",
		definition: {
			title: "SEO analysis of a topic",
			description:
				"Analyze search queries and results to identify search intent, the main topics for topical authority, and high-volume search queries that are not adequately served by search results",
			arguments: [
				{
					name: "queries",
					description:
						"The most likely search queries to analyze for a given topic, comma-separated list",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const queries = args.queries as string;
			const basePrompt = `Please perform an SEO analysis for the following search queries: "${queries}"

1. First, use the generate_google_search_queries_graph tool to analyze related search queries
2. Then, use the generate_google_search_results_graph tool to analyze the top search results
3. Use the generate_google_results_vs_queries_graph tool to find gaps between queries and results`;

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text:
								basePrompt +
								`

Provide insights about the search landscape and content opportunities based on the gaps identified.`,
						},
					},
				],
			};
		},
	},
	{
		name: "seo-content-analysis",
		definition: {
			title: "SEO analysis of a content",
			description: "Analyze the content to identify SEO opportunities and gaps",
			arguments: [
				{
					name: "content",
					description:
						"The content to analyze for SEO opportunities and gaps, can be a text or the text content of a website",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const content = args.content as string;
			const basePrompt = `Please perform an SEO analysis for the following content: 
			
			${content}

Use the generate_seo_report tool to provide full report on the SEO opportunities and gaps identified in the content`;

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text:
								basePrompt +
								`

Provide insights about the main topics for topical authority, high-volume search queries, content gaps and other SEO opportunities.`,
						},
					},
				],
			};
		},
	},
	{
		name: "seo-competition-analysis",
		definition: {
			title: "SEO analysis of the competition",
			description:
				"Analyze the highest-ranking websites of your competition to identify their main topics and gaps and see what you can focus on to improve your ranking",
			arguments: [
				{
					name: "yourWebsite",
					description: "The URL of your website to analyze",
					required: true,
				},
				{
					name: "competitionWebsites",
					description:
						"The URLs of the highest-ranking websites of your competition to analyze, comma-separated list",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const yourWebsite = args.yourWebsite as string;
			const competitionWebsites = args.competitionWebsites as string;
			const basePrompt = `Extract the content of the main and highest-ranking pages on Google for my website "${yourWebsite}" and the content of the highest ranking pages on Googlefollowing websites of my competition: "${competitionWebsites}"
			
			Then use the difference_between_texts tool to keyword combinations that are present in the competitors' websites that is not in my website.

			Then use the analyze_related_search_queries tool with these keyword combinations to identify the high-volume, low-competition search queries. 
			
			Then use the generate_seo_report tool to analyze the content of competitors content and see what they are missing.

			Then run the analyze_google_search_results tool on the gaps identified to extract the main topics to target to improve topical authority.

			Provide a comprensive advice on how to improve my website's SEO based on this analysis.

			`;

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: basePrompt,
						},
					},
				],
			};
		},
	},
	{
		name: "develop-text",
		definition: {
			title: "Develop and expand text",
			description:
				"Develop text using knowledge graph analysis to fill gaps and expand ideas",
			arguments: [
				{
					name: "text",
					description: "The text to develop and expand",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const text = args.text as string;
			const focus = args.focus;
			let prompt = `Please help me develop and expand this text using InfraNodus:

${text}

Use the develop_text tool to generate research ideas based on the content gaps, conceptual bridges, and latent topics identified in the text.
`;

			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: prompt,
						},
					},
				],
			};
		},
	},
	{
		name: "save-memory",
		definition: {
			title: "Save text to InfraNodus memory",
			description:
				"Save important information to your InfraNodus knowledge base",
			arguments: [
				{
					name: "graphName",
					description: "Name for the saved graph",
					required: true,
				},
				{
					name: "text",
					description: "The text to save",
					required: true,
				},
			],
		},
		handler: async (args: { [key: string]: string | undefined }) => {
			const graphName = args.graphName as string;
			const text = args.text as string;
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `Please save the following text to my InfraNodus memory with the name "${graphName}":

${text}

Use the memory_add_relations tool to save this information.`,
						},
					},
				],
			};
		},
	},
];
