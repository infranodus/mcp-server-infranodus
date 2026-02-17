# InfraNodus MCP Tools — Examples

This file demonstrates how each tool is used for a particular purpose. The same **example text** is used throughout so you can compare how different tools analyze it and the results they produce.

You can also use the tools with URL links (including YouTube videos which will be automatically transcribed) as well as exisitng InfraNodus graphs.

---

## Example text: Genesis 3 — The Fall (excerpt)

```
 God said, 'You shall not eat of the fruit of the tree which is in the midst of the garden, neither shall you touch it, lest you die.'" But the serpent said to the woman, "You will not die. For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil."
```

---

## Analysis examples (per tool)

Below you will find descriptions of every tool that is available in the InfraNodus MCP, its typical use case, the data it receives, and the structure of the response generated.

Note, that exact schemas may change, so it's better to avoid hard-coding the tool names or fields and to instead rely on your LLM reading through all available tool descriptions and request parameters. In this case, even if the server is updated, you'll always get the best possible results.

### generate_knowledge_graph

Generates a knowledge graph from a text, URL (including YouTube video), or an existing InfraNodus graph based on network analysis. Shows the main concepts (nodes), and relations, as well as the topical clusters and gaps.

Can be used to get structural insights into text, estimate bias (through diversity), find content gaps, main topical clusters, and relations between them.

Useful for providing additional reproducible structure to LLMs or to steer their attention to a certain aspect of text.

For instance, in the example below, we can see that the text excerpt is too focused on specific concepts "god" and "eat" and the topical cluster they form, concentrating most of the influence.

Additional structure insights provided in the compact DOT graph format provide a clear structural outline of the text.

- **Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"includeGraph": true
}
```

**Result:**

```json
{
	"statistics": {
		"modularity": 0.2951913988657845,
		"clusterCount": 3,
		"nodeCount": 14,
		"edgeCount": 41,
		"diversity_stats": {
			"diversity_score": "focused",
			"modularity_score": "medium",
			"too_focused_on_top_nodes": true,
			"too_focused_on_top_clusters": true,
			"ratio_of_top_nodes_influence_by_betweenness": 0.63,
			"top_nodes_entropy": 0,
			"ratio_of_top_cluster_influence_by_betweenness": 0.63,
			"total_clusters": 3,
			"fair_influence_by_cluster": 0.33
		}
	},
	"contentGaps": [
		"Gap 1: 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch) -> 3. Moral Duality (knowing good evil)",
		"Gap 2: 1. Divine Consumption (god eat eye open) -> 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch)",
		"Gap 3: 1. Divine Consumption (god eat eye open) -> 3. Moral Duality (knowing good evil)"
	],
	"mainTopicalClusters": [
		"1. Divine Consumption: god eat eye open (0 | 29% | 63%)",
		"2. Forbidden Knowledge: serpent tree fruit woman midst garden touch (1 | 50% | 26%)",
		"3. Moral Duality: knowing good evil (2 | 21% | 10%)"
	],
	"mainConcepts": [
		"god",
		"eat",
		"serpent",
		"knowing",
		"tree",
		"good",
		"fruit",
		"woman",
		"midst",
		"garden",
		"touch",
		"eye",
		"open",
		"evil"
	],
	"conceptualGateways": [
		"god",
		"eat",
		"serpent",
		"good",
		"knowing",
		"tree",
		"fruit",
		"woman"
	],
	"topRelations": [
		"1) god <-> eat",
		"2) god <-> eye",
		"3) god <-> open",
		"4) eat <-> fruit",
		"5) fruit <-> tree",
		"6) tree <-> midst",
		"7) midst <-> garden",
		"8) garden <-> touch",
		"9) touch <-> serpent",
		"10) serpent <-> woman",
		"11) woman <-> god",
		"12) eat <-> eye"
	],
	"topBigrams": [
		"god eat",
		"god eye",
		"god open",
		"eat fruit",
		"fruit tree",
		"tree midst",
		"midst garden",
		"garden touch",
		"touch serpent",
		"serpent woman",
		"woman god",
		"eat eye"
	],
	"topInfluentialNodes": [
		{
			"node": "god",
			"bc": 0.5897435897435898,
			"degree": 11
		},
		{
			"node": "eat",
			"bc": 0.2692307692307692,
			"degree": 8
		}
	],
	"knowledgeGraphByCluster": {
		"0": ["god <-> eat [label=\"eye, open\"]"],
		"1": [
			"midst <-> garden [label=\"tree, fruit, touch, serpent\"]",
			"serpent <-> woman [label=\"touch, garden\"]"
		],
		"2": ["knowing <-> good [label=\"evil\"]"],
		"top_nodes": [
			"god <-> eat [label=\"eye, open, woman, fruit, serpent, tree\"]",
			"touch <-> god [label=\"serpent, woman, tree\"]",
			"god <-> knowing [label=\"eye, open, good, evil\"]",
			"eat <-> midst [label=\"fruit, tree, serpent\"]",
			"midst <-> garden [label=\"tree, fruit, touch, serpent\"]"
		],
		"inter_cluster": [
			"god <-> knowing",
			"god <-> good",
			"woman <-> god",
			"god <-> fruit",
			"eat <-> fruit",
			"open <-> knowing"
		]
	},
	"knowledgeGraph": {
		"attributes": {
			"modularity": 0.2951913988657845,
			"diversity_stats": {
				"diversity_score": "focused",
				"modularity_score": "medium",
				"too_focused_on_top_nodes": true,
				"too_focused_on_top_clusters": true,
				"ratio_of_top_nodes_influence_by_betweenness": 0.63,
				"top_nodes_entropy": 0,
				"ratio_of_top_cluster_influence_by_betweenness": 0.63,
				"total_clusters": 3,
				"fair_influence_by_cluster": 0.33
			},
			"top_clusters": [
				{
					"community": "0",
					"nodes": [
						{
							"nodeName": "god",
							"bc": 0.5897435897435898
						},
						{
							"nodeName": "eat",
							"bc": 0.2692307692307692
						},
						{
							"nodeName": "eye",
							"bc": 0
						},
						{
							"nodeName": "open",
							"bc": 0
						}
					],
					"bcRatio": 0.63
				},
				{
					"community": "1",
					"nodes": [
						{
							"nodeName": "serpent",
							"bc": 0.1282051282051282
						},
						{
							"nodeName": "tree",
							"bc": 0.0641025641025641
						},
						{
							"nodeName": "fruit",
							"bc": 0.04487179487179487
						},
						{
							"nodeName": "woman",
							"bc": 0.04487179487179487
						},
						{
							"nodeName": "midst",
							"bc": 0.02564102564102564
						},
						{
							"nodeName": "garden",
							"bc": 0.02564102564102564
						},
						{
							"nodeName": "touch",
							"bc": 0.02564102564102564
						}
					],
					"bcRatio": 0.26
				},
				{
					"community": "2",
					"nodes": [
						{
							"nodeName": "knowing",
							"bc": 0.07692307692307693
						},
						{
							"nodeName": "good",
							"bc": 0.0641025641025641
						},
						{
							"nodeName": "evil",
							"bc": 0
						}
					],
					"bcRatio": 0.1
				}
			],
			"top_influential_nodes": [
				{
					"node": "god",
					"bc": 0.5897435897435898,
					"degree": 11
				},
				{
					"node": "eat",
					"bc": 0.2692307692307692,
					"degree": 8
				}
			],
			"gaps": [
				{
					"from": {
						"community": "1"
					},
					"to": {
						"community": "2"
					}
				},
				{
					"from": {
						"community": "0"
					},
					"to": {
						"community": "1"
					}
				},
				{
					"from": {
						"community": "0"
					},
					"to": {
						"community": "2"
					}
				}
			]
		}
	},
	"statements": [],
	"userName": "deemeetree"
}
```

### create_knowledge_graph

Create a knowledge graph from text or URL (including YouTube videos) and save it in InfraNodus.

Useful for saving the text in InfraNodus for future reference or using it as a knowledge base.

- **Parameters (JSON):**

```json
{
	"graphName": "bible_genesis",
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"includeGraph": true
}
```

**Result:**

Same JSON object as in `generate_knowledge_graph` with additional parameters:

```json
{
    ...,
	"userName": "deemeetree",
	"graphName": "test_bible",
	"graphUrl": "https://infranodus.com/deemeetree/test_bible/edit"
}
```

### generate_topical_clusters

Extracts topical clusters from a text, URL, YouTube video, or an existing InfraNodus graph. Compact delivery of the most important topics identified in a text. Can be used to generate compact topical summaries of text and improve the structure of LLM output and reasoning workflows.

- **Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>"
}
```

