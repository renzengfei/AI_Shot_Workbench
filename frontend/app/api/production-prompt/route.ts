import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'data', 'productionStoryboardPrompt.ts');
        const content = await fs.readFile(filePath, 'utf-8');
        return new NextResponse(content, {
            status: 200,
            headers: {
                'content-type': 'text/plain; charset=utf-8',
            },
        });
    } catch (err) {
        console.error('读取 productionStoryboardPrompt.ts 失败', err);
        return NextResponse.json({ error: '读取 productionStoryboardPrompt.ts 失败' }, { status: 500 });
    }
}
