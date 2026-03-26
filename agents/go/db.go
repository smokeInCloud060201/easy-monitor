package telemetry

import (
	"context"
	"database/sql"
	"regexp"
)

var sqlObfuscator = regexp.MustCompile(`(['"]).*?\1|(\b\d+\b)`)

func ObfuscateSQL(query string) string {
	return sqlObfuscator.ReplaceAllString(query, "?")
}

type DB struct {
	*sql.DB
}

func WrapDB(db *sql.DB) *DB {
	return &DB{DB: db}
}

func (db *DB) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	span, ctx := StartSpanFromContext(ctx, "db.query")
	span.SetTag("db.system", "sql")
	span.SetTag("db.statement", query)
	span.SetTag("db.query", ObfuscateSQL(query))
	span.Type = "sql"

	rows, err := db.DB.QueryContext(ctx, query, args...)
	if err != nil {
		span.Error = 1
		span.SetTag("error.message", err.Error())
	}
	span.Finish()
	return rows, err
}

func (db *DB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	span, ctx := StartSpanFromContext(ctx, "db.execute")
	span.SetTag("db.system", "sql")
	span.SetTag("db.statement", query)
	span.SetTag("db.query", ObfuscateSQL(query))
	span.Type = "sql"

	result, err := db.DB.ExecContext(ctx, query, args...)
	if err != nil {
		span.Error = 1
		span.SetTag("error.message", err.Error())
	}
	span.Finish()
	return result, err
}

func (db *DB) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	span, _ := StartSpanFromContext(ctx, "db.query")
	span.SetTag("db.system", "sql")
	span.SetTag("db.statement", query)
	span.SetTag("db.query", ObfuscateSQL(query))
	span.Type = "sql"

	row := db.DB.QueryRowContext(ctx, query, args...)
	
	span.Finish()
	return row
}
