<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reports extends Model
{
    //
    use HasFactory;

    protected $table = 'reports';

    protected $fillable = [
        'user_id',
        'store_id',
        'reported_user_id',
        'title',
        'priority',
        'report_type',
        'description',
        'status',
    ];

    public function evidences()
    {
        return $this->hasMany(ReportEvidences::class, 'report_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reportedUser()
    {
        return $this->belongsTo(User::class, 'reported_user_id');
    }

    public function store()
    {
        return $this->belongsTo(StoreRooms::class, 'store_id');
    }
}
