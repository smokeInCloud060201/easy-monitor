package telemetry

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	mathrand "math/rand"
	"net"
	"net/http"
	"os"
	"regexp"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/vmihailenco/msgpack/v5"
)

var defaultMeta = make(map[string]string)

var urlScrubber = regexp.MustCompile(`(?i)/([a-zA-Z0-9]+_[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(/|$|\?)`)

func scrubURL(u string) string {
	return urlScrubber.ReplaceAllString(u, "/?$2")
}

func init() {
	if otelAttrs := os.Getenv("OTEL_RESOURCE_ATTRIBUTES"); otelAttrs != "" {
		pairs := strings.Split(otelAttrs, ",")
		for _, pair := range pairs {
			kv := strings.SplitN(pair, "=", 2)
			if len(kv) == 2 {
				if kv[0] == "deployment.environment" {
					defaultMeta["env"] = kv[1]
				} else if kv[0] == "service.version" {
					defaultMeta["version"] = kv[1]
				}
			}
		}
	}
}

type Span struct {
	TraceID    uint64
	SpanID     uint64
	ParentID   uint64
	Name       string
	Resource   string
	Service    string
	Type       string
	Start      time.Time
	Duration   time.Duration
	Error      int32
	Meta       map[string]string
	Metrics    map[string]float64
	StartAlloc uint64
}

func (s *Span) Finish() {
	s.Duration = time.Since(s.Start)
	if s.Error == 0 && mathrand.Float64() > sampleRate {
		return // drop
	}
	SendSpan(s)
}

func (s *Span) SetTag(key, value string) {
	if s.Meta == nil {
		s.Meta = make(map[string]string)
	}
	s.Meta[key] = value
}

// DatadogSpan maps directly to Datadog's MessagePack format
type DatadogSpan struct {
	TraceID  uint64             `msgpack:"trace_id"`
	SpanID   uint64             `msgpack:"span_id"`
	ParentID uint64             `msgpack:"parent_id"`
	Name     string             `msgpack:"name"`
	Resource string             `msgpack:"resource"`
	Service  string             `msgpack:"service"`
	Type     string             `msgpack:"type"`
	Start    int64              `msgpack:"start"`
	Duration int64              `msgpack:"duration"`
	Error    int32              `msgpack:"error"`
	Meta     map[string]string  `msgpack:"meta"`
	Metrics  map[string]float64 `msgpack:"metrics"`
}

var (
	serviceName string
	exporterURL string = "http://127.0.0.1:8126/v0.4/traces" // Datadog Agent default
	client      *http.Client
	spanQueue   chan *Span
	sampleRate  float64 = 1.0
)

func Init(service string) {
	serviceName = service
	client = &http.Client{Timeout: 5 * time.Second}
	spanQueue = make(chan *Span, 1000)

	if addr, err := net.ResolveUDPAddr("udp", "127.0.0.1:12201"); err == nil {
		gelfConn, _ = net.DialUDP("udp", nil, addr)
	}

	go startBackgroundFlusher()
	log.Printf("  [EasyMonitor] Native Go Agent attached to %s!", serviceName)
}

func generateID() uint64 {
	var b [8]byte
	rand.Read(b[:])
	return binary.BigEndian.Uint64(b[:]) & 0x7FFFFFFFFFFFFFFF
}

type traceContextKey struct{}

func StartSpanFromContext(ctx context.Context, name string) (*Span, context.Context) {
	var traceID, parentID uint64

	if parentSpan, ok := ctx.Value(traceContextKey{}).(*Span); ok {
		traceID = parentSpan.TraceID
		parentID = parentSpan.SpanID
	} else {
		traceID = generateID()
	}

	spanID := generateID()

	meta := make(map[string]string)
	for k, v := range defaultMeta {
		meta[k] = v
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	span := &Span{
		TraceID:    traceID,
		SpanID:     spanID,
		ParentID:   parentID,
		Name:       name,
		Resource:   name, // Default to name
		Service:    serviceName,
		Type:       "web",
		Start:      time.Now(),
		Meta:       meta,
		StartAlloc: m.TotalAlloc,
		Metrics:    make(map[string]float64),
	}

	return span, context.WithValue(ctx, traceContextKey{}, span)
}

func SendSpan(s *Span) {
	select {
	case spanQueue <- s:
	default:
		// spanQueue is full, drop span silently
	}
}

func startBackgroundFlusher() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	var batch []DatadogSpan

	flush := func() {
		if len(batch) == 0 {
			return
		}

		payload := [][]DatadogSpan{batch}
		b, err := msgpack.Marshal(payload)
		if err == nil {
			req, err := http.NewRequest("POST", exporterURL, bytes.NewReader(b))
			if err == nil {
				req.Header.Set("Content-Type", "application/msgpack")
				resp, err := client.Do(req)
				if err == nil {
					resp.Body.Close()
				}
			}
		}

		batch = nil
	}

	for {
		select {
		case <-ticker.C:
			flush()
		case s, ok := <-spanQueue:
			if !ok {
				return
			}
			dd := DatadogSpan{
				TraceID:  s.TraceID,
				SpanID:   s.SpanID,
				ParentID: s.ParentID,
				Name:     s.Name,
				Resource: s.Resource,
				Service:  s.Service,
				Type:     s.Type,
				Start:    s.Start.UnixNano(),
				Duration: s.Duration.Nanoseconds(),
				Error:    s.Error,
				Meta:     s.Meta,
				Metrics:  s.Metrics,
			}
			batch = append(batch, dd)
			if len(batch) >= 100 {
				flush()
			}
		}
	}
}

