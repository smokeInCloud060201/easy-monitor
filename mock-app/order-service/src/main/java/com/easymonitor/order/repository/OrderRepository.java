package com.easymonitor.order.repository;

import com.easymonitor.order.domain.OrderOrder;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<OrderOrder, String> {
}
