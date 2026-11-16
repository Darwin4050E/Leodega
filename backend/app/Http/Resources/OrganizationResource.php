<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An organization as seen by one member: expects the model to be loaded
 * through User::organizations() so `pivot` carries that user's role.
 * `logo_path` is never exposed; `logo` is a ready-to-use absolute URL
 * (asset('storage/...'), the repo convention for public-disk images) or null.
 */
class OrganizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'ruc' => $this->ruc,
            'email' => $this->email,
            'logo' => $this->logo_path ? asset('storage/'.$this->logo_path) : null,
            'status' => $this->status,
            'role' => $this->pivot->role,
        ];
    }
}
