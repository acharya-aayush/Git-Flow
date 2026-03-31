import { PrismaClient } from '@gitflow/db';
import crypto from 'crypto';

const db = new PrismaClient();

export async function checkIdempotency(key: string): Promise<boolean> {
  const existingEvent = await db.event.findUnique({
    where: { idempotency_key: key },
  });

  return !!existingEvent;
}

export async function markProcessed(key: string, eventType: string, payload: unknown): Promise<void> {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  
  await db.event.create({
    data: {
      idempotency_key: key,
      event_type: eventType,
      payload_hash: hash,
    },
  });
}