**Result:**

```json
{
	"topicalClusters": [
		"1. Divine Consumption: god eat eye open (0 | 29% | 63%)",

		"2. Forbidden Knowledge: serpent tree fruit woman midst garden touch (1 | 50% | 26%)",

		"3. Moral Duality: knowing good evil (2 | 21% | 10%)"
	]
}
```

### generate_content_gaps

Retrieves content gaps from a text, URL (including YouTube video), or an existing InfraNodus graph.

It can be used to identify areas of discourse that could be further developed, as well as potential opportunities for generating insights by linking topics that are not well connected.

- **Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>"
}
```

**Result:**

```json
{
	"contentGaps": [
		"Gap 1: 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch) -> 3. Moral Duality (knowing good evil)",

		"Gap 2: 1. Divine Consumption (god eat eye open) -> 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch)",

		"Gap 3: 1. Divine Consumption (god eat eye open) -> 3. Moral Duality (knowing good evil)"
	]
}
```

### generate_research_questions

Generates three research questions based on a text, URL (or YouTube video), or an existing InfraNodus graph.

Useful for generating ideas for research and LLM prompts that bridge content gaps found in text.

The questions are based on the content gaps identified using text network analysis. User can specify `useSeveralGaps` to get a more diverse range of questions and `gapDepth` to explore less prominent gaps.

- **Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"useSeveralGaps": true,
	"modelToUse": "gpt-4o"
}
```

**Result:**

```json
{
	"questions": [
		"How does the interplay between forbidden knowledge and moral duality in the Garden of Eden narrative reflect on contemporary ethical dilemmas surrounding technology and privacy, considering concepts like serpent-tree interactions and knowing good from evil?",

		"How does the act of consuming forbidden fruit in mythological narratives symbolize a shift from divine control to human agency, and what role do gender dynamics play in this transition?",

		"How does the metaphor of \"divine consumption\" in religious texts explore the interplay between forbidden knowledge and moral duality, specifically through the act of eating that opens one's eyes to knowing good and evil?"
	]
}
```

### generate_research_ideas

Generates ideas to help develop the text further. Will be based by default on the content gap and will generate an idea that bridges the gap (staying within the text's context). With the `shouldTranscend` mode on, will focus on the least represented clusters as well as conceptual gateways and attempt to link the text to a wider discourse or to an alternative viewpoint.

- **Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"useSeveralGaps": true,
	"shouldTranscend": true,
	"modelToUse": "gpt-4o"
}
```

**Result:**

```json
{
	"ideas": [
		"In the labyrinth of divine prohibition and serpentine temptation, one might propose a novel perspective: \"Consciousness as the forbidden fruit.\" Rather than viewing knowledge as static binaries—good or evil—it becomes an evolving awareness where divine consumption isn't just about godlike knowing but embodying the perpetual journey of understanding itself. This transcends duality, reshaping existence into a dynamic synthesis where morality is not fixed but fluid, redefined by every act of seeing and being. The true revelation lies in recognizing that it's not solely what you consume that opens your eyes, but how those open eyes redefine reality continuously."
	]
}
```

### generate_contextual_hint

Generates a structural summary of a text for an LLM to have an general overview of the context. Can be useful for GraphRAG-augmented retrieval where in addition to retrieving statements based on vector similarity (RAG), the system can also have a general understanding of the whole knowledge base, the main topical clusters, concepts, and gaps inside.

Can be generated from text, URL (including YouTube videos), or an existing InfraNodus graph that contains a knowledge base.

- **Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>"
}
```

**Result:**

```json
{
  "textOverview": "<Main Concepts (concept_degree | concept_betweenness_centrality | concept_topic_id)>: \n god (11 | 0.5897 | ), eat (8 | 0.2692 | ), serpent (6 | 0.1282 | 1), knowing (5 | 0.0769 | 2), tree (6 | 0.0641 | 1), good (4 | 0.0641 | 2), fruit (5 | 0.0449 | 1), woman (6 | 0.0449 | 1), midst (6 | 0.0256 | 1), garden (6 | 0.0256 | 1), touch (6 | 0.0256 | 1), eye (5 | 0.0000 | ), open (5 | 0.0000 | ), evil (3 | 0.0000 | 2) \n </MainConcepts> \n\n

  <MainTopics (topic_id | cluster_influence_by_degree_ratio | cluster_influence_by_betweenness_ratio)>: \n 1. Divine Consumption: god eat eye open (0 | 29% | 63%)\n2. Forbidden Knowledge: serpent tree fruit woman midst garden touch (1 | 50% | 26%)\n3. Moral Duality: knowing good evil (2 | 21% | 10%) \n </MainTopics> \n\n

  <TopicalGaps>: \n Gap 1: 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch) -> 3. Moral Duality (knowing good evil)\nGap 2: 1. Divine Consumption (god eat eye open) -> 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch)\nGap 3: 1. Divine Consumption (god eat eye open) -> 3. Moral Duality (knowing good evil) \n </TopicalGaps> \n\n

  <ConceptualGateways> \n god\neat\nserpent\ngood\nknowing\ntree\nfruit\nwoman \n </ConceptualGateways> \n\n

  <Relations>: \n 1) god <-> eat\n2) god <-> eye\n3) god <-> open\n4) eat <-> fruit\n5) fruit <-> tree\n6) tree <-> midst\n7) midst <-> garden\n8) garden <-> touch\n9) touch <-> serpent\n10) serpent <-> woman\n11) woman <-> god\n12) eat <-> eye \n </Relations> \n

  <DiversityStatistics>:\n        Modularity: 0.30 \n        Modularity Score: medium \n        Too focused on top concept nodes \n        Too focused on top topical clusters \n        Ratio of top nodes influence / betweenness: 0.63 \n        Ratio of top topical clusters influence / betweenness: 0.63 \n        Total clusters: 3\n        Fair betweenness / influence ratio per cluster: 0.33 \n        Entropy of top nodes distribution among clusters: 0 \n</DiversityStatistics> \n"
}
```

