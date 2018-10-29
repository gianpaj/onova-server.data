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

    Seller ->>    Onova: Confirms
    Onova  ->>  Onova: Product marked as 'sold'
    Onova  ->>  Onova:    UAPAY Deal is confirmed
    Note right of Seller: Order 'confirmed'

    Onova   ->> Seller: The tracking number is retrieved (Send system message)
    Note over Seller:  Goes to Novaposhta and ships the item.
    Onova ->>   Buyer:  Order is 'shipped' (Send system message)
    
    opt Fail to ship
        Note over Seller:  Fails to ship in 2 days (Send system message)
        Onova  ->>  Onova: Order is: 'failed_by_seller'
        Onova -->>  Onova: UAPay Deal is refused
        Onova -->>  Buyer: Request Buyer to review?
    end
            Onova  ->>  Onova: Order is: 'delivered'
    Onova  ->>  Buyer:   Delivered.  (Send system message)
    Buyer -->> Seller:   Collects  (Send system message)
    Onova  ->>  Seller:  Seller is paid (notif. Seller)
    Onova  ->>  Onova:   Order is: 'completed'
    Onova -->>  Buyer:   Request Buyer to review
    Onova -->>  Seller:  Request Seller to review
    opt Fail to collect
        Note over Buyer:    Fails to collect in 5 days  (notif. Seller & Buyer)
        Onova  ->>  Onova:  Order is: 'failed_by_buyer'
        Onova -->>  Buyer:  Charge Buyer for two-way shipping?
        Onova -->>  Buyer:  Refunds Buyer
        Onova -->>  Seller: Request Seller to review
    end
    opt Item is not as described
        Note over Buyer:    Refuses item (not as described) (notif. Seller)
        Onova  ->>  Onova:  Order is: 'failed_by_seller'
        Onova -->>  Buyer:  Charge Buyer for one-way shipping
        Onova -->>  Seller: Charge Seller for one-way shipping
        Onova -->>  Buyer:  Request Buyer to review
        Onova -->>  Seller: Request Seller to review
    end
```

## Status updates and system messages:

| Order status        | Send push notif. to | Send review reminder to | Send system message? | Notes                                              | Refunds / Payments notes                              |
| ------------------- | ------------------- | ----------------------- | -------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `pending`           | _nobody_            | _none_                  | _n/a_                |                                                    |                                                       |
| `cancelled`         | _nobody_            | _none_                  | _n/a_                | Buyer cancels before paying or doesn't pay in time |                                                       |
| `paid`              | seller              | _none_                  | _n/a_                |                                                    | Buyer pays item price + shipping fee                  |
| `failed_by_seller`  | buyer (TODO)        | buyer?                  | _n/a_                | Fails to confirm                                   | Buyer gets 100% back?                                 |
| `cancelled`         | buyer (TODO)        | _none_                  | _n/a_                | Seller cancels with a reason                       | Buyer gets 100% back?                                 |
| `confirmed`         | _nobody_            | _none_                  | yes                  | Includes tracking number                           |                                                       |
| `shipped`           | _nobody_            | _none_                  | yes (TODO)           |                                                    |                                                       |
| `failed_by_seller`  | ?                   | buyer?                  | yes?                 | Fails to ship                                      | Buyer gets 100% back?                                 |
| `delivered` (TODO?) |                     | _none_                  | yes (TODO)           |                                                    |                                                       |
| `completed`         | _nobody_            | buyer + seller          | yes (TODO)           | Buyer collected the item :tada:                    | Seller gets paid = item price - UAPay fee - Onova fee |
| `failed_by_buyer`   | seller?             | buyer? + seller         | no?                  | Failed to collect                                  | Seller pays for two-way shipping?                     |
| `failed_by_seller`  | seller?             | buyer + seller          | no?                  | Refuses item (not as described)                    | Seller pays for two-way shipping?                     |

## Notes

- Onova is here also UAPAY and Novaposhta