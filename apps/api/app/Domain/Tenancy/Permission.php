<?php

namespace App\Domain\Tenancy;

/** Mirrors Permission in packages/shared-types/src/roles.ts. */
enum Permission: string
{
    case TenantManage = 'tenant.manage';
    case MembersManage = 'members.manage';
    case PatientsView = 'patients.view';
    case PatientsManage = 'patients.manage';
    case SessionsView = 'sessions.view';
    case SessionsManage = 'sessions.manage';
    case ReportsView = 'reports.view';
    case ReportsGenerate = 'reports.generate';
    case BillingManage = 'billing.manage';
}