### develop_latent_topics

Identifies underdeveloped topics and generates ideas (when the `requestMode` is set to `transcend` or by default) or reseach ideas that develop those topics further.

Additionally provides information about the latent topical clusters used for generating ideas / questions.

Useful for finding latent topics in text and focusing on developing them further.

Can be used for text, URLs (including YouTube videos), existing InfraNodus graphs.

**Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"requestMode": "transcend"
}
```

**Result:**

```json
{
	"ideas": [
		"Imagine the forbidden fruit as a mirror, reflecting not just knowledge but the act of reflection itself. By consuming it, one sees both self and divine mirrored in their own eyes—transcending duality into unity. The garden ceases to be merely a place; it becomes an internal landscape where consumption is creation. Here, God, serpent, woman—all become facets of an intricate dance towards self-realization through interconnected awareness. In this view, eating isn't defiance or transgression but a step toward holistic vision beyond good and evil—a conscious choice to see oneself as part of everything that exists and could exist between knowing and unknowing."
	],
	"mainTopics": [
		"1. Divine Consumption: god eat eye open (0 | 29% | 63%)",
		"2. Forbidden Knowledge: serpent tree fruit woman midst garden touch (1 | 50% | 26%)",
		"3. Moral Duality: knowing good evil (2 | 21% | 10%)"
	],
	"latentTopicsToDevelop": [
		"god <-> eat [label=\"eye, open\"]",
		"midst <-> garden [label=\"tree, fruit, touch, serpent\"],serpent <-> woman [label=\"touch, garden\"]"
	]
}
```

### develop_conceptual_bridges

Similar to the `develop_latent_topics` tool. However, in this case, instead of focusing on developing the text itself, the tool focuses on the nodes (concepts in text) that have high ratio of influence to degree (they link different topical clusters together but are not excessively overwhelmed by the informational flow). These concepts will usually be optimal for connecting this discourse to another context.

Can be used to nudge the model to think "outside of the box" and link a discourse to a different context or expand its perspective.

Can be used for text, URLs (including YouTube videos), existing InfraNodus graphs.

**Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"requestMode": "transcend"
}
```

**Result:**

```json
{
	"ideas": [
		"In the realm where God restrains and serpents entice, consider this: The true transformation lies not in forbidden knowledge or divine consumption, but in transcending both by recognizing that the fruit is merely a mirror to our inner landscape. It reflects our capacity for choice—not just between good and evil—but towards understanding existence as a garden of infinite possibilities. Herein lies potential beyond duality: embracing curiosity without surrendering autonomy."
	],
	"latentConceptsToDevelop": [
		"god",
		"eat",
		"serpent",
		"good",
		"knowing",
		"tree",
		"fruit",
		"woman"
	],
	"latentConceptsRelations": [
		"god <-> eat [label=\"woman, fruit, serpent, tree\"]",
		"god <-> knowing [label=\"good\"]"
	]
}
```

### analyze_existing_graph_by_name

Extract an existing graph from InfraNodus and provide full graph analysis: main topical clusters, concepts, gaps, as well as the structure of the discourse and its diversity.

**Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>"
}
```

**Result:**

```json
{
	"statistics": {
		"modularity": 0.2951913988657845,
		"clusterCount": 3,
		"diversity_stats": {
			"diversity_score": "focused",
			"modularity_score": "medium",
			"too_focused_on_top_nodes": true,
			"too_focused_on_top_clusters": true,
			"ratio_of_top_nodes_influence_by_betweenness": 0.63,
			"top_nodes_entropy": 0,
			"ratio_of_top_cluster_influence_by_betweenness": 0.63,
			"total_clusters": 3,
			"fair_influence_by_cluster": 0.33
		}
	},
	"contentGaps": [
		"Gap 1: 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch) -> 3. Moral Duality (knowing good evil)",
		"Gap 2: 1. Divine Consumption (god eat eye open) -> 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch)",
		"Gap 3: 1. Divine Consumption (god eat eye open) -> 3. Moral Duality (knowing good evil)"
	],
	"mainTopicalClusters": [
		"1. Divine Consumption: god eat eye open (0 | 29% | 63%)",
		"2. Forbidden Knowledge: serpent tree fruit woman midst garden touch (1 | 50% | 26%)",
		"3. Moral Duality: knowing good evil (2 | 21% | 10%)"
	],
	"mainConcepts": [
		"god",
		"eat",
		"serpent",
		"knowing",
		"tree",
		"good",
		"fruit",
		"woman",
		"midst",
		"garden",
		"touch",
		"eye",
		"open",
		"evil"
	],
	"conceptualGateways": [
		"god",
		"eat",
		"serpent",
		"good",
		"knowing",
		"tree",
		"fruit",
		"woman"
	],
	"topRelations": [
		"1) god <-> eat",
		"2) god <-> eye",
		"3) god <-> open",
		"4) eat <-> fruit",
		"5) fruit <-> tree",
		"6) tree <-> midst",
		"7) midst <-> garden",
		"8) garden <-> touch",
		"9) touch <-> serpent",
		"10) serpent <-> woman",
		"11) woman <-> god",
		"12) eat <-> eye"
	],
	"topBigrams": [
		"god eat",
		"god eye",
		"god open",
		"eat fruit",
		"fruit tree",
		"tree midst",
		"midst garden",
		"garden touch",
		"touch serpent",
		"serpent woman",
		"woman god",
		"eat eye"
	],
	"topInfluentialNodes": [
		{
			"node": "god",
			"bc": 0.5897435897435898,
			"degree": 11
		},
		{
			"node": "eat",
			"bc": 0.2692307692307692,
			"degree": 8
		}
	],
	"statements": [],
	"userName": "deemeetree"
}
```

### analyze_text

Analyze a text or the content of a URL page (or a YouTube video transcript), and provide information about the main topical clusters, concepts, content gaps, the text structure, as well as as the statements analyzed.

Useful for general text analysis. Similar to `generate_knowledge_graph` however here the focus is not on the graph, but on the results of analysis and general recommendations regarding the text's structure (e.g. its diversity and focus).

**Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>"
}
```

