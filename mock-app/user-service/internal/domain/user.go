package domain

type User struct {
	ID         string `json:"id" gorm:"primaryKey"`
	Name       string `json:"name"`
	Stock      int    `json:"stock"`
	PriceRange string `json:"price_range"`
	Users   int    `json:"user_count"`
}
