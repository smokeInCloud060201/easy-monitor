package com.easymonitor.checkout.repository;

import com.easymonitor.checkout.domain.CheckoutOrder;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<CheckoutOrder, String> {
}
