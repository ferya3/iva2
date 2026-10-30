<?php

namespace App\Domain\Reports;

use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Prints HTML to PDF with headless Chromium — the same engine that renders
 * the clinic panel, so Persian shaping, RTL and fonts match on screen and
 * on paper.
 */
final class ChromiumPdfRenderer implements PdfRenderer
{
    public function __construct(
        private readonly string $binary,
        private readonly int $timeout,
    ) {}

    public function render(string $html): string
    {
        $dir = sys_get_temp_dir().'/cognitest-pdf-'.bin2hex(random_bytes(8));
        if (! mkdir($dir, 0700) && ! is_dir($dir)) {
            throw new RuntimeException("Cannot create {$dir}");
        }
        $source = "{$dir}/report.html";
        $target = "{$dir}/report.pdf";
        file_put_contents($source, $html);

        try {
            // chrome-headless-shell (preferred in containers) is headless by
            // construction and rejects the --headless switch.
            $headless = str_contains(basename($this->binary), 'headless') ? [] : ['--headless=new'];
            $result = Process::timeout($this->timeout)->run([
                $this->binary,
                ...$headless,
                '--no-sandbox',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-component-update',
                '--disable-sync',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--no-pdf-header-footer',
                '--user-data-dir='.$dir.'/profile',
                '--print-to-pdf='.$target,
                'file://'.$source,
            ]);
            if (! is_file($target) || filesize($target) === 0) {
                throw new RuntimeException('Chromium did not produce a PDF: '.trim($result->errorOutput()));
            }

            return file_get_contents($target);
        } finally {
            Process::run(['rm', '-rf', $dir]);
        }
    }
}
