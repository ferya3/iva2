# Alerting baseline

| Signal                                            | Threshold        | Why                                                     |
| ------------------------------------------------- | ---------------- | ------------------------------------------------------- |
| Horizon `scoring` queue wait                      | > 5 min          | Sessions stay in COMPLETED; clinicians wait for results |
| Failed jobs (`failed_jobs`)                       | any new          | Scoring/PDF failures need a human                       |
| HTTP 5xx rate (nginx)                             | > 1 % over 5 min | API health                                              |
| `sequence_conflict` / `batch_id_reused` responses | spike            | Player bug or tampering                                 |
| PostgreSQL replication / backup age               | > 26 h           | Backup policy breach                                    |
| Disk usage                                        | > 80 %           | Raw events grow ~1–2 MB per session incl. indexes       |
| TLS certificate expiry                            | < 14 days        | —                                                       |
