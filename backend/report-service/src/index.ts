import { ReportWorker } from './jobs/report.worker';
import { ReportRenderer } from './render/engine';
import http from 'http';
import Redis from 'ioredis';
import { config } from './config';

let worker: ReportWorker;
let renderer: ReportRenderer;
let redisConnected = false;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/render/class-list') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!renderer) renderer = new ReportRenderer();
        const pdf = await renderer.renderClassList(data);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="class-list-${data.className?.replace(/\s+/g, '_') || 'report'}.pdf"`,
          'Content-Length': pdf.length,
        });
        res.end(pdf);
      } catch (err: any) {
        console.error('❌ Render error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/render/attendance-register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!renderer) renderer = new ReportRenderer();
        const pdf = await renderer.renderAttendanceRegister(data);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="attendance-register-${data.className?.replace(/\s+/g, '_') || 'report'}.pdf"`,
          'Content-Length': pdf.length,
        });
        res.end(pdf);
      } catch (err: any) {
        console.error('❌ Render error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/render/student-attendance') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!renderer) renderer = new ReportRenderer();
        const pdf = await renderer.renderStudentAttendance(data);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="student-attendance-${data.student?.firstName || 'report'}.pdf"`,
          'Content-Length': pdf.length,
        });
        res.end(pdf);
      } catch (err: any) {
        console.error('❌ Render error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: redisConnected ? 'running' : 'degraded',
    service: 'smart-tech-report-service',
    redis: redisConnected ? 'connected' : 'disconnected',
  }));
});

async function checkRedis(): Promise<boolean> {
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    retryStrategy: () => null,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    redisConnected = pong === 'PONG';
    await redis.quit();
    return redisConnected;
  } catch (err: any) {
    redisConnected = false;
    return false;
  }
}

async function main() {
  console.log('🚀 Starting SmartTech Report Service...');
  console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`   Queue: ${config.queue.name}`);

  const redisOk = await checkRedis();

  if (!redisOk) {
    console.error('');
    console.error('❌ Cannot connect to Redis. The report service requires Redis to process jobs.');
    console.error('   Start Redis and restart the service.');
    console.error('');
    console.error('   Install Redis: https://redis.io/docs/install/');
    console.error('   Or using Docker: docker run -d -p 6379:6379 redis:7');
    console.error('');
    console.error('⚠️  Starting in degraded mode — health check available, but no worker processing.');
  } else {
    console.log('✅ Redis connection established');
    worker = new ReportWorker();
  }

  server.listen(config.server.port, () => {
    console.log(`📡 Health check server listening on port ${config.server.port}`);
    if (!redisOk) {
      console.log('   (Worker not started — Redis unavailable)');
    }
  });

  const shutdown = async () => {
    console.log('\n👋 Shutting down...');
    server.close();
    if (worker) await worker.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
  });
  process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled rejection:', err);
  });
}

main();
