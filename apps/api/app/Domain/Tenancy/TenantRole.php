<?php

namespace App\Domain\Tenancy;

enum TenantRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Clinician = 'clinician';
    case Assistant = 'assistant';

    /** Default permission sets; seeded into roles/permissions tables. */
    public function defaultPermissions(): array
    {
        $all = array_map(fn (Permission $p) => $p->value, Permission::cases());

        return match ($this) {
            self::Owner => $all,
            self::Admin => array_values(array_diff($all, [Permission::BillingManage->value])),
            self::Clinician => [
                Permission::PatientsView->value, Permission::PatientsManage->value,
                Permission::SessionsView->value, Permission::SessionsManage->value,
                Permission::ReportsView->value, Permission::ReportsGenerate->value,
            ],
            self::Assistant => [
                Permission::PatientsView->value, Permission::PatientsManage->value,
                Permission::SessionsView->value, Permission::SessionsManage->value,
            ],
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'مالک',
            self::Admin => 'مدیر کلینیک',
            self::Clinician => 'متخصص',
            self::Assistant => 'دستیار',
        };
    }
}
