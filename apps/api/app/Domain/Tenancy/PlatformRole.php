<?php

namespace App\Domain\Tenancy;

enum PlatformRole: string
{
    case SuperAdmin = 'super_admin';
    case Support = 'support';
}