**Result:**

```json
{
	"statistics": {
		"modularity": 0.2951913988657845,
		"clusterCount": 3,
		"diversity_stats": {
			"diversity_score": "focused",
			"modularity_score": "medium",
			"too_focused_on_top_nodes": true,
			"too_focused_on_top_clusters": true,
			"ratio_of_top_nodes_influence_by_betweenness": 0.63,
			"top_nodes_entropy": 0,
			"ratio_of_top_cluster_influence_by_betweenness": 0.63,
			"total_clusters": 3,
			"fair_influence_by_cluster": 0.33
		}
	},
	"contentGaps": [
		"Gap 1: 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch) -> 3. Moral Duality (knowing good evil)",
		"Gap 2: 1. Divine Consumption (god eat eye open) -> 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch)",
		"Gap 3: 1. Divine Consumption (god eat eye open) -> 3. Moral Duality (knowing good evil)"
	],
	"mainTopicalClusters": [
		"1. Divine Consumption: god eat eye open (0 | 29% | 63%)",
		"2. Forbidden Knowledge: serpent tree fruit woman midst garden touch (1 | 50% | 26%)",
		"3. Moral Duality: knowing good evil (2 | 21% | 10%)"
	],
	"mainConcepts": [
		"god",
		"eat",
		"serpent",
		"knowing",
		"tree",
		"good",
		"fruit",
		"woman",
		"midst",
		"garden",
		"touch",
		"eye",
		"open",
		"evil"
	],
	"conceptualGateways": [
		"god",
		"eat",
		"serpent",
		"good",
		"knowing",
		"tree",
		"fruit",
		"woman"
	],
	"topRelations": [
		"1) god <-> eat",
		"2) god <-> eye",
		"3) god <-> open",
		"4) eat <-> fruit",
		"5) fruit <-> tree",
		"6) tree <-> midst",
		"7) midst <-> garden",
		"8) garden <-> touch",
		"9) touch <-> serpent",
		"10) serpent <-> woman",
		"11) woman <-> god",
		"12) eat <-> eye"
	],
	"topBigrams": [
		"god eat",
		"god eye",
		"god open",
		"eat fruit",
		"fruit tree",
		"tree midst",
		"midst garden",
		"garden touch",
		"touch serpent",
		"serpent woman",
		"woman god",
		"eat eye"
	],
	"topInfluentialNodes": [
		{
			"node": "god",
			"bc": 0.5897435897435898,
			"degree": 11
		},
		{
			"node": "eat",
			"bc": 0.2692307692307692,
			"degree": 8
		}
	],
	"statements": [
		{
			"id": "842386_1",
			"content": " God said, 'You shall not eat of the fruit of the tree which is in the midst of the garden, neither shall you touch it, lest you die.'\" But the serpent said to the woman, \"You will not die. For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil.\"",
			"topStatementCommunity": "1",
			"topStatementOfCommunity": "2"
		}
	],
	"userName": "deemeetree"
}
```

### develop_text_tool

_(Example to be added.)_

## Utility Tools

These tools are used for listing all available graphs, retrieving search results from the knowledge base, searching existing graphs, and fetching specific search results.

### retrieve_from_knowledge_base

Get the existing graph provided (by name) and retrieve statements relevant to the prompt using GraphRAG and RAG retrieval algorithms.

Use it for augmented RAG with GraphRAG capabilities (that retrieves not only the most similar statements to the prompt but also related connections that are connected to the nodes you require).

Additionally, you can ask InfraNodus MCP to include a graph summary to augment your RAG flows with additional information about the general context from where the data was extracted using the `includeGraphSummary` parameter.

**Parameters (JSON)**

```json
{
	"graphName": "test_bible",
	"prompt": "sin",
    "includeGraphSummary: true
}
```

Note, in the example above we use a word "sin" that does not exist in the graph, however both vector search and GraphRAG retrieves the most relevant part of the graph's structure:

**Result:**

```json
{
	"retrievedStatements": [
		{
			"content": " God said, 'You shall not eat of the fruit of the tree which is in the midst of the garden, neither shall you touch it, lest you die.'\" But the serpent said to the woman, \"You will not die. For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil.\"",
			"categories": [],
			"topStatementCommunity": "1",
			"topStatementOfCommunity": "2",
			"similarityScore": 0.16702114939288282
		},
		{
			"content": " God said, 'You shall not eat of the fruit of the tree which is in the midst of the garden, neither shall you touch it, lest you die.'\" But the serpent said to the woman, \"You will not die. For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil.\"",
			"categories": [],
			"topStatementCommunity": "1",
			"topStatementOfCommunity": "2",
			"similarityScore": 0.3
		}
	],
	"graphSummary": "<Main Concepts (concept_degree | concept_betweenness_centrality | concept_topic_id)>: \n god (11 | 0.5897 | ), eat (8 | 0.2692 | ), serpent (6 | 0.1282 | 1), knowing (5 | 0.0769 | 2), tree (6 | 0.0641 | 1), good (4 | 0.0641 | 2), fruit (5 | 0.0449 | 1), woman (6 | 0.0449 | 1), midst (6 | 0.0256 | 1), garden (6 | 0.0256 | 1), touch (6 | 0.0256 | 1), eye (5 | 0.0000 | ), open (5 | 0.0000 | ), evil (3 | 0.0000 | 2) \n </MainConcepts> \n\n <MainTopics (topic_id | cluster_influence_by_degree_ratio | cluster_influence_by_betweenness_ratio)>: \n 1. Divine Consumption: god eat eye open (0 | 29% | 63%)\n2. Forbidden Knowledge: serpent tree fruit woman midst garden touch (1 | 50% | 26%)\n3. Moral Duality: knowing good evil (2 | 21% | 10%) \n </MainTopics> \n\n <TopicalGaps>: \n Gap 1: 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch) -> 3. Moral Duality (knowing good evil)\nGap 2: 1. Divine Consumption (god eat eye open) -> 2. Forbidden Knowledge (serpent tree fruit woman midst garden touch)\nGap 3: 1. Divine Consumption (god eat eye open) -> 3. Moral Duality (knowing good evil) \n </TopicalGaps> \n\n <ConceptualGateways> \n god\neat\nserpent\ngood\nknowing\ntree\nfruit\nwoman \n </ConceptualGateways> \n\n <Relations>: \n 1) god <-> eat\n2) god <-> eye\n3) god <-> open\n4) eat <-> fruit\n5) fruit <-> tree\n6) tree <-> midst\n7) midst <-> garden\n8) garden <-> touch\n9) touch <-> serpent\n10) serpent <-> woman\n11) woman <-> god\n12) eat <-> eye \n </Relations> \n <DiversityStatistics>:\n        Modularity: 0.30 \n        Modularity Score: medium \n        Too focused on top concept nodes \n        Too focused on top topical clusters \n        Ratio of top nodes influence / betweenness: 0.63 \n        Ratio of top topical clusters influence / betweenness: 0.63 \n        Total clusters: 3\n        Fair betweenness / influence ratio per cluster: 0.33 \n        Entropy of top nodes distribution among clusters: 0 \n</DiversityStatistics> \n",
	"userName": "deemeetree"
}
```

