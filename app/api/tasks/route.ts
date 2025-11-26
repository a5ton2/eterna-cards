import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get tasks error:', error);
      return NextResponse.json(
        { error: 'Failed to load tasks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: tasks || [] });
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
    const body = await request.json();
    const title = (body?.title as string | undefined)?.trim();

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title,
        completed: false,
        created_at: now,
        completed_at: null,
      })
      .select()
      .single();

    if (error || !task) {
      console.error('Create task error:', error);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