func WrapHTTPHandler(next http.Handler, serviceName string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		traceIDStr := r.Header.Get("x-easymonitor-trace-id")
		parentIDStr := r.Header.Get("x-easymonitor-parent-id")

		if traceIDStr != "" && parentIDStr != "" {
			traceID, _ := strconv.ParseUint(traceIDStr, 10, 64)
			parentID, _ := strconv.ParseUint(parentIDStr, 10, 64)
			if traceID != 0 {
				parentSpan := &Span{TraceID: traceID, SpanID: parentID}
				ctx = context.WithValue(ctx, traceContextKey{}, parentSpan)
			}
		}

		span, ctx := StartSpanFromContext(ctx, "http.server.request")
		span.Resource = r.Method + " " + scrubURL(r.URL.Path)
		span.SetTag("http.method", r.Method)
		span.SetTag("http.url", scrubURL(r.URL.String()))

		defer span.Finish()
		defer func() {
			if err := recover(); err != nil {
				span.Error = 1
				span.SetTag("error.message", fmt.Sprintf("%v", err))
				span.SetTag("error.type", "panic")

				stack := debug.Stack()
				stackStr := string(stack)
				if len(stackStr) > 2000 {
					stackStr = stackStr[:2000] + "... (truncated)"
				}
				span.SetTag("error.stack", stackStr)

				panic(err)
			}
		}()

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Transport wraps an existing http.RoundTripper to capture and inject spans
type Transport struct {
	Base http.RoundTripper
}

func (t *Transport) RoundTrip(req *http.Request) (*http.Response, error) {
	span, ctx := StartSpanFromContext(req.Context(), "http.client.request")
	span.Resource = req.Method + " " + scrubURL(req.URL.Path)
	span.SetTag("http.method", req.Method)
	span.SetTag("http.url", scrubURL(req.URL.String()))

	// Inject trace context headers
	req.Header.Set("x-easymonitor-trace-id", strconv.FormatUint(span.TraceID, 10))
	req.Header.Set("x-easymonitor-parent-id", strconv.FormatUint(span.SpanID, 10))

	// Re-assign context
	req = req.WithContext(ctx)

	base := t.Base
	if base == nil {
		base = http.DefaultTransport
	}

	resp, err := base.RoundTrip(req)

	if err != nil {
		span.Error = 1
		span.SetTag("error.message", err.Error())
	} else if resp != nil {
		span.SetTag("http.status_code", strconv.Itoa(resp.StatusCode))
		if resp.StatusCode >= 400 {
			span.Error = 1
		}
	}

	span.Finish()
	return resp, err
}

// WrapHTTPClient wraps an existing *http.Client's Transport
func WrapHTTPClient(client *http.Client) *http.Client {
	if client.Transport == nil {
		client.Transport = &Transport{Base: http.DefaultTransport}
	} else if _, ok := client.Transport.(*Transport); !ok {
		client.Transport = &Transport{Base: client.Transport}
	}
	return client
}

// ----------------------------------------------------------------------------
// SLOG CONTEXT HANDLER (UDP GELF)
// ----------------------------------------------------------------------------

var gelfConn *net.UDPConn

type traceSlogHandler struct {
	slog.Handler
}

func (t *traceSlogHandler) Handle(ctx context.Context, r slog.Record) error {
	levelStr := 6
	switch r.Level {
	case slog.LevelDebug:
		levelStr = 7
	case slog.LevelInfo:
		levelStr = 6
	case slog.LevelWarn:
		levelStr = 4
	case slog.LevelError:
		levelStr = 3
	}

	payload := map[string]interface{}{
		"version":       "1.1",
		"host":          "local",
		"short_message": r.Message,
		"timestamp":     float64(r.Time.UnixNano()) / 1e9,
		"level":         levelStr,
		"_service":      serviceName,
	}

	if span, ok := ctx.Value(traceContextKey{}).(*Span); ok && span != nil {
		// Log string is NOT modified natively, but trace metadata is injected into the GELF datagram
		payload["_trace_id"] = fmt.Sprintf("%016x", span.TraceID)
		payload["_span_id"] = fmt.Sprintf("%016x", span.SpanID)
	}

	if gelfConn != nil {
		if b, err := json.Marshal(payload); err == nil {
			gelfConn.Write(b)
		}
	}

	return t.Handler.Handle(ctx, r)
}

func (t *traceSlogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &traceSlogHandler{Handler: t.Handler.WithAttrs(attrs)}
}

func (t *traceSlogHandler) WithGroup(name string) slog.Handler {
	return &traceSlogHandler{Handler: t.Handler.WithGroup(name)}
}

// NewTraceSlogHandler wraps an existing slog.Handler to flawlessly pipe EasyMonitor Trace/Span IDs over UDP.
// Usage: slog.SetDefault(slog.New(telemetry.NewTraceSlogHandler(slog.Default().Handler())))
func NewTraceSlogHandler(h slog.Handler) slog.Handler {
	return &traceSlogHandler{Handler: h}
}
