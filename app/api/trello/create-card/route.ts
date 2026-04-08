import { NextRequest, NextResponse } from 'next/server';
import { createTrelloCard } from "@/services/trelloService";
import { ReportType } from "@/types/report";

const VALID_TYPES: ReportType[] = ['bug', 'feature', 'feedback'];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        const type = body.type;

        if (!title || !description) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!VALID_TYPES.includes(type)) {
            return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
        }

        await createTrelloCard({
            title,
            description,
            type,
            errorStack: typeof body.errorStack === 'string' ? body.errorStack : undefined,
            pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : undefined,
            userAgent: typeof body.userAgent === 'string' ? body.userAgent : undefined,
            screenshot: typeof body.screenshot === 'string' ? body.screenshot : undefined,
        });

        return NextResponse.json({ message: 'Card created successfully' }, { status: 201 });
    } catch (error) {
        console.error('Error creating Trello card:', error);
        return NextResponse.json({ error: 'Failed to create Trello card' }, { status: 500 });
    }
}
