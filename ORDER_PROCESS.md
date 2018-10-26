# Order Process

Rules:

- The product is reserved when buyer presses Buy
- The buyer has 15 minutes to make payment
- The seller then has 48 hours to confirm order
- The seller has 2? days to ship order
- The buyer has 5? days to collect package after is delivered

```mermaid
sequenceDiagram
    Buyer  ->>  Seller:   Press Buy. 'pending' (no notifications)
    Note right of Seller: Product 'reserved'

    opt Buyer Cancels
        Note right of Seller: Product 'forsale'
        Buyer ->>   Seller: Cancels (no notifications)
        Onova  ->>  Onova:  Order is: 'cancelled'
    end
    
    Buyer  ->>  Onova: Pays with UAPay/LiqPay.
    Onova  ->>  Seller: Order is 'paid' (notif. Seller)

    opt Fail to confirm
        Note over Seller:  Fails to confirm (notif. Seller & Buyer)
        Onova  ->>  Onova: Order is: 'failed_by_seller'. (first warning?)
    end
    opt Seller Cancels
        Seller ->>  Buyer:    Cancels (notif. Buyer)
        Note right of Seller: Requires reason.
        Onova  ->>  Onova:    Order is: 'cancelled'
        Onova  ->>  Onova:    UAPAY Deal is refused
    end

    Onova  ->>  Onova: Product marked as 'sold'

    Seller ->>    Onova: Confirms
    Onova  ->>  Onova:    UAPAY Deal is confirmed
    Note right of Seller: Order 'confirmed'

    Onova   ->> Seller: The tracking number is retrieved (Send system message)
    Note over Seller:  Goes to Novaposhta and ships the item.
    Onova ->>   Buyer:  Order is 'shipped' (Send system message)
    
    opt Fail to ship
        Note over Seller:  Fails to ship in 2 days (Send system message)
        Onova  ->>  Onova: Order is: 'failed_by_seller'
        Onova -->>  Onova: UAPAY Deal is refused (TODO)
        Onova -->>  Buyer: Request Buyer to review? (TODO)
    end
    Onova  ->>  Buyer:   Delivered.  (Send system message)
    Buyer -->> Seller:   Collects  (Send system message)
    Onova  ->>  Seller:  Pay.   (Send system message)
    Onova  ->>  Onova:   Order is: 'completed'
    Onova -->>  Buyer:   Request Buyer to review (TODO)
    Onova -->>  Seller:  Request Seller to review (TODO)
    opt Fail to collect
        Note over Buyer:    Fails to collect in 5 days  (notif. Seller & Buyer)
        Onova  ->>  Onova:  Order is: 'failed_by_buyer'
        Onova -->>  Buyer:  Charge Buyer for two-way shipping? (TODO)
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