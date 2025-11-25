import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    await db.read();

    const body = await request.json();
    const id = body?.id as string | undefined;
    const explicitCompleted = body?.completed as boolean | undefined;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(db.data.tasks)) {
      db.data.tasks = [];
    }

    const taskIndex = db.data.tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = db.data.tasks[taskIndex];
    const now = new Date().toISOString();

    const newCompleted =
      typeof explicitCompleted === 'boolean' ? explicitCompleted : !task.completed;

    task.completed = newCompleted;
    task.completedAt = newCompleted ? now : null;

    db.data.tasks[taskIndex] = task;
    await db.write();

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Toggle task error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