### list_graphs

Lists all the graphs that exist in the user's account. Can search by name, type, date, language, and favorites.

Can be useful for finding the graphs that belong to a certain category and retrieving the graphs that relate to a certain topic.

A different function is used for search.

For example, in the

**Parameters (JSON)**

```json
{
	"nameContains": "bible",
	"type": "memory"
}
```

**Result**

```json
{
	"totalGraphs": 1,
	"filters": "query: \"bible\", type: MEMORY",
	"graphs": [
		{
			"id": 294,
			"name": "test_ bible_memory",
			"description": null,
			"type": "MEMORY",
			"isFavorite": false,
			"isPublic": false,
			"createdAt": "2026-02-14T18:00:31.564Z",
			"language": "AUTO"
		}
	]
}
```

### search

Find all the statements in the user's account that contain a certain search term.

A required function for any MCP that connects to ChatGPT as it allows the LLM to find the content.

**Parameters (JSON)**

```json
{
	"query": "serpent"
}
```

**Result**

```json
{
	"results": [
		{
			"id": "deemeetree:test_bible:serpent",
			"title": "test_bible",
			"url": "https://localhost:3000/deemeetree/test_bible/edit"
		},
		{
			"id": "deemeetree:test_ bible_memory:serpent",
			"title": "test_ bible_memory",
			"url": "https://localhost:3000/deemeetree/test_ bible_memory/edit"
		}
	]
}
```

### fetch

Fetches the statements found using the `search` tool above using the ID provided by the `search` tool. Note, it doesn't extract the whole graph, but the statements that were found in the graph using the search `query`.

**Parameters (JSON)**

```json
{
	"id": "deemeetree:test_bible:serpent"
}
```

**Result**

```json
{
	"id": "deemeetree:test_bible:serpent",
	"title": "test_bible",
	"text": " God said, 'You shall not eat of the fruit of the tree which is in the midst of the garden, neither shall you touch it, lest you die.'\" But the serpent said to the woman, \"You will not die. For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil.\"",
	"url": "https://localhost:3000/deemeetree/test_bible/edit"
}
```

## Knowledge-Graph Based Memory

InfraNodus has a set of tools for generating "memories" in InfraNodus that have the structure of knowledge graphs.

In the default setting, entities identified in text are converted to [[wikilinks]] which are then represented as nodes. Relations between the entities are described by the statement where they appear.

Can be used for saving and retrieving structured memories from your LLM conversations or workflows.

### memory_add_relations

