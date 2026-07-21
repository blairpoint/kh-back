import { NextResponse } from 'next/server';
import { connectGlobalDB, GlobalEvent, SpotlightEventModel, Gold4GoldEventModel } from '@blairpoint/shared-core';

export async function GET() {
  try {
    // Ensure connected to the global db if not already
    await connectGlobalDB(process.env.MONGODB_URI);

    // Fetch global events from spotlight database as primary directory
    const events = await SpotlightEventModel.find({}).select('title status');
    return NextResponse.json(events);
  } catch (error) {
    console.error('Fetch global events error:', error);
    return NextResponse.json({ error: 'Failed to fetch global events directory.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectGlobalDB(process.env.MONGODB_URI);
    const { title } = await request.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Event title is required.' }, { status: 400 });
    }

    const eventTitle = title.trim();

    // 1. Save locally to Kohartist (GlobalEvent model)
    try {
      await GlobalEvent.findOneAndUpdate(
        { title: eventTitle },
        { title: eventTitle, status: 'published', sourceApp: 'kohartist' },
        { upsert: true }
      );
    } catch (err) {
      console.error('Error saving local global event:', err);
    }

    // 2. Sync to Spotlight database (SpotlightEventModel)
    try {
      await SpotlightEventModel.findOneAndUpdate(
        { title: eventTitle },
        { title: eventTitle, status: 'published', sourceApp: 'kohartist' },
        { upsert: true }
      );
    } catch (err) {
      console.error('Error syncing to Spotlight:', err);
    }

    // 3. Sync to Gold4Gold database (Gold4GoldEventModel)
    try {
      await Gold4GoldEventModel.findOneAndUpdate(
        { title: eventTitle },
        { title: eventTitle, status: 'published', sourceApp: 'kohartist' },
        { upsert: true }
      );
    } catch (err) {
      console.error('Error syncing to Gold4Gold:', err);
    }

    return NextResponse.json({ success: true, title: eventTitle });
  } catch (error) {
    console.error('Create global event error:', error);
    return NextResponse.json({ error: 'Failed to create new event.' }, { status: 500 });
  }
}
