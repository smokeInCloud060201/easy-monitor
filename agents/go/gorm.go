package telemetry

import (
	"gorm.io/gorm"
)

const spanKey = "easymonitor:span"

type GormTracer struct{}

func (t *GormTracer) Name() string { return "easymonitor-tracer" }
func (t *GormTracer) Initialize(db *gorm.DB) error {
	db.Callback().Create().Before("gorm:create").Register("easymonitor:before_create", t.before)
	db.Callback().Create().After("gorm:create").Register("easymonitor:after_create", t.after)
	
	db.Callback().Query().Before("gorm:query").Register("easymonitor:before_query", t.before)
	db.Callback().Query().After("gorm:query").Register("easymonitor:after_query", t.after)

	db.Callback().Update().Before("gorm:update").Register("easymonitor:before_update", t.before)
	db.Callback().Update().After("gorm:update").Register("easymonitor:after_update", t.after)

	db.Callback().Delete().Before("gorm:delete").Register("easymonitor:before_delete", t.before)
	db.Callback().Delete().After("gorm:delete").Register("easymonitor:after_delete", t.after)
	
	db.Callback().Row().Before("gorm:row").Register("easymonitor:before_row", t.before)
	db.Callback().Row().After("gorm:row").Register("easymonitor:after_row", t.after)
	
	db.Callback().Raw().Before("gorm:raw").Register("easymonitor:before_raw", t.before)
	db.Callback().Raw().After("gorm:raw").Register("easymonitor:after_raw", t.after)
	
	return nil
}

func (t *GormTracer) before(db *gorm.DB) {
	if db.Statement == nil || db.Statement.Context == nil {
		return
	}
	span, _ := StartSpanFromContext(db.Statement.Context, "db.query")
	span.SetTag("db.system", "sql")
	span.Type = "sql"
	db.InstanceSet(spanKey, span)
}

func (t *GormTracer) after(db *gorm.DB) {
	if db.Statement == nil || db.Statement.Context == nil {
		return
	}
	
	val, ok := db.InstanceGet(spanKey)
	if !ok {
		return
	}
	span, ok := val.(*Span)
	if !ok || span == nil {
		return
	}
	
	query := db.Statement.SQL.String()
	if query == "" {
		query = db.Statement.Table
	}
	span.SetTag("db.statement", query)
	span.SetTag("db.query", ObfuscateSQL(query))
	
	if db.Error != nil {
		span.Error = 1
		span.SetTag("error.message", db.Error.Error())
	}
	
	span.Finish()
}
