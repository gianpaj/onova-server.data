# Order Process

Rules:

- Buyer needs to pay immediately. The product is not reserved when he/she presses Buy
- We're not requesting funds to be frozen until the Seller confirms

```mermaid
sequenceDiagram
    Buyer  ->>  Seller:   Press Buy. 'pending' (no notifications)
    Note right of Seller: Product still 'forsale'

    opt Fail to confirm
        Note over Seller:  Fails to confirm (notif. Seller & Buyer)
        Onova  ->>  Onova: Order is: 'failed_by_seller'. (first warning?)
    end
    opt Seller Cancels
        Seller ->>  Buyer:    Cancels (notif. Buyer)
        Note right of Seller: Requires reason.
        Onova  ->>  Onova:    Order is: 'cancelled'
        Onova -->>  Buyer:    Refunds Buyer (TODO)
    end
    opt Buyer Cancels
        Buyer ->>   Seller: Cancels (no notifications)
        Onova  ->>  Onova:  Order is: 'cancelled'
    end

    Buyer  ->>  Onova: Pays with UAPay/LiqPay.
    Onova  ->>  Onova: Product marked as 'sold'
    Onova  ->>  Seller: Order is 'paid' (notif. Seller)

    Seller ->>    Buyer: Confirms (notif. Buyer)
    Note right of Buyer: Order 'confirmed'

    %% opt Fail to ship
    %%     Note over   Buyer: Fails to pay (n)
    %%     Onova  ->>  Onova: Order is: 'failed_by_buyer'
    %%     Onova  ->>  Onova: If left unpaid the Product returns to 'forsale' after X hours or after Y mins if payment fails.
    %% end

    Onova   ->> Seller: The tracking number is generated (TODO)
    Seller ->>  Onova:  Goes to Novaposhta and ships the item.
    Onova ->>   Buyer:  Order is 'shipped'  (notif. Buyer)
    opt Fail to ship
        Note over Seller:  Fails to ship in 2 days (notif. Seller & Seller)
        Onova  ->>  Onova: Order is: 'failed_by_seller'
        Onova -->>  Buyer: Refunds Buyer (TODO)
        Onova -->>  Buyer: Request Buyer to review (TODO)
    end
    Onova  ->>  Buyer:   Delivered.  (notif. Buyer & Seller)
    Buyer -->> Seller:   Collects (notif. Seller)
    Onova  ->>  Seller:  Pay.  (notif. Seller)
    Onova  ->>  Onova:   Order is: 'completed'
    Onova -->>  Buyer:   Request Buyer to review (TODO)
    Onova -->>  Seller:  Request Seller to review (TODO)
    opt Fail to collect
        Note over Buyer:    Fails to collect in 5 days  (notif. Seller & Buyer)
        Onova  ->>  Onova:  Order is: 'failed_by_buyer'
        Onova -->>  Buyer:  Charge Buyer for two-way shipping (TODO)
        Onova -->>  Buyer:  Refunds Buyer (TODO)
        Onova -->>  Seller: Request Seller to review (TODO)
    end
    opt Item is not as described
        Note over Buyer:    Refuses item (not as described) (notif. Seller)
        Onova  ->>  Onova:  Order is: 'failed_by_seller'
        Onova -->>  Buyer:  Charge Buyer for one-way shipping (TODO)
        Onova -->>  Seller: Charge Seller for one-way shipping (TODO)
        Onova -->>  Buyer:  Request Buyer to review (TODO)
        Onova -->>  Seller: Request Seller to review (TODO)
    end
```

## Legend

- Onova is here also UAPAY and Novaposhta