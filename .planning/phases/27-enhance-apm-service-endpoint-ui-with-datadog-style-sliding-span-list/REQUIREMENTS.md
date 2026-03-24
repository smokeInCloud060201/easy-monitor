# Phase 27 Requirements

## User Request
Enhance APM service endpoint section. The endpoint section has the correct logic, however we need to improve the UX UI.

- When clicking into an endpoint to see the span list, we will **not** open the dropdown.
- Instead, from the right screen we open a menubar sliding from right to left.
- In this menu bar, we show the spanlist.

The span list web UI layout will be exactly the same as Datadog's waterfall view. 

## Mockup / Layout Reference

```text
[ Client ]
    |
    | POST /v1/transaction/submit
    v

---------------------------------------------------------------------------------------------------------
| Service / Operation                                      | Duration | Exec Time | % Exec Time         |
---------------------------------------------------------------------------------------------------------
| caspersky-sit-run-2                                      | 13.4s    | 183ms     | 2.94%               |
|-------------------------------------------------------------------------------------------------------|
| └── servlet.request POST /v1/transaction/submit          | 6.21s    | 3.14ms    | <0.1%              |
|     └── TransactionController.submit                     | 6.21s    | 109ms     | 1.75%              |
|         |
|         |--- Repository Layer -------------------------------------------------------------------------|
|         |   ├── findDuplicateApplication                  | 860ms    | 8.60ms    | 0.14%              |
|         |   ├── findByComAppl                            | 39.7ms   | 8.46ms    | 0.14%              |
|         |   ├── PaymentMetadataRepository.save           | 9.05ms   | 1.66ms    | <0.1%              |
|         |   ├── TransactionRepository.save               | 8.16ms   | 3.15ms    | <0.1%              |
|         |   ├── CommercialApplicationRepository.findById | 7.16ms   | 3.48ms    | <0.1%              |
|         |   ├── TransactionRepository.findById           | 4.48ms   | 1.20ms    | <0.1%              |
|         |   └── TransactionRepository.findById           | 4.04ms   | 1.77ms    | <0.1%              |
|         |
|         |--- External APIs ----------------------------------------------------------------------------|
|         |   ├── GET /api/v10/getpublicholiday             | 34.6ms   | 24.6ms    | 0.40%              |
|         |   ├── GET /adminservice/loadholidays            | 22.8ms   | 8.75ms    | 0.14%              |
|         |   ├── GET /api/v10/getspecialholiday            | 13.2ms   | 3.87ms    | <0.1%              |
|         |   ├── GET /api/v10/getspecialholiday            | 12.0ms   | 2.99ms    | <0.1%              |
|         |   └── GET /api/v10/getblockout                  | 11.3ms   | 2.58ms    | <0.1%              |
|         |
|         |--- Downstream Services ----------------------------------------------------------------------|
|         |   ├── userprofile                              | 886ms    | 886ms     | 14.3%              |
|         |   │    └── userprofile-service                 | 228ms    | 228ms     | 3.67%              |
|         |   |
|         |   ├── p1qixapi.sap.local                       | 4.67s    | 4.67s     | 75.2%  ⚠️          |
|         |   |
|         |   ├── spdiredisq2.sap.local                    | 18.0ms   | 18.0ms    | 0.29%              |
|         |   │    ├── HGETALL                             | 3.28ms   | 3.28ms    | <0.1%              |
|         |   │    ├── DEL                                 | 2.93ms   | 2.93ms    | <0.1%              |
|         |   │    ├── DEL                                 | 2.75ms   | 2.75ms    | <0.1%              |
|         |   │    ├── HMSET                               | 2.39ms   | 2.39ms    | <0.1%              |
|         |   │    ├── HGETALL                             | 2.27ms   | 2.27ms    | <0.1%              |
|         |   │    ├── HMSET                               | 2.26ms   | 2.26ms    | <0.1%              |
|         |   │    └── SADD                                | 2.07ms   | 2.07ms    | <0.1%              |
|         |   |
|         |   └── fileoperation-service                    | 176ms    | 176ms     | 2.83%              |
|         |        └── POST /UpdateTempOnlineApplication   | 176ms    | 176ms     | 2.83%              |
|
|--- Other Services ------------------------------------------------------------------------------------|
|   ├── admin-service-master                             | 94.6ms   | 39.5ms    | 0.64%              |
|   └── admin                                            | 11.6ms   | 11.6ms    | 0.19%              |
---------------------------------------------------------------------------------------------------------
```
