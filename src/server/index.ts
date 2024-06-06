import { Readable } from 'stream';
import path from 'path';
import os from 'os';

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { Database } from 'better-sqlite3';

import { StreamGeocoder } from '@controller/geocode/stream-geocoder';
import { setupContainer } from '@interface-adapter/setup-container';
import { DI_TOKEN } from '@interface-adapter/tokens';
import { GeocodeResult } from '@domain/geocode-result';

const app = new Hono();

app.get('/health', async c => {
  return c.text('ok');
});

type GeocoderOptions = {
  fuzzy: string;
};

let db: Database;

function datadir() {
  // fallback to default
  return process.env.ABRG_DATADIR ?? path.join(os.homedir(), '.abr-geocoder');
}

const getGeocoder = async ({ fuzzy }: GeocoderOptions) => {
  const container = await setupContainer({
    dataDir: datadir(),
    ckanId: 'ba000001', // https://catalog.registries.digital.go.jp/rc/dataset/ba000001
  });

  if (!db) db = await container.resolve(DI_TOKEN.DATABASE);

  const geocoder = await StreamGeocoder.create(db, fuzzy);
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

  const geocoder = await getGeocoder({ fuzzy: '?' }); // TransformStream

  let result: GeocodeResult | null = null;
  for await (const res of readable.pipe(geocoder)) {
    result = res;
  }

  // close streams
  readable.destroy();
  geocoder.destroy();

  return c.json({ result });
});

serve({
  fetch: app.fetch,
  port: 8787,
});
