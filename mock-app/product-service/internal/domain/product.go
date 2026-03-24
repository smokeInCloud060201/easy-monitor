package domain

type Product struct {
	ID         string `json:"id" gorm:"primaryKey"`
	Name       string `json:"name"`
	Stock      int    `json:"stock"`
	PriceRange string `json:"price_range"`
	Products   int    `json:"product_count"`
}
