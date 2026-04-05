import {NextRequest, NextResponse} from 'next/server';
import {createTrelloCard} from "@/services/trelloService";
import {ReportFormData} from "@/types/report";

export async function POST(request: NextRequest) {
    try {
        const body: ReportFormData = await request.json();

        if (!body.title || !body.description || !body.type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await createTrelloCard(body);
        return NextResponse.json({ message: 'Card created successfully' }, { status: 201 });
    } catch (error) {
        console.error('Error creating Trello card:', error);
        return NextResponse.json({ error: 'Failed to create Trello card' }, { status: 500 });
    }
}