import { ReportFormData, TrelloCardPayload } from '../types/report';

const TRELLO_API_BASE = 'https://api.trello.com/1';

function buildCardDescription(data: ReportFormData): string {
    return `**Type:** ${data.type}\n\n**Description:**\n${data.description}`.trim();
}

function buildCardPayload(data: ReportFormData): TrelloCardPayload {
    return {
        name: `[${data.type.toUpperCase()}] ${data.title}`,
        desc: buildCardDescription(data),
        idList: process.env.TRELLO_LIST_ID!,
        ...(data.screenshot && { urlSource: data.screenshot }),
    };
} 

export async function createTrelloCard(data: ReportFormData): Promise<void> {
    const payload: TrelloCardPayload = buildCardPayload(data);

    const url = new URL(`${TRELLO_API_BASE}/cards`);
    url.searchParams.set("key", process.env.TRELLO_API_KEY!);
    url.searchParams.set("token", process.env.TRELLO_TOKEN!);

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create Trello card: ${response.status} ${response.statusText} - ${error}`);
    }





}