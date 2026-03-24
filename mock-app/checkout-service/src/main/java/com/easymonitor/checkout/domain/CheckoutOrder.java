package com.easymonitor.checkout.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Date;

@Entity
@Table(name = "checkout_orders")
public class CheckoutOrder implements Serializable {

    @Id
    private String id;

    private String status;
    private double total;
    private int itemCount;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    public CheckoutOrder() {}

    public CheckoutOrder(String id, String status, double total, int itemCount, Date createdAt) {
        this.id = id;
        this.status = status;
        this.total = total;
        this.itemCount = itemCount;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }

    public int getItemCount() { return itemCount; }
    public void setItemCount(int itemCount) { this.itemCount = itemCount; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
}
