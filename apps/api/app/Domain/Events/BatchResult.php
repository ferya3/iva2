<?php

namespace App\Domain\Events;

final readonly class BatchResult
{
    public function __construct(
        public string $batchId,
        public int $accepted,
        public bool $duplicate,
        public int $lastSequence,
        public bool $sessionCompleted = false,
    ) {}

    /** Wire format: EventBatchAck in packages/shared-types. */
    public function toArray(): array
    {
        return [
            'batch_id' => $this->batchId,
            'accepted' => $this->accepted,
            'duplicate' => $this->duplicate,
            'last_sequence' => $this->lastSequence,
        ];
    }
}
