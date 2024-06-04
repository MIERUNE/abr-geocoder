import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { Readable } from 'stream';

import { StreamGeocoder } from '@controller/geocode/stream-geocoder';
import { setupContainer } from '@interface-adapter/setup-container';
import { DI_TOKEN } from '@interface-adapter/tokens';
import { Database } from 'better-sqlite3';
import { GeocodeResult } from '@domain/geocode-result';

const app = new Hono();

app.get('/health', async c => {
  return c.text('ok');
});

const getGeocoder = async () => {
  const container = await setupContainer({
    dataDir: process.env.ABGR_DATADIR!,
    ckanId: 'ba000001',
  });
  const db: Database = await container.resolve(DI_TOKEN.DATABASE);
  const geocoder = StreamGeocoder.create(db, '');
  return geocoder;
};

app.get('/geocode', async c => {
  const q = c.req.query('q');

  const readable = new Readable({
    read() {
      this.push(q);
      this.push(null);
    },
  });

  const geocoder = await getGeocoder(); // TransformStream

  let result: GeocodeResult | null = null;
  for await (const res of readable.pipe(geocoder)) {
    result = res;
  }

  return c.json({ result });
});

serve({
  fetch: app.fetch,
  port: 8787,
});
