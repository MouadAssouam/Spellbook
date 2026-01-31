/**
 * Spellbook Runtime: OpenTelemetry Tracing
 * 
 * Distributed tracing for production observability.
 * Wraps tool invocations in spans with context propagation.
 */

// ============================================================================
// Types
// ============================================================================

export interface SpanContext {
    traceId: string;
    spanId: string;
    traceFlags: number;
}

export interface Span {
    name: string;
    context: SpanContext;
    startTime: number;
    endTime?: number;
    status: 'ok' | 'error' | 'unset';
    attributes: Record<string, unknown>;
    events: SpanEvent[];
    end(): void;
    setStatus(status: 'ok' | 'error', message?: string): void;
    setAttribute(key: string, value: unknown): void;
    addEvent(name: string, attributes?: Record<string, unknown>): void;
    recordException(error: Error): void;
}

export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
}

export interface TracerOptions {
    serviceName: string;
    serviceVersion?: string;
    exporter?: 'console' | 'otlp' | 'none';
    otlpEndpoint?: string;
    sampleRate?: number;
}

// ============================================================================
// Tracer Implementation
// ============================================================================

export class Tracer {
    private serviceName: string;
    private serviceVersion: string;
    private exporter: 'console' | 'otlp' | 'none';
    private otlpEndpoint?: string;
    private sampleRate: number;
    private spans: Map<string, Span> = new Map();

    constructor(options: TracerOptions) {
        this.serviceName = options.serviceName;
        this.serviceVersion = options.serviceVersion ?? '1.0.0';
        this.exporter = options.exporter ?? 'console';
        this.otlpEndpoint = options.otlpEndpoint;
        this.sampleRate = options.sampleRate ?? 1;
    }

    /**
     * Start a new span.
     */
    startSpan(name: string, parentContext?: SpanContext): Span {
        const shouldSample = Math.random() < this.sampleRate;

        const context: SpanContext = {
            traceId: parentContext?.traceId ?? this.generateId(32),
            spanId: this.generateId(16),
            traceFlags: shouldSample ? 1 : 0,
        };

        const span: Span = {
            name,
            context,
            startTime: Date.now(),
            status: 'unset',
            attributes: {
                'service.name': this.serviceName,
                'service.version': this.serviceVersion,
            },
            events: [],

            end: () => {
                span.endTime = Date.now();
                this.exportSpan(span);
                this.spans.delete(context.spanId);
            },

            setStatus: (status, message) => {
                span.status = status;
                if (message) span.attributes['status.message'] = message;
            },

            setAttribute: (key, value) => {
                span.attributes[key] = value;
            },

            addEvent: (eventName, attributes) => {
                span.events.push({
                    name: eventName,
                    timestamp: Date.now(),
                    attributes,
                });
            },

            recordException: (error) => {
                span.status = 'error';
                span.addEvent('exception', {
                    'exception.type': error.constructor.name,
                    'exception.message': error.message,
                    'exception.stacktrace': error.stack,
                });
            },
        };

        this.spans.set(context.spanId, span);
        return span;
    }

    /**
     * Run a function within a span.
     */
    async trace<T>(
        name: string,
        fn: (span: Span) => Promise<T>,
        parentContext?: SpanContext
    ): Promise<T> {
        const span = this.startSpan(name, parentContext);

        try {
            const result = await fn(span);
            span.setStatus('ok');
            return result;
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    private exportSpan(span: Span): void {
        if (span.context.traceFlags === 0) return; // Not sampled

        const spanData = {
            traceId: span.context.traceId,
            spanId: span.context.spanId,
            name: span.name,
            startTime: span.startTime,
            endTime: span.endTime,
            duration_ms: span.endTime ? span.endTime - span.startTime : 0,
            status: span.status,
            attributes: span.attributes,
            events: span.events,
        };

        switch (this.exporter) {
            case 'console':
                console.log(JSON.stringify({ type: 'span', ...spanData }));
                break;

            case 'otlp':
                this.exportToOTLP(spanData);
                break;
        }
    }

    private async exportToOTLP(spanData: Record<string, unknown>): Promise<void> {
        if (!this.otlpEndpoint) return;

        try {
            await fetch(this.otlpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resourceSpans: [{
                        resource: {
                            attributes: [
                                { key: 'service.name', value: { stringValue: this.serviceName } },
                            ],
                        },
                        scopeSpans: [{
                            spans: [this.toOTLPSpan(spanData)],
                        }],
                    }],
                }),
            });
        } catch (error) {
            console.error('Failed to export span to OTLP:', error);
        }
    }

    private toOTLPSpan(spanData: Record<string, unknown>): Record<string, unknown> {
        return {
            traceId: spanData.traceId,
            spanId: spanData.spanId,
            name: spanData.name,
            startTimeUnixNano: (spanData.startTime as number) * 1_000_000,
            endTimeUnixNano: (spanData.endTime as number) * 1_000_000,
            status: { code: spanData.status === 'ok' ? 1 : spanData.status === 'error' ? 2 : 0 },
            attributes: Object.entries(spanData.attributes as Record<string, unknown>).map(([k, v]) => ({
                key: k,
                value: { stringValue: String(v) },
            })),
        };
    }

    private generateId(length: number): string {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }
}

// ============================================================================
// Global Tracer
// ============================================================================

let globalTracer: Tracer | null = null;

export function initTracer(options: TracerOptions): Tracer {
    globalTracer = new Tracer(options);
    return globalTracer;
}

export function getTracer(): Tracer | null {
    return globalTracer;
}

// ============================================================================
// Tool Wrapper
// ============================================================================

/**
 * Wrap a tool handler with tracing.
 */
export function withTracing<T extends (...args: any[]) => Promise<any>>(
    toolName: string,
    fn: T
): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        const tracer = getTracer();
        if (!tracer) return fn(...args);

        return tracer.trace(`tool.${toolName}`, async (span) => {
            span.setAttribute('tool.name', toolName);
            span.setAttribute('tool.input_size', JSON.stringify(args[0] ?? {}).length);

            const result = await fn(...args);

            span.setAttribute('tool.output_size', JSON.stringify(result ?? {}).length);
            return result;
        });
    }) as T;
}
