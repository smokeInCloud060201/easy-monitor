package controller

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"

	"github.com/easymonitor/user-service/internal/service"
)

type UserController struct {
	svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
	return &UserController{svc: svc}
}

func (c *UserController) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/user/"), "/")
	userID := parts[0]
	if userID == "" || userID == "search" {
		return
	}

	cat, _, _ := c.svc.GetUser(r.Context(), userID)

	if rand.Float64() < 0.05 {
		slog.Error(fmt.Sprintf("Stock unavailable for %s", userID))
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "Stock unavailable", "user": userID})
		return
	}

	if cat != nil {
		cat.Users = rand.Intn(50) + 10
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cat)
}

func (c *UserController) HandleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results, _ := c.svc.SearchCategories(r.Context(), q)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"results": results, "total": len(results)})
}

func (c *UserController) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "user-service"})
}
