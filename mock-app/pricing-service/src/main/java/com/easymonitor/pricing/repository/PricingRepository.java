package com.easymonitor.pricing.repository;

import com.easymonitor.pricing.domain.PricingPricing;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PricingRepository extends JpaRepository<PricingPricing, String> {
}
