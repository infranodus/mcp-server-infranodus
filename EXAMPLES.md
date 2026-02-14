# InfraNodus MCP Tools — Examples

This file demonstrates how each tool is used for a particular purpose. The same **example text** is used throughout so you can compare how different tools analyze it.

---

## Example text: Genesis 3 — The Fall (excerpt)

```
 God said, 'You shall not eat of the fruit of the tree which is in the midst of the garden, neither shall you touch it, lest you die.'" But the serpent said to the woman, "You will not die. For God knows that when you eat of it your eyes will be opened, and you will be like God, knowing good and evil."
```

---

## Analysis examples (per tool)

_Add below the example output or usage for each tool when you run it on the text above._

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

````json
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

**Parameters (JSON):**

```json
{
	"text": "<Genesis 3: The Fall — full text from the Example text section above>",
	"requestMode": "transcend"
}
````

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

Similar to the `develop_latent_topics` tool, however, in this case, it focuses on the nodes (concepts in text) that

### develop_text_tool

_(Example to be added.)_

### create_knowledge_graph

_(Example to be added.)_

### add_memory (memory_add_relations)

_(Example to be added.)_

### Overlap / difference (multiple texts)

For `generate_overlap_graph_from_texts` and `generate_difference_graph_from_texts`, use this text as one input and add a second text for comparison.

_(Example to be added.)_

### Google / SEO tools

For `generate_google_search_results_graph`, `generate_google_search_queries_graph`, `generate_google_results_vs_queries_graph`, and `generate_seo_report`, use search queries or a URL derived from this passage.

_(Example to be added.)_
