package telemetry

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/vmihailenco/msgpack/v5"
)

type Span struct {
	TraceID  uint64
	SpanID   uint64
	ParentID uint64
	Name     string
	Resource string
	Service  string
	Start    time.Time
	Duration time.Duration
	Error    int32
	Meta     map[string]string
	Metrics  map[string]float64
}

func (s *Span) Finish() {
	s.Duration = time.Since(s.Start)
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
)

func Init(service string) {
	serviceName = service
	client = &http.Client{Timeout: 5 * time.Second}
	log.Printf("  [EasyMonitor] Native Go Agent attached to %s!", serviceName)
}

func generateID() uint64 {
	var b [8]byte
	rand.Read(b[:])
	return binary.BigEndian.Uint64(b[:])
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

	span := &Span{
		TraceID:  traceID,
		SpanID:   generateID(),
		ParentID: parentID,
		Name:     name,
		Resource: name,
		Service:  serviceName,
		Start:    time.Now(),
		Meta:     make(map[string]string),
		Metrics:  make(map[string]float64),
	}

	return span, context.WithValue(ctx, traceContextKey{}, span)
}

func SendSpan(s *Span) {
	dd := DatadogSpan{
		TraceID:  s.TraceID,
		SpanID:   s.SpanID,
		ParentID: s.ParentID,
		Name:     s.Name,
		Resource: s.Resource,
		Service:  s.Service,
		Type:     "web",
		Start:    s.Start.UnixNano(),
		Duration: s.Duration.Nanoseconds(),
		Error:    s.Error,
		Meta:     s.Meta,
		Metrics:  s.Metrics,
	}

	payload := [][]DatadogSpan{{dd}}
	
	// Batching is omitted in this simple native client for brevity, but easily added
	go func() {
		b, err := msgpack.Marshal(payload)
		if err != nil {
			return
		}
		
		req, err := http.NewRequest("POST", exporterURL, bytes.NewReader(b))
		if err != nil { return }
		
		req.Header.Set("Content-Type", "application/msgpack")
		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
}

func WrapHTTPHandler(next http.Handler, serviceName string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		span, ctx := StartSpanFromContext(r.Context(), "http.request")
		span.Resource = r.Method + " " + r.URL.Path
		span.SetTag("http.method", r.Method)
		span.SetTag("http.url", r.URL.String())
		
		defer span.Finish()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
