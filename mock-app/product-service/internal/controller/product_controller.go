package controller

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"

	"github.com/easymonitor/product-service/internal/service"
)

type ProductController struct {
	svc *service.ProductService
}

func NewProductController(svc *service.ProductService) *ProductController {
	return &ProductController{svc: svc}
}

func (c *ProductController) HandleGetProduct(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/product/"), "/")
	productID := parts[0]
	if productID == "" || productID == "search" {
		return
	}

	cat, _, _ := c.svc.GetProduct(r.Context(), productID)

	if rand.Float64() < 0.05 {
		slog.ErrorContext(r.Context(), fmt.Sprintf("Stock unavailable for %s", productID))
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "Stock unavailable", "product": productID})
		return
	}

	if cat != nil {
		cat.Products = rand.Intn(50) + 10
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cat)
}

func (c *ProductController) HandleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results, _ := c.svc.SearchCategories(r.Context(), q)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"results": results, "total": len(results)})
}

func (c *ProductController) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "product-service"})
}
