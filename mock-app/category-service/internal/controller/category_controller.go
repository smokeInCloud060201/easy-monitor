package controller

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"

	"github.com/easymonitor/category-service/internal/service"
)

type CategoryController struct {
	svc *service.CategoryService
}

func NewCategoryController(svc *service.CategoryService) *CategoryController {
	return &CategoryController{svc: svc}
}

func (c *CategoryController) HandleGetCategory(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/category/"), "/")
	categoryID := parts[0]
	if categoryID == "" || categoryID == "search" {
		return
	}

	cat, _, _ := c.svc.GetCategory(r.Context(), categoryID)

	if rand.Float64() < 0.05 {
		slog.Error(fmt.Sprintf("Stock unavailable for %s", categoryID))
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "Stock unavailable", "category": categoryID})
		return
	}

	if cat != nil {
		cat.Products = rand.Intn(50) + 10
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cat)
}

func (c *CategoryController) HandleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results, _ := c.svc.SearchCategories(r.Context(), q)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"results": results, "total": len(results)})
}

func (c *CategoryController) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "category-service"})
}
