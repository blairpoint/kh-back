import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export async function GET() {
  try {
    const p = getPool();
    // Fetch active events directly from PostgreSQL event table
    const res = await p.query(`
      SELECT id, venue_name as title, starts_at, ends_at 
      FROM event 
      WHERE ends_at IS NULL
    `);
    
    return NextResponse.json(res.rows.map(row => ({
      id: row.id,
      title: row.title || 'Main Stage',
      status: 'published'
    })));
  } catch (error) {
    console.error('Fetch active events error:', error);
    return NextResponse.json({ error: 'Failed to fetch active events.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const p = getPool();
    const { title } = await request.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Event title is required.' }, { status: 400 });
    }

    const eventTitle = title.trim();

    // Insert new event directly into PostgreSQL
    await p.query(`
      INSERT INTO event (venue_name, starts_at, latitude, longitude)
      VALUES ($1, NOW(), 0.0, 0.0)
      ON CONFLICT DO NOTHING
    `, [eventTitle]);

    return NextResponse.json({ success: true, title: eventTitle });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Failed to create new event.' }, { status: 500 });
  }
}
