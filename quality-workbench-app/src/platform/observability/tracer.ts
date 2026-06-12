// platform/observability/tracer.ts — traceId 生成与传递 (F6.S3)
import { randomUUID } from 'node:crypto';

class Tracer {
  currentTraceId: string | null = null;
  currentSpanId: string | null = null;
  parentSpanId: string | null = null;

  start(traceId?: string) {
    this.currentTraceId = traceId ?? randomUUID();
    this.parentSpanId = this.currentSpanId;
    this.currentSpanId = randomUUID();
    return this.currentTraceId;
  }

  reset() { this.currentTraceId = null; this.currentSpanId = null; this.parentSpanId = null; }
}

const tracer = new Tracer();

export function getTracer() {
  return tracer;
}
