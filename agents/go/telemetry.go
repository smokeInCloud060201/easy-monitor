package telemetry

import (
	"context"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	otellog "go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"

	"encoding/json"
	"log/slog"
	"net"
	"net/http"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

type GelfPayload struct {
	Version      string  `json:"version"`
	Host         string  `json:"host"`
	ShortMessage string  `json:"short_message"`
	Timestamp    float64 `json:"timestamp"`
	Level        int     `json:"level"`
	Service      string  `json:"_service"`
	TraceID      string  `json:"_trace_id"`
	SpanID       string  `json:"_span_id"`
}

type GelfLogExporter struct {
	conn *net.UDPConn
}

func NewGelfLogExporter(addr string) (*GelfLogExporter, error) {
	udpAddr, err := net.ResolveUDPAddr("udp", addr)
	if err != nil {
		return nil, err
	}
	conn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		return nil, err
	}
	return &GelfLogExporter{conn: conn}, nil
}

func (e *GelfLogExporter) Export(ctx context.Context, records []sdklog.Record) error {
	for _, rec := range records {
		levelNum := int(rec.Severity())
		gelfLevel := 6
		if levelNum >= 21 {
			gelfLevel = 2
		} else if levelNum >= 17 {
			gelfLevel = 3
		} else if levelNum >= 13 {
			gelfLevel = 4
		} else if levelNum <= 8 {
			gelfLevel = 7
		}

		serviceName := "unknown"
		for _, kv := range rec.Resource().Attributes() {
			if kv.Key == "service.name" {
				serviceName = kv.Value.AsString()
				break
			}
		}

		msg := rec.Body().AsString()

		traceID := ""
		spanID := ""
		if rec.TraceID().IsValid() {
			traceID = rec.TraceID().String()
		}
		if rec.SpanID().IsValid() {
			spanID = rec.SpanID().String()
		}

		payload := GelfPayload{
			Version:      "1.1",
			Host:         "local",
			ShortMessage: msg,
			Timestamp:    float64(rec.Timestamp().UnixNano()) / 1e9,
			Level:        gelfLevel,
			Service:      serviceName,
			TraceID:      traceID,
			SpanID:       spanID,
		}

		b, _ := json.Marshal(payload)
		e.conn.Write(b)
	}
	return nil
}

func (e *GelfLogExporter) Shutdown(ctx context.Context) error {
	return e.conn.Close()
}

func (e *GelfLogExporter) ForceFlush(ctx context.Context) error {
	return nil
}

// Init sets up the global easy-monitor OpenTelemetry trace and log providers.
func Init(serviceName string) (func(context.Context) error, func(context.Context) error, error) {
	ctx := context.Background()

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		log.Fatalf("failed to create resource: %v", err)
	}

	// Trace Exporter
	traceExporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint("127.0.0.1:4317"),
	)
	if err != nil {
		return nil, nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Log Exporter (Native GELF UDP)
	logExporter, err := NewGelfLogExporter("127.0.0.1:12201")
	if err != nil {
		return nil, nil, err
	}
	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
		sdklog.WithResource(res),
	)
	otellog.SetLoggerProvider(lp)

	// Set global slog provider gracefully bypassing app
	slogger := otelslog.NewLogger(serviceName)
	slog.SetDefault(slogger)

	log.Printf("  [EasyMonitor] Go Agent successfully attached to %s!\n", serviceName)

	return tp.Shutdown, lp.Shutdown, nil
}

// WrapHTTPHandler encapsulates the OpenTelemetry native span tracing HTTP middleware natively.
func WrapHTTPHandler(handler http.Handler, serviceName string) http.Handler {
	return otelhttp.NewHandler(handler, serviceName)
}
