/** Split on line boundaries so no statement is cut in half. */
export function chunkByLines(text: string, chunkSize: number): string[] {
	const chunks: string[] = [];
	let current: string[] = [];
	let size = 0;
	for (const line of text.split("\n")) {
		if (size + line.length + 1 > chunkSize && current.length > 0) {
			chunks.push(current.join("\n"));
			current = [];
			size = 0;
		}
		current.push(line);
		size += line.length + 1;
	}
	if (current.length > 0) chunks.push(current.join("\n"));
	return chunks.filter((chunk) => chunk.trim().length > 0);
}
