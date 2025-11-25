import { NextRequest, NextResponse } from 'next/server';
import { getDb, Task } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDb();
    await db.read();

    const tasks = Array.isArray(db.data.tasks) ? db.data.tasks : [];

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to load tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    await db.read();

    const body = await request.json();
    const title = (body?.title as string | undefined)?.trim();

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(db.data.tasks)) {
      db.data.tasks = [];
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: now,
      completedAt: null,
    };

    db.data.tasks.push(task);
    await db.write();

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
