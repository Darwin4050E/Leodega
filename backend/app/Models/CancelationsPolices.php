<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CancelationsPolices extends Model
{
    //
    use HasFactory;

    protected $table = 'cancelations_polices';

    protected $fillable = [
        'landlord_id',
        'policy_name',
        'description',
        'is_default',
    ];

    public function landlord()
    {
        return $this->belongsTo(Landlords::class, 'landlord_id');
    }
}
