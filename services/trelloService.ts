import { ReportFormData, TrelloCardPayload } from '../types/report';

const TRELLO_API_BASE = 'https://api.trello.com/1';
const TRELLO_TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function buildCardDescription(data: ReportFormData): string {
    let desc = `**Type:** ${data.type}\n\n**Reported by:** ${data.reporter ?? 'anonymous'}\n\n**Description:**\n${data.description}`;

    if (data.pageUrl) {
        desc += `\n\n**Page:** ${data.pageUrl}`;
    }
    if (data.userAgent) {
        desc += `\n\n**User Agent:** ${data.userAgent}`;
    }
    if (data.errorStack) {
        desc += `\n\n**Stack Trace:**\n\`\`\`\n${data.errorStack}\n\`\`\``;
    }

    return desc.trim();
}

function getListId(type: ReportFormData['type']): string {
    if (type === 'feature') return requireEnv('TRELLO_LIST_ID_FEATURE');
    if (type === 'feedback') return requireEnv('TRELLO_LIST_ID_FEEDBACK');
    return requireEnv('TRELLO_LIST_ID');
}

function buildCardPayload(data: ReportFormData): TrelloCardPayload {
    return {
        name: `[${data.type.toUpperCase()}] ${data.title}`,
        desc: buildCardDescription(data),
        idList: getListId(data.type),
    };
}

export async function createTrelloCard(data: ReportFormData): Promise<void> {
    const payload: TrelloCardPayload = buildCardPayload(data);

    const url = new URL(`${TRELLO_API_BASE}/cards`);
    url.searchParams.set("key", requireEnv('TRELLO_API_KEY'));
    url.searchParams.set("token", requireEnv('TRELLO_TOKEN'));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRELLO_TIMEOUT_MS);

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create Trello card: ${response.status} ${response.statusText} - ${error}`);
        }

        if (data.screenshot) {
            const card = await response.json() as { id: string };
            await attachScreenshotToCard(card.id, data.screenshot).catch((err) => {
                console.error('Screenshot attachment failed (non-fatal):', err);
            });
        }
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Trello API request timed out after 10 seconds');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function attachScreenshotToCard(cardId: string, base64DataUrl: string): Promise<void> {
    const commaIndex = base64DataUrl.indexOf(',');
    if (commaIndex === -1) throw new Error('Invalid base64 data URL format');

    const meta = base64DataUrl.slice(0, commaIndex);
    const data = base64DataUrl.slice(commaIndex + 1);
    const mimeType = meta.match(/:(.*?);/)?.[1] ?? 'image/png';
    const buffer = Buffer.from(data, 'base64');
    const blob = new Blob([buffer], { type: mimeType });

    const formData = new FormData();
    formData.append('file', blob, 'screenshot.png');
    formData.append('name', 'screenshot');
    formData.append('mimeType', mimeType);

    const url = new URL(`${TRELLO_API_BASE}/cards/${cardId}/attachments`);
    url.searchParams.set("key", requireEnv('TRELLO_API_KEY'));
    url.searchParams.set("token", requireEnv('TRELLO_TOKEN'));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRELLO_TIMEOUT_MS);

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Failed to attach screenshot: ${response.status}`);
        }
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Screenshot attachment timed out');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}
