<?php

namespace App\Services;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class OrganizationService
{
    /**
     * Creates the organization and enrolls the creator as its admin in ONE
     * transaction. The returned model carries the creator's `pivot`.
     *
     * The logo is written only here, after the FormRequest already passed,
     * and deleted again if the transaction fails (compensating delete, same
     * lifecycle as StoreRoomService::register), so a failed creation never
     * leaves an orphan file.
     *
     * @throws ValidationException on `ruc` when it was taken between the
     *                             request validation and the insert
     */
    public function create(User $creator, array $data, ?UploadedFile $logo = null): Organization
    {
        $path = $logo?->store('organization_logos', 'public');

        try {
            return DB::transaction(function () use ($creator, $data, $path) {
                // array_merge (not `+`) so the forced values always win over
                // anything the caller passed in $data.
                $organization = Organization::create(array_merge($data, [
                    'created_by' => $creator->id,
                    'logo_path' => $path,
                ]));

                $organization->users()->attach($creator->id, ['role' => OrganizationRole::ADMIN->value]);

                // Re-query through the user's relation so `pivot` is populated.
                return $creator->organizations()->whereKey($organization->id)->firstOrFail();
            });
        } catch (\Throwable $e) {
            if ($path) {
                Storage::disk('public')->delete($path);
            }

            throw $e instanceof UniqueConstraintViolationException
                ? ValidationException::withMessages(['ruc' => Organization::DUPLICATE_RUC_MESSAGE])
                : $e;
        }
    }
}
