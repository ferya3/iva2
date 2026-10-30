<?php

namespace App\Domain\Reports;

interface PdfRenderer
{
    /** Renders a self-contained HTML document to PDF bytes. */
    public function render(string $html): string;
}