Add relations to a memory graph (the new graph is created in user's account if the graph with this name does not exist yet).

By default, entities will be detected as marked with [[wikilinks]], so the resulting graph is a high-level representation of the main concepts.

**Parameters (JSON):**

```json
{
	"graphName": "test_bible_entities",
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"modifyAnalyzedText": "extractEntitiesOnly"
}
```

**Result:**

```json
{
	"statistics": {
		"modularity": 0,
		"clusterCount": 1,
		"nodeCount": 5,
		"edgeCount": 8,
		"diversity_stats": {
			"diversity_score": "biased",
			"modularity_score": "low",
			"too_focused_on_top_nodes": true,
			"too_focused_on_top_clusters": true,
			"ratio_of_top_nodes_influence_by_betweenness": 1,
			"top_nodes_entropy": 0,
			"ratio_of_top_cluster_influence_by_betweenness": 1,
			"total_clusters": 1,
			"fair_influence_by_cluster": 1
		}
	},
	"contentGaps": [],
	"mainTopicalClusters": [
		"Divine Temptation: [[god]] [[fruit]] [[tree]] [[the_serpent]] [[good_and_evil]] (0 | 100% | 100%)"
	],
	"mainConcepts": [
		"[[god]]",
		"[[fruit]]",
		"[[tree]]",
		"[[the_serpent]]",
		"[[good_and_evil]]"
	],
	"conceptualGateways": [
		"[[god]]",
		"[[fruit]]",
		"[[tree]]",
		"[[the_serpent]]",
		"[[good_and_evil]]"
	],
	"topRelations": [
		"1) [[god]] <-> [[the_serpent]]",
		"2) [[god]] <-> [[tree]]",
		"3) [[god]] <-> [[good_and_evil]]",
		"4) [[god]] <-> [[fruit]]",
		"5) [[fruit]] <-> [[tree]]",
		"6) [[tree]] <-> [[the_serpent]]",
		"7) [[fruit]] <-> [[the_serpent]]",
		"8) [[the_serpent]] <-> [[good_and_evil]]"
	],
	"topBigrams": [
		"[[god]] [[the_serpent]]",
		"[[god]] [[tree]]",
		"[[god]] [[good_and_evil]]",
		"[[god]] [[fruit]]",
		"[[fruit]] [[tree]]",
		"[[tree]] [[the_serpent]]",
		"[[fruit]] [[the_serpent]]",
		"[[the_serpent]] [[good_and_evil]]"
	],
	"topInfluentialNodes": [
		{
			"node": "[[god]]",
			"bc": 0.6666666666666666,
			"degree": 4
		}
	],
	"knowledgeGraphByCluster": {
		"0": [
			"[[god]] <-> [[the_serpent]] [label=\"[[tree]], [[good_and_evil]], [[fruit]]\"]"
		],
		"top_nodes": [
			"[[god]] <-> [[the_serpent]] [label=\"[[tree]], [[good_and_evil]], [[fruit]]\"]"
		],
		"inter_cluster": []
	},
	"statements": [],
	"userName": "deemeetree",
	"graphName": "test_ bible_memory",
	"graphUrl": "https://localhost:3000/deemeetree/test_ bible_memory/edit"
}
```

### memory_get_relations

Retrieves memory from your InfraNodus account that contains the entity or, if the entity is empty, all the statements that exist in a certain graph.

```json
{
	"memoryContextName": "test_ bible_memory",
    "entity": "[[god]]
}
```

**Result:**

```json
{
	"statements": [
		" [[God]] said, 'You shall not eat of the [[fruit]] of the [[tree]] which is in the midst of the garden, neither shall you touch it, lest you die.'\" But [[the serpent]] said to the woman, \"You will not die. For [[God]] knows that when you eat of it your eyes will be opened, and you will be like [[God]], knowing [[good and evil]].\""
	],
	"userName": "deemeetree",
	"graphNames": ["test_ bible_memory"],
	"graphUrls": ["https://localhost:3000/deemeetree/test_ bible_memory/edit"]
}
```

## Text Comparison

This set of tools is useful for comparing multiple texts in order to find commonalities and differences between them.

For example, one can compare one's own website to the website of competitors to reveal what the competitors are writing about that you miss.

It is also possible to add several texts (e.g. a collection of landing pages from the top Google search results) to reveal what are the common topical clusters and gaps that emerge on all the pages combined.

### generate_difference_graph_from_text

This tool shows you what's _missing_ in the first text, url, or InfraNodus graph object you have that is _present_ in all the other objects you sent.

The result shows the topics and concepts that are missing and can be used to improve your content and add some more ideas that are present in the already existing discourse.

You can also optionally set `includeStatements` true to include the specific statements that are missing.

Note, that the result shows not the keywords, but the relations and clusters that are missing. Because most of the texts will use the same concepts, but it's the relations that will be different!

This is very useful for finding content gaps in your texts or websites in relation to the already existing discourse. For instance, you can add your article as a first text and then compare it with several URLs of other articles that exist on the internet.

Simple example:

**Request (JSON)**

```json
{
	"contexts": [
		{
			"graphName": "test_bible"
		},
		{
			"text": "Serpent is woman's friend"
		},
		{
			"url": "https://infranodus.com"
		}
	],
	"includeStatements": true
}
```

As a result, we will see only the content that's present in text 2 and text 3 but NOT in text 1:

**Response**

```json
{
	"statistics": {
		"modularity": 0,
		"diversity_stats": {},
		"clusterCount": 0
	},
	"contentGaps": [
		"Gap 1: 2. Cognitive Networks (meet cognitive science network) -> 3. Contemplative Solitude (solitude form contemplation)"
	],
	"mainTopicalClusters": [
		"1. Cosmic Variability: variability cosmic (1 | 22% | 35%)",
		"2. Cognitive Networks: meet cognitive science network (0 | 44% | 33%)",
		"3. Contemplative Solitude: solitude form contemplation (2 | 33% | 32%)"
	],
	"mainConcepts": [
		"solitude",
		"variability",
		"meet",
		"cognitive",
		"cosmic",
		"science",
		"network",
		"form",
		"contemplation"
	],
	"conceptualGateways": [
		"solitude",
		"variability",
		"meet",
		"cognitive",
		"cosmic",
		"science",
		"network",
		"form"
	],
	"topRelations": [
		"1) network <-> science",
		"2) science <-> meet",
		"3) meet <-> cognitive",
		"4) cognitive <-> variability",
		"5) variability <-> cosmic",
		"6) cosmic <-> solitude",
		"7) solitude <-> form",
		"8) form <-> contemplation",
		"9) network <-> meet",
		"10) science <-> cognitive",
		"11) meet <-> variability",
		"12) cognitive <-> cosmic"
	],
	"topBigrams": [
		"network science",
		"science meet",
		"meet cognitive",
		"cognitive variability",
		"variability cosmic",
		"cosmic solitude",
		"solitude form",
		"form contemplation",
		"network meet",
		"science cognitive",
		"meet variability",
		"cognitive cosmic"
	],
	"statements": [
		{
			"id": "401450_1",
			"content": "Network science meets cognitive variability and cosmic solitude",
			"topStatementCommunity": "0",
			"topStatementOfCommunity": "0"
		},
		{
			"id": "41332_1",
			"content": "Solitude is a form of contemplation",
			"topStatementCommunity": "2",
			"topStatementOfCommunity": "2"
		}
	]
}
```

In the second example, we want to see what is missing on the homepage of [https://infranodus.com](https://infranodus.com) that is present in the other text provided. Obviously, InfraNodus talks about "network science" and "cognitive variability" but there's no mention of "cosmic solitude" and the Genesis bible text and so that is exactly what this tool shows us:

**Request (JSON)**

```json
{
	"contexts": [
		{
			"url": "https://infranodus.com"
		},
		{
			"text": "Network science meets cognitive variability and cosmic solitude"
		},
		{
			"graphName": "test_bible"
		}
	]
}
```

**Result**

```json
{
	"statistics": {
		"modularity": 0,
		"diversity_stats": {},
		"clusterCount": 0
	},
	"contentGaps": [
		"Gap 1: 2. Serpent's Temptation (serpent tree fruit woman midst garden touch) -> 3. Cosmic Connectivity (meet variability cognitive cosmic network science solitude)",
		"Gap 2: 1. Divine Duality (god eat knowing good open eye evil) -> 3. Cosmic Connectivity (meet variability cognitive cosmic network science solitude)",
		"Gap 3: 1. Divine Duality (god eat knowing good open eye evil) -> 2. Serpent's Temptation (serpent tree fruit woman midst garden touch)"
	],
	"mainTopicalClusters": [
		"1. Divine Duality: god eat knowing good open eye evil (1 | 33% | 64%)",
		"2. Serpent's Temptation: serpent tree fruit woman midst garden touch (2 | 33% | 23%)",
		"3. Cosmic Connectivity: meet variability cognitive cosmic network science solitude (0 | 33% | 12%)"
	],
	"mainConcepts": [
		"god",
		"eat",
		"serpent",
		"meet",
		"knowing",
		"tree",
		"good",
		"variability",
		"fruit",
		"woman",
		"cognitive",
		"midst",
		"garden",
		"touch",
		"cosmic",
		"network"
	],
	"conceptualGateways": [
		"god",
		"eat",
		"serpent",
		"meet",
		"good",
		"knowing",
		"variability",
		"tree"
	],
	"topRelations": [
		"1) god <-> eat",
		"2) god <-> eye",
		"3) god <-> open",
		"4) eat <-> fruit",
		"5) fruit <-> tree",
		"6) tree <-> midst",
		"7) midst <-> garden",
		"8) garden <-> touch",
		"9) touch <-> serpent",
		"10) serpent <-> woman",
		"11) woman <-> god",
		"12) eat <-> eye"
	],
	"topBigrams": [
		"god eat",
		"god eye",
		"god open",
		"eat fruit",
		"fruit tree",
		"tree midst",
		"midst garden",
		"garden touch",
		"touch serpent",
		"serpent woman",
		"woman god",
		"eat eye"
	],
	"statements": []
}
```

### generate_overlap_from_texts

This tool helps you find which common topics and relations exist in all the texts, URLs (including YouTube videos), or existing InfraNodus graphs provided.

This is very useful for revealing the common themes in specific content and exposing the commonalities present within a discourse.

Note, that if it least one context provided does not have any intersections with the rest of the contexts, then no results will be shown.

Consider this simple example where there are no intersections between any texts:

**Request (JSON)**

```json
{
	"contexts": [
		{
			"text": "Apples and oranges are good"
		},
		{
			"text": "Network science meets cognitive variability and cosmic solitude"
		},
		{
			"text": "Solitude is a form of contemplation"
		}
	]
}
```

**Response**

```json
{
	"statistics": {
		"modularity": 0,
		"diversity_stats": {},
		"clusterCount": 0
	},
	"mainConcepts": [],
	"conceptualGateways": [],
	"topRelations": [],
	"topBigrams": [],
	"statements": []
}
```

Consider another example where we use our original demo text (retrieved as an InfraNodus graph), a URL with a longer version of that demo text, and plain text. We also ask MCP to include statements here so that we can see the exact statements where intersections have been found:

**Request**

```json
{
	"contexts": [
		{
			"graphName": "test_bible"
		},
		{
			"text": "Serpent is a woman's friend"
		},
		{
			"url": "https://www.biblegateway.com/passage/?search=Genesis%203&version=NIV"
		}
	],
	"includeStatements": true
}
```

**Result**

```json
{
	"statistics": {
		"modularity": 0,
		"diversity_stats": {},
		"clusterCount": 0
	},
	"contentGaps": [],
	"mainTopicalClusters": ["1. Serpent Bond: serpent woman (0 | 100% | 0%)"],
	"mainConcepts": ["serpent", "woman"],
	"conceptualGateways": ["serpent", "woman"],
	"topRelations": ["1) serpent <-> woman"],
	"topBigrams": ["serpent woman"],
	"statements": [
		{
			"id": "270623_1",
			"content": "God said, 'You shall not eat of the fruit of the tree which is in the midst of the garden, neither shall you touch it, lest you die.'\" But the serpent said to the woman, \"You will not die. For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil.\"",
			"topStatementCommunity": "0",
			"topStatementOfCommunity": "none"
		},
		{
			"id": "715965_1",
			"content": "Serpent is a woman's friend",
			"topStatementCommunity": "0",
			"topStatementOfCommunity": "0"
		},
		{
			"id": "199975_34",
			"content": "2 The woman said to the serpent, “We may eat fruit from the trees in the garden,(C) 3 but God did say, ‘You must not eat fruit from the tree that is in the middle of the garden, and you must not touch it, or you will die.’”(D)",
			"topStatementCommunity": "0",
			"topStatementOfCommunity": "none"
		},
		{
			"id": "199975_35",
			"content": "4 “You will not certainly die,” the serpent said to the woman.(E) 5 “For God knows that when you eat from it your eyes will be opened, and you will be like God,(F) knowing good and evil.”",
			"topStatementCommunity": "0",
			"topStatementOfCommunity": "none"
		},
		{
			"id": "199975_42",
			"content": "The woman said, “The serpent deceived me,(T) and I ate.”",
			"topStatementCommunity": "0",
			"topStatementOfCommunity": "none"
		}
	]
}
```

### merged_graph_from_texts

This tool generates a merged graph from several texts, URLs (including YouTube videos), and existing InfraNodus graphs. It provides information about the main topics and gaps in a collection of documents. Can be useful for getting an overview of a certain discourse from various sources and identifying potential topics that could be developed further.

**Request**

```json
{
	"contexts": [
		{
			"graphName": "test_bible"
		},
		{
			"text": "Serpent is a woman's friend"
		},
		{
			"url": "https://www.biblegateway.com/passage/?search=Genesis%203&version=NIV"
		}
	],
	"includeStatements": true
}
```

Note, to include `diversity_stats`, use the `"includeGraph": true` parameter in the Request above.

**Response**

```json
{
	"statistics": {
		"modularity": 0,
		"diversity_stats": {},
		"clusterCount": 0
	},
	"contentGaps": [
		"Gap 1: 2. Divine Garden (garden god eden man tree lord eat wife) -> 5. Bulgarian Editions (библия, berv bn книги издание превод bpb нов)",
		"Gap 2: 2. Divine Garden (garden god eden man tree lord eat wife) -> 3. Language Connections (— amu de cco ceb luth1545 apsd-ceb hoffnung)",
		"Gap 3: 3. Language Connections (— amu de cco ceb luth1545 apsd-ceb hoffnung) -> 5. Bulgarian Editions (библия, berv bn книги издание превод bpb нов)"
	],
	"mainTopicalClusters": [
		"1. Bible Versions: ar bible version bulgarian erv-ar easy-to-read gateway arabic (1 | 19% | 28%)",
		"2. Divine Garden: garden god eden man tree lord eat wife (0 | 20% | 24%)",
		"3. Language Connections: — amu de cco ceb luth1545 apsd-ceb hoffnung (2 | 13% | 16%)",
		"4. Testament Links: chr new testament ckb ꭶꮼꮒꭿꮝ kss sorani kurdi (3 | 7% | 10%)",
		"5. Bulgarian Editions: библия, berv bn книги издание превод bpb нов (4 | 13% | 7%)",
		"6. Publishing Networks: bwm cs snc ckw b21 cy 21 na (5 | 10% | 6%)",
		"7. Danish Bible: da på bibelen dette hverdagsdansk biblen bph er (6 | 6% | 3%)",
		"8. Scriptural References: genesis job co rev jn isa jer ki (8 | 6% | 2%)",
		"9. Copyright Issues: english greek your copyright hebrew (7 | 3% | 1%)",
		"10] harpercollins publishing christian: nelson (9 | 3% | 1%)"
	],
	"mainConcepts": [
		"ar",
		"garden",
		"bible",
		"—",
		"god",
		"version",
		"chr",
		"amu",
		"eden",
		"библия,",
		"bwm",
		"bulgarian",
		"man",
		"genesis",
		"tree",
		"da"
	],
	"conceptualGateways": [
		"eden",
		"ar",
		"garden",
		"chr",
		"amu",
		"da",
		"—",
		"bwm"
	],
	"topRelations": [
		"1) lord <-> god",
		"2) bible <-> gateway",
		"3) genesis <-> isa",
		"4) bulgarian <-> bible",
		"5) eat <-> tree",
		"6) fruit <-> tree",
		"7) easy-to-read <-> version",
		"8) god <-> eat",
		"9) genesis <-> job",
		"10) occidental <-> ckw",
		"11) serpent <-> woman",
		"12) woman <-> god"
	],
	"topBigrams": [
		"lord god",
		"bible gateway",
		"genesis isa",
		"bulgarian bible",
		"eat tree",
		"fruit tree",
		"easy-to-read version",
		"god eat",
		"genesis job",
		"occidental ckw",
		"serpent woman",
		"woman god"
	],
	"statements": []
}
```

## Google / SEO & GEO / LLMO tools

This set of tools help optimize content for seach engines and LLMs. They have access to real search results and search intent data and provide additional statistical information to your LLM text analysis workflows that can show which search terms are used more often than others or what topics top-ranking content pages contain.

### analyze_google_search_results

This tool generates a graph of the Google search results for a certain query.

It can be useful for getting an overview of the topics that should be covered to gain topical authority in a subject or to get a general overview of a discourse.

The response can optionally provide search results and URLs retrieved if the `"includeSearchResults": true` parameter is added to the request.

**Request**

```json
{
	"queries": ["bible", "forbidden fruit"],
	"showExtendedGraphInfo": true
}
```

**Response**

```json
{
	"statistics": {
		"modularity": 0.6111963690548499,
		"clusterCount": 8,
		"diversity_stats": {
			"diversity_score": "focused",
			"modularity_score": "high",
			"too_focused_on_top_nodes": false,
			"too_focused_on_top_clusters": true,
			"ratio_of_top_nodes_influence_by_betweenness": 0.7,
			"top_nodes_entropy": 1.9219280948873623,
			"ratio_of_top_cluster_influence_by_betweenness": 0.36,
			"total_clusters": 8,
			"fair_influence_by_cluster": 0.13
		}
	},
	"graphSummary": "<Main Concepts (concept_degree | concept_betweenness_centrality | concept_topic_id)>: \n bible (200 | 0.6749 | ), fruit (192 | 0.3853 | 3), forbidden (147 | 0.3507 | 3), @theabbybible (24 | 0.2741 | 6), create (23 | 0.1064 | 1), eve (15 | 0.0777 | 3), god (43 | 0.0598 | 1), light (16 | 0.0464 | 3), hand (13 | 0.0460 | ), study (32 | 0.0438 | ), free (41 | 0.0437 | 1), church (22 | 0.0406 | 4), people (22 | 0.0390 | 1), book (27 | 0.0342 | ), song (17 | 0.0284 | 4), red (12 | 0.0216 | 2) \n </MainConcepts> \n\n <MainTopics (topic_id | cluster_influence_by_degree_ratio | cluster_influence_by_betweenness_ratio)>: \n 1. Bible Insights: bible hand study book true written edition transform (0 | 31% | 36%)\n2. Forbidden Knowledge: fruit forbidden eve light adam idea wellness university (3 | 27% | 36%)\n3. Social Media: @theabbybible · abby • instagram photos videos k (6 | 15% | 11%)\n4. Divine Connection: create god free people magazine apr step word (1 | 12% | 11%)\n5. Musical Faith: church song aug month couple back write christian (4 | 7% | 4%)\n6. Flavor Versatility: red highlight versatile tone feature sauce pepper (2 | 5% | 1%)\n7. Spiritual Journey: faith spiritual american (5 | 2% | 1%)\n8. Label Impact: warning effect label (7 | 2% | 1%) \n </MainTopics> \n\n <TopicalGaps>: \n Gap 1: 2. Forbidden Knowledge (fruit forbidden eve light adam idea wellness university) -> 3. Social Media (@theabbybible · abby • instagram photos videos k)\nGap 2: 3. Social Media (@theabbybible · abby • instagram photos videos k) -> 4. Divine Connection (create god free people magazine apr step word)\nGap 3: 1. Bible Insights (bible hand study book true written edition transform) -> 3. Social Media (@theabbybible · abby • instagram photos videos k) \n </TopicalGaps> \n\n <ConceptualGateways> \n @theabbybible\neve\ncreate\nhand\nbible\nlight\nforbidden\nwellness \n </ConceptualGateways> \n\n <Relations>: \n 1) forbidden <-> fruit\n2) @theabbybible <-> ·\n3) read <-> bible\n4) book <-> bible\n5) bible <-> study\n6) half <-> bible\n7) warpaint <-> fanatic\n8) fanatic <-> forbidden\n9) bible <-> online\n10) god <-> create\n11) · <-> following\n12) · <-> pos \n </Relations> \n <DiversityStatistics>:\n        Modularity: 0.61 \n        Modularity Score: high \n        Top concept nodes diversified\n        Too focused on top topical clusters \n        Ratio of top nodes influence / betweenness: 0.7 \n        Ratio of top topical clusters influence / betweenness: 0.36 \n        Total clusters: 8\n        Fair betweenness / influence ratio per cluster: 0.13 \n        Entropy of top nodes distribution among clusters: 1.9219280948873623 \n</DiversityStatistics> \n",
	"contentGaps": [
		"Gap 1: 2. Forbidden Knowledge (fruit forbidden eve light adam idea wellness university) -> 3. Social Media (@theabbybible · abby • instagram photos videos k)",
		"Gap 2: 3. Social Media (@theabbybible · abby • instagram photos videos k) -> 4. Divine Connection (create god free people magazine apr step word)",
		"Gap 3: 1. Bible Insights (bible hand study book true written edition transform) -> 3. Social Media (@theabbybible · abby • instagram photos videos k)"
	],
	"mainTopicalClusters": [
		"1. Bible Insights: bible hand study book true written edition transform (0 | 31% | 36%)",
		"2. Forbidden Knowledge: fruit forbidden eve light adam idea wellness university (3 | 27% | 36%)",
		"3. Social Media: @theabbybible · abby • instagram photos videos k (6 | 15% | 11%)",
		"4. Divine Connection: create god free people magazine apr step word (1 | 12% | 11%)",
		"5. Musical Faith: church song aug month couple back write christian (4 | 7% | 4%)",
		"6. Flavor Versatility: red highlight versatile tone feature sauce pepper (2 | 5% | 1%)",
		"7. Spiritual Journey: faith spiritual american (5 | 2% | 1%)",
		"8. Label Impact: warning effect label (7 | 2% | 1%)"
	],
	"mainConcepts": [
		"bible",
		"fruit",
		"forbidden",
		"@theabbybible",
		"create",
		"eve",
		"god",
		"light",
		"hand",
		"study",
		"free",
		"church",
		"people",
		"book",
		"song",
		"red"
	],
	"conceptualGateways": [
		"@theabbybible",
		"eve",
		"create",
		"hand",
		"bible",
		"light",
		"forbidden",
		"wellness"
	],
	"topRelations": [
		"1) forbidden <-> fruit",
		"2) @theabbybible <-> ·",
		"3) read <-> bible",
		"4) book <-> bible",
		"5) bible <-> study",
		"6) half <-> bible",
		"7) warpaint <-> fanatic",
		"8) fanatic <-> forbidden",
		"9) bible <-> online",
		"10) god <-> create",
		"11) · <-> following",
		"12) · <-> pos"
	],
	"topBigrams": [
		"forbidden fruit",
		"@theabbybible ·",
		"read bible",
		"book bible",
		"bible study",
		"half bible",
		"warpaint fanatic",
		"fanatic forbidden",
		"bible online",
		"god create",
		"· following",
		"· pos"
	],
	"topInfluentialNodes": [
		{
			"node": "bible",
			"bc": 0.6748896547554266,
			"degree": 200
		},
		{
			"node": "fruit",
			"bc": 0.3852560614305581,
			"degree": 192
		},
		{
			"node": "forbidden",
			"bc": 0.3506711409395973,
			"degree": 147
		},
		{
			"node": "@theabbybible",
			"bc": 0.27407944857609284,
			"degree": 24
		},
		{
			"node": "create",
			"bc": 0.10638490839833122,
			"degree": 23
		}
	],
	"userName": "deemeetree"
}
```

generate_google_search_queries_graph`, `generate_google_results_vs_queries_graph`, and `generate_seo_report`, use search queries or a URL derived from this passage.

```

```
