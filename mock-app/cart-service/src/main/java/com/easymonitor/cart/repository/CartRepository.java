package com.easymonitor.cart.repository;

import com.easymonitor.cart.domain.CartCart;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartRepository extends JpaRepository<CartCart, String> {
}
